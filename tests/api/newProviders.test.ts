import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  AI_PERSONAS,
  buildProviderChain,
  callAmdAPIStreaming,
  callLlm7APIStreaming,
  dispatchStreamingProvider,
  normalizeStreamingProvider,
} from '../../api/ai-proxy';
import type { ProviderMessage, ProviderTool } from '../../api/_lib/providerTypes';
import { resolveVisionMode } from '../../api/_lib/vision';

/** Read this codebase's newline-delimited frames back out of a stream. */
async function drain(stream: ReadableStream): Promise<Array<Record<string, unknown>>> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  const frames: Array<Record<string, unknown>> = [];
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';
    for (const line of lines) if (line.trim()) frames.push(JSON.parse(line));
  }
  return frames;
}

/** An SSE body shaped exactly like the one the live endpoint returned. */
function sseResponse(events: string[]) {
  return new Response(events.join(''), {
    status: 200,
    headers: { 'content-type': 'text/event-stream' },
  });
}

const messages: ProviderMessage[] = [
  { role: 'system', content: 'You are TimeMachine.' },
  { role: 'user', content: 'hello' },
];

describe('AMD Radeon Cloud registration', () => {
  it('is a known streaming provider, so a fallback naming it is not dropped', () => {
    expect(normalizeStreamingProvider('amd', 'cerebras')).toBe('amd');

    const chain = buildProviderChain('groq', 'a', [{ provider: 'amd', model: 'DeepSeek-V4-Flash' }]);
    expect(chain).toEqual([
      { provider: 'groq', model: 'a' },
      { provider: 'amd', model: 'DeepSeek-V4-Flash' },
    ]);
  });

  it('is text-only, so an image turn routed to it is transcribed first', () => {
    // Not a guess: the live endpoint returns 400 "Model DeepSeek-V4-Flash does
    // not support image input" for an image_url part. Air lists AMD as its
    // first fallback, so a wrong annotation here breaks every image turn the
    // moment the primary fails.
    expect(resolveVisionMode({ provider: 'amd', model: 'DeepSeek-V4-Flash' })).toBe('ocr');

    const airAmdHop = AI_PERSONAS.default.fallbacks.find(hop => hop.provider === 'amd');
    expect(airAmdHop).toBeDefined();
    expect(resolveVisionMode(airAmdHop as { provider: string; model: string })).toBe('ocr');
  });

  it('has its own dispatch branch rather than falling through to Cerebras', async () => {
    process.env.AMD_API_KEY = process.env.AMD_API_KEY || 'test-key';
    const fetchMock = vi.fn().mockResolvedValue(sseResponse([
      'data: {"choices":[{"delta":{"content":"hi"}}]}\n\n',
    ]));
    vi.stubGlobal('fetch', fetchMock);
    try {
      await dispatchStreamingProvider('amd', messages, undefined, {
        model: 'DeepSeek-V4-Flash', temperature: 0.7, maxTokens: 100,
      });
      const [url] = fetchMock.mock.calls[0];
      expect(String(url)).toContain('developer.amd.com.cn');
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe('the OpenAI-compatible adapter, against AMD\'s actual wire format', () => {
  const fetchMock = vi.fn();
  let previousKey: string | undefined;

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
    // Set explicitly so these pass in CI, where no real key exists.
    previousKey = process.env.AMD_API_KEY;
    process.env.AMD_API_KEY = 'test-key';
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    if (previousKey === undefined) delete process.env.AMD_API_KEY;
    else process.env.AMD_API_KEY = previousKey;
  });

  it('skips the SSE comment and id lines AMD interleaves with data', async () => {
    // Verbatim from the live endpoint: it opens with ": ping" and puts an
    // "id: N" line after every event. Neither is a data frame.
    fetchMock.mockResolvedValue(sseResponse([
      ': ping\n',
      'data: {"choices":[{"index":0,"delta":{"role":"assistant","content":"Hello"}}]}\n',
      'id: 0\n\n',
      'data: {"choices":[{"index":0,"delta":{"content":" there"}}]}\n',
      'id: 1\n\n',
      'data: [DONE]\n\n',
    ]));

    const frames = await drain(await callAmdAPIStreaming(messages, 'DeepSeek-V4-Flash'));
    expect(frames.filter(f => f.type === 'content').map(f => f.content)).toEqual(['Hello', ' there']);
  });

  it('passes tool-call deltas through with their index, so the loop can accumulate them', async () => {
    fetchMock.mockResolvedValue(sseResponse([
      'data: {"choices":[{"index":0,"delta":{"tool_calls":[{"id":"call_e9af","index":0,"type":"function","function":{"name":"web_search","arguments":""}}]}}]}\n\n',
      'data: {"choices":[{"index":0,"delta":{"tool_calls":[{"id":null,"index":0,"function":{"name":null,"arguments":"{\\"query\\":\\"dhaka\\"}"}}]}}]}\n\n',
      'data: {"choices":[{"index":0,"delta":{},"finish_reason":"tool_calls"}]}\n\n',
    ]));

    const tools: ProviderTool[] = [{
      type: 'function',
      function: { name: 'web_search', description: 'search', parameters: { type: 'object', properties: {} } },
    }];
    const frames = await drain(await callAmdAPIStreaming(messages, 'DeepSeek-V4-Flash', 1, 100, tools));

    const toolFrames = frames.filter(f => f.type === 'tool_calls');
    expect(toolFrames).toHaveLength(2);
    expect((toolFrames[0].tool_calls as Array<{ index: number }>)[0].index).toBe(0);
    expect(frames.some(f => f.type === 'finish' && f.reason === 'tool_calls')).toBe(true);
  });

  it('drops reasoning_content, which is scratchpad rather than answer', async () => {
    // DeepSeek-family models emit this alongside content. Letting it through
    // would print the model's thinking into the chat, and this codebase has
    // its own <reason> mechanism for that.
    fetchMock.mockResolvedValue(sseResponse([
      'data: {"choices":[{"index":0,"delta":{"reasoning_content":"Let me think...","content":null}}]}\n\n',
      'data: {"choices":[{"index":0,"delta":{"content":"The answer."}}]}\n\n',
    ]));

    const frames = await drain(await callAmdAPIStreaming(messages, 'DeepSeek-V4-Flash'));
    expect(frames.filter(f => f.type === 'content').map(f => f.content)).toEqual(['The answer.']);
  });

  it('drops an empty system message but keeps a real one', async () => {
    // A frame of real content: a stream that says nothing is now refused by
    // guardStreamStart, which is a separate test.
    fetchMock.mockResolvedValue(sseResponse(['data: {"choices":[{"delta":{"content":"ok"},"finish_reason":"stop"}]}\n\n', 'data: [DONE]\n\n']));
    await callAmdAPIStreaming(
      [{ role: 'system', content: '   ' }, { role: 'user', content: 'hi' }],
      'DeepSeek-V4-Flash',
    );
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.messages).toEqual([{ role: 'user', content: 'hi' }]);
  });

  it('sends tools only when there are some', async () => {
    fetchMock.mockResolvedValue(sseResponse(['data: [DONE]\n\n']));
    await callAmdAPIStreaming(messages, 'DeepSeek-V4-Flash', 1, 100, []);
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.tools).toBeUndefined();
    expect(body.tool_choice).toBeUndefined();
  });

  it('never logs prompt content', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    fetchMock.mockResolvedValue(sseResponse(['data: [DONE]\n\n']));
    try {
      await callAmdAPIStreaming(
        [{ role: 'user', content: 'my bank password is hunter2' }],
        'DeepSeek-V4-Flash',
      );
      const logged = JSON.stringify(log.mock.calls);
      expect(logged).not.toContain('hunter2');
      expect(logged).toContain('messageCount');
    } finally {
      log.mockRestore();
    }
  });

  it('names the missing environment variable when the key is absent', async () => {
    delete process.env.AMD_API_KEY;
    await expect(callAmdAPIStreaming(messages, 'DeepSeek-V4-Flash'))
      .rejects.toThrow(/AMD_API_KEY is not configured/);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('LLM7', () => {
  const fetchMock = vi.fn();
  let previousKey: string | undefined;

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
    previousKey = process.env.LLM7_API_KEY;
    process.env.LLM7_API_KEY = 'test-key';
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    if (previousKey === undefined) delete process.env.LLM7_API_KEY;
    else process.env.LLM7_API_KEY = previousKey;
  });

  it('sends none of the reasoning-suppression fields', async () => {
    // LLM7 forwards the body to whichever upstream serves the model, and they
    // disagree about what they accept. Verified live: thinking_budget is
    // rejected outright, and reasoning_effort is accepted by minimax-m2.7's
    // upstream but answered with a 400 by the one behind `default`. Since the
    // model is per hop, any of them can break a call.
    fetchMock.mockResolvedValue(sseResponse(['data: [DONE]\n\n']));
    await callLlm7APIStreaming(messages, 'minimax-m2.7');

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body).not.toHaveProperty('thinking_budget');
    expect(body).not.toHaveProperty('reasoning_effort');
    expect(body).not.toHaveProperty('thinking');
    // The parts that do have to be there.
    expect(body.model).toBe('minimax-m2.7');
    expect(body.stream).toBe(true);
  });

  it('still sends all three to AMD, which tolerates them', async () => {
    process.env.AMD_API_KEY = 'test-key';
    fetchMock.mockResolvedValue(sseResponse(['data: [DONE]\n\n']));
    await callAmdAPIStreaming(messages, 'DeepSeek-V4-Flash');

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.thinking_budget).toBe(0);
  });

  it('handles an answer that arrives as one chunk rather than token by token', async () => {
    // LLM7 streams the whole completion in a single delta. The frames it
    // produces have to be identical in shape to a token-by-token provider's,
    // or the agent loop would treat it differently.
    fetchMock.mockResolvedValue(sseResponse([
      'data: {"choices":[{"index":0,"delta":{"role":"assistant","content":"The whole answer at once."},"finish_reason":"stop"}]}\n\n',
      'data: [DONE]\n\n',
    ]));
    const frames = await drain(await callLlm7APIStreaming(messages, 'minimax-m2.7'));
    expect(frames.filter(f => f.type === 'content').map(f => f.content)).toEqual(['The whole answer at once.']);
    expect(frames.some(f => f.type === 'finish' && f.reason === 'stop')).toBe(true);
  });

  it('is a known provider with its own dispatch branch', async () => {
    expect(normalizeStreamingProvider('llm7', 'cerebras')).toBe('llm7');
    fetchMock.mockResolvedValue(sseResponse(['data: {"choices":[{"delta":{"content":"ok"},"finish_reason":"stop"}]}\n\n', 'data: [DONE]\n\n']));
    await dispatchStreamingProvider('llm7', messages, undefined, {
      model: 'minimax-m2.7', temperature: 0.7, maxTokens: 100,
    });
    expect(String(fetchMock.mock.calls[0][0])).toContain('api.llm7.io');
  });

  it('is text-only, per LLM7\'s own model catalog', () => {
    expect(resolveVisionMode({ provider: 'llm7', model: 'minimax-m2.7' })).toBe('ocr');
    // `default` is a routing selector; which upstream serves it can change,
    // and an image sent to a text-only one is a hard 400.
    expect(resolveVisionMode({ provider: 'llm7', model: 'default' })).toBe('ocr');
  });
});

describe('Air\'s chain after both providers were added', () => {
  it('runs groq, then nvidia, then amd, then llm7', () => {
    const chain = buildProviderChain(
      AI_PERSONAS.default.provider,
      AI_PERSONAS.default.model,
      AI_PERSONAS.default.fallbacks,
    );
    expect(chain.map(hop => hop.provider)).toEqual(['groq', 'nvidia', 'amd', 'llm7']);
  });

  it('keeps every hop on a distinct provider', () => {
    // One provider's circuit breaker opening must not take out two hops.
    const chain = buildProviderChain(
      AI_PERSONAS.default.provider,
      AI_PERSONAS.default.model,
      AI_PERSONAS.default.fallbacks,
    );
    expect(new Set(chain.map(hop => hop.provider)).size).toBe(chain.length);
  });

  it('sends an image turn through OCR on every fallback', () => {
    // Only the groq primary can see. Each fallback must say so itself, or a
    // turn that falls through hits a hard 400 on the image part.
    for (const hop of AI_PERSONAS.default.fallbacks) {
      expect(resolveVisionMode(hop)).toBe('ocr');
    }
  });
});

describe('reasoning on groq', () => {
  const originalKey = process.env.GROQ_API_KEY;
  beforeEach(() => { process.env.GROQ_API_KEY = 'test-key'; });
  afterEach(() => { process.env.GROQ_API_KEY = originalKey; vi.restoreAllMocks(); });

  /** What the groq block puts on the wire for a persona's own settings. */
  async function groqBody(reasoningEffort: string | undefined) {
    const fetchMock = vi.fn(async () => sseResponse(['data: {"choices":[{"delta":{"content":"ok"},"finish_reason":"stop"}]}\n\n', 'data: [DONE]\n\n']));
    vi.stubGlobal('fetch', fetchMock);
    await dispatchStreamingProvider('groq', messages, undefined, {
      model: 'qwen/qwen3.6-27b', temperature: 0.8, maxTokens: 100, reasoningEffort,
    });
    return JSON.parse(fetchMock.mock.calls[0][1].body as string) as Record<string, unknown>;
  }

  it('is switched off for Air, and set low rather than off for Flow State', async () => {
    // Measured live: without this, "what is 17*23" cost 255 completion tokens
    // and opened with "<think>Here's a thinking process"; with it, 4 tokens
    // and "391". gpt-oss answers 'none' with a 400, so Flow State carries its
    // own value and must never inherit Air's.
    const air = AI_PERSONAS.default;
    expect(air.reasoningEffort).toBe('none');
    expect(air.flowState.reasoningEffort).toBe('low');
    expect(air.flowState.reasoningEffort).not.toBe(air.reasoningEffort);

    expect((await groqBody(air.reasoningEffort)).reasoning_effort).toBe('none');
    expect((await groqBody(air.flowState.reasoningEffort)).reasoning_effort).toBe('low');
    expect((await groqBody(undefined)).reasoning_effort).toBeUndefined();
  });
});

describe('the dispatcher guards every stream', () => {
  const keys = { GROQ_API_KEY: process.env.GROQ_API_KEY, NVIDIA_API_KEY: process.env.NVIDIA_API_KEY };
  beforeEach(() => { process.env.GROQ_API_KEY = 'test-key'; process.env.NVIDIA_API_KEY = 'test-key'; });
  afterEach(() => { Object.assign(process.env, keys); vi.restoreAllMocks(); });

  it('rejects a hop that opened a 200 and sent nothing, so the chain moves on', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => sseResponse([
      'data: {"choices":[{"delta":{"role":"assistant","content":""},"finish_reason":null}]}\n\n',
      'data: {"choices":[{"delta":{},"finish_reason":"stop"}]}\n\n',
      'data: [DONE]\n\n',
    ])));
    await expect(dispatchStreamingProvider('groq', messages, undefined, { model: 'qwen/qwen3.6-27b', temperature: 0.8, maxTokens: 100 }))
      .rejects.toThrow(/answered with nothing/);
  });

  it('hands back a stream that has already started answering, intact', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => sseResponse([
      'data: {"choices":[{"delta":{"content":"Hel"},"finish_reason":null}]}\n\n',
      'data: {"choices":[{"delta":{"content":"lo"},"finish_reason":"stop"}]}\n\n',
      'data: [DONE]\n\n',
    ])));
    const stream = await dispatchStreamingProvider('groq', messages, undefined, { model: 'qwen/qwen3.6-27b', temperature: 0.8, maxTokens: 100 });
    const text = (await drain(stream)).filter(f => f.type === 'content').map(f => f.content).join('');
    expect(text).toBe('Hello');
  });

  it('forwards reasoning_effort to nvidia only when a persona set one', async () => {
    const fetchMock = vi.fn(async () => sseResponse([
      'data: {"choices":[{"delta":{"content":"391"},"finish_reason":"stop"}]}\n\n', 'data: [DONE]\n\n',
    ]));
    vi.stubGlobal('fetch', fetchMock);
    const hop = AI_PERSONAS.default.fallbacks.find(h => h.provider === 'nvidia')!;
    // Verified live on this model: 'none' turns its thinking off.
    expect(hop.model).toBe('nvidia/nemotron-3.5-lightning-30b-a3b');
    expect(hop.vision).toBe('ocr');

    await dispatchStreamingProvider('nvidia', messages, undefined, { model: hop.model, temperature: 0.8, maxTokens: 100, reasoningEffort: 'none' });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body as string).reasoning_effort).toBe('none');

    await dispatchStreamingProvider('nvidia', messages, undefined, { model: 'moonshotai/kimi-k3', temperature: 0.8, maxTokens: 100 });
    expect(JSON.parse(fetchMock.mock.calls[1][1].body as string).reasoning_effort).toBeUndefined();
  });
});
