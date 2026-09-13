import { describe, expect, it } from 'vitest';
import { compactHarnessTranscript } from '../../../shared/harnessTranscript';
import type { ToolTranscriptMessage } from '../../../shared/deviceTools';
import { aiProxyBodySchema } from '../../../api/_lib/validation';

function transcript(rounds: number): ToolTranscriptMessage[] {
  return Array.from({ length: rounds }, (_, round): ToolTranscriptMessage[] => {
    const calls = Array.from({ length: 5 }, (_, index) => ({ id: `${round}-${index}`, type: 'function', function: { name: 'read_file', arguments: JSON.stringify({ path: `src/${index}.ts` }) } }));
    return [{ role: 'assistant', content: 'Reading.', tool_calls: calls }, ...calls.map(call => ({ role: 'tool' as const, tool_call_id: call.id, name: 'read_file', content: 'x'.repeat(5000) }))];
  }).flat();
}

describe('coding transcript compaction', () => {
  it('keeps a forty-round batched run inside the API limits without orphaned results', () => {
    const original = transcript(40);
    const compacted = compactHarnessTranscript(original);
    expect(original).toHaveLength(240);
    expect(JSON.stringify(compacted).length).toBeLessThan(160_000);
    const ids = compacted.flatMap(entry => entry.tool_calls?.map(call => call.id) ?? []);
    expect(compacted.filter(entry => entry.role === 'tool').map(entry => entry.tool_call_id)).toEqual(ids);
    expect(compacted[compacted.length - 1]).toEqual(original[original.length - 1]);
    expect(compacted[0].content).toContain('Earlier workspace activity');
    expect(aiProxyBodySchema.safeParse({ messages: [{ content: 'go' }], persona: 'pro', toolTranscript: compacted }).success).toBe(true);
    expect(compactHarnessTranscript(compacted)).toEqual(compacted);
  });
  it('leaves short transcripts unchanged', () => {
    expect(compactHarnessTranscript(transcript(2))).toEqual(transcript(2));
  });
});
