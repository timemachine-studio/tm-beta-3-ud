import type { VercelRequest, VercelResponse } from './vercelTypes.js';
import { createHmac, timingSafeEqual, randomUUID } from 'node:crypto';
import { supabaseAdmin as supabase } from './supabaseAdmin.js';

// ─── Rate limiting ──────────────────────────────────────────────────────────
// Extracted from api/ai-proxy.ts unchanged (pre-launch-audit.md A.2), so the
// media and search endpoints can share the same buckets without importing the
// whole proxy. ai-proxy re-exports everything here for its existing callers.
//
// Two rules that must survive any edit:
//  - It fails CLOSED. A backend error is a 503, never a free generation.
//  - Quota is charged only after a generation succeeds (production-check.md 0.4).

// Default rate limiting configuration (fallback when no custom limits set)
const DEFAULT_PERSONA_LIMITS: Record<string, number> = {
  default: parseInt(process.env.VITE_DEFAULT_PERSONA_LIMIT || '400'),
  girlie: parseInt(process.env.VITE_GIRLIE_PERSONA_LIMIT || '70'),
  pro: parseInt(process.env.VITE_PRO_PERSONA_LIMIT || '200'),
};

// Anonymous trial. These are the numbers the UI shows, and they are enforced
// here — the localStorage counter in useAnonymousRateLimit is display only and
// resets when a visitor clears site data.
export const ANONYMOUS_PERSONA_LIMITS: Record<string, number> = {
  default: parseInt(process.env.ANON_DEFAULT_PERSONA_LIMIT || '3'),
  girlie: 0,
  pro: 0,
};

export function getAnonymousLimit(persona: string): number {
  return ANONYMOUS_PERSONA_LIMITS[persona] ?? 0;
}

// ─── Anonymous device cookie ────────────────────────────────────────────────
// An anonymous visitor is counted against two independent buckets: their IP
// (which they cannot clear) and a signed device id (which survives an IP
// change). Whichever is exhausted first stops them, so neither clearing site
// data nor hopping networks grants a fresh trial on its own.

const ANON_COOKIE_NAME = 'tm_anon';
const ANON_TRIAL_SECRET = process.env.ANON_TRIAL_SECRET || '';

function signDeviceId(deviceId: string): string {
  return createHmac('sha256', ANON_TRIAL_SECRET).update(deviceId).digest('base64url');
}

function parseCookies(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(';')) {
    const index = part.indexOf('=');
    if (index === -1) continue;
    out[part.slice(0, index).trim()] = decodeURIComponent(part.slice(index + 1).trim());
  }
  return out;
}

/**
 * Read the signed device id from the request, or mint a new one and set it.
 * Returns null when ANON_TRIAL_SECRET is unset — the IP bucket still applies.
 */
export function resolveAnonymousDeviceId(req: VercelRequest, res: VercelResponse): string | null {
  if (!ANON_TRIAL_SECRET) return null;

  const cookies = parseCookies(req.headers.cookie);
  const raw = cookies[ANON_COOKIE_NAME];

  if (raw) {
    const separator = raw.lastIndexOf('.');
    if (separator > 0) {
      const deviceId = raw.slice(0, separator);
      const signature = raw.slice(separator + 1);
      const expected = signDeviceId(deviceId);
      // Compare in constant time, and only when the lengths already match —
      // timingSafeEqual throws on a length mismatch.
      if (
        signature.length === expected.length &&
        timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
      ) {
        return deviceId;
      }
    }
  }

  const deviceId = randomUUID();
  const value = `${deviceId}.${signDeviceId(deviceId)}`;
  res.setHeader(
    'Set-Cookie',
    `${ANON_COOKIE_NAME}=${encodeURIComponent(value)}; Path=/; Max-Age=${60 * 60 * 24 * 30}; HttpOnly; SameSite=Lax; Secure`,
  );
  return deviceId;
}

// Get rate limit for a user - checks for custom overrides in profiles.rate_limit_overrides
// You can set custom limits per user from Supabase Table Editor:
// profiles.rate_limit_overrides = { "default": 100, "girlie": 100, "pro": 50 }
async function getUserRateLimit(userId: string | null, persona: string): Promise<number> {
  if (userId) {
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('rate_limit_overrides')
        .eq('id', userId)
        .maybeSingle();

      if (profile?.rate_limit_overrides) {
        const overrides = profile.rate_limit_overrides as Record<string, number>;
        if (typeof overrides[persona] === 'number') {
          return overrides[persona];
        }
      }
    } catch (error) {
      console.error('Error fetching user rate limits:', error);
    }
  }
  return DEFAULT_PERSONA_LIMITS[persona] ?? 50;
}

export type RateLimitOutcome =
  // `providers` is the requested chain minus anything at its daily ceiling —
  // the whole chain when no ceiling is configured. Empty only when the caller
  // named no providers at all.
  | { allowed: true; providers: string[] }
  | { allowed: false; reason: 'limit'; limit: number }
  | { allowed: false; reason: 'backend_error' }
  | { allowed: false; reason: 'spend_ceiling'; providers: string[] };

// Reserved bucket keys in the rate_limits table. Real personas are lowercase
// identifiers, so a '__' prefix cannot collide with one.
const PROVIDER_BUCKET_PREFIX = '__provider__:';
const GLOBAL_BUCKET_IP = '__global__';

/**
 * Read one bucket's usage in the current 24h window.
 * Throws on a backend error so callers can fail closed.
 */
async function readBucketCount(
  persona: string,
  key: { userId: string } | { ip: string },
): Promise<number> {
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  let query = supabase.from('rate_limits').select('*').eq('persona', persona);
  query = 'userId' in key ? query.eq('user_id', key.userId) : query.eq('ip_address', key.ip);

  // Newest window first, one row. Until rate_limits_atomic.sql is applied a
  // race on the first charge can leave two rows for one bucket; maybeSingle()
  // on its own then throws, and because this fails closed the caller is 503'd
  // on every request after that (pre-launch-audit.md A.5). Reading one row
  // degrades that to a slightly generous count instead.
  const { data, error } = await query
    .order('window_start', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`rate_limit_backend_error: ${error.message}`);
  if (!data) return 0;

  // Window expired — increment will reset it, so it reads as zero usage.
  if (new Date(data.window_start) < dayAgo) return 0;

  return data.message_count ?? 0;
}

/**
 * Daily ceiling on total generations per provider. A hard stop that protects
 * the card when something (a leak, a bug, a bot) drives volume past anything
 * a real user population would produce. 0 / unset disables the ceiling.
 *
 * Returns the subset of `providers` still under their ceiling, in the order
 * given. This is per *provider*, not per run: one provider hitting its cap
 * means the run skips that provider, not that the app stops answering. The
 * previous version checked only the primary and refused the whole turn on it,
 * which — now that Air has a fallback chain — took two healthy providers down
 * with the capped one.
 */
async function providersUnderCeiling(providers: string[]): Promise<string[]> {
  const ceiling = parseInt(process.env.PROVIDER_DAILY_CEILING || '0', 10);
  if (!ceiling || Number.isNaN(ceiling)) return providers;

  const verdicts = await Promise.all(providers.map(async (provider) => {
    const used = await readBucketCount(`${PROVIDER_BUCKET_PREFIX}${provider}`, { ip: GLOBAL_BUCKET_IP });
    if (used >= ceiling) {
      console.warn(`provider_spend_ceiling_reached provider=${provider} used=${used} ceiling=${ceiling}`);
      return null;
    }
    return provider;
  }));

  const open = verdicts.filter((provider): provider is string => provider !== null);
  if (open.length === 0 && providers.length > 0) {
    console.error(`provider_spend_ceiling_reached_all providers=${providers.join(',')} ceiling=${ceiling}`);
  }
  return open;
}

/**
 * Supabase-based rate limiting.
 *
 * Fails CLOSED: a backend error denies the request. The previous behaviour
 * ("allow on error to not block users") meant a Supabase incident removed all
 * limits and made spend unbounded — see production-check.md 0.4.
 */
/**
 * Remaining quota for the caller in the current 24h window.
 * Returns null when the limiter backend is unavailable — callers should show
 * nothing rather than a number they cannot stand behind.
 */
export async function getRemainingQuota(
  userId: string | null,
  ip: string,
  persona: string,
  anonymousDeviceId?: string | null,
): Promise<{ remaining: number; limit: number } | null> {
  try {
    if (userId) {
      const limit = await getUserRateLimit(userId, persona);
      const used = await readBucketCount(persona, { userId });
      return { remaining: Math.max(0, limit - used), limit };
    }

    const limit = getAnonymousLimit(persona);
    if (limit <= 0) return { remaining: 0, limit: 0 };

    let used = await readBucketCount(persona, { ip });
    if (anonymousDeviceId) {
      used = Math.max(used, await readBucketCount(persona, { ip: `device:${anonymousDeviceId}` }));
    }
    return { remaining: Math.max(0, limit - used), limit };
  } catch (error) {
    console.error('rate_limit_backend_error', error instanceof Error ? error.message : error);
    return null;
  }
}

export async function checkRateLimit(
  userId: string | null,
  ip: string,
  persona: string,
  options: {
    anonymousDeviceId?: string | null;
    providers?: string[];
    /**
     * A fixed cap for buckets that are not personas (the media endpoints —
     * api/_lib/mediaGate.ts). With it set, neither the persona table nor the
     * anonymous allowance is consulted.
     */
    limitOverride?: number;
  } = {},
): Promise<RateLimitOutcome> {
  try {
    if (options.limitOverride !== undefined) {
      const limit = options.limitOverride;
      const used = userId
        ? await readBucketCount(persona, { userId })
        : await readBucketCount(persona, { ip });
      return used < limit
        ? { allowed: true, providers: [] }
        : { allowed: false, reason: 'limit', limit };
    }

    // Only a run with nowhere left to go is refused here. A single capped
    // provider just drops out of the chain.
    const requested = options.providers ?? [];
    const open = requested.length > 0 ? await providersUnderCeiling(requested) : [];
    if (requested.length > 0 && open.length === 0) {
      return { allowed: false, reason: 'spend_ceiling', providers: requested };
    }

    if (userId) {
      const limit = await getUserRateLimit(userId, persona);
      const used = await readBucketCount(persona, { userId });
      return used < limit
        ? { allowed: true, providers: open }
        : { allowed: false, reason: 'limit', limit };
    }

    // Anonymous: enforce the same number the UI advertises, server-side.
    const limit = getAnonymousLimit(persona);
    if (limit <= 0) return { allowed: false, reason: 'limit', limit };

    const ipUsed = await readBucketCount(persona, { ip });
    if (ipUsed >= limit) return { allowed: false, reason: 'limit', limit };

    if (options.anonymousDeviceId) {
      const deviceUsed = await readBucketCount(persona, { ip: `device:${options.anonymousDeviceId}` });
      if (deviceUsed >= limit) return { allowed: false, reason: 'limit', limit };
    }

    return { allowed: true, providers: open };
  } catch (error) {
    // Deliberately fail closed. This log line is the signal that the limiter
    // backend is down — alert on it (production-check.md 2.1).
    console.error('rate_limit_backend_error', error instanceof Error ? error.message : error);
    return { allowed: false, reason: 'backend_error' };
  }
}

/**
 * True once the database has told us bump_rate_limit does not exist, so the
 * read-modify-write fallback is used without a failed RPC on every charge.
 * Reset by a cold start, which is also when the function might have appeared.
 */
let atomicBumpUnavailable = false;

/** Increment one bucket by `amount`, resetting the window if it has expired. */
async function bumpBucket(
  persona: string,
  key: { userId: string } | { ip: string },
  amount: number,
): Promise<void> {
  // One statement, serialised on the row lock — see
  // supabase/migrations/rate_limits_atomic.sql. The select→update below loses
  // increments under concurrency and can create duplicate rows on the first
  // charge; it stays only as the path for a database where the migration has
  // not been applied yet.
  if (!atomicBumpUnavailable) {
    const { error } = await supabase.rpc('bump_rate_limit', {
      p_persona: persona,
      p_user_id: 'userId' in key ? key.userId : null,
      p_ip_address: 'userId' in key ? null : key.ip,
      p_amount: amount,
    });
    if (!error) return;
    // PGRST202: no such function (PostgREST); 42883: undefined_function (PG).
    if (error.code === 'PGRST202' || error.code === '42883') {
      atomicBumpUnavailable = true;
      console.warn('rate_limit_atomic_unavailable: apply supabase/migrations/rate_limits_atomic.sql');
    } else {
      throw new Error(`rate_limit_backend_error: ${error.message}`);
    }
  }

  const now = new Date();
  const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  let query = supabase.from('rate_limits').select('*').eq('persona', persona);
  query = 'userId' in key ? query.eq('user_id', key.userId) : query.eq('ip_address', key.ip);

  const { data: existing, error } = await query
    .order('window_start', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`rate_limit_backend_error: ${error.message}`);

  if (existing) {
    const windowExpired = new Date(existing.window_start) < dayAgo;
    await supabase
      .from('rate_limits')
      .update(
        windowExpired
          ? { message_count: amount, window_start: now.toISOString(), updated_at: now.toISOString() }
          : {
            // Never let a refund drive the counter below zero.
            message_count: Math.max(0, (existing.message_count ?? 0) + amount),
            updated_at: now.toISOString(),
          },
      )
      .eq('id', existing.id);
    return;
  }

  if (amount <= 0) return; // nothing to refund against

  await supabase.from('rate_limits').insert({
    user_id: 'userId' in key ? key.userId : null,
    ip_address: 'userId' in key ? null : key.ip,
    persona,
    message_count: amount,
    window_start: now.toISOString(),
  });
}

/**
 * Charge (or, with a negative amount, refund) quota for one generation.
 *
 * Call this only after a generation has actually succeeded. Charging up front
 * means a failed request silently costs the user a message — the behaviour
 * reported in production-check.md 0.4.
 */
export async function incrementRateLimit(
  userId: string | null,
  ip: string,
  persona: string,
  options: { amount?: number; anonymousDeviceId?: string | null; provider?: string } = {},
): Promise<void> {
  const amount = options.amount ?? 1;
  try {
    if (userId) {
      await bumpBucket(persona, { userId }, amount);
    } else {
      await bumpBucket(persona, { ip }, amount);
      if (options.anonymousDeviceId) {
        await bumpBucket(persona, { ip: `device:${options.anonymousDeviceId}` }, amount);
      }
    }

    if (options.provider) {
      await bumpBucket(`${PROVIDER_BUCKET_PREFIX}${options.provider}`, { ip: GLOBAL_BUCKET_IP }, amount);
    }
  } catch (error) {
    console.error('rate_limit_increment_error', error instanceof Error ? error.message : error);
  }
}

