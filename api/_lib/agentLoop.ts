// The agentic tool loop, shared by every persona and both runtimes.
//
// Previously only PRO ran a loop; Air called the model once and spliced tool
// output straight into the response, so the model never saw a tool result and
// never got a chance to reconsider a bad call. That is also what made the
// runtime backstop impossible to enforce for Air — a refusal needs a next
// iteration to land in.

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
  messages: any[];
  tools: any[];
  toolContext: ToolExecutionContext;
  emit: AgentLoopEmitter;
  /** Runs one model turn. Provider dispatch stays with the caller. */
  callModel: (messages: any[], activeTools: any[]) => Promise<ReadableStream>;
  maxIterations?: number;
  log?: (message: string) => void;
}

export interface AgentLoopResult {
  /** Everything the model emitted, concatenated. Excludes tool-produced text. */
  content: string;
  iterations: number;
  /** The run was cut off with tool calls still pending. */
  hitMaxIterations: boolean;
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
  } = opts;

  const currentMessages = [...messages];
  const toolCallsMap = new Map<number, any>();
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

        currentMessages.push({
          role: 'assistant',
          content: assistantContent || null,
          tool_calls: toolCalls
        });

        for (const toolCall of toolCalls) {
          const result = await executeTool(toolCall, toolContext, {
            emitText: emit.emitToolText,
            emitMarker: emit.emitMarker,
          });

          currentMessages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            name: toolCall.function.name,
            content: result
          });
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
