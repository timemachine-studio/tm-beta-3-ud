import { describe, it, expect } from 'vitest';
import { AI_PERSONAS, buildProviderChain, personaFallbacks, runProviderNames } from '../../api/ai-proxy';
import {
  EmptyAnswerError,
  ProviderHttpError,
  guardStreamStart,
  recordProviderOutcome,
  runWithProviderFallback,
  type ProviderHop,
} from '../../api/_lib/providerResilience';

// Every test uses its own provider names. The circuit breaker keeps per-name
// state at module scope, so shared names would leak failures between tests.
let nameCounter = 0;
const uniq = (label: string) => `${label}-${nameCounter++}`;

describe('Air provider chain', () => {
  const air = AI_PERSONAS.default;

  it('runs the primary first, then each configured fallback in order', () => {
    const chain = buildProviderChain(air.provider, air.model, personaFallbacks(air));

    // Derived, not a magic number: the chain grows whenever a provider is
    // added, and the invariant is "primary first, then every fallback in
    // order" — not "exactly three hops".
    expect(chain).toHaveLength(1 + personaFallbacks(air).length);
    expect(chain[0]).toEqual({ provider: air.provider, model: air.model });
    expect(chain.slice(1)).toEqual(personaFallbacks(air));
  });

  it('gives each hop a distinct provider, so one provider failing cannot end the chain', () => {
    const chain = buildProviderChain(air.provider, air.model, personaFallbacks(air));
    expect(new Set(chain.map(hop => hop.provider)).size).toBe(chain.length);
  });

  it('drops a fallback naming a provider with no dispatch branch', () => {
    const chain = buildProviderChain('groq', 'a', [
      { provider: 'not-a-provider', model: 'b' },
      { provider: 'cerebras', model: 'c' },
    ]);
    expect(chain).toEqual([
      { provider: 'groq', model: 'a' },
      { provider: 'cerebras', model: 'c' },
    ]);
  });

  it('drops a repeat of a pair already in the chain', () => {
    const chain = buildProviderChain('groq', 'a', [
      { provider: 'groq', model: 'a' },
      { provider: 'groq', model: 'b' },
    ]);
    expect(chain).toEqual([
      { provider: 'groq', model: 'a' },
      { provider: 'groq', model: 'b' },
    ]);
  });

  it('reads no fallbacks off a persona that declares none', () => {
    expect(personaFallbacks({ model: 'x' })).toEqual([]);
    expect(personaFallbacks(undefined)).toEqual([]);
  });
});

describe('Girlie provider chain', () => {
  const girlie = AI_PERSONAS.girlie;

  it('runs on a model groq actually serves, with thinking off', () => {
    // llama-4-scout returned 404 model_not_found from groq, and Girlie had no
    // fallbacks — every message failed on its first hop.
    expect(girlie.model).not.toMatch(/llama-4-scout/);
    expect(girlie.provider).toBe('groq');
    expect(girlie.reasoningEffort).toBe('none');
  });

  it('has a chain of distinct providers behind it, like Air', () => {
    const chain = buildProviderChain(girlie.provider, girlie.model, personaFallbacks(girlie));
    expect(chain.length).toBe(1 + girlie.fallbacks.length);
    expect(new Set(chain.map(hop => hop.provider)).size).toBe(chain.length);
  });
});

describe('PRO provider chain', () => {
  const pro = AI_PERSONAS.pro;

  it('runs the primary first, then each configured fallback in order', () => {
    const chain = buildProviderChain(pro.provider, pro.model, personaFallbacks(pro));

    expect(chain).toHaveLength(3);
    expect(chain[0]).toEqual({ provider: pro.provider, model: pro.model });
    expect(chain.slice(1)).toEqual(personaFallbacks(pro));
  });

  it('keeps two hops on the same provider when their models differ', () => {
    // PRO's fallbacks are both Eaon. Dedup is per (provider, model) pair, so
    // collapsing them to one would silently cost a hop.
    const chain = buildProviderChain(pro.provider, pro.model, personaFallbacks(pro));
    const eaon = chain.filter(hop => hop.provider === 'eaon');
    expect(eaon).toHaveLength(2);
    expect(new Set(eaon.map(hop => hop.model)).size).toBe(2);
  });
});

describe('runProviderNames', () => {
  const air = AI_PERSONAS.default;

  it('names every provider the spend ceiling has to consider, primary first', () => {
    // The ceiling runs before a model is resolved, so it works in names. If it
    // saw only the primary it would refuse a turn two healthy providers could
    // have served.
    expect(runProviderNames(air.provider, air)).toEqual([
      air.provider,
      ...personaFallbacks(air).map(hop => hop.provider),
    ]);
  });

  it('collapses a persona whose hops share a provider to one name', () => {
    // The ceiling is per provider, so PRO's two Eaon hops are one budget.
    expect(runProviderNames(AI_PERSONAS.pro.provider, AI_PERSONAS.pro)).toEqual(['nvidia', 'eaon']);
  });

  it('is just the primary for a persona with no fallbacks', () => {
    expect(runProviderNames('groq', { model: 'x' })).toEqual(['groq']);
  });

  it('drops unknown names and repeats', () => {
    expect(runProviderNames('groq', {
      fallbacks: [
        { provider: 'groq', model: 'other' },
        { provider: 'nope', model: 'x' },
        { provider: 'nvidia', model: 'y' },
      ],
    })).toEqual(['groq', 'nvidia']);
  });
});

describe('runWithProviderFallback', () => {
  it('moves to the next hop when the primary fails, and reports where it landed', async () => {
    const hops: ProviderHop[] = [
      { provider: uniq('down'), model: 'm1' },
      { provider: uniq('up'), model: 'm2' },
    ];
    const tried: string[] = [];

    const run = await runWithProviderFallback(hops, async (hop) => {
      tried.push(hop.model);
      if (hop.model === 'm1') throw new ProviderHttpError(hop.provider, 429, 'busy');
      return 'stream';
    });

    expect(run.value).toBe('stream');
    expect(run.model).toBe('m2');
    expect(tried).toEqual(['m1', 'm1', 'm2']); // one quick retry, then hand off
  });

  it('hands off instead of waiting out an upstream Retry-After', async () => {
    const hops: ProviderHop[] = [
      { provider: uniq('busy'), model: 'm1' },
      { provider: uniq('spare'), model: 'm2' },
    ];

    const started = Date.now();
    await runWithProviderFallback(hops, async (hop) => {
      // 60s Retry-After: honoured on the last hop, ignored while a spare exists.
      if (hop.model === 'm1') throw new ProviderHttpError(hop.provider, 429, 'busy', 60_000);
      return 'stream';
    });

    expect(Date.now() - started).toBeLessThan(3_000);
  });

  it('tries a hop even when its predecessor failed for a non-retryable reason', async () => {
    const hops: ProviderHop[] = [
      { provider: uniq('misconfigured'), model: 'm1' },
      { provider: uniq('spare'), model: 'm2' },
    ];

    const run = await runWithProviderFallback(hops, async (hop) => {
      // What a missing API key or an unknown model id looks like.
      if (hop.model === 'm1') throw new Error('GROQ_API_KEY not configured');
      return 'stream';
    });

    expect(run.model).toBe('m2');
  });

  it('surfaces the last failure only once every hop is spent', async () => {
    const hops: ProviderHop[] = [
      { provider: uniq('a'), model: 'm1' },
      { provider: uniq('b'), model: 'm2' },
      { provider: uniq('c'), model: 'm3' },
    ];
    const tried: string[] = [];

    await expect(runWithProviderFallback(hops, async (hop) => {
      tried.push(hop.model);
      throw new ProviderHttpError(hop.provider, 503, 'down');
    })).rejects.toThrow('503');

    expect(new Set(tried)).toEqual(new Set(['m1', 'm2', 'm3']));
  });
});

/** This codebase's stream: newline-delimited JSON frames, as bytes. */
function frames(items: Array<object | string>, { fail = false } = {}): ReadableStream {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const item of items) {
        controller.enqueue(encoder.encode(typeof item === 'string' ? item : `${JSON.stringify(item)}\n`));
      }
      if (fail) controller.error(new Error('socket hung up'));
      else controller.close();
    },
  });
}

async function readAll(stream: ReadableStream): Promise<string> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let text = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) return text;
    text += decoder.decode(value, { stream: true });
  }
}

describe('guardStreamStart', () => {
  it('replays the bytes it read, then the rest, once the provider has said something', async () => {
    const guarded = await guardStreamStart(frames([
      { type: 'content', content: '' },
      { type: 'content', content: 'Hel' },
      { type: 'content', content: 'lo' },
      { type: 'finish' },
    ]), 'p');
    expect(await readAll(guarded)).toBe(
      '{"type":"content","content":""}\n{"type":"content","content":"Hel"}\n{"type":"content","content":"lo"}\n{"type":"finish"}\n',
    );
  });

  it('counts a tool call as an answer', async () => {
    const guarded = await guardStreamStart(frames([
      { type: 'tool_calls', tool_calls: [{ index: 0, id: 'c1', function: { name: 'web_search', arguments: '{}' } }] },
    ]), 'p');
    expect(await readAll(guarded)).toContain('web_search');
  });

  it('rejects a stream that ends with only blank text, so the chain can move on', async () => {
    // Exactly what the empty 200s looked like: a frame or two of nothing,
    // then done.
    await expect(guardStreamStart(frames([{ type: 'content', content: '\n' }, { type: 'finish' }]), 'nvidia'))
      .rejects.toBeInstanceOf(EmptyAnswerError);
  });

  it('rejects a stream that fails before its first frame', async () => {
    await expect(guardStreamStart(frames([], { fail: true }), 'nvidia'))
      .rejects.toThrow(/socket hung up/);
  });

  it('survives a frame split across two chunks', async () => {
    const guarded = await guardStreamStart(frames(['{"type":"content","con', 'tent":"hi"}\n']), 'p');
    expect(await readAll(guarded)).toBe('{"type":"content","content":"hi"}\n');
  });
});

describe('runWithProviderFallback, continued', () => {
  it('walks past a hop that answered with nothing', async () => {
    const hops: ProviderHop[] = [
      { provider: uniq('silent'), model: 'm1' },
      { provider: uniq('talks'), model: 'm2' },
    ];
    const tried: string[] = [];
    const run = await runWithProviderFallback(hops, async (hop) => {
      tried.push(hop.model);
      if (hop.model === 'm1') throw new EmptyAnswerError(hop.provider, 'nothing');
      return 'stream';
    });
    expect(run.model).toBe('m2');
    // One quick retry of the silent hop — the same request often works the
    // second time — then on to the next.
    expect(tried).toEqual(['m1', 'm1', 'm2']);
  });

  it('tries every hop when every breaker is open, not just the primary', async () => {
    const hops: ProviderHop[] = [
      { provider: uniq('tripped-a'), model: 'm1' },
      { provider: uniq('tripped-b'), model: 'm2' },
    ];
    for (const hop of hops) for (let i = 0; i < 3; i++) recordProviderOutcome(hop.provider, false);

    const run = await runWithProviderFallback(hops, async (hop) => {
      if (hop.model === 'm1') throw new ProviderHttpError(hop.provider, 503, 'still down');
      return 'stream';
    });
    expect(run.model).toBe('m2');
  });
});
