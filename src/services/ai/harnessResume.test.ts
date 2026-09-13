import { afterEach, describe, expect, it, vi } from 'vitest';
import { generateAIResponseStreaming, type HarnessBridgeOptions } from './aiProxyService';
import { ChatError } from './chatErrors';
import { HARNESS_ACTION_MARKER, type HarnessAction } from '../../types/chat';
import type { WorkspaceToolExecutor } from '../agent/deviceToolRunner';

vi.mock('../../lib/supabase', () => ({
  supabase: { auth: { getSession: async () => ({ data: { session: null } }) } },
}));

const CONTROL = String.fromCharCode(0x1e);

function legResponse(body: string): Response {
  return {
    ok: true,
    body: new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(body));
        controller.close();
      },
    }),
  } as unknown as Response;
}

function deviceFrame(payload: unknown): string {
  return `${CONTROL}${JSON.stringify({ type: 'device_tool_request', payload })}\n`;
}

function failedResponse(): Response {
  return {
    ok: false,
    status: 502,
    headers: { get: () => 'application/json' },
    json: async () => ({ error: { code: 'PROVIDER_DOWN', message: 'upstream died' } }),
    text: async () => '',
  } as unknown as Response;
}

const executor: WorkspaceToolExecutor = {
  run: async (name, args) => ({ ok: true, content: `${name} ok`, path: String(args.path ?? ''), detail: 'done' }),
};

function harness(overrides: Partial<HarnessBridgeOptions> = {}): HarnessBridgeOptions {
  return {
    mode: 'auto',
    summarizeWorkspace: async () => ({ paths: [], truncated: false, runtimes: ['python'] }),
    executor,
    ...overrides,
  };
}

const readCall = (id: string) => ({ id, name: 'read_file', arguments: JSON.stringify({ path: 'a.ts', start_line: 0, end_line: 0 }) });

async function run(fetchMock: ReturnType<typeof vi.fn>, bridge: HarnessBridgeOptions) {
  const chunks: string[] = [];
  const actions: HarnessAction[] = [];
  let failure: ChatError | null = null;
  let completed: string | null = null;
  vi.stubGlobal('fetch', fetchMock);
  await generateAIResponseStreaming(
    [{ id: 'm1', content: 'build it', isAI: false }],
    undefined, '', 'pro', 'auto', undefined, undefined,
    (chunk) => { chunks.push(chunk); },
    (response) => { completed = response.content; },
    (error) => { failure = error as ChatError; },
    undefined, undefined, undefined, undefined,
    undefined, undefined, undefined, undefined, 'session-1', undefined, undefined,
    { deviceApps: ['workspace', 'python'], currentChatSessionId: 'session-1', harness: { ...bridge, onAction: (action) => { actions.push(action); } } },
  );
  return { chunks, actions, failure: failure as ChatError | null, completed: completed as string | null, fetchMock };
}

describe('a Max Mode leg that fails keeps the legs before it', () => {
  afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });

  it('reports the completed legs, cards and transcript with the failure', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(legResponse(
        'Reading the entry point.'
        + deviceFrame({ assistantContent: 'Reading the entry point.', toolCalls: [readCall('call-1')], resolvedResults: [], deviceRounds: 1 })
        + '[STATUS_END]',
      ))
      // Leg 2 never opens: the provider is down, and the retries inside the
      // transport are exhausted the same way.
      .mockResolvedValue(failedResponse());

    const { chunks, actions, failure, completed, fetchMock: calls } = await run(fetchMock, harness());

    expect(completed).toBeNull();
    expect(failure).toBeInstanceOf(ChatError);
    expect(failure!.code).toBe('PROVIDER_DOWN');
    // The text the user already saw, marker included, travels with the error.
    const shown = chunks.join('');
    expect(shown).toContain('Reading the entry point.');
    expect(shown.split(HARNESS_ACTION_MARKER)).toContain('call-1');
    expect(failure!.partialContent).toBe(shown);
    // And enough to continue: the transcript of leg 1 and the rounds spent.
    expect(failure!.resume?.deviceRounds).toBe(1);
    expect(failure!.resume?.toolTranscript.map(entry => entry.role)).toEqual(['assistant', 'tool']);
    expect(failure!.resume?.content).toBe(shown);
    expect(actions.map(action => action.status)).toEqual(['running', 'done']);
    expect(calls.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it('a resumed turn starts from the failed leg, not from the user message', async () => {
    const resume = {
      deviceRounds: 1,
      content: 'Reading the entry point.\n\n⿦tm-action:call-1⿧\n\n',
      toolTranscript: [
        { role: 'assistant' as const, content: 'Reading the entry point.', tool_calls: [{ id: 'call-1', type: 'function', function: { name: 'read_file', arguments: '{}' } }] },
        { role: 'tool' as const, tool_call_id: 'call-1', name: 'read_file', content: 'a.ts (1 lines):\n1\tx' },
      ],
    };
    const fetchMock = vi.fn().mockResolvedValueOnce(legResponse('All done.[STATUS_END]'));

    const { chunks, completed } = await run(fetchMock, harness({ resume }));

    // One request — the leg that failed — carrying the earlier transcript.
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.deviceRounds).toBe(1);
    expect(body.toolTranscript).toEqual(resume.toolTranscript);
    expect(body.maxMode.mode).toBe('auto');
    // The user sees the earlier text again, then the new leg's.
    expect(chunks[0]).toBe(resume.content);
    expect(completed).toBe(`${resume.content}All done.`);
  });
});

describe('durable device execution receipts', () => {
  afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });
  it('checkpoints queued, uncertain, and completed outcomes before proceeding', async () => {
    const checkpoints: Array<NonNullable<HarnessBridgeOptions['resume']>> = [];
    const checkpoint = vi.fn(async state => { checkpoints.push(structuredClone(state)); });
    const execute = vi.fn(async () => {
      expect(checkpoints[checkpoints.length - 1].toolTranscript[1].content).toContain('outcome unknown');
      return { ok: true, content: 'Read the current file.' };
    });
    const fetchMock = vi.fn().mockResolvedValueOnce(legResponse(deviceFrame({ assistantContent: '', toolCalls: [readCall('c1')], resolvedResults: [], deviceRounds: 1 }) + '[STATUS_END]'))
      .mockResolvedValueOnce(legResponse('Done.[STATUS_END]'));
    const result = await run(fetchMock, harness({ executor: { run: execute }, onCheckpoint: checkpoint }));
    expect(result.completed).toContain('Done.');
    expect(checkpoints[0].toolTranscript[1].content).toContain('Not executed');
    expect(checkpoints[checkpoints.length - 1].toolTranscript[1].content).toBe('Read the current file.');
    expect(checkpoints.every(state => state.deviceRounds === 1)).toBe(true);
    expect(execute).toHaveBeenCalledTimes(1);
  });
  it('refuses to execute a tool if its receipt cannot be saved', async () => {
    const execute = vi.fn();
    const fetchMock = vi.fn().mockResolvedValueOnce(legResponse(deviceFrame({ assistantContent: '', toolCalls: [readCall('c1')], resolvedResults: [], deviceRounds: 1 }) + '[STATUS_END]'));
    const result = await run(fetchMock, harness({ executor: { run: execute }, onCheckpoint: async () => { throw new Error('Workspace storage is full'); } }));
    expect(result.failure?.message).toContain('Workspace storage is full');
    expect(result.failure?.resume?.toolTranscript[1].content).toContain('Not executed');
    expect(execute).not.toHaveBeenCalled();
  });
});

it.each([
  { rounds: 0, calls: [readCall('c1')] },
  { rounds: 1, calls: [readCall('same'), readCall('same')] },
])('refuses a malformed continuation before executing any tool: %j', async ({ rounds, calls }) => {
  const execute = vi.fn();
  const fetchMock = vi.fn().mockResolvedValueOnce(legResponse(deviceFrame({ assistantContent: '', toolCalls: calls, resolvedResults: [], deviceRounds: rounds }) + '[STATUS_END]'));
  const result = await run(fetchMock, harness({ executor: { run: execute } }));
  expect(result.failure?.message).toContain('continuation was invalid');
  expect(execute).not.toHaveBeenCalled();
  vi.unstubAllGlobals();
});
