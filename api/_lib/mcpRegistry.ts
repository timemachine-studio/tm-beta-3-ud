/**
 * Searching the public MCP registry.
 *
 * The curated catalog is what an operator publishes for everyone; this is how
 * a user finds a server nobody has published yet.
 *
 * It lives in `_lib` and is called from `api/mcp-servers.ts` rather than being
 * its own route, because Vercel deploys one Function per file under `api/` and
 * this project has already failed a production deploy by going over the limit
 * (see tests/api/deployableSurface.test.ts). Two related capabilities, one
 * Function.
 *
 * **Everything returned here is untrusted.** Names, descriptions and URLs are
 * written by whoever published the server. Nothing is dialled at this stage;
 * adding a server is a separate, deliberate action, and it revalidates the URL.
 */

const REGISTRY_URL = 'https://registry.modelcontextprotocol.io/v0/servers';
const REQUEST_TIMEOUT_MS = 10_000;

/** What the client gets. Deliberately narrow — the registry entry is much larger. */
export interface RegistryServerResult {
  name: string;
  title: string;
  description: string;
  version: string;
  /** The streamable-HTTP endpoint, when the server publishes one. */
  remoteUrl: string | null;
  /** Whether that endpoint requires a secret header the user would supply. */
  requiresAuth: boolean;
  repositoryUrl: string | null;
}

interface RegistryRemote {
  type?: string;
  url?: string;
  headers?: Array<{ name?: string; isSecret?: boolean; isRequired?: boolean }>;
}

interface RegistryEntry {
  server?: {
    name?: string;
    title?: string;
    description?: string;
    version?: string;
    remotes?: RegistryRemote[];
    repository?: { url?: string };
  };
}

/**
 * Pick the endpoint we could actually talk to.
 *
 * `mcpClient` speaks Streamable HTTP with an SSE fallback, so those are the
 * two remote types worth surfacing. A server published only as a stdio package
 * runs as a local process, which this product has no way to host — showing it
 * would be offering something that cannot work.
 */
function usableRemote(remotes: RegistryRemote[] | undefined): RegistryRemote | null {
  if (!Array.isArray(remotes)) return null;
  const supported = remotes.filter(remote =>
    (remote.type === 'streamable-http' || remote.type === 'sse')
    && typeof remote.url === 'string'
    && remote.url.startsWith('https://'));
  // Prefer the modern transport when a server publishes both.
  return supported.find(remote => remote.type === 'streamable-http') ?? supported[0] ?? null;
}

export function toRegistryResult(entry: RegistryEntry): RegistryServerResult | null {
  const server = entry?.server;
  if (!server?.name) return null;

  const remote = usableRemote(server.remotes);
  // No remotely reachable endpoint means nothing this product can connect to.
  if (!remote?.url) return null;

  return {
    name: String(server.name).slice(0, 200),
    title: String(server.title || server.name).slice(0, 120),
    description: String(server.description || '').replace(/\s+/g, ' ').trim().slice(0, 400),
    version: String(server.version || '').slice(0, 40),
    remoteUrl: remote.url,
    requiresAuth: (remote.headers || []).some(header => header?.isSecret || header?.isRequired),
    repositoryUrl: typeof server.repository?.url === 'string' ? server.repository.url.slice(0, 300) : null,
  };
}


export interface RegistrySearchOptions {
  query?: string;
  limit?: number;
}

export type RegistrySearchOutcome =
  | { ok: true; servers: RegistryServerResult[] }
  | { ok: false; status: number; code: 'PROVIDER_DOWN' | 'TIMEOUT'; message: string };

export async function searchMcpRegistry(options: RegistrySearchOptions = {}): Promise<RegistrySearchOutcome> {
  const limit = options.limit ?? 15;
  const url = new URL(REGISTRY_URL);
  if (options.query) url.searchParams.set('search', options.query);
  // Over-fetch a little, because entries without a usable remote are dropped.
  url.searchParams.set('limit', String(Math.min(limit * 3, 100)));

  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) {
      return { ok: false, status: 502, code: 'PROVIDER_DOWN', message: `The MCP registry returned ${response.status}` };
    }

    const body = await response.json() as { servers?: RegistryEntry[] };
    const servers = (body.servers || [])
      .map(toRegistryResult)
      .filter((entry): entry is RegistryServerResult => entry !== null)
      .slice(0, limit);
    return { ok: true, servers };
  } catch (error: unknown) {
    return error instanceof Error && error.name === 'TimeoutError'
      ? { ok: false, status: 504, code: 'TIMEOUT', message: 'The MCP registry took too long to respond' }
      : { ok: false, status: 502, code: 'PROVIDER_DOWN', message: 'The MCP registry could not be reached' };
  }
}
