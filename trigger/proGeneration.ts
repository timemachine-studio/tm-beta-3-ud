import type { ProviderMessage, ProviderTool } from '../api/_lib/providerTypes.js';
import { task, logger } from "@trigger.dev/sdk";
import {
  dispatchStreamingProvider,
  normalizeStreamingProvider,
  incrementRateLimit,
  processMemoryTags,
} from "../api/ai-proxy.js";
import { runWithProviderFallback, type ProviderHop } from "../api/_lib/providerResilience.js";
import { createToolPolicy } from "../api/_lib/tools.js";
import { runAgentLoop } from "../api/_lib/agentLoop.js";
import { completeProJob, failProJob } from "../api/_lib/proJobs.js";
import { proOutputStream } from "./streams.js";

// Payload is fully prepared by /api/pro-generation (prompt building, RAG,
// PDF injection, image OCR, quota check) so this task only does the
// long-running part: the PRO agentic tool loop.
export interface ProGenerationPayload {
  jobId: string;
  apiMessages: ProviderMessage[];
  tools: ProviderTool[];
  model: string;
  temperature: number;
  maxTokens: number;
  provider: string;
  /**
   * Providers to try, in order, each with its own model. Optional: a job
   * queued before this field existed still runs on `provider`/`model` alone.
   */
  providerChain?: ProviderHop[];
  reasoningEffort?: string;
  userId: string | null;
  ip: string;
  inputImageUrls?: string[];
  imageDimensions?: { width?: number; height?: number };
  hadImageInput?: boolean;
  /** Results of the intent gates, decided in /api/pro-generation. */
  imageAllowed?: boolean;
  searchAllowed?: boolean;
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

      // ─── PRO agentic loop (shared with /api/ai-proxy) ─────────────────
      const toolPolicy = createToolPolicy({
        imageAllowed: payload.imageAllowed !== false,
        searchAllowed: payload.searchAllowed !== false,
      });

      // Opening a provider stream is the only retryable moment; once tokens are
      // flowing there is no resume. A chain is only absent on a job queued
      // before the field existed, so fall back to the single pair.
      const providerChain: ProviderHop[] = payload.providerChain?.length
        ? payload.providerChain
        : [{ provider: normalizeStreamingProvider(payload.provider, "pollinations"), model: payload.model }];
      let servedProvider = providerChain[0].provider;

      const loopResult = await runAgentLoop({
        messages: payload.apiMessages,
        tools: payload.tools,
        toolContext: {
          persona: "pro",
          inputImageUrls: payload.inputImageUrls,
          imageDimensions: payload.imageDimensions,
          policy: toolPolicy,
        },
        emit: {
          emitContent: (text) => emitText(text),
          emitToolText: (text) => emitText(`\n\n${text}\n\n`),
          emitMarker: (marker) => emitMarker(marker),
        },
        callModel: async (messages, activeTools) => {
          const run = await runWithProviderFallback(
            providerChain,
            (hop) => dispatchStreamingProvider(
              hop.provider,
              messages,
              activeTools,
              {
                model: hop.model,
                temperature: payload.temperature,
                maxTokens: payload.maxTokens,
                reasoningEffort: payload.reasoningEffort,
              }
            ),
            (message) => logger.log(`[pro] ${message}`),
          );
          servedProvider = run.provider;
          if (run.provider !== providerChain[0].provider) {
            logger.warn(`[pro] fell back from ${providerChain[0].provider} to ${run.provider}`);
          }
          return run.value;
        },
        maxIterations: MAX_ITERATIONS,
        log: (message) => logger.log(message),
      });

      let fullContent = loopResult.content;

      if (loopResult.hitMaxIterations) {
        const warning = "\n\n*System: Maximum reasoning iterations (5) reached. Stopped further tool executions.*";
        await emitText(warning);
        fullContent += warning;
      }

      // Finalize rate limits & memories
      // Charged to the provider that actually served the run, so the daily
      // spend ceiling reflects where the money went.
      await incrementRateLimit(payload.userId, payload.ip, "pro", {
        amount: 1,
        provider: servedProvider,
      });

      if (payload.userId && fullContent) {
        const memoryResult = await processMemoryTags(fullContent, payload.userId, "pro");
        if (memoryResult.hasSavedMemory) {
          await emitMarker("\n\n[MEMORY_SAVED]");
        }
      }

      await emitMarker("[STATUS_END]");
      await flush(true);
      await completeProJob(payload.jobId, fullContent);
      await emitMarker(`\u001e{"type":"pro_done"}\n`);
      logger.log("PRO generation completed", { jobId: payload.jobId, contentLength: fullContent.length });

      return { ok: true, contentLength: fullContent.length };
    } catch (error) {
      const message = 'PRO_GENERATION_FAILED';
      void error;
      logger.error("PRO generation failed", { jobId: payload.jobId, error: message });

      try {
        await flush(true);
        await proOutputStream.append(`\u001e${JSON.stringify({ type: "pro_error", message })}\n`);
      } catch (emitError) {
        void emitError;
        logger.error("Failed to emit pro_error frame");
      }

      await failProJob(payload.jobId, message);
      // Do not rethrow: the client already received a structured error frame,
      // and a failed run would not add anything on top of it.
      return { ok: false, error: message };
    }
  },
  onFailure: async ({ payload, error }) => {
    // Crash-level failure (process died before the run handler could finish).
    const message = 'PRO_GENERATION_FAILED';
    void error;
    await failProJob(payload.jobId, message);
  },
});
