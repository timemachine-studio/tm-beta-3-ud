import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ServerFlightControl } from './flightControls';

interface MockTransport {
  kind: 'streamable-http' | 'sse';
  url: URL;
  options: unknown;
}

interface MockClient {
  info: unknown;
  options: unknown;
  connect: ReturnType<typeof vi.fn>;
  listTools: ReturnType<typeof vi.fn>;
  close: ReturnType<typeof vi.fn>;
}

const mcp = vi.hoisted(() => ({
  clients: [] as MockClient[],
  transports: [] as MockTransport[],
  streamableError: null as Error | null,
  tools: [] as Array<{ name: string; description?: string; inputSchema?: Record<string, unknown> }>,
}));

vi.mock('node:dns/promises', () => ({
  lookup: vi.fn(async () => [{ address: '203.0.113.10', family: 4 }]),
}));

vi.mock('@modelcontextprotocol/client', () => {
  class Client {
    info: unknown;
    options: unknown;
    connect = vi.fn(async (transport: MockTransport) => {
      if (transport.kind === 'streamable-http' && mcp.streamableError) throw mcp.streamableError;
    });
    listTools = vi.fn(async () => ({ tools: mcp.tools }));
    callTool = vi.fn();
    close = vi.fn(async () => undefined);

    constructor(info: unknown, options: unknown) {
      this.info = info;
      this.options = options;
      mcp.clients.push(this);
    }
  }

  class StreamableHTTPClientTransport {
    readonly kind = 'streamable-http' as const;
    constructor(public url: URL, public options: unknown) {
      mcp.transports.push(this);
    }
  }

  class SSEClientTransport {
    readonly kind = 'sse' as const;
    constructor(public url: URL, public options: unknown) {
      mcp.transports.push(this);
    }
  }

  return { Client, StreamableHTTPClientTransport, SSEClientTransport };
});

import { discoverMcpTools } from './mcpClient';

const server: ServerFlightControl = {
  id: 'mcp-1',
  kind: 'mcp',
  slug: 'fixture',
  name: 'Fixture MCP',
  description: 'Test server',
  skill_content: null,
  mcp_server_url: 'https://mcp.example.test/mcp',
  mcp_auth_mode: 'none',
  mcp_auth_env_var: null,
  mcp_allowed_tools: ['allowed'],
  mcp_auto_approve_tools: [],
  mcp_connect_timeout_ms: 1_000,
  mcp_call_timeout_ms: 1_000,
  mcp_result_char_limit: 4_096,
  sort_order: 1,
  default_enabled: true,
};

describe('MCP client transport compatibility', () => {
  beforeEach(() => {
    mcp.clients.length = 0;
    mcp.transports.length = 0;
    mcp.streamableError = null;
    mcp.tools = [];
  });

  it('uses Streamable HTTP first, opts into protocol negotiation, and filters discovered tools', async () => {
    mcp.tools = [
      { name: 'blocked', description: 'Not enabled', inputSchema: { type: 'object' } },
      { name: 'allowed', description: 'Enabled tool', inputSchema: { type: 'object', properties: { query: { type: 'string' } } } },
    ];

    const tools = await discoverMcpTools([server]);

    expect(mcp.transports.map(transport => transport.kind)).toEqual(['streamable-http']);
    expect(mcp.clients[0].options).toEqual({
      versionNegotiation: { mode: 'auto', probe: { maxRetries: 0 } },
    });
    expect(tools).toHaveLength(1);
    expect(tools[0]).toMatchObject({
      modelName: 'mcp__fixture__allowed',
      originalName: 'allowed',
      description: 'Enabled tool',
      requiresApproval: true,
    });
    expect(mcp.clients[0].close).toHaveBeenCalledOnce();
  });

  it('closes a failed modern client and retries discovery over legacy SSE', async () => {
    mcp.streamableError = new Error('Streamable HTTP unavailable');
    mcp.tools = [{ name: 'allowed', description: 'Legacy tool', inputSchema: { type: 'object' } }];

    const tools = await discoverMcpTools([server]);

    expect(mcp.transports.map(transport => transport.kind)).toEqual(['streamable-http', 'sse']);
    expect(mcp.clients).toHaveLength(2);
    expect(mcp.clients[0].close).toHaveBeenCalledOnce();
    expect(mcp.clients[1].listTools).toHaveBeenCalledOnce();
    expect(mcp.clients[1].close).toHaveBeenCalledOnce();
    expect(tools.map(tool => tool.originalName)).toEqual(['allowed']);
  });
});
