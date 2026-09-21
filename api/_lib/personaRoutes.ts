/**
 * The routes the three minds run on: a primary (provider, model) and the
 * fallback chain behind it. Declared here, once, because more than the chat
 * reads them — Notes AI offers the same minds and has to land on the same
 * upstreams, or "TimeMachine Air" in Notes would quietly be a different
 * model from "TimeMachine Air" in the chat.
 *
 * Girlie runs Air's route: she is the same mind with a different voice.
 */

import type { VisionCapability } from './providerTypes.js';

export interface PersonaRoute extends VisionCapability {
  provider: string;
  model: string;
  fallbacks: ReadonlyArray<{ provider: string; model: string } & VisionCapability>;
}

/* Air's route: the primary and the fallback chain behind it. Spread into
   both Air and Girlie in ai-proxy's AI_PERSONAS. */
export const AIR_ROUTE = {
  provider: 'eaon', // allowed change to 'groq' or 'cerebras' or 'pollinations' or 'eaon' or 'nvidia'
  model: 'eaon/minimax-m3',
  // MiniMax M3 is text-only on this route. Transcribe image turns instead of
  // handing it an image_url part and turning an otherwise valid chat into a
  // provider error.
  vision: 'ocr' as const,
  // Air's fallback chain, in order. If the primary above fails for any
  // reason — 429, 5xx, timeout, missing key, unknown model — the run moves
  // to the next entry without the user seeing anything. Only when every
  // entry here has failed does the turn surface an error in the chat.
  //
  // Each entry must name a model that provider actually serves. A hop
  // pointed at a model id the provider does not have fails worse than no
  // hop at all, so do not add one without a verified (provider, model) pair.
  //
  // `vision` is per hop: every hop on this chain is OCR today, but the
  // annotation stays on each entry so a hop that gains native vision can
  // flip on its own without touching the others.
  fallbacks: [
    // The designated backup shares the primary's provider on purpose: it is
    // the model-level cushion (a Gemini-side outage or a 400 the route
    // refuses for that model) and the breaker in providerResilience keys by
    // provider, so once eaon itself is down for three turns both hops are
    // skipped together and the chain continues below. Text-only per the
    // catalog (same line as llm7's minimax-m2.7 in vision.ts), so `ocr`.
    { provider: 'eaon', model: 'eaon/qwen3.8-flash', vision: 'ocr' as const },
    // Lightest Gemini on the same route: a third model-level cushion before
    // the chain leaves eaon. OCR until an image has been sent through it.
    { provider: 'eaon', model: 'eaon/qwen3.7-flash', vision: 'ocr' as const },
    // The rest is ordered by how dependable each hop has actually been, not
    // by preference: the earlier a hop sits, the more often a stall on it
    // costs a user 45s before the chain moves on. nvidia is the one that
    // has answered consistently, so it goes first.
    //
    // OCR: the endpoint answers an image_url part with "multimodal
    // processing is not enabled" (400). Tool calls stream fine, and its
    // thinking switches off with the persona's reasoning_effort, which the
    // nvidia block forwards. Both verified against the live endpoint; what
    // was not fixable is its latency — nvidia's free endpoint queued even a
    // four-token answer for 19–30s in testing.
    { provider: 'nvidia', model: 'nvidia/nemotron-3.5-lightning-30b-a3b', vision: 'ocr' as const },
    // Last line, on purpose: Pollinations is paid and has been the most
    // dependable host in this file, so it is reached only once the free
    // providers are down. Text-only per its own model metadata
    // (`input_modalities: ["text"]`), so `ocr`; tool calling is declared.
    // It is also a reasoning model, which the pollinations block switches
    // off and — because a strict upstream can 400 on the switches — retries
    // without them rather than failing the hop.
    { provider: 'pollinations', model: 'nvidia/nemotron-3.5-lightning', vision: 'ocr' as const },
  ],
  // Qwen 3.6 thinks unless told not to, and it thinks *into content*:
  // measured against the live endpoint, "what is 17*23" cost 255 completion
  // tokens and opened with "<think>Here's a thinking process" — against 4
  // tokens and "391" with this set. On a tier that allows 1,000 output
  // tokens a minute, that thinking was most of Air's budget. Only the groq
  // block reads this; the other providers have their own switches.
  reasoningEffort: 'none',
} as const;

/* PRO's route. */
export const PRO_ROUTE = {
  provider: 'eaon',
  model: 'eaon/minimax-m3',
  // MiniMax's catalog lists the M line as text-only (see minimax-m2.7 in
  // api/_lib/vision.ts), so PRO transcribes images before this hop.
  vision: 'ocr' as const,
  // Same contract as Air's chain above: tried in order, silently, and only
  // an exhausted chain reaches the user. PRO runs as a Trigger.dev job, so
  // the chain travels in the job payload (see api/pro-generation.ts).
  //
  // The former primary stays as the first cushion. The old `kimi-k3-extended`
  // hop on eaon is gone: it was an id from the api.eaon.dev route, and the
  // ai.eaon.dev catalog prefixes everything with `eaon/` — an id that route
  // does not serve fails worse than no hop at all.
  fallbacks: [
    { provider: 'nvidia', model: 'deepseek-ai/deepseek-v4-flash-0731', vision: 'ocr' as const },
  ],
} as const;
