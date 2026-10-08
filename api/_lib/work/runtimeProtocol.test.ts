import { describe, expect, it, vi } from 'vitest';
import type { WorkTask } from '../../../shared/work';
import { parseWorkRuntimeRequest, readWorkRuntimeCompletion, runtimePrompt } from './runtimeProtocol';
const tool = { type: 'function', function: { name: 'read_file', parameters: { type: 'object', properties: { path: { type: 'string' } } } } };
const base = { model: 'tm-air', messages: [{ role: 'user', content: 'Read the file' }], tools: [tool] };
const frame = (value: unknown) => JSON.stringify(value) + '\n';
const make = (...chunks: string[]) => new ReadableStream<Uint8Array>({ start(controller) { for (const chunk of chunks) controller.enqueue(new TextEncoder().encode(chunk)); controller.close(); } });
const read = (...chunks: string[]) => readWorkRuntimeCompletion(make(...chunks), [tool], new AbortController().signal);
const delta = { type: 'tool_calls', tool_calls: [{ index: 0, id: 'call-1', type: 'function', function: { name: 'read_file', arguments: '{"path":' } }] };
describe('runtime completion protocol', () => {
  it('accepts bounded text parts and complete tool transcripts', () => {
    const request = parseWorkRuntimeRequest({ ...base, messages: [{ role: 'system', content: [{ type: 'text', text: 'Runtime rules' }] }, ...base.messages,
      { role: 'assistant', content: null, tool_calls: [{ id: 'call-1', type: 'function', function: { name: 'read_file', arguments: '{"path":"a.md"}' } }] },
      { role: 'tool', tool_call_id: 'call-1', content: 'File contents' }] }); expect(request.stream).toBe(false);
  });
  it.each([{ ...base, model: 'gpt-bypass' }, { ...base, tools: [tool, tool] }, { ...base, tool_choice: 'required' },
    { ...base, provider: 'other' }, { ...base, messages: [{ role: 'user', content: [{ type: 'image_url', image_url: { url: 'https://private.invalid' } }] }] },
    { ...base, messages: [{ role: 'tool', tool_call_id: 'missing', content: 'bad' }] }, { ...base, messages: [{ role: 'user', content: null }] },
    { ...base, messages: [...base.messages, { role: 'assistant', content: null, tool_calls: [{ id: 'call-1', type: 'function', function: { name: 'read_file', arguments: '{}' } }] }] },
  ])('rejects unsupported or inconsistent requests %o', value => { expect(() => parseWorkRuntimeRequest(value)).toThrow(); });
  it('bounds total bytes, schema depth and message count', () => {
    expect(() => parseWorkRuntimeRequest({ ...base, messages: Array.from({ length: 8 }, () => ({ role: 'user', content: 'a'.repeat(40000) })) })).toThrow();
    let deep: Record<string, unknown> = {}; for (let i = 0; i < 15; i++) deep = { child: deep };
    expect(() => parseWorkRuntimeRequest({ ...base, tools: [{ ...tool, function: { ...tool.function, parameters: deep } }] })).toThrow();
    expect(() => parseWorkRuntimeRequest({ ...base, messages: Array.from({ length: 121 }, () => base.messages[0]) })).toThrow();
  });
  it('keeps raw runtime system/task content out of configuration provenance, but changes its hash', () => {
    const task = { persona: 'girlie', goal: 'private goal', instructions: 'private constraint' } as WorkTask;
    const a = runtimePrompt(task, parseWorkRuntimeRequest({ ...base, messages: [{ role: 'system', content: 'private runtime secret' }, ...base.messages] }));
    const b = runtimePrompt(task, parseWorkRuntimeRequest(base));
    expect(a.snapshot).not.toContain('private runtime secret'); expect(a.snapshot).not.toContain('private goal'); expect(a.version).not.toBe(b.version);
    expect(a.messages[0].content).toContain('TimeMachine'); expect(a.messages[0].content).toContain('Girlie'); expect(a.tools).toHaveLength(1);
    expect(runtimePrompt(task, parseWorkRuntimeRequest({ ...base, tool_choice: 'none' })).tools).toHaveLength(0);
  });
  it('joins fragmented tools and strips private reasoning from content', async () => {
    const result = await read(frame({ type: 'reasoning', content: 'never forward' }), frame({ type: 'content', content: '<think>private</think>Checking.' }).slice(0, 15),
      frame({ type: 'content', content: '<think>private</think>Checking.' }).slice(15), frame(delta), frame({ type: 'tool_calls', tool_calls: [{ index: 0, function: { arguments: '"a.md"}' } }] }), frame({ type: 'finish', reason: 'tool_calls' }));
    expect(result).toEqual({ content: 'Checking.', toolCalls: [{ id: 'call-1', type: 'function', function: { name: 'read_file', arguments: '{"path":"a.md"}' } }], finishReason: 'tool_calls' });
  });
  it('supports a final non-newline finish and length-truncated text', async () => {
    await expect(read(frame({ type: 'content', content: 'Partial text' }), JSON.stringify({ type: 'finish', reason: 'length' }))).resolves.toMatchObject({ finishReason: 'length' });
  });
  it.each([[frame(delta), frame({ type: 'finish', reason: 'tool_calls' })], [frame({ type: 'content', content: 'partial' })],
    [frame({ type: 'tool_calls', tool_calls: [{ index: 0, id: 'call-1', function: { name: 'delete_host', arguments: '{}' } }] }), frame({ type: 'finish', reason: 'tool_calls' })],
    [frame({ type: 'content', content: '<think>only private' }), frame({ type: 'finish', reason: 'stop' })],
    [frame({ type: 'content', content: 'hello' }), frame({ type: 'finish', reason: 'stop' }), frame({ type: 'content', content: 'late' })],
  ].map(chunks => ({ chunks })))('rejects partial, unknown or private-only completions', async ({ chunks }) => { await expect(read(...chunks)).rejects.toMatchObject({ code: 'WORK_MODEL_INVALID_COMPLETION' }); });
  it('redacts provider error frames and bounds output', async () => {
    await expect(read(frame({ type: 'error', content: 'private-provider-key' }))).rejects.toMatchObject({ message: 'WORK_MODEL_STREAM_FAILED' });
    await expect(read(frame({ type: 'content', content: 'a'.repeat(120001) }))).rejects.toThrow();
  });
  it('cancels a pending stream rather than accepting its partial content', async () => {
    const controller = new AbortController(), cancelled = vi.fn();
    const stream = new ReadableStream<Uint8Array>({ start(c) { c.enqueue(new TextEncoder().encode(frame({ type: 'content', content: 'partial' }))); }, cancel: cancelled });
    const pending = readWorkRuntimeCompletion(stream, [], controller.signal); controller.abort();
    await expect(pending).rejects.toMatchObject({ code: 'WORK_MODEL_CANCELLED' }); expect(cancelled).toHaveBeenCalled();
  });
});
