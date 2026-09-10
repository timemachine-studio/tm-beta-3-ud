import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { generateAIResponseStreaming } from './aiProxyService';
import { readNotes } from '../notes/notesRepository';
import { chatService } from '../chat/chatService';
import type { AppObjectRef } from '../../types/chat';
import { DEVICE_ROUND_HARD_STOP } from '../../../shared/deviceTools';

vi.mock('../../lib/supabase', () => ({
  supabase: { auth: { getSession: async () => ({ data: { session: null } }) } },
}));

/** The wire prefix for an out-of-band JSON frame (CONTROL_FRAME_PREFIX). */
const CONTROL = String.fromCharCode(0x1e);

function installStorage(initial: Record<string, string> = {}) {
  const store = new Map(Object.entries(initial));
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    writable: true,
    value: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => { store.set(key, value); },
      removeItem: (key: string) => { store.delete(key); },
      clear: () => store.clear(),
      key: () => null,
      length: 0,
    } as Storage,
  });
}

/** A /api/ai-proxy response body: the app's text + markers + control frames. */
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

describe('device tool bridge, end to end through the transport', () => {
  beforeEach(() => {
    installStorage();
    chatService.setUserId(null);
  });
  afterEach(() => { vi.restoreAllMocks(); });

  it('runs the call on the device and resumes the run with its result', async () => {
    const chunks: string[] = [];
    const statuses: string[] = [];
    const objects: AppObjectRef[] = [];
    let completed: { content: string } | null = null;

    const fetchMock = vi.fn()
      .mockResolvedValueOnce(legResponse(
        'Saving that for you.'
        + deviceFrame({
          assistantContent: 'Saving that for you.',
          toolCalls: [{
            id: 'call-1',
            name: 'notes_create',
            arguments: JSON.stringify({ title: 'Assignment', markdown: '# Jobs and Musk' }),
          }],
          resolvedResults: [],
          deviceRounds: 1,
        })
        + '[STATUS_END]',
      ))
      .mockResolvedValueOnce(legResponse('Done, it is in your notes.[STATUS_END]'));

    vi.stubGlobal('fetch', fetchMock);

    await generateAIResponseStreaming(
      [{ id: 'm1', content: 'write me an assignment and save it', isAI: false }],
      undefined, '', 'default', undefined, undefined, undefined,
      (chunk) => { chunks.push(chunk); },
      (response) => { completed = { content: response.content }; },
      (error) => { throw error; },
      undefined, undefined, undefined,
      (status) => { statuses.push(status); },
      undefined, undefined, undefined, undefined, 'session-1', undefined, undefined,
      { deviceApps: ['notes', 'chats'], currentChatSessionId: 'session-1', onAppObject: (object) => { objects.push(object); } },
    );

    expect(fetchMock).toHaveBeenCalledTimes(2);

    // Leg 1 declares what this browser can run; leg 2 carries the transcript.
    const first = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(first.deviceApps).toEqual(['notes', 'chats']);
    expect(first.deviceRounds).toBe(0);
    expect(first.toolTranscript).toBeUndefined();

    const second = JSON.parse(fetchMock.mock.calls[1][1].body);
    expect(second.deviceRounds).toBe(1);
    expect(second.toolTranscript).toEqual([
      {
        role: 'assistant',
        content: 'Saving that for you.',
        tool_calls: [{
          id: 'call-1',
          type: 'function',
          function: { name: 'notes_create', arguments: JSON.stringify({ title: 'Assignment', markdown: '# Jobs and Musk' }) },
        }],
      },
      expect.objectContaining({ role: 'tool', tool_call_id: 'call-1', name: 'notes_create' }),
    ]);

    // The note really exists, and the chat got a card pointing at it.
    const saved = readNotes();
    expect(saved).toHaveLength(1);
    expect(objects).toEqual([{ kind: 'note', id: saved[0].id, title: 'Assignment', action: 'created' }]);

    // The user saw one answer being written, with the shimmer naming the app.
    expect(statuses).toContain('Saving a note');
    expect(chunks.join('')).toBe('Saving that for you.\n\nDone, it is in your notes.');
    expect(completed!.content).toBe('Saving that for you.\n\nDone, it is in your notes.');
  });

  it('never offers the tools when the caller has not opted in', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(legResponse('Plain answer.[STATUS_END]'));
    vi.stubGlobal('fetch', fetchMock);

    await generateAIResponseStreaming(
      [{ id: 'm1', content: 'hello', isAI: false }],
      undefined, '', 'default', undefined, undefined, undefined,
      undefined, undefined, (error) => { throw error; },
    );

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.deviceApps).toBeUndefined();
    expect(body.deviceRounds).toBeUndefined();
  });

  it('stops on its own against a server that never stops asking', async () => {
    // The real budget is server-side — past it the tools are simply not
    // offered. This is the client's safety valve for a server that ignores
    // its own budget, so it is a hard stop, not a policy.
    const fetchMock = vi.fn().mockImplementation((_url: string, init: { body: string }) => {
      const rounds = JSON.parse(init.body).deviceRounds ?? 0;
      return Promise.resolve(legResponse(
        `leg${rounds}`
        + deviceFrame({
          assistantContent: `leg${rounds}`,
          toolCalls: [{ id: `call-${rounds}`, name: 'notes_search', arguments: '{"query":"x","limit":3}' }],
          resolvedResults: [],
          deviceRounds: rounds + 1,
        })
        + '[STATUS_END]',
      ));
    });
    vi.stubGlobal('fetch', fetchMock);

    await generateAIResponseStreaming(
      [{ id: 'm1', content: 'go', isAI: false }],
      undefined, '', 'default', undefined, undefined, undefined,
      undefined, undefined, (error) => { throw error; },
      undefined, undefined, undefined, undefined, undefined, undefined, undefined,
      undefined, 'session-1', undefined, undefined,
      { deviceApps: ['notes'] },
    );

    // It gives up rather than following a misbehaving server forever. In the
    // real path this never fires: the server withholds the tools at its own
    // budget, several rounds earlier, and that leg goes on to answer.
    expect(fetchMock).toHaveBeenCalledTimes(DEVICE_ROUND_HARD_STOP);
  });

  it('surfaces a truncated leg as a failure rather than a half answer', async () => {
    // No [STATUS_END]: the stream died. This must not look like a finished turn.
    const fetchMock = vi.fn().mockResolvedValue(legResponse('half a sen'));
    vi.stubGlobal('fetch', fetchMock);

    let failure: Error | null = null;
    await generateAIResponseStreaming(
      [{ id: 'm1', content: 'go', isAI: false }],
      undefined, '', 'default', undefined, undefined, undefined,
      undefined,
      () => { throw new Error('onComplete must not run'); },
      (error) => { failure = error; },
      undefined, undefined, undefined, undefined, undefined, undefined, undefined,
      undefined, 'session-1', undefined, undefined,
      { deviceApps: ['notes'] },
    );

    expect(failure).toBeInstanceOf(Error);
    expect((failure as unknown as { code: string }).code).toBe('TRUNCATED');
  });
});
