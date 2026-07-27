import { task, logger } from "@trigger.dev/sdk";
import {
  callCerebrasAirAPIStreaming,
  callEaonAPIStreaming,
  callGroqStandardAPIStreaming,
  callNvidiaAPIStreaming,
  callPollinationsAPIStreaming,
  callSecretsToAIAPIStreaming,
  createImageMarkdown,
  fetchWebSearchResults,
  incrementRateLimit,
  processMemoryTags,
} from "../api/ai-proxy.js";
import { SKILLS_DATA } from "../api/skills.js";
import { completeProJob, failProJob } from "../api/_lib/proJobs.js";
import { proOutputStream } from "./streams.js";

// Payload is fully prepared by /api/pro-generation (prompt building, RAG,
// PDF injection, image OCR, quota check) so this task only does the
// long-running part: the PRO agentic tool loop.
export interface ProGenerationPayload {
  jobId: string;
  apiMessages: any[];
  tools: any[];
  model: string;
  temperature: number;
  maxTokens: number;
  provider: string;
  reasoningEffort?: string;
  userId: string | null;
  ip: string;
  inputImageUrls?: string[];
  imageDimensions?: { width?: number; height?: number };
  hadImageInput?: boolean;
}

const MAX_ITERATIONS = 5;
// Buffer model deltas and flush a few times per second instead of one stream
// append per token. Markers/control frames always flush pending text first so
// every stream chunk is either pure text or exactly one marker — this keeps
// the frontend parser free of split-marker edge cases.
const FLUSH_INTERVAL_MS = 250;

export const proGeneration = task({
  id: "pro-generation",
  // Generations can legitimately run 15+ minutes. No retry: a retried run
  // would re-append duplicate text to the same output stream.
  maxDuration: 3600,
  retry: { maxAttempts: 1 },
  run: async (payload: ProGenerationPayload) => {
    let pendingText = "";
    let lastFlush = Date.now();

    const flush = async (force: boolean) => {
      if (!pendingText) {
        lastFlush = Date.now();
        return;
      }
      if (!force && Date.now() - lastFlush < FLUSH_INTERVAL_MS) {
        return;
      }
      const text = pendingText;
      pendingText = "";
      lastFlush = Date.now();
      await proOutputStream.append(text);
    };

    // Model-visible text (goes through the 250ms buffer)
    const emitText = async (text: string) => {
      pendingText += text;
      await flush(false);
    };

    // Markers and control frames (flushed immediately, as their own chunk)
    const emitMarker = async (marker: string) => {
      await flush(true);
      await proOutputStream.append(marker);
    };

    try {
      if (payload.hadImageInput) {
        // OCR already happened in the API route; mirror the old marker so the
        // frontend switches from "Analyzing photo..." to "Thinking...".
        await emitMarker("[IMAGE_ANALYZED]");
      }

      // ─── PRO agentic loop (ported from api/ai-proxy.ts) ───────────────
      let currentMessages = [...payload.apiMessages];
      let iteration = 0;
      const toolCallsMap = new Map<number, any>();
      let fullContent = "";

      while (iteration < MAX_ITERATIONS) {
        iteration++;

        // On the final iteration, disable tools to force a response
        const activeTools = iteration === MAX_ITERATIONS ? [] : payload.tools;

        logger.log(`PRO Persona Agent Loop: Iteration ${iteration} of ${MAX_ITERATIONS}`);

        const proProvider = payload.provider || "pollinations";
        let streamingResponse: ReadableStream;
        if (proProvider === "secretstoai" || proProvider === "secrectstoai") {
          streamingResponse = await callSecretsToAIAPIStreaming(
            currentMessages,
            payload.model,
            payload.temperature,
            payload.maxTokens,
            activeTools
          );
        } else if (proProvider === "eaon") {
          streamingResponse = await callEaonAPIStreaming(
            currentMessages,
            payload.model,
            payload.temperature,
            payload.maxTokens,
            activeTools
          );
        } else if (proProvider === "nvidia" || proProvider === "nim") {
          streamingResponse = await callNvidiaAPIStreaming(
            currentMessages,
            payload.model,
            payload.temperature,
            payload.maxTokens,
            activeTools
          );
        } else if (proProvider === "groq") {
          streamingResponse = await callGroqStandardAPIStreaming(
            currentMessages,
            payload.model,
            payload.temperature,
            payload.maxTokens,
            activeTools,
            payload.reasoningEffort
          );
        } else if (proProvider === "cerebras") {
          streamingResponse = await callCerebrasAirAPIStreaming(
            currentMessages,
            activeTools,
            payload.model,
            payload.temperature,
            payload.maxTokens
          );
        } else {
          streamingResponse = await callPollinationsAPIStreaming(
            currentMessages,
            payload.model,
            payload.temperature,
            payload.maxTokens,
            activeTools
          );
        }

        const reader = streamingResponse.getReader();
        const decoder = new TextDecoder();
        let assistantContent = "";
        let hasToolCalls = false;
        let isFirstContentOfIteration = true;
        toolCallsMap.clear();

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split("\n").filter((line) => line.trim());

          for (const line of lines) {
            try {
              const data = JSON.parse(line);
              if (data.type === "content") {
                if (isFirstContentOfIteration) {
                  isFirstContentOfIteration = false;
                  await emitMarker("[STATUS_END]");
                  if (fullContent.trim().length > 0) {
                    const gap = "\n\n";
                    assistantContent += gap;
                    await emitText(gap);
                    fullContent += gap;
                  }
                }
                assistantContent += data.content;
                await emitText(data.content);
                fullContent += data.content;
              } else if (data.type === "tool_calls") {
                hasToolCalls = true;
                for (const delta of data.tool_calls) {
                  const index = delta.index;
                  if (!toolCallsMap.has(index)) {
                    toolCallsMap.set(index, {
                      id: delta.id || "",
                      type: delta.type || "function",
                      function: {
                        name: delta.function?.name || "",
                        arguments: delta.function?.arguments || "",
                      },
                    });
                  } else {
                    const existing = toolCallsMap.get(index);
                    if (delta.function?.name) existing.function.name = delta.function.name;
                    if (delta.function?.arguments) existing.function.arguments += delta.function.arguments;
                  }
                }
              }
            } catch {
              // Ignore parsing errors (same as the original loop)
            }
          }
        }

        if (hasToolCalls && toolCallsMap.size > 0) {
          const toolCalls = Array.from(toolCallsMap.values()).filter((tc) => tc.id && tc.function?.name);

          // Append assistant message with tool calls to history
          currentMessages.push({
            role: "assistant",
            content: assistantContent || null,
            tool_calls: toolCalls,
          });

          // Execute tools, write status messages, and append tool response messages
          for (const toolCall of toolCalls) {
            const name = toolCall.function.name;
            const argsStr = toolCall.function.arguments;
            let result = "";

            if (name === "web_search") {
              try {
                const params = JSON.parse(argsStr);
                await emitMarker(`[STATUS:Searching the web for "${params.query}"]`);
                const searchResults = await fetchWebSearchResults(params);

                // Truncate search results to protect context window
                result = searchResults.slice(0, 10000);
              } catch (err: any) {
                result = `Error: ${err.message}`;
              }
            } else if (name === "generate_image") {
              try {
                const params = JSON.parse(argsStr);
                await emitMarker(`[STATUS:Generating image with prompt: "${params.prompt}"]`);
                const imageMarkdown = createImageMarkdown({
                  ...params,
                  persona: "pro",
                  inputImageUrls: payload.inputImageUrls,
                  imageWidth: payload.imageDimensions?.width,
                  imageHeight: payload.imageDimensions?.height,
                });
                // Stream the markdown directly to the user response
                await emitText(`\n\n${imageMarkdown}\n\n`);

                result = `Image generated successfully. Markdown link: ${imageMarkdown}`;
              } catch (err: any) {
                result = `Error: ${err.message}`;
              }
            } else if (name === "list_skills") {
              try {
                await emitMarker("[STATUS:Reading skills library]");
                const list = Object.keys(SKILLS_DATA).map((key) => ({
                  name: SKILLS_DATA[key].name,
                  description: SKILLS_DATA[key].description,
                }));
                result = JSON.stringify(list, null, 2);
              } catch (err: any) {
                result = `Error: ${err.message}`;
              }
            } else if (name === "read_skill") {
              try {
                const params = JSON.parse(argsStr);
                await emitMarker(`[STATUS:Reading skill instructions for ${params.name}]`);
                const skill = SKILLS_DATA[params.name];
                if (skill) {
                  result = skill.content;
                } else {
                  result = `Error: Skill "${params.name}" not found. Available skills: ${Object.keys(SKILLS_DATA).join(", ")}`;
                }
              } catch (err: any) {
                result = `Error: ${err.message}`;
              }
            }

            currentMessages.push({
              role: "tool",
              tool_call_id: toolCall.id,
              name: name,
              content: result,
            });
          }

          // Loop again to call the LLM with the tool results
          continue;
        }

        // No tool calls, meaning the assistant responded with final text. Done!
        break;
      }

      // Check if max iterations reached and last response had tool calls
      if (iteration >= MAX_ITERATIONS && toolCallsMap.size > 0) {
        const warning = "\n\n*System: Maximum reasoning iterations (5) reached. Stopped further tool executions.*";
        await emitText(warning);
        fullContent += warning;
      }

      // Finalize rate limits & memories
      const quotaCost = 1;
      for (let i = 0; i < quotaCost; i++) {
        await incrementRateLimit(payload.userId, payload.ip, "pro");
      }

      if (payload.userId && fullContent) {
        const memoryResult = await processMemoryTags(fullContent, payload.userId, "pro");
        if (memoryResult.hasSavedMemory) {
          await emitMarker("\n\n[MEMORY_SAVED]");
        }
      }

      await emitMarker("[STATUS_END]");
      await flush(true);
      await emitMarker(`\u001e{"type":"pro_done"}\n`);

      await completeProJob(payload.jobId, fullContent);
      logger.log("PRO generation completed", { jobId: payload.jobId, contentLength: fullContent.length });

      return { ok: true, contentLength: fullContent.length };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error("PRO generation failed", { jobId: payload.jobId, error: message });

      try {
        await flush(true);
        await proOutputStream.append(`\u001e${JSON.stringify({ type: "pro_error", message })}\n`);
      } catch (emitError) {
        logger.error("Failed to emit pro_error frame", { emitError });
      }

      await failProJob(payload.jobId, message);
      // Do not rethrow: the client already received a structured error frame,
      // and a failed run would not add anything on top of it.
      return { ok: false, error: message };
    }
  },
  onFailure: async ({ payload, error }) => {
    // Crash-level failure (process died before the run handler could finish).
    const message = error instanceof Error ? error.message : String(error);
    await failProJob(payload.jobId, message);
  },
});
