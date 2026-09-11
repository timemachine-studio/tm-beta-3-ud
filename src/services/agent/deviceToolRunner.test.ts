import { beforeEach, describe, expect, it, vi } from 'vitest';
import { deviceToolStatus, runDeviceTool } from './deviceToolRunner';
import { chatService } from '../chat/chatService';
import { readNotes } from '../notes/notesRepository';

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

const call = (name: string, args: unknown) => ({ id: 'call-1', name, arguments: JSON.stringify(args) });

describe('runDeviceTool', () => {
  beforeEach(() => {
    installStorage();
    chatService.setUserId(null);
  });

  it('saves a note and hands back a card for the chat to render', async () => {
    const outcome = await runDeviceTool(call('notes_create', { title: 'Assignment', markdown: '# Jobs\n\nbody' }));

    expect(outcome.appObject).toMatchObject({ kind: 'note', title: 'Assignment', action: 'created' });
    expect(readNotes()).toHaveLength(1);
    // The note is already on screen; telling the model to paste it back would
    // duplicate the whole thing into the reply.
    expect(outcome.content).toContain('already shown to the user');
  });

  it('edits the same note instead of creating a second one', async () => {
    const created = await runDeviceTool(call('notes_create', { title: 'Draft', markdown: 'long intro' }));
    const noteId = created.appObject!.id;

    const edited = await runDeviceTool({
      id: 'call-2',
      name: 'notes_edit',
      arguments: JSON.stringify({ note_id: noteId, title: '', markdown: 'short intro', mode: 'replace' }),
    });

    expect(edited.appObject).toMatchObject({ id: noteId, action: 'updated' });
    expect(readNotes()).toHaveLength(1);
  });

  it('tells the model to ask before replacing a note it cannot find', async () => {
    const outcome = await runDeviceTool(call('notes_edit', { note_id: 'gone', markdown: 'x', mode: 'replace' }));
    expect(outcome.appObject).toBeUndefined();
    expect(outcome.content).toContain('without asking the user');
  });

  it('reports an empty history rather than letting the model invent one', async () => {
    const outcome = await runDeviceTool(call('chats_search', { query: 'jobs', after: '', before: '', limit: 5 }));
    expect(outcome.content).toContain('could not find it');
  });

  it('reads a past conversation and points at the next page', async () => {
    installStorage({
      chatSessions: JSON.stringify([{
        id: 'c1',
        name: 'Old chat',
        persona: 'default',
        createdAt: '2026-08-01T00:00:00.000Z',
        lastModified: '2026-08-01T00:00:00.000Z',
        messages: Array.from({ length: 15 }, (_, index) => ({
          id: `m${index}`, content: `message ${index}`, isAI: index % 2 === 1,
        })),
      }]),
    });

    // The page size is fixed by the executor, not asked of the model: the
    // result is replayed into every later leg, so its size is not the model's
    // to choose.
    const outcome = await runDeviceTool(call('chats_read', { chat_id: 'c1', offset: 0 }));
    expect(outcome.content).toContain('message 0');
    expect(outcome.content).toContain('message 11');
    expect(outcome.content).not.toContain('message 12');
    expect(outcome.content).toContain('offset 12');
    // Read history is a record of a conversation, not established fact.
    expect(outcome.content).toContain('not as verified fact');
  });

  it('ignores a date bound the model did not format as a date', async () => {
    const search = vi.spyOn(chatService, 'searchChats').mockResolvedValue([]);
    await runDeviceTool(call('chats_search', { query: 'x', after: 'last month', before: '2026-09-01', limit: 5 }));

    expect(search).toHaveBeenCalledWith('x', expect.objectContaining({ after: undefined, before: '2026-09-01' }));
    search.mockRestore();
  });

  it('asks the model to retry when it sends malformed arguments', async () => {
    const outcome = await runDeviceTool({ id: 'c', name: 'notes_read', arguments: '{not json' });
    expect(outcome.content).toContain('not valid JSON');
  });

  it('refuses a tool name it does not implement', async () => {
    const outcome = await runDeviceTool(call('notes_delete_everything', {}));
    expect(outcome.content).toContain('not a tool this app can run');
  });

  it('turns a storage failure into something the user will be told about', async () => {
    installStorage();
    Object.defineProperty(globalThis.localStorage, 'setItem', {
      value: () => { throw new DOMException('full', 'QuotaExceededError'); },
    });

    const outcome = await runDeviceTool(call('notes_create', { title: 'Doomed', markdown: 'body' }));
    expect(outcome.appObject).toBeUndefined();
    expect(outcome.content).toContain('not saved');
  });

  it('names the app being touched so the shimmer says something true', async () => {
    const onStatus = vi.fn();
    await runDeviceTool(call('notes_search', { query: '', limit: 5 }), { onStatus });
    expect(onStatus).toHaveBeenCalledWith('Looking through your notes');
    expect(deviceToolStatus('chats_read')).toBe('Reading an earlier conversation');
  });
});

describe('run_python through the device bridge', () => {
  const outcome = (overrides = {}) => ({
    ok: true,
    durationMs: 300,
    stdout: '391\n',
    stderr: '',
    freshSession: false,
    outputs: [],
    files: [],
    ...overrides,
  });

  const saveFile = async () => 'stored-1';

  it('runs the code and hands back both halves: text for the model, a card for the user', async () => {
    const runPython = vi.fn(async () => outcome({
      outputs: [{ kind: 'image' as const, bytes: new Uint8Array([1, 2]) }],
    }));

    const result = await runDeviceTool(call('run_python', { code: 'print(17 * 23)' }), { runPython, saveFile });

    expect(runPython).toHaveBeenCalledWith('print(17 * 23)', expect.anything());
    expect(result.content).toContain('391');
    expect(result.pythonRun?.code).toBe('print(17 * 23)');
    expect(result.pythonRun?.artifacts[0]).toMatchObject({ kind: 'image' });
  });

  it('still shows a chart the code drew before it threw', async () => {
    // Half a result is worth more than none, and a turn where the card simply
    // never appears reads as the feature being broken.
    const runPython = vi.fn(async () => outcome({
      ok: false,
      error: 'ValueError: bad axis',
      outputs: [{ kind: 'image' as const, bytes: new Uint8Array([1, 2]) }],
    }));

    const result = await runDeviceTool(call('run_python', { code: 'plot()' }), { runPython, saveFile });
    expect(result.content).toContain('ValueError: bad axis');
    expect(result.pythonRun?.ok).toBe(false);
    expect(result.pythonRun?.artifacts).toHaveLength(1);
  });

  it('refuses an empty call rather than starting an interpreter for nothing', async () => {
    const runPython = vi.fn();
    const result = await runDeviceTool(call('run_python', { code: '   ' }), { runPython });
    expect(runPython).not.toHaveBeenCalled();
    expect(result.content).toContain('no code');
  });

  it('says which stage the sandbox is at, since the first run downloads a runtime', async () => {
    const onStatus = vi.fn();
    const runPython = vi.fn(async (_code: string, options?: { onPhase?: (phase: 'starting' | 'installing' | 'running') => void }) => {
      options?.onPhase?.('installing');
      return outcome();
    });

    await runDeviceTool(call('run_python', { code: 'import pandas' }), { onStatus, runPython });
    expect(onStatus).toHaveBeenCalledWith('Loading Python packages');
  });

  it('warns that the very first run is the slow one', async () => {
    const onStatus = vi.fn();
    const runPython = vi.fn(async (_code: string, options?: { onPhase?: (phase: 'starting' | 'installing' | 'running') => void }) => {
      options?.onPhase?.('starting');
      return outcome();
    });
    await runDeviceTool(call('run_python', { code: '1 + 1' }), { onStatus, runPython });
    expect(onStatus).toHaveBeenCalledWith('Starting Python (first run takes a moment)');
  });
});

describe('generated tools through the device bridge', () => {
  const outcome = (overrides = {}) => ({
    ok: true,
    durationMs: 120,
    stdout: 'Returned: {"value": 1000.0, "unit": "m"}\n',
    stderr: '',
    freshSession: false,
    outputs: [],
    files: [],
    ...overrides,
  });
  const saveFile = async () => 'stored-1';

  const spec = {
    slug: 'unit_convert',
    title: 'Unit converter',
    description: 'Convert a length between metres, feet, inches and kilometres. Call it whenever the user asks to convert units of length.',
    summary: 'Convert lengths between metric and imperial units.',
    parameters: {
      type: 'object',
      properties: { value: { type: 'number' }, from_unit: { type: 'string' }, to_unit: { type: 'string' } },
      required: ['value', 'from_unit', 'to_unit'],
    },
    source: 'FACTORS = {"m": 1.0, "km": 1000.0}\ndef main(value, from_unit, to_unit):\n    return {"value": value * FACTORS[from_unit] / FACTORS[to_unit], "unit": to_unit}',
    terms: ['convert', 'metres to feet', 'kilometres'],
    tests: [{ input: { value: 1, from_unit: 'km', to_unit: 'm' }, expect: '1000' }],
  };

  const published = async () => ({ published: true as const, id: 'row-1', version: 1, reused: false });

  it('validates, test-runs in the sandbox, publishes, and hands back the tool', async () => {
    const runPython = vi.fn(async (_code: string) => outcome());
    const publishTool = vi.fn(async (_spec: unknown, _digest: string) => published());

    const result = await runDeviceTool(call('create_tool', spec), { runPython, saveFile, publishTool });

    // The test ran through the wrapper program, not the bare source.
    const program = runPython.mock.calls[0][0];
    expect(program).toContain('exec(compile(_tm_source, "tm__unit_convert", "exec"), _tm_ns)');
    expect(publishTool).toHaveBeenCalledTimes(1);
    expect(publishTool.mock.calls[0][1]).toMatch(/^sha256:/);
    expect(result.createdTool).toMatchObject({ slug: 'unit_convert', published: true, registryId: 'row-1', version: 1 });
    expect(result.content).toContain('tm__unit_convert is created');
    expect(result.content).toContain('published to the shared TimeMachine registry');
  });

  it('refuses a spec that does not validate, before running anything', async () => {
    const runPython = vi.fn();
    const publishTool = vi.fn(published);
    const result = await runDeviceTool(call('create_tool', { ...spec, terms: ['data', 'the'] }), { runPython, publishTool });
    expect(runPython).not.toHaveBeenCalled();
    expect(publishTool).not.toHaveBeenCalled();
    expect(result.createdTool).toBeUndefined();
    expect(result.content).toContain('too generic');
  });

  it('hands a failing test back as a traceback, and does not publish', async () => {
    const runPython = vi.fn(async () => outcome({ ok: false, error: 'Traceback\nKeyError: \'ft\'', stdout: '' }));
    const publishTool = vi.fn(published);
    const result = await runDeviceTool(call('create_tool', spec), { runPython, saveFile, publishTool });
    expect(publishTool).not.toHaveBeenCalled();
    expect(result.createdTool).toBeUndefined();
    expect(result.content).toContain('Test 1 of 1 failed');
    expect(result.content).toContain("KeyError: 'ft'");
    expect(result.content).toContain('call create_tool again with the same slug');
  });

  it('fails a test whose output lacks the expected text', async () => {
    const runPython = vi.fn(async () => outcome({ stdout: 'Returned: {"value": 1.0}\n' }));
    const publishTool = vi.fn(published);
    const result = await runDeviceTool(call('create_tool', spec), { runPython, publishTool });
    expect(publishTool).not.toHaveBeenCalled();
    expect(result.content).toContain('did not contain the expected text');
    expect(result.content).toContain('Expected to find: "1000"');
  });

  it('keeps a tool that could not be published, and says so', async () => {
    const runPython = vi.fn(async () => outcome());
    const publishTool = vi.fn(async () => ({ published: false as const, reason: 'anonymous' as const }));
    const result = await runDeviceTool(call('create_tool', spec), { runPython, publishTool });
    expect(result.createdTool).toMatchObject({ published: false, version: 1 });
    expect(result.content).toContain('not signed in');
  });

  it('runs a session tool from the device copy, never from the frame', async () => {
    const runPython = vi.fn(async () => outcome());
    const sessionTool = { ...spec, digest: 'sha256:' + 'a'.repeat(64), version: 1, published: false };
    const result = await runDeviceTool(
      { id: 'c', name: 'tm__unit_convert', arguments: JSON.stringify({ value: 1, from_unit: 'km', to_unit: 'm' }) },
      { runPython, saveFile, sessionTools: [sessionTool] },
    );
    expect(runPython).toHaveBeenCalledTimes(1);
    expect(result.content).toContain('tm__unit_convert ran in');
    expect(result.content).toContain('Returned: {"value": 1000.0');
    expect(result.pythonRun?.tool).toMatchObject({ name: 'tm__unit_convert', title: 'Unit converter', shared: false });
    expect(result.pythonRun?.code).toBe(spec.source);
  });

  it('runs a registry tool only when its digest matches what was published', async () => {
    const { toolDigest } = await import('../../../shared/toolRegistrySchema');
    const digest = await toolDigest(spec);
    const payload = { id: 'row-1', slug: spec.slug, title: spec.title, version: 2, digest, parameters: spec.parameters, source: spec.source };
    const runPython = vi.fn(async () => outcome());

    const good = await runDeviceTool(
      { id: 'c', name: 'tm__unit_convert', arguments: '{"value": 1, "from_unit": "km", "to_unit": "m"}', tool: payload },
      { runPython, saveFile },
    );
    expect(runPython).toHaveBeenCalledTimes(1);
    expect(good.pythonRun?.tool?.shared).toBe(true);

    const tampered = await runDeviceTool(
      { id: 'd', name: 'tm__unit_convert', arguments: '{}', tool: { ...payload, source: spec.source + '\nimport os' } },
      { runPython, saveFile },
    );
    expect(runPython).toHaveBeenCalledTimes(1);
    expect(tampered.content).toContain('does not match what the registry recorded');
    expect(tampered.pythonRun).toBeUndefined();
  });

  it('refuses a tool whose code never arrived', async () => {
    const runPython = vi.fn();
    const result = await runDeviceTool({ id: 'e', name: 'tm__missing', arguments: '{}' }, { runPython });
    expect(runPython).not.toHaveBeenCalled();
    expect(result.content).toContain('its code did not arrive');
  });

  it('names the tool in the shimmer', () => {
    expect(deviceToolStatus('tm__unit_convert')).toBe('Using unit convert');
    expect(deviceToolStatus('create_tool')).toBe('Writing a new tool');
  });
});
