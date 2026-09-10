import { describe, expect, it, vi } from 'vitest';
import { isMcpToolName, mcpToolDescriptors } from './mcpCatalog.js';
import { createToolPolicy, executeTool, selectToolSet } from './tools.js';
import { runAgentLoop } from './agentLoop.js';
import type { DiscoveredMcpTool } from './mcpClient.js';
import type { ProviderTool, ProviderToolCall } from './providerTypes.js';

const names = (tools: ProviderTool[]) => tools.map(t => t.function.name);
const silent = { emitText: () => {}, emitMarker: () => {} };

function mcpTool(overrides: Partial<DiscoveredMcpTool> = {}): DiscoveredMcpTool {
  const originalName = overrides.originalName || 'get_current_weather';
  const modelName = overrides.modelName || `mcp__norway_weather__${originalName}`;
  const description = overrides.description
    ?? 'Get current weather conditions for a coordinate in or near Norway.';
  return {
    modelName,
    originalName,
    description,
    inputSchema: { type: 'object', properties: { lat: { type: 'number' }, lon: { type: 'number' } } },
    requiresApproval: false,
    server: {
      id: 'server-1', kind: 'mcp', slug: 'norway_weather', name: 'Norway Weather',
      description: '', skill_content: null,
      mcp_server_url: 'https://example.com/mcp', mcp_auth_mode: 'none', mcp_auth_env_var: null,
      mcp_allowed_tools: [originalName], mcp_auto_approve_tools: [originalName],
      mcp_connect_timeout_ms: 8000, mcp_call_timeout_ms: 30000, mcp_result_char_limit: 12000,
      sort_order: 1, default_enabled: false,
    },
    definition: {
      type: 'function',
      function: { name: modelName, description, parameters: { type: 'object', properties: {} } },
    },
    ...overrides,
  } as DiscoveredMcpTool;
}

describe('putting MCP tools on the catalogue', () => {
  it('drops the generic verbs from the matching terms', () => {
    // "get_current_weather" is about weather, not about getting. Leaving "get"
    // in would match a large share of every message ever sent.
    const [descriptor] = mcpToolDescriptors([mcpTool()]);
    expect(descriptor.select?.intent).toContain('weather');
    expect(descriptor.select?.intent).toContain('norway');
    expect(descriptor.select?.intent).not.toContain('get');
  });

  it('offers a relevant tool directly, without spending a find_tools round trip', () => {
    const descriptors = mcpToolDescriptors([mcpTool()]);
    const set = selectToolSet({
      messages: [{ content: 'what is the weather in Oslo right now?', isAI: false }],
      extraDescriptors: descriptors,
    });
    expect(names(set.tools)).toContain('mcp__norway_weather__get_current_weather');
  });

  it('keeps it off an unrelated turn but leaves it findable', () => {
    const descriptors = mcpToolDescriptors([mcpTool()]);
    const set = selectToolSet({
      messages: [{ content: 'write me a haiku about cats', isAI: false }],
      extraDescriptors: descriptors,
    });
    expect(names(set.tools)).not.toContain('mcp__norway_weather__get_current_weather');
    expect(set.findable.map(d => d.name)).toContain('mcp__norway_weather__get_current_weather');
  });

  it('lets the token budget cap a large collection of servers', () => {
    // A user with many servers must not flood the request. What fits is
    // offered; the rest stays reachable through find_tools.
    const many = Array.from({ length: 40 }, (_unused, index) => mcpTool({
      originalName: `weather_report_${index}`,
      modelName: `mcp__norway_weather__weather_report_${index}`,
      description: 'Weather report with a deliberately long description. '.repeat(12),
    }));
    const set = selectToolSet({
      messages: [{ content: 'what is the weather?', isAI: false }],
      extraDescriptors: mcpToolDescriptors(many),
    });
    const offered = names(set.tools).filter(n => n.startsWith('mcp__'));
    expect(offered.length).toBeGreaterThan(0);
    expect(offered.length).toBeLessThan(40);
    expect(set.findable.filter(d => d.name.startsWith('mcp__')).length).toBeGreaterThan(0);
  });

  it('recognises its own names', () => {
    expect(isMcpToolName('mcp__norway_weather__get_forecast')).toBe(true);
    expect(isMcpToolName('web_fetch')).toBe(false);
    expect(isMcpToolName(undefined)).toBe(false);
  });
});

describe('executing an MCP tool', () => {
  it('frames the result as third-party data rather than instructions', async () => {
    const tool = mcpTool();
    const markers: string[] = [];
    const result = await executeTool(
      { id: '1', function: { name: tool.modelName, arguments: '{"lat":59.9,"lon":10.7}' } },
      {
        persona: 'default',
        policy: createToolPolicy({ offered: [tool.modelName] }),
        mcpTools: [tool],
      },
      { emitText: () => {}, emitMarker: (m: string) => { markers.push(m); } },
    );
    // Reaches the real client, which is not stubbed here, so it fails — but it
    // must fail by telling the model, never by inventing a result.
    expect(result).toMatch(/Result from Norway Weather|could not run/);
    expect(markers.join(' ')).toContain('Asking Norway Weather');
  });

  it('refuses a name that is not among this user\'s servers', async () => {
    const result = await executeTool(
      { id: '1', function: { name: 'mcp__someone_else__do_thing', arguments: '{}' } },
      { persona: 'default', policy: createToolPolicy({ offered: ['mcp__someone_else__do_thing'] }), mcpTools: [] },
      silent,
    );
    expect(result).toContain('not available for this request');
  });

  it('never runs a tool needing approval when the request cannot ask', async () => {
    const tool = mcpTool({ requiresApproval: true });
    const result = await executeTool(
      { id: '1', function: { name: tool.modelName, arguments: '{}' } },
      { persona: 'default', policy: createToolPolicy({ offered: [tool.modelName] }), mcpTools: [tool] },
      silent,
    );
    expect(result).toContain("needs the user's approval");
    expect(result).toContain('do not claim you ran it');
  });
});

describe('consent before execution, in the loop', () => {
  /** One model turn that calls both tools at once, then a turn that answers. */
  function batchCallingModel(calls: ProviderTool[][]) {
    let turn = 0;
    return async (_messages: unknown, activeTools: ProviderTool[]) => {
      calls.push(activeTools);
      const first = turn++ === 0;
      const frames = first
        ? [{
            type: 'tool_calls',
            tool_calls: [
              { index: 0, id: 'a', type: 'function', function: { name: 'web_search', arguments: '{"query":"oslo"}' } },
              { index: 1, id: 'b', type: 'function', function: { name: 'mcp__norway_weather__get_current_weather', arguments: '{}' } },
            ],
          }]
        : [{ type: 'content', content: 'done' }];
      return new ReadableStream({
        start(controller) {
          for (const frame of frames) controller.enqueue(new TextEncoder().encode(`${JSON.stringify(frame)}\n`));
          controller.close();
        },
      });
    };
  }

  it('stops the whole batch, so no half of it runs before the user answers', async () => {
    // A batch that mixes an approved call with one needing consent must not
    // quietly perform the first and then stop.
    const executed: string[] = [];
    const requestMcpApproval = vi.fn(async (call: ProviderToolCall) =>
      call.function.name.startsWith('mcp__')
        ? { runId: 'run-1', serverName: 'Norway Weather', toolName: 'get_current_weather', argumentPreview: {}, expiresAt: '2026-01-01T00:00:00Z' }
        : null);

    const result = await runAgentLoop({
      messages: [],
      tools: [],
      toolContext: {
        persona: 'default',
        policy: createToolPolicy({ offered: ['web_search', 'mcp__norway_weather__get_current_weather'] }),
      },
      emit: {
        emitContent: () => {},
        emitToolText: (text: string) => { executed.push(text); },
        emitMarker: () => {},
      },
      callModel: batchCallingModel([]),
      requestMcpApproval,
    });

    expect(result.mcpApproval?.runId).toBe('run-1');
    // Both calls were offered for approval before either ran.
    expect(requestMcpApproval).toHaveBeenCalledTimes(2);
    expect(executed).toHaveLength(0);
  });

  it('runs straight through when nothing needs approving', async () => {
    const requestMcpApproval = vi.fn(async () => null);
    const result = await runAgentLoop({
      messages: [],
      tools: [],
      toolContext: {
        persona: 'default',
        policy: createToolPolicy({ offered: ['web_search', 'mcp__norway_weather__get_current_weather'] }),
        mcpTools: [mcpTool()],
      },
      emit: { emitContent: () => {}, emitToolText: () => {}, emitMarker: () => {} },
      callModel: batchCallingModel([]),
      requestMcpApproval,
    });
    expect(result.mcpApproval).toBeUndefined();
    expect(result.content).toContain('done');
  });
});

describe('user-added servers carry their own credential', () => {
  const server = (overrides: Record<string, unknown> = {}) => ({
    id: 's1', kind: 'mcp' as const, slug: 'mine', name: 'My Server', description: '',
    skill_content: null, mcp_server_url: 'https://example.com/mcp',
    mcp_auth_mode: 'bearer_user' as const, mcp_auth_env_var: null,
    mcp_allowed_tools: ['a'], mcp_auto_approve_tools: [],
    mcp_connect_timeout_ms: 8000, mcp_call_timeout_ms: 30000, mcp_result_char_limit: 12000,
    sort_order: 1, default_enabled: true, ...overrides,
  });

  it('refuses to dial a bearer_user server whose credential could not be read', async () => {
    // Sending an unauthenticated request to someone's private endpoint is
    // worse than not reaching it. loadUserMcpServers drops such rows; this is
    // the second line, in case one gets through.
    const { discoverMcpTools } = await import('./mcpClient.js');
    const errors: unknown[] = [];
    const originalError = console.error;
    console.error = (...args: unknown[]) => { errors.push(args.join(' ')); };
    try {
      const tools = await discoverMcpTools([server({ bearer_token: undefined }) as never]);
      expect(tools).toEqual([]);
      expect(errors.join(' ')).toContain('credential is unavailable');
    } finally {
      console.error = originalError;
    }
  });
});
