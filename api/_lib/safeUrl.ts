/**
 * Outbound URL validation for anything the model can point at us.
 *
 * Extracted from mcpClient.ts, which had the only copy. `web_fetch` needs the
 * identical checks, and a second hand-written copy of SSRF protection is how
 * one of them ends up missing a case — the loopback range, or the DNS lookup,
 * or a redirect that lands somewhere the first check would have refused.
 *
 * The threat is specific: a URL chosen by the model (or by text the model
 * read) is fetched by our server, which sits inside a network the user cannot
 * reach. Cloud metadata endpoints, internal services, and anything on
 * localhost are all one unvalidated fetch away.
 */

import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

/** Loopback, link-local, private, and the unspecified address. */
export function isPrivateAddress(address: string): boolean {
  if (address === '::1' || address.startsWith('fe80:') || address.startsWith('fc') || address.startsWith('fd')) return true;
  const parts = address.split('.').map(Number);
  if (parts.length !== 4 || parts.some(Number.isNaN)) return false;
  return parts[0] === 10
    || parts[0] === 127
    || (parts[0] === 169 && parts[1] === 254)
    || (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31)
    || (parts[0] === 192 && parts[1] === 168)
    || parts[0] === 0;
}

export interface SafeUrlOptions {
  /** Schemes to accept. MCP is HTTPS-only; web_fetch also takes plain HTTP. */
  protocols?: readonly string[];
}

/**
 * Parse and validate an outbound URL, or throw.
 *
 * The DNS lookup is the part that matters and the part that is easy to leave
 * out: `internal.example.com` is a public-looking hostname that resolves to
 * 10.0.0.5, and only resolving it catches that. `all: true` because a host
 * with one public and one private address must still be refused.
 */
export async function assertPublicUrl(rawUrl: string, options: SafeUrlOptions = {}): Promise<URL> {
  const protocols = options.protocols ?? ['https:'];

  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error('That is not a valid URL');
  }

  if (!protocols.includes(url.protocol)) {
    throw new Error(`URL must use ${protocols.map(p => p.replace(':', '')).join(' or ')}`);
  }

  const hostname = url.hostname.toLowerCase();
  if (hostname === 'localhost' || hostname.endsWith('.local') || hostname.endsWith('.internal')) {
    throw new Error('Private hosts are not allowed');
  }
  if (isIP(hostname) && isPrivateAddress(hostname)) {
    throw new Error('Private addresses are not allowed');
  }
  if (!isIP(hostname)) {
    const addresses = await lookup(hostname, { all: true, verbatim: true });
    if (!addresses.length || addresses.some(entry => isPrivateAddress(entry.address))) {
      throw new Error('Host resolves to a private address');
    }
  }
  return url;
}
