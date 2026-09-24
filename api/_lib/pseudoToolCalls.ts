import type { ProviderTool, ProviderToolCall } from './providerTypes.js';

const MINIMAX_SEPARATOR = /\]\s*<\]\s*minimax\s*\[>\s*\[/gi;
const TOOL_BLOCK = /<tool_call\b[^>]*>[\s\S]*?(?:<\/tool_call>|$)/gi;

function decodeXml(value: string): string {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

function parameterType(tool: ProviderTool, name: string): string | undefined {
  const properties = tool.function.parameters?.properties;
  if (!properties || typeof properties !== 'object' || Array.isArray(properties)) return undefined;
  const property = (properties as Record<string, unknown>)[name];
  if (!property || typeof property !== 'object' || Array.isArray(property)) return undefined;
  return typeof (property as { type?: unknown }).type === 'string'
    ? (property as { type: string }).type
    : undefined;
}

function coerceValue(value: string, type: string | undefined): unknown {
  const decoded = decodeXml(value.trim());
  if (!decoded) return undefined;
  if (type === 'integer' || type === 'number') {
    const numeric = Number(decoded);
    return Number.isFinite(numeric) ? numeric : decoded;
  }
  if (type === 'boolean') {
    if (/^true$/i.test(decoded)) return true;
    if (/^false$/i.test(decoded)) return false;
  }
  if (type === 'array' || type === 'object') {
    try { return JSON.parse(decoded); } catch { return decoded; }
  }
  return decoded;
}

/**
 * MiniMax occasionally writes its private XML tool syntax into `content`
 * instead of the OpenAI-compatible `tool_calls` field. Normalize only exact
 * names offered on this iteration: arbitrary model text can never become an
 * executable capability through this compatibility path.
 */
export function parsePseudoToolCalls(
  content: string,
  offeredTools: ProviderTool[],
  idPrefix: string,
): ProviderToolCall[] {
  if (!/<tool_call\b/i.test(content)) return [];

  const offered = new Map(offeredTools.map(tool => [tool.function.name, tool]));
  const normalized = content.replace(MINIMAX_SEPARATOR, '');
  const calls: ProviderToolCall[] = [];
  const invokePattern = /<invoke\s+name=["']([^"']+)["'][^>]*>([\s\S]*?)<\/invoke>/gi;
  let invoke: RegExpExecArray | null;

  while ((invoke = invokePattern.exec(normalized))) {
    const name = decodeXml(invoke[1].trim());
    const tool = offered.get(name);
    if (!tool) continue;

    const args: Record<string, unknown> = {};
    const parameterPattern = /<([A-Za-z_][\w.-]*)\b[^>]*>([\s\S]*?)<\/\1>/g;
    let parameter: RegExpExecArray | null;
    while ((parameter = parameterPattern.exec(invoke[2]))) {
      const parameterName = parameter[1];
      const value = coerceValue(parameter[2], parameterType(tool, parameterName));
      if (value !== undefined) args[parameterName] = value;
    }

    calls.push({
      id: `${idPrefix}_${calls.length}`,
      type: 'function',
      function: { name, arguments: JSON.stringify(args) },
    });
  }

  return calls;
}

/** Remove model-private compatibility markup from persisted/user-visible text. */
export function stripPseudoToolMarkup(content: string): string {
  return content.replace(TOOL_BLOCK, '').replace(MINIMAX_SEPARATOR, '').trim();
}
