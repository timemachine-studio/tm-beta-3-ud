import { Client, SSEClientTransport, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import type { ServerFlightControl } from './flightControls.js';
import { assertPublicUrl } from './safeUrl.js';

export interface DiscoveredMcpTool {
  modelName: string;
  originalName: string;
  server: ServerFlightControl;
  description: string;
  inputSchema: Record<string, unknown>;
  requiresApproval: boolean;
  definition: {
    type: 'function';
    function: {
      name: string;
      description: string;
      parameters: Record<string, unknown>;
    };
  };
}

function timeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  return Promise.race([
    promise.finally(() => clearTimeout(timer)),
    new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error(`${label} timed out`)), timeoutMs);
    }),
  ]);
}

function requestHeaders(server: ServerFlightControl): HeadersInit {
  const headers: Record<string, string> = {};
  if (server.mcp_auth_mode === 'bearer_env') {
    const variable = server.mcp_auth_env_var || '';
    if (!/^MCP_[A-Z0-9_]+$/.test(variable)) throw new Error('Invalid MCP credential configuration');
    const token = process.env[variable];
    if (!token) throw new Error('MCP server credential is not configured');
    headers.Authorization = `Bearer ${token}`;
  }
  if (server.mcp_auth_mode === 'bearer_user') {
    // Decrypted upstream by loadUserMcpServers. Absent means the credential
    // could not be read, and an unauthenticated call to a private endpoint is
    // worse than no call — so this refuses rather than dialling without it.
    if (!server.bearer_token) throw new Error('MCP server credential is unavailable');
    headers.Authorization = `Bearer ${server.bearer_token}`;
  }
  return headers;
}

async function connect(server: ServerFlightControl): Promise<Client> {
  if (!server.mcp_server_url) throw new Error('MCP server URL is missing');
  // Same validation as web_fetch, from the same module — see safeUrl.ts.
  const url = await assertPublicUrl(server.mcp_server_url, { protocols: ['https:'] })
    .catch((error: unknown) => {
      throw new Error(`MCP server URL rejected: ${error instanceof Error ? error.message : String(error)}`);
    });
  const headers = requestHeaders(server);
  const createClient = () => new Client(
    { name: 'timemachine-chat', version: '0.3.0' },
    { versionNegotiation: { mode: 'auto', probe: { maxRetries: 0 } } },
  );

  const modern = createClient();
  try {
    const transport = new StreamableHTTPClientTransport(url, {
      requestInit: { headers, redirect: 'error' },
      reconnectionOptions: {
        maxReconnectionDelay: 2000,
        initialReconnectionDelay: 250,
        reconnectionDelayGrowFactor: 1.5,
        maxRetries: 0,
      },
    });
    await timeout(modern.connect(transport), server.mcp_connect_timeout_ms, `${server.name} connection`);
    return modern;
  } catch (modernError) {
    await modern.close().catch(() => undefined);
    const legacy = createClient();
    try {
      const transport = new SSEClientTransport(url, {
        requestInit: { headers, redirect: 'error' },
        eventSourceInit: { fetch: (input, init) => fetch(input, { ...init, redirect: 'error', headers: { ...Object.fromEntries(new Headers(init?.headers)), ...Object.fromEntries(new Headers(headers)) } }) },
      });
      await timeout(legacy.connect(transport), server.mcp_connect_timeout_ms, `${server.name} legacy connection`);
      return legacy;
    } catch (legacyError) {
      await legacy.close().catch(() => undefined);
      throw new Error(
        `${server.name} is unavailable: ${legacyError instanceof Error ? legacyError.message : String(modernError)}`,
        { cause: legacyError },
      );
    }
  }
}

function modelToolName(serverSlug: string, toolName: string): string {
  const sanitized = `mcp__${serverSlug}__${toolName}`.replace(/[^a-zA-Z0-9_-]/g, '_');
  return sanitized.slice(0, 64);
}

export interface DiscoverOptions {
  /**
   * Return everything the server advertises, ignoring the allow-list.
   *
   * Only for probing a server the user is adding: the allow-list is built
   * *from* that probe, so filtering against an empty one would find nothing.
   * Never use this on a chat request — the allow-list is what keeps a server
   * from adding tools after the user approved it.
   */
  allowAllTools?: boolean;
}

export async function discoverMcpTools(
  servers: ServerFlightControl[],
  options: DiscoverOptions = {},
): Promise<DiscoveredMcpTool[]> {
  const discovered: DiscoveredMcpTool[] = [];
  await Promise.all(servers.map(async server => {
    let client: Client | null = null;
    try {
      client = await connect(server);
      const response = await timeout(client.listTools(), server.mcp_connect_timeout_ms, `${server.name} tool discovery`);
      const allowed = new Set(server.mcp_allowed_tools || []);
      for (const tool of response.tools) {
        if (!options.allowAllTools && !allowed.has(tool.name)) continue;
        const modelName = modelToolName(server.slug, tool.name);
        discovered.push({
          modelName,
          originalName: tool.name,
          server,
          description: String(tool.description || `${server.name}: ${tool.name}`).slice(0, 1000),
          inputSchema: (tool.inputSchema || { type: 'object', properties: {} }) as Record<string, unknown>,
          requiresApproval: !(server.mcp_auto_approve_tools || []).includes(tool.name),
          definition: {
            type: 'function',
            function: {
              name: modelName,
              description: String(tool.description || `${server.name}: ${tool.name}`).slice(0, 1000),
              parameters: (tool.inputSchema || { type: 'object', properties: {} }) as Record<string, unknown>,
            },
          },
        });
      }
    } catch (error) {
      console.error(`[MCP] ${server.slug} discovery failed:`, error instanceof Error ? error.message : error);
    } finally {
      await client?.close().catch(() => undefined);
    }
  }));
  return discovered.sort((a, b) => a.server.sort_order - b.server.sort_order || a.originalName.localeCompare(b.originalName)).slice(0, 32);
}

function serializeContent(value: unknown, limit: number): string {
  const content = value && typeof value === 'object' && 'content' in value
    ? (value as { content: unknown }).content
    : value;
  let serialized: string;
  if (Array.isArray(content)) {
    serialized = content.map(block => {
      if (block && typeof block === 'object' && (block as { type?: string }).type === 'text') {
        return String((block as { text?: string }).text || '');
      }
      if (block && typeof block === 'object' && (block as { type?: string }).type === 'resource_link') {
        return `[Resource link omitted: ${String((block as { name?: string }).name || 'external resource')}]`;
      }
      return '[Unsupported MCP content omitted]';
    }).join('\n');
  } else {
    serialized = typeof content === 'string' ? content : (JSON.stringify(content) || String(content ?? ''));
  }
  return serialized.slice(0, limit);
}

export async function executeMcpTool(tool: DiscoveredMcpTool, args: Record<string, unknown>): Promise<string> {
  const client = await connect(tool.server);
  try {
    const result = await timeout(
      client.callTool({ name: tool.originalName, arguments: args }),
      tool.server.mcp_call_timeout_ms,
      `${tool.server.name}.${tool.originalName}`,
    );
    const serialized = serializeContent(result, tool.server.mcp_result_char_limit);
    return result.isError ? `MCP tool error: ${serialized}` : serialized;
  } finally {
    await client.close().catch(() => undefined);
  }
}

// ─── Discovery cache ────────────────────────────────────────────────────────

/**
 * How long a server's tool list is reused within one warm instance.
 *
 * Discovery is a full connect + `tools/list` round trip per server, on the hot
 * path of a chat message. A server's tool list changes when its operator ships
 * a new version, which is rare; paying for that round trip on every message is
 * not. Five minutes keeps a changed list from lingering long while removing
 * discovery from almost every request.
 *
 * Keyed by server id *and* the catalog row's `updated_at`, so an operator
 * editing the allow-list in Supabase invalidates it immediately rather than
 * waiting out the TTL.
 */
const DISCOVERY_TTL_MS = 5 * 60_000;
const DISCOVERY_CACHE_MAX = 200;

const discoveryCache = new Map<string, { expires: number; tools: DiscoveredMcpTool[] }>();

function discoveryKey(server: ServerFlightControl): string {
  const revision = (server as ServerFlightControl & { updated_at?: string }).updated_at || '';
  return `${server.id}:${revision}:${(server.mcp_allowed_tools || []).join(',')}`;
}

/**
 * Discover tools for these servers, reusing recent results.
 *
 * A server that fails discovery is cached as an empty list for a shorter
 * window than a success would be — long enough to stop a dead host being
 * dialled on every message, short enough that it comes back quickly.
 */
export async function discoverMcpToolsCached(servers: ServerFlightControl[]): Promise<DiscoveredMcpTool[]> {
  if (servers.length === 0) return [];

  const now = Date.now();
  const fresh: DiscoveredMcpTool[] = [];
  const stale: ServerFlightControl[] = [];

  for (const server of servers) {
    const cached = discoveryCache.get(discoveryKey(server));
    if (cached && cached.expires > now) fresh.push(...cached.tools);
    else stale.push(server);
  }

  if (stale.length > 0) {
    const discovered = await discoverMcpTools(stale);
    for (const server of stale) {
      const tools = discovered.filter(tool => tool.server.id === server.id);
      if (discoveryCache.size >= DISCOVERY_CACHE_MAX) {
        const oldest = discoveryCache.keys().next().value;
        if (oldest !== undefined) discoveryCache.delete(oldest);
      }
      discoveryCache.set(discoveryKey(server), {
        // A failed discovery yields no tools; re-dial sooner than a success.
        expires: now + (tools.length > 0 ? DISCOVERY_TTL_MS : 60_000),
        tools,
      });
    }
    fresh.push(...discovered);
  }

  return fresh;
}

/** Drop every cached tool list. Exported for tests. */
export function clearMcpDiscoveryCache(): void {
  discoveryCache.clear();
}
