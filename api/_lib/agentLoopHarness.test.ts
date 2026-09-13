import { describe, expect, it, vi } from 'vitest';
import { runAgentLoop } from './agentLoop.js';
import type { ProviderTool } from './providerTypes.js';

const offered = (name: string): ProviderTool => ({ type: 'function', function: { name, parameters: {} } });
const toolFrame = (name: string) => ({ type: 'tool_calls', tool_calls: [{ index: 0, id: 'c1', function: { name, arguments: '{"path":"a.ts"}' } }] });
const stream = (chunks: Uint8Array[]) => new ReadableStream({ start(c) { chunks.forEach(chunk => c.enqueue(chunk)); c.close(); } });
const encoded = (value: unknown) => new TextEncoder().encode(JSON.stringify(value) + '\n');
const emit = () => ({ emitContent: vi.fn(), emitMarker: vi.fn(), emitToolText: vi.fn() });

describe('harness loop boundaries', () => {
  it('reassembles every byte boundary, including UTF-8 and a final line without a newline', async () => {
    const bytes = new TextEncoder().encode(JSON.stringify({ type: 'content', content: 'Reading বাংলা.' }) + '\n' + JSON.stringify(toolFrame('read_file')));
    const result = await runAgentLoop({ messages: [], tools: [offered('read_file')], toolContext: { persona: 'pro' }, emit: emit(),
      deviceBridge: true, callModel: async () => stream([...bytes].map(byte => Uint8Array.of(byte))) });
    expect(result.content).toBe('Reading বাংলা.');
    expect(result.deviceSuspension?.pendingCalls[0].name).toBe('read_file');
    expect(result.deviceSuspension?.pendingCalls[0].arguments).toBe('{"path":"a.ts"}');
  });

  it('refuses a hallucinated write instead of passing it to a Plan browser', async () => {
    const callModel = vi.fn().mockResolvedValueOnce(stream([encoded(toolFrame('write_file'))]))
      .mockResolvedValueOnce(stream([encoded({ type: 'content', content: 'I can only plan.' })]));
    const result = await runAgentLoop({ messages: [], tools: [offered('read_file')], toolContext: { persona: 'pro' }, emit: emit(), deviceBridge: true, callModel });
    expect(result.deviceSuspension).toBeUndefined();
    expect(callModel.mock.calls[1][0].at(-1).content).toContain('not available');
  });

  it('does not run tools on the final answer-only iteration', async () => {
    const result = await runAgentLoop({ messages: [], tools: [offered('write_file')], toolContext: { persona: 'pro' }, emit: emit(), deviceBridge: true,
      maxIterations: 1, callModel: async () => stream([encoded(toolFrame('write_file'))]) });
    expect(result.deviceSuspension).toBeUndefined();
    expect(result.hitMaxIterations).toBe(true);
  });
});

it('carries earlier server tool iterations into a later device suspension', async () => {
  const callModel = vi.fn().mockResolvedValueOnce(stream([encoded(toolFrame('list_skills'))]))
    .mockResolvedValueOnce(stream([encoded({ ...toolFrame('read_file'), tool_calls: [{ index: 0, id: 'c2', function: { name: 'read_file', arguments: '{}' } }] })]));
  const result = await runAgentLoop({ messages: [], tools: [offered('list_skills'), offered('read_file')], toolContext: { persona: 'pro' }, emit: emit(), deviceBridge: true, callModel });
  expect(result.deviceSuspension?.priorTranscript.map(entry => entry.role)).toEqual(['assistant', 'tool']);
  expect(result.deviceSuspension?.priorTranscript[1].name).toBe('list_skills');
});
