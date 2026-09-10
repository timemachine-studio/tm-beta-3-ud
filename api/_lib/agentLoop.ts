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

export interface AgentLoopResult {
  /** Everything the model emitted, concatenated. Excludes tool-produced text. */
  content: string;
  iterations: number;
  /** The run was cut off with tool calls still pending. */
  hitMaxIterations: boolean;
  /** Set when the run is waiting on the device. Not a failure. */
  deviceSuspension?: DeviceToolSuspension;
}

export const DEFAULT_MAX_ITERATIONS = 5;

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
  } = opts;

  const currentMessages = [...messages];
  const toolCallsMap = new Map<number, ProviderToolCall>();
  let iteration = 0;
  let fullContent = '';
  let endedWithPendingToolCalls = false;

  while (iteration < maxIterations) {
    iteration++;

    // The last iteration runs without tools so the model is forced to answer.
    // Anything the policy revoked earlier stays revoked.
    const activeTools = iteration === maxIterations
      ? []
      : applyPolicy(tools, toolContext.policy);

    log?.(`Agent loop: iteration ${iteration} of ${maxIterations}`);

    const streamingResponse = await callModel(currentMessages, activeTools);
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

        const pendingCalls = deviceBridge
          ? toolCalls.filter(call => isDeviceToolName(call.function.name))
          : [];

        currentMessages.push({
          role: 'assistant',
          content: assistantContent || null,
          tool_calls: toolCalls
        });

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
