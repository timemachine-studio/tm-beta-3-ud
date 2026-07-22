import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import type { ServerFlightControl } from './flightControls.js';

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

function isPrivateAddress(address: string): boolean {
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

async function validateServerUrl(rawUrl: string): Promise<URL> {
  const url = new URL(rawUrl);
  if (url.protocol !== 'https:') throw new Error('MCP server must use HTTPS');
  const hostname = url.hostname.toLowerCase();
  if (hostname === 'localhost' || hostname.endsWith('.local') || hostname.endsWith('.internal')) {
    throw new Error('Private MCP hosts are not allowed');
  }
  if (isIP(hostname) && isPrivateAddress(hostname)) throw new Error('Private MCP addresses are not allowed');
  if (!isIP(hostname)) {
    const addresses = await lookup(hostname, { all: true, verbatim: true });
    if (!addresses.length || addresses.some(entry => isPrivateAddress(entry.address))) {
      throw new Error('MCP host resolves to a private address');
    }
  }
  return url;
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
  return headers;
}

async function connect(server: ServerFlightControl): Promise<Client> {
  if (!server.mcp_server_url) throw new Error('MCP server URL is missing');
  const url = await validateServerUrl(server.mcp_server_url);
  const headers = requestHeaders(server);
  const createClient = () => new Client({ name: 'timemachine-chat', version: '0.3.0' });

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
      throw new Error(`${server.name} is unavailable: ${legacyError instanceof Error ? legacyError.message : String(modernError)}`);
    }
  }
}

function modelToolName(serverSlug: string, toolName: string): string {
  const sanitized = `mcp__${serverSlug}__${toolName}`.replace(/[^a-zA-Z0-9_-]/g, '_');
  return sanitized.slice(0, 64);
}

export async function discoverMcpTools(servers: ServerFlightControl[]): Promise<DiscoveredMcpTool[]> {
  const discovered: DiscoveredMcpTool[] = [];
  await Promise.all(servers.map(async server => {
    let client: Client | null = null;
    try {
      client = await connect(server);
      const response = await timeout(client.listTools(), server.mcp_connect_timeout_ms, `${server.name} tool discovery`);
      const allowed = new Set(server.mcp_allowed_tools || []);
      for (const tool of response.tools) {
        if (!allowed.has(tool.name)) continue;
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
