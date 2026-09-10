/**
 * Storing the continuation state for an MCP call that needs the user's yes.
 *
 * The turn stops here. There is no next leg from the client the way there is
 * for a device tool — `/api/mcp-approval` finishes the turn server-side if the
 * user approves — so everything needed to resume has to be written down first:
 * the arguments, the tool, and the transcript up to this point.
 *
 * The row is the security boundary. `mcp_tool_runs` has no browser policies at
 * all (see the migration), so exact arguments and continuation state are only
 * ever readable by the service role, and the argument hash is what stops an
 * approved run being resumed with different arguments than the user saw.
 */

import { createHash } from 'node:crypto';
import { flightControlsAdmin } from './flightControls.js';
import type { DiscoveredMcpTool } from './mcpClient.js';
import type { McpApprovalPayload } from './agentLoop.js';
import type { ProviderMessage, ProviderToolCall } from './providerTypes.js';

/** Keep the card readable, and keep an enormous argument out of the database. */
const PREVIEW_VALUE_CHARS = 300;
const PREVIEW_KEYS = 12;

/**
 * A shortened copy of the arguments, for showing the user what they are
 * approving. The full arguments live in `continuation_state`; this is the part
 * that gets rendered, so it is bounded.
 */
function argumentPreview(args: Record<string, unknown>): Record<string, unknown> {
  const preview: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(args).slice(0, PREVIEW_KEYS)) {
    if (typeof value === 'string') {
      preview[key] = value.length > PREVIEW_VALUE_CHARS ? `${value.slice(0, PREVIEW_VALUE_CHARS)}…` : value;
    } else if (value === null || ['number', 'boolean'].includes(typeof value)) {
      preview[key] = value;
    } else {
      const serialised = JSON.stringify(value) ?? String(value);
      preview[key] = serialised.length > PREVIEW_VALUE_CHARS ? `${serialised.slice(0, PREVIEW_VALUE_CHARS)}…` : JSON.parse(serialised);
    }
  }
  return preview;
}

export interface McpApprovalContext {
  userId: string;
  chatSessionId: string | null;
  mcpTools: readonly DiscoveredMcpTool[];
  provider: string;
  model: string;
  temperature: number;
  maxTokens: number;
  reasoningEffort?: string;
}

/**
 * Build the `requestMcpApproval` callback the agent loop takes.
 *
 * Returns null for anything that may run unattended — a built-in tool, a tool
 * from a server that auto-approved it, or a name we do not recognise (which
 * `executeTool` refuses separately). Only a real approval-required MCP call
 * produces a payload, and only then does the loop stop.
 */
export function createMcpApprovalRequester(ctx: McpApprovalContext) {
  return async function requestMcpApproval(
    call: ProviderToolCall,
    messages: ProviderMessage[],
  ): Promise<McpApprovalPayload | null> {
    const tool = ctx.mcpTools.find(candidate => candidate.modelName === call.function?.name);
    if (!tool || !tool.requiresApproval) return null;

    let args: Record<string, unknown>;
    try {
      const parsed = JSON.parse(call.function.arguments || '{}');
      args = parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch {
      // Unparseable arguments are not something to ask a user to approve.
      // executeTool tells the model to fix them; let the run continue there.
      return null;
    }

    // Must match how /api/mcp-approval recomputes it, or every approval fails
    // integrity validation.
    const argumentHash = createHash('sha256').update(JSON.stringify(args)).digest('hex');

    const { data, error } = await flightControlsAdmin
      .from('mcp_tool_runs')
      .insert({
        user_id: ctx.userId,
        catalog_id: tool.server.id,
        chat_session_id: ctx.chatSessionId,
        tool_name: tool.originalName,
        argument_preview: argumentPreview(args),
        argument_hash: argumentHash,
        status: 'pending',
        continuation_state: {
          args,
          toolCallId: call.id,
          modelToolName: tool.modelName,
          currentMessages: [...messages, {
            role: 'assistant',
            content: null,
            tool_calls: [call],
          }],
          provider: ctx.provider,
          model: ctx.model,
          temperature: ctx.temperature,
          maxTokens: ctx.maxTokens,
          ...(ctx.reasoningEffort ? { reasoningEffort: ctx.reasoningEffort } : {}),
        },
      })
      .select('id,expires_at')
      .single();

    if (error || !data) {
      // Failing to record the request must not become permission to skip it.
      // Returning null here would run the tool unapproved, so this throws and
      // the turn fails loudly instead.
      throw new Error(`Could not record the approval request: ${error?.message || 'unknown error'}`);
    }

    return {
      runId: data.id as string,
      serverName: tool.server.name,
      toolName: tool.originalName,
      argumentPreview: argumentPreview(args),
      expiresAt: data.expires_at as string,
    };
  };
}
