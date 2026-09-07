import type { VercelRequest, VercelResponse } from '@vercel/node';

// Comma-separated allowlist, e.g.
//   ALLOWED_ORIGINS=https://timemachinechat.com,https://www.timemachinechat.com
// Add http://localhost:5173 in the dev environment only.
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS ?? '')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);

if (ALLOWED_ORIGINS.length === 0) {
  // Not fatal — same-origin requests are still served (see requestOrigin below)
  // — but a missing allowlist means no other origin can reach the API at all.
  console.warn('ALLOWED_ORIGINS is not set; only same-origin requests will be accepted.');
}

/** The origin this request was actually served on, e.g. https://timemachinechat.com. */
function requestOrigin(req: VercelRequest): string | null {
  const header = (name: string): string | undefined => {
    const value = req.headers[name];
    return Array.isArray(value) ? value[0] : value;
  };
  const host = header('x-forwarded-host') ?? header('host');
  if (!host) return null;
  const proto = header('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https');
  return `${proto}://${host}`;
}

export function isAllowedOrigin(origin: string | undefined, req?: VercelRequest): boolean {
  if (!origin) return false;
  if (ALLOWED_ORIGINS.includes(origin)) return true;
  // A request from our own page is not a CORS concern, and accepting it means a
  // missing ALLOWED_ORIGINS cannot take the whole app down.
  return Boolean(req && origin === requestOrigin(req));
}

/**
 * Reflect the request origin only when it is on the allowlist.
 *
 * CORS is a *browser* control — it does not stop `curl`. It is necessary but
 * only meaningful alongside the auth check in `requireRequestUser`.
 *
 * `methods` should list what the endpoint actually accepts so the preflight
 * response is accurate.
 */
export function applyCors(
  req: VercelRequest,
  res: VercelResponse,
  methods: string = 'POST, OPTIONS',
): void {
  const origin = Array.isArray(req.headers.origin) ? req.headers.origin[0] : req.headers.origin;

  if (isAllowedOrigin(origin, req)) {
    res.setHeader('Access-Control-Allow-Origin', origin as string);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }

  // Vary on Origin unconditionally: the response differs by origin whether or
  // not this particular one was allowed, and caching one answer for all
  // origins would defeat the allowlist.
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', methods);
}

/**
 * True when the request did not come from a browser page on a disallowed
 * origin. A same-origin `fetch` sends no `Origin` header at all, and non-browser
 * clients omit it too — those are handled by the auth check, not here.
 */
export function hasAcceptableOrigin(req: VercelRequest): boolean {
  const origin = Array.isArray(req.headers.origin) ? req.headers.origin[0] : req.headers.origin;
  if (!origin) return true;
  return isAllowedOrigin(origin, req);
}

/**
 * Gate for media endpoints that are loaded as `<img src>` / `<audio src>`.
 *
 * Those requests cannot carry an Authorization header, so a bearer token is not
 * an option. What they *can* be checked against is the browser's own fetch
 * metadata: a subresource loaded by our own page sends
 * `Sec-Fetch-Site: same-origin`, which no plain `curl` produces. A cross-site
 * page embedding the URL sends `cross-site` and is rejected.
 *
 * This is weaker than a token — it is a spend control, not an identity check —
 * so these endpoints must stay rate limited too.
 */
export function isSameOriginSubresource(req: VercelRequest): boolean {
  const header = (name: string): string | undefined => {
    const value = req.headers[name];
    return Array.isArray(value) ? value[0] : value;
  };

  const fetchSite = header('sec-fetch-site');
  if (fetchSite) return fetchSite === 'same-origin' || fetchSite === 'same-site';

  // Browsers that omit Sec-Fetch-Site still send Referer for a subresource.
  const referer = header('referer');
  if (!referer) return false;
  try {
    return isAllowedOrigin(new URL(referer).origin, req);
  } catch {
    return false;
  }
}
