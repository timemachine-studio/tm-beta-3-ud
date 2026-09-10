/**
 * Putting a user's MCP tools on the tool catalogue.
 *
 * MCP is the first genuinely unbounded source of tools: a user can enable
 * several servers, each publishing a dozen, and none of it is known when the
 * code ships. That is exactly the shape `shared/toolCatalog.ts` was built for
 * — a token budget decides how many get into a request, and `find_tools`
 * reaches whatever did not fit.
 *
 * So MCP tools are `gated`, not `catalog`. It is tempting to make them
 * catalog-tier and let find_tools be the only door, but that costs a whole
 * extra model round trip for the common case: a user who has enabled a
 * weather server and asks about the weather should not need the model to go
 * looking. Gating them means an obviously-relevant tool is offered directly,
 * the budget stops a large collection flooding the request, and find_tools
 * still reaches the rest. Nothing is lost by guessing wrong.
 */

import type { DiscoveredMcpTool } from './mcpClient.js';
import type { SelectSpec, ToolDescriptor } from '../../shared/toolCatalog.js';

/**
 * Words that say nothing about what a tool is for.
 *
 * Mostly the verbs every API uses. `get_current_weather` is about weather, not
 * about getting, and leaving `get` in would match half the messages ever sent.
 */
const GENERIC_TERMS = new Set([
  'get', 'set', 'list', 'fetch', 'read', 'write', 'create', 'update', 'delete',
  'remove', 'add', 'put', 'post', 'query', 'search', 'find', 'lookup', 'load',
  'run', 'call', 'exec', 'execute', 'tool', 'tools', 'api', 'data', 'info',
  'information', 'result', 'results', 'value', 'values', 'name', 'names',
  'return', 'returns', 'given', 'from', 'this', 'that', 'with', 'for', 'the',
  'and', 'you', 'your', 'use', 'used', 'using', 'can', 'will', 'about',
  'server', 'service', 'endpoint', 'request', 'response', 'mcp',
]);

/** Terms the packer will match this tool on. */
function intentTerms(tool: DiscoveredMcpTool): string[] {
  const words = (text: string) => text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(word => word.length > 3 && !GENERIC_TERMS.has(word));

  const terms = new Set<string>([
    ...words(tool.originalName),
    ...words(tool.server.name),
    // The description's opening words are where an MCP author says what the
    // tool is for; the tail is usually parameter minutiae.
    ...words(tool.description).slice(0, 12),
  ]);

  // Bounded so one verbose description cannot dominate the matcher.
  return [...terms].slice(0, 24);
}

/** A one-line summary for find_tools, kept short enough to list many. */
function summarise(tool: DiscoveredMcpTool): string {
  const description = tool.description.replace(/\s+/g, ' ').trim();
  const firstSentence = description.split(/(?<=[.!?])\s/)[0] || description;
  const body = firstSentence.length > 90 ? `${firstSentence.slice(0, 87)}...` : firstSentence;
  return `${tool.server.name}: ${body || tool.originalName}`;
}

/**
 * Turn this user's discovered MCP tools into catalogue descriptors.
 *
 * `origin: 'registry'` because these are not built in — they are data, from a
 * server we do not control, and everything downstream should treat them that
 * way.
 */
export function mcpToolDescriptors(discovered: readonly DiscoveredMcpTool[]): ToolDescriptor[] {
  return discovered.map((tool): ToolDescriptor => {
    const select: SelectSpec = { intent: intentTerms(tool) };
    return {
      name: tool.modelName,
      definition: {
        type: 'function',
        function: {
          name: tool.modelName,
          description: tool.description,
          parameters: tool.inputSchema,
        },
      },
      runtime: 'server',
      tier: 'gated',
      summary: summarise(tool),
      select,
      origin: 'registry',
    };
  });
}

/** Whether a tool name belongs to an MCP server rather than a built-in. */
export function isMcpToolName(name: string | undefined | null): boolean {
  return !!name && name.startsWith('mcp__');
}
