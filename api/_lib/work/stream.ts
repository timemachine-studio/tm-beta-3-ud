import { WorkError } from './store.js';

/** Consume TM's normalized NDJSON, not OpenAI SSE. Reasoning stays private. */
export async function readWorkContent(stream: ReadableStream<Uint8Array>, timeoutMs = 180000): Promise<string> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let pending = '', output = '', timedOut = false;
  const consume = (line: string) => {
    if (!line.trim()) return;
    const frame = JSON.parse(line) as { type?: string; content?: string };
    if (frame.type === 'error') throw new WorkError('WORK_MODEL_STREAM_FAILED');
    if (frame.type === 'content' && typeof frame.content === 'string') output += frame.content;
    if (output.length > 100000) throw new WorkError('WORK_OUTPUT_TOO_LARGE');
  };
  const deadline = setTimeout(() => { timedOut = true; void reader.cancel().catch(() => undefined); }, timeoutMs);
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (timedOut) throw new WorkError('WORK_MODEL_TIMEOUT');
      if (done) break;
      pending += decoder.decode(value, { stream: true });
      if (pending.length > 120000) throw new WorkError('WORK_OUTPUT_TOO_LARGE');
      const lines = pending.split('\n'); pending = lines.pop() ?? '';
      for (const line of lines) consume(line);
    }
    pending += decoder.decode();
    if (pending.trim()) consume(pending);
    return output;
  } finally { clearTimeout(deadline); await reader.cancel().catch(() => undefined); reader.releaseLock(); }
}
