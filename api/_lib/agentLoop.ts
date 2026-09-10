import type { ProviderMessage, ProviderTool, ProviderToolCall } from './providerTypes.js';
// The agentic tool loop, shared by every persona and both runtimes.
//
// Previously only PRO ran a loop; Air called the model once and spliced tool
// output straight into the response, so the model never saw a tool result and
// never got a chance to reconsider a bad call. That is also what made the
// runtime backstop impossible to enforce for Air — a refusal needs a next
// iteration to land in.

import { isDeviceToolName, type DeviceToolCall } from '../../shared/deviceTools.js';
import {
  applyPolicy,
  executeTool,
  type ToolExecutionContext,
} from './tools.js';

export interface AgentLoopEmitter {
  /** Model-generated text deltas. */
  emitContent: (text: string) => void | Promise<void>;
  /** User-visible output produced by a tool (e.g. image markdown). */
  emitToolText: (text: string) => void | Promise<void>;
  /** Control markers such as [STATUS:…] and [STATUS_END]. */
  emitMarker: (marker: string) => void | Promise<void>;
}

export interface AgentLoopOptions {
  messages: ProviderMessage[];
  tools: ProviderTool[];
  toolContext: ToolExecutionContext;
  emit: AgentLoopEmitter;
  /** Runs one model turn. Provider dispatch stays with the caller. */
  callModel: (messages: ProviderMessage[], activeTools: ProviderTool[]) => Promise<ReadableStream>;
  maxIterations?: number;
  log?: (message: string) => void;
  /**
   * The caller can suspend this run and hand device tool calls to the browser.
   * Without it a device tool call falls through to executeTool's refusal, so
   * the model is told plainly rather than left waiting on a result that will
   * never come.
   */
  deviceBridge?: boolean;
  /**
   * Offer a tool call for the user's approval.
   *
   * Returns a payload when the call needs approving — the loop then stops, and
   * the caller shows the card. Returns null when the call may run unattended.
   * Supplied by the route because storing continuation state needs the request
   * transcript and Supabase, neither of which belongs in the loop.
   */
  requestMcpApproval?: (
    call: ProviderToolCall,
    messages: ProviderMessage[],
  ) => Promise<McpApprovalPayload | null>;
}

/**
 * A run stopped mid-flight because the model called a tool only the user's
 * device can execute. The caller streams this to the client, which runs the
 * calls locally and starts the next leg with the transcript extended.
 */
export interface DeviceToolSuspension {
  assistantContent: string | null;
  /** Every call the model made this iteration, device and server alike. */
  allToolCalls: ProviderToolCall[];
  /** Server-executable calls from the same batch, already run. */
  resolvedResults: Array<{ id: string; name: string; content: string }>;
  pendingCalls: DeviceToolCall[];
}

/**
 * What the client needs to show an approval card, and to resolve it later.
 * Mirrors McpApprovalRequest in src/types/flightControls.ts.
 */
export interface McpApprovalPayload {
  runId: string;
  serverName: string;
  toolName: string;
  argumentPreview: Record<string, unknown>;
  expiresAt: string;
}

export interface AgentLoopResult {
  /** Everything the model emitted, concatenated. Excludes tool-produced text. */
  content: string;
  iterations: number;
  /** The run was cut off with tool calls still pending. */
  hitMaxIterations: boolean;
  /** Set when the run is waiting on the device. Not a failure. */
  deviceSuspension?: DeviceToolSuspension;
  /**
   * Set when the run stopped to ask the user to approve an MCP call.
   *
   * Unlike the device suspension there is no next leg from the client: the
   * turn ends here, and /api/mcp-approval finishes it if the user says yes.
   * That is why the continuation state has to be stored before we stop.
   */
  mcpApproval?: McpApprovalPayload;
}

export const DEFAULT_MAX_ITERATIONS = 5;

/**
 * How many characters of tool output the transcript may carry into a request.
 *
 * A tool result is not sent once. It sits in `currentMessages` and is replayed
 * on every following iteration, so a 12,000-character page fetched on
 * iteration 2 is re-sent on 3, 4 and 5 — and a device round starts a whole new
 * request that replays it again. Each tool caps its own output, which bounds
 * one result but not their sum.
 *
 * 20,000 characters is roughly 6,000 tokens: enough for one full page fetch
 * plus a couple of searches, and small enough to leave the model room to
 * answer on a modest context window.
 */
export const TOOL_RESULT_BUDGET_CHARS = 20_000;

/** What replaces a result that has been trimmed. */
function trimmedNotice(name: string | undefined): string {
  return `[Earlier ${name || 'tool'} result trimmed to make room. If you still need it, call the tool again.]`;
}

/**
 * Trim the oldest tool results until the transcript fits the budget.
 *
 * Oldest first, because the model has usually already extracted what it needed
 * from an early result and is working from the most recent one. The messages
 * themselves stay — only their content is replaced. Removing a `role: 'tool'`
 * message would orphan the `tool_call_id` on the assistant turn above it,
 * which providers reject outright.
 */
export function trimToolResults(
  messages: ProviderMessage[],
  budget: number = TOOL_RESULT_BUDGET_CHARS,
): ProviderMessage[] {
  const toolIndexes: number[] = [];
  let total = 0;
  for (let i = 0; i < messages.length; i++) {
    const message = messages[i];
    if (message.role !== 'tool' || typeof message.content !== 'string') continue;
    toolIndexes.push(i);
    total += message.content.length;
  }

  if (total <= budget) return messages;

  const trimmed = [...messages];
  // Never trim the newest result: it is the one the model is answering from,
  // and trimming it would make the whole round trip pointless.
  for (const index of toolIndexes.slice(0, -1)) {
    if (total <= budget) break;
    const message = trimmed[index];
    const notice = trimmedNotice(message.name);
    const saved = (message.content as string).length - notice.length;
    if (saved <= 0) continue;
    trimmed[index] = { ...message, content: notice };
    total -= saved;
  }

  return trimmed;
}

export async function runAgentLoop(opts: AgentLoopOptions): Promise<AgentLoopResult> {
  const {
    messages,
    tools,
    toolContext,
    emit,
    callModel,
    maxIterations = DEFAULT_MAX_ITERATIONS,
    log,
    deviceBridge = false,
    requestMcpApproval,
  } = opts;

  const currentMessages = [...messages];
  const toolCallsMap = new Map<number, ProviderToolCall>();
  let iteration = 0;
  let fullContent = '';
  let endedWithPendingToolCalls = false;

  while (iteration < maxIterations) {
    iteration++;

    // The last iteration runs without tools so the model is forced to answer.
    // Anything the policy revoked earlier stays revoked; anything find_tools
    // loaded since is added.
    let activeTools = iteration === maxIterations
      ? []
      : applyPolicy(tools, toolContext.policy);

    // find_tools comes off one iteration early. Loading a schema costs a whole
    // model call, and a tool granted on the second-to-last iteration can only
    // be called on the last — which runs with no tools at all. Offering it
    // there spends the user's last round on a capability it cannot then use.
    if (iteration === maxIterations - 1) {
      activeTools = activeTools.filter(tool => tool?.function?.name !== 'find_tools');
    }

    log?.(`Agent loop: iteration ${iteration} of ${maxIterations}`);

    // Tool output accumulates across iterations and is replayed in full each
    // time. Keep the newest, trim the oldest — see trimToolResults.
    const streamingResponse = await callModel(trimToolResults(currentMessages), activeTools);
    const reader = streamingResponse.getReader();
    const decoder = new TextDecoder();

    let assistantContent = '';
    let hasToolCalls = false;
    let isFirstContentOfIteration = true;
    toolCallsMap.clear();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n').filter(line => line.trim());

      for (const line of lines) {
        try {
          const data = JSON.parse(line);

          if (data.type === 'content') {
            if (isFirstContentOfIteration) {
              isFirstContentOfIteration = false;
              await emit.emitMarker('[STATUS_END]');
              // Separate this iteration's prose from the previous one's.
              if (fullContent.trim().length > 0) {
                const gap = '\n\n';
                assistantContent += gap;
                await emit.emitContent(gap);
                fullContent += gap;
              }
            }
            assistantContent += data.content;
            await emit.emitContent(data.content);
            fullContent += data.content;
          } else if (data.type === 'tool_calls') {
            hasToolCalls = true;
            for (const delta of data.tool_calls) {
              const index = delta.index;
              if (!toolCallsMap.has(index)) {
                toolCallsMap.set(index, {
                  id: delta.id || '',
                  type: delta.type || 'function',
                  function: {
                    name: delta.function?.name || '',
                    arguments: delta.function?.arguments || ''
                  }
                });
              } else {
                const existing = toolCallsMap.get(index);
                if (!existing) continue;
                if (delta.function?.name) existing.function.name = delta.function.name;
                if (delta.function?.arguments) existing.function.arguments += delta.function.arguments;
              }
            }
          }
        } catch {
          // Malformed frame — skip it, same as the original loop.
        }
      }
    }

    if (hasToolCalls && toolCallsMap.size > 0) {
      const toolCalls = Array.from(toolCallsMap.values()).filter(tc => tc.id && tc.function?.name);

      if (toolCalls.length > 0) {
        endedWithPendingToolCalls = true;
        // Names only. Arguments can carry note text, a search query or a page
        // URL, and CLAUDE.md's security rules forbid logging request content.
        log?.(`Agent loop: tool calls ${toolCalls.map(call => call.function.name).join(', ')}`);

        const pendingCalls = deviceBridge
          ? toolCalls.filter(call => isDeviceToolName(call.function.name))
          : [];

        currentMessages.push({
          role: 'assistant',
          content: assistantContent || null,
          tool_calls: toolCalls
        });

        // Consent before execution. Checked before anything in this batch runs,
        // because a batch that mixes an approved call with one needing consent
        // must not quietly perform half of it and then stop.
        if (requestMcpApproval) {
          for (const toolCall of toolCalls) {
            if (pendingCalls.includes(toolCall)) continue;
            const approval = await requestMcpApproval(toolCall, currentMessages);
            if (approval) {
              log?.(`Agent loop: waiting on approval for ${toolCall.function.name}`);
              return {
                content: fullContent,
                iterations: iteration,
                hitMaxIterations: false,
                mcpApproval: approval,
              };
            }
          }
        }

        // Server-side calls run either way. A batch that mixes the two — say
        // web_search alongside notes_search — must not lose the half we can
        // answer here, so those results travel with the suspension.
        const resolvedResults: Array<{ id: string; name: string; content: string }> = [];
        for (const toolCall of toolCalls) {
          if (pendingCalls.includes(toolCall)) continue;

          const result = await executeTool(toolCall, toolContext, {
            emitText: emit.emitToolText,
            emitMarker: emit.emitMarker,
          });

          resolvedResults.push({ id: toolCall.id, name: toolCall.function.name, content: result });
          currentMessages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            name: toolCall.function.name,
            content: result
          });
        }

        if (pendingCalls.length > 0) {
          log?.(`Agent loop: suspending for ${pendingCalls.length} device tool call(s)`);
          return {
            content: fullContent,
            iterations: iteration,
            hitMaxIterations: false,
            deviceSuspension: {
              assistantContent: assistantContent || null,
              allToolCalls: toolCalls,
              resolvedResults,
              pendingCalls: pendingCalls.map(call => ({
                id: call.id,
                name: call.function.name,
                arguments: call.function.arguments || '{}',
              })),
            },
          };
        }

        // Go around again so the model can use the tool results.
        continue;
      }
    }

    // Plain text response — the run is finished.
    endedWithPendingToolCalls = false;
    break;
  }

  return {
    content: fullContent,
    iterations: iteration,
    hitMaxIterations: iteration >= maxIterations && endedWithPendingToolCalls,
  };
}
