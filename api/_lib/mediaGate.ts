import { createHmac, timingSafeEqual } from 'node:crypto';
import type { VercelRequest, VercelResponse } from './vercelTypes.js';
import { getAuthenticatedRequestUser } from './auth.js';
import { apiErrorBody } from './errors.js';
import { checkRateLimit, incrementRateLimit } from './rateLimit.js';

/**
 * Access control for the media endpoints (/api/image, /api/music,
 * /api/musicCover) — pre-launch-audit.md A.2.
 *
 * These URLs are loaded as `<img src>` / `<audio src>`, so they cannot carry
 * an Authorization header. The previous gate accepted `Sec-Fetch-Site:
 * same-origin` or an allowlisted Referer as proof that a browser page of ours
 * made the request. Neither is proof: curl sets either header in one flag, and
 * nothing behind that gate was rate limited, so the Pollinations key was
 * spendable by anyone who knew the URL shape.
 *
 * Two ways in now:
 *
 *  1. **A signed URL.** Anything the server itself hands to the browser — the
 *     `generate_image` tool result, the music-compose card's URLs — carries
 *     `exp` and `sig` (HMAC over the endpoint, the parameters and the expiry).
 *     The URL is the credential: it can only be minted by code that already
 *     passed the chat turn's own quota check, it is bound to one prompt and
 *     seed, and it expires. A replay within the window re-serves the same
 *     image (same seed), so it is bounded work, and a per-IP bucket caps even
 *     that.
 *  2. **A bearer token.** Non-browser callers we control, and any client that
 *     fetches the bytes with `Authorization` set. Charged to the user's own
 *     media bucket.
 *
 * The signing key is derived from the service-role key — already mandatory
 * everywhere the API runs — so there is nothing new to configure. Set
 * MEDIA_URL_SECRET to rotate it independently.
 */

const SIGNING_KEY: Buffer | null = (() => {
  const source = process.env.MEDIA_URL_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!source) return null;
  return createHmac('sha256', source).update('timemachine-media-url-v1').digest();
})();

/** Generated-image URLs stay valid this long. Long enough to reopen a chat. */
export const IMAGE_URL_TTL_SECONDS = 7 * 24 * 60 * 60;
/** Music URLs are consumed within one card render, then saved to storage. */
export const MUSIC_URL_TTL_SECONDS = 24 * 60 * 60;

/** Bucket keys in rate_limits. A '__' prefix cannot collide with a persona. */
export const MEDIA_BUCKETS = {
  image: '__media__:image',
  music: '__media__:music',
  cover: '__media__:cover',
} as const;
export type MediaKind = keyof typeof MEDIA_BUCKETS;

/**
 * Daily caps. `signed` is an abuse brake on URLs the server already vouched
 * for — it only trips if someone replays one in a loop. `bearer` is what a
 * signed-in caller may generate directly, outside a chat turn.
 */
const MEDIA_LIMITS: Record<MediaKind, { signed: number; bearer: number }> = {
  image: { signed: 300, bearer: 40 },
  music: { signed: 60, bearer: 10 },
  cover: { signed: 120, bearer: 20 },
};

function canonical(path: string, params: Record<string, string>, exp: number): string {
  const body = Object.keys(params)
    .sort()
    .map(key => `${key}=${params[key]}`)
    .join('&');
  return `${path}\n${body}\n${exp}`;
}

function sign(path: string, params: Record<string, string>, exp: number): string | null {
  if (!SIGNING_KEY) return null;
  return createHmac('sha256', SIGNING_KEY).update(canonical(path, params, exp)).digest('base64url');
}

/**
 * Append `exp` and `sig` to a relative media URL. Without a signing key the
 * URL is returned unsigned and the endpoint will require a bearer token —
 * which for an `<img>` means a broken image, so the key must be present.
 */
export function signMediaUrl(path: string, params: Record<string, string>, ttlSeconds: number): string {
  const search = new URLSearchParams(params);
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  const sig = sign(path, params, exp);
  if (sig) {
    search.set('exp', String(exp));
    search.set('sig', sig);
  }
  return `${path}?${search.toString()}`;
}

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * True when the request carries a valid, unexpired signature over every
 * parameter except `exp` and `sig` themselves. Any parameter added or changed
 * after signing invalidates it, so a signed image URL cannot be edited into a
 * different prompt.
 */
export function verifySignedMediaRequest(path: string, query: VercelRequest['query']): boolean {
  if (!SIGNING_KEY) return false;
  const exp = Number(first(query.exp));
  const sig = first(query.sig);
  if (!sig || !Number.isFinite(exp) || exp < Math.floor(Date.now() / 1000)) return false;

  const params: Record<string, string> = {};
  for (const [key, value] of Object.entries(query)) {
    if (key === 'exp' || key === 'sig') continue;
    const single = first(value);
    if (single !== undefined) params[key] = single;
  }
  const expected = sign(path, params, exp);
  if (!expected || expected.length !== sig.length) return false;
  return timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
}

export interface MediaAccess {
  /** How the caller got in. */
  via: 'signature' | 'bearer';
  /** Charge the bucket after the upstream call succeeds. */
  charge: () => Promise<void>;
}

function clientIp(req: VercelRequest): string {
  const header = req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || req.socket?.remoteAddress || 'unknown';
  const raw = Array.isArray(header) ? header[0] : header;
  // x-forwarded-for can be a comma list; the first entry is the client.
  return String(raw).split(',')[0].trim() || 'unknown';
}

/**
 * Admit or refuse a media request. Writes the refusal itself and returns null;
 * otherwise returns how to charge it once the upstream call has succeeded
 * (never before — a failed generation must not cost anything).
 */
export async function admitMediaRequest(
  req: VercelRequest,
  res: VercelResponse,
  kind: MediaKind,
  path: string,
): Promise<MediaAccess | null> {
  const ip = clientIp(req);
  const bucket = MEDIA_BUCKETS[kind];

  if (verifySignedMediaRequest(path, req.query)) {
    // The URL was minted by us for a turn that already passed its own quota
    // check. The per-IP bucket is only there to stop a replay loop.
    const outcome = await checkRateLimit(null, ip, bucket, { limitOverride: MEDIA_LIMITS[kind].signed });
    if (!outcome.allowed) {
      res.status(outcome.reason === 'backend_error' ? 503 : 429)
        .json(apiErrorBody(outcome.reason === 'backend_error' ? 'UNAVAILABLE' : 'RATE_LIMITED', 'Too many media requests'));
      return null;
    }
    return { via: 'signature', charge: () => incrementRateLimit(null, ip, bucket, { provider: 'pollinations' }) };
  }

  const user = await getAuthenticatedRequestUser(req);
  if (!user) {
    res.status(401).json(apiErrorBody('AUTH_REQUIRED', 'Not authorized'));
    return null;
  }
  // Signed-in, unsigned URL: a direct generation. Their own daily bucket.
  const outcome = await checkRateLimit(user.id, ip, bucket, { limitOverride: MEDIA_LIMITS[kind].bearer });
  if (!outcome.allowed) {
    res.status(outcome.reason === 'backend_error' ? 503 : 429)
      .json(apiErrorBody(outcome.reason === 'backend_error' ? 'UNAVAILABLE' : 'RATE_LIMITED', 'Daily media limit reached'));
    return null;
  }
  return { via: 'bearer', charge: () => incrementRateLimit(user.id, ip, bucket, { provider: 'pollinations' }) };
}
