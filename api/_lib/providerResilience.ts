import type { VisionCapability } from './providerTypes.js';

/**
 * Timeouts, retries, a circuit breaker and a fallback chain for upstream model
 * providers (production-check.md 1.11).
 *
 * The measured behaviour this exists for: 12 concurrent streaming requests to
 * NVIDIA NIM all returned 200, but latency spread from 1.35s to 12.12s on a
 * three-word prompt. With real prompts the slow tail crosses whatever the
 * upstream tolerates and starts failing, and there was nothing here to absorb
 * it — no timeout, no retry, no backoff, no Retry-After handling.
 *
 * Scope note: breaker and latency state are per warm serverless instance, not
 * global. That is enough to stop one instance hammering a dead provider; it is
 * not a cluster-wide breaker, and it resets on a cold start.
 */

/** How long to wait for a provider's response headers before giving up. */
export const PROVIDER_TIMEOUT_MS = 45_000;

const MAX_PROVIDER_RETRIES = 2;
const RETRYABLE_STATUSES = new Set([408, 425, 429, 500, 502, 503, 504]);

// Retries while a fallback hop is still available. Sitting on a provider that
// just said 429 is the worst of both worlds: the user waits out our backoff
// (and an upstream Retry-After can be a minute) only to be told the model is
// busy, when another provider was ready the whole time. One quick retry
// absorbs a one-off blip without stalling; anything worse hands off.
const MAX_RETRIES_BEFORE_FALLBACK = 1;
const MAX_BACKOFF_BEFORE_FALLBACK_MS = 750;

// Circuit breaker: after this many consecutive failures a provider is skipped
// for the cooldown window instead of being piled onto.
const BREAKER_THRESHOLD = 3;
const BREAKER_COOLDOWN_MS = 30_000;

export class ProviderHttpError extends Error {
  readonly status: number;
  readonly retryAfterMs?: number;

  constructor(provider: string, status: number, detail: string, retryAfterMs?: number) {
    // The detail stays in the message for server logs only — callers must not
    // forward it to the client (1.7).
    super(`${provider} API error: ${status} - ${detail}`);
    this.name = 'ProviderHttpError';
    this.status = status;
    this.retryAfterMs = retryAfterMs;
  }
}

export function isRetryableError(error: unknown): boolean {
  if (error instanceof ProviderHttpError) return RETRYABLE_STATUSES.has(error.status);
  // AbortError from our own timeout, or a transport-level failure.
  if (error instanceof Error) {
    return error.name === 'AbortError' || error.name === 'TimeoutError' || error.name === 'TypeError';
  }
  return false;
}

function parseRetryAfter(header: string | null): number | undefined {
  if (!header) return undefined;
  const seconds = Number(header);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
  const date = Date.parse(header);
  return Number.isFinite(date) ? Math.max(0, date - Date.now()) : undefined;
}

/**
 * `fetch` with a hard deadline, and a uniform error on non-2xx.
 *
 * Every provider call goes through this: `reader.read()` on a naked fetch can
 * hang indefinitely, and vercel.json allows 300s.
 */
export async function providerFetch(
  url: string,
  init: RequestInit & { providerLabel?: string } = {},
): Promise<Response> {
  const { providerLabel = 'Provider', ...rest } = init;
  const started = Date.now();

  let response: Response;
  try {
    response = await fetch(url, { ...rest, signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS) });
  } catch (error) {
    recordProviderLatency(providerLabel, Date.now() - started, false);
    throw error;
  }

  recordProviderLatency(providerLabel, Date.now() - started, response.ok);

  if (!response.ok) {
    const detail = (await response.text().catch(() => '')).slice(0, 500) || 'no error body';
    throw new ProviderHttpError(
      providerLabel,
      response.status,
      detail,
      parseRetryAfter(response.headers.get('retry-after')),
    );
  }

  return response;
}

// ─── Circuit breaker ────────────────────────────────────────────────────────

interface BreakerState { failures: number; openUntil: number }
const breakers = new Map<string, BreakerState>();

export function isProviderTripped(provider: string): boolean {
  const state = breakers.get(provider);
  return Boolean(state && state.openUntil > Date.now());
}

export function recordProviderOutcome(provider: string, ok: boolean): void {
  const state = breakers.get(provider) || { failures: 0, openUntil: 0 };
  if (ok) {
    breakers.set(provider, { failures: 0, openUntil: 0 });
    return;
  }
  state.failures += 1;
  if (state.failures >= BREAKER_THRESHOLD) {
    state.openUntil = Date.now() + BREAKER_COOLDOWN_MS;
    state.failures = 0;
    console.warn(`[provider] ${provider} circuit open for ${BREAKER_COOLDOWN_MS}ms`);
  }
  breakers.set(provider, state);
}

// ─── Latency telemetry ──────────────────────────────────────────────────────
// You cannot tune a tail you cannot see. Percentiles are logged (never prompt
// content) every SAMPLE_WINDOW calls, per provider.

const SAMPLE_WINDOW = 20;
const samples = new Map<string, number[]>();

export function recordProviderLatency(provider: string, ms: number, ok: boolean): void {
  const bucket = samples.get(provider) || [];
  bucket.push(ms);
  if (bucket.length >= SAMPLE_WINDOW) {
    const sorted = [...bucket].sort((a, b) => a - b);
    const at = (p: number) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))];
    console.log(`[provider-latency] ${provider} n=${sorted.length} p50=${at(0.5)}ms p95=${at(0.95)}ms p99=${at(0.99)}ms`);
    samples.set(provider, []);
  } else {
    samples.set(provider, bucket);
  }
  if (!ok) console.warn(`[provider] ${provider} call failed after ${ms}ms`);
}

// ─── Retry + fallback ───────────────────────────────────────────────────────

function backoffDelay(attemptIndex: number, retryAfterMs?: number): number {
  if (typeof retryAfterMs === 'number') return Math.min(retryAfterMs, 10_000);
  const base = 400 * Math.pow(2, attemptIndex);
  return base + Math.random() * base * 0.5; // jitter, so retries don't sync up
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export interface ProviderHop extends VisionCapability {
  provider: string;
  model: string;
}

export interface ProviderRunResult<T> {
  value: T;
  provider: string;
  model: string;
}

/**
 * Run `attempt` against each hop in turn, retrying transient failures on each
 * with exponential backoff and jitter before moving on.
 *
 * IMPORTANT: only call this for work that has not yet written anything to the
 * client. Once tokens have streamed there is no resume, and a retry would
 * duplicate output — that case must surface as truncated instead (1.9).
 */
export async function runWithProviderFallback<T>(
  hops: ProviderHop[],
  attempt: (hop: ProviderHop) => Promise<T>,
  log: (message: string) => void = () => {},
): Promise<ProviderRunResult<T>> {
  let lastError: unknown = new Error('No providers configured');

  const usable = hops.filter(hop => !isProviderTripped(hop.provider));
  // If the breaker has tripped on everything, still try the primary rather
  // than failing without contacting anyone.
  const chain = usable.length > 0 ? usable : hops.slice(0, 1);

  for (const [hopIndex, hop] of chain.entries()) {
    // The last hop has nowhere to hand off to, so it is the only one that
    // spends the full retry budget and honours an upstream Retry-After.
    const isLastHop = hopIndex === chain.length - 1;
    const maxRetries = isLastHop ? MAX_PROVIDER_RETRIES : MAX_RETRIES_BEFORE_FALLBACK;

    for (let attemptIndex = 0; attemptIndex <= maxRetries; attemptIndex++) {
      try {
        const value = await attempt(hop);
        recordProviderOutcome(hop.provider, true);
        return { value, provider: hop.provider, model: hop.model };
      } catch (error) {
        lastError = error;
        recordProviderOutcome(hop.provider, false);

        const retryable = isRetryableError(error);
        log(`${hop.provider} attempt ${attemptIndex + 1} failed${retryable ? '' : ' (not retryable)'}`);

        if (!retryable || attemptIndex === maxRetries) break;

        const retryAfterMs = error instanceof ProviderHttpError ? error.retryAfterMs : undefined;
        const delay = isLastHop
          ? backoffDelay(attemptIndex, retryAfterMs)
          : Math.min(backoffDelay(attemptIndex), MAX_BACKOFF_BEFORE_FALLBACK_MS);
        await sleep(delay);
      }
    }

    if (!isLastHop) log(`${hop.provider} exhausted, falling through to ${chain[hopIndex + 1].provider}`);
  }

  throw lastError;
}
