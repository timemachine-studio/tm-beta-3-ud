import { describe, expect, it } from 'vitest';
import { readWorkContent } from './stream';
const bytes = new TextEncoder();
const stream = (...chunks: string[]) => new ReadableStream<Uint8Array>({ start(controller) { for (const chunk of chunks) controller.enqueue(bytes.encode(chunk)); controller.close(); } });
describe('TM Work stream adapter', () => {
  it('joins split NDJSON frames and does not expose reasoning', async () => {
    expect(await readWorkContent(stream('{"type":"reasoning","content":"private"}\n{"type":"cont', 'ent","content":"hello"}\n{"type":"content","content":" world"}'))).toBe('hello world');
  });
  it('rejects explicit provider error frames and bounds output', async () => {
    await expect(readWorkContent(stream('{"type":"error","content":"secret internal stack"}'))).rejects.toMatchObject({ code: 'WORK_MODEL_STREAM_FAILED' });
    await expect(readWorkContent(stream(JSON.stringify({ type: 'content', content: 'a'.repeat(100001) })))).rejects.toMatchObject({ code: 'WORK_OUTPUT_TOO_LARGE' });
  });
  it('does not accept a partial timed-out completion as success', async () => {
    const never = new ReadableStream<Uint8Array>({ start(controller) { controller.enqueue(bytes.encode('{"type":"content","content":"partial"}\n')); } });
    await expect(readWorkContent(never, 5)).rejects.toMatchObject({ code: 'WORK_MODEL_TIMEOUT' });
  });
});
