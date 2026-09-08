import type { ProviderMessage, ProviderTool } from '../api/_lib/providerTypes.js';
import { task, logger } from "@trigger.dev/sdk";
import {
  dispatchStreamingProvider,
  extractImageContent,
  normalizeStreamingProvider,
  incrementRateLimit,
  processMemoryTags,
} from "../api/ai-proxy.js";
import { runWithProviderFallback, type ProviderHop } from "../api/_lib/providerResilience.js";
import {
  attachmentsFrom,
  chainIsAllNative,
  createVisionAdapter,
  passThroughVisionAdapter,
  resolveVisionMode,
  type VisionHop,
} from "../api/_lib/vision.js";
import { createToolPolicy } from "../api/_lib/tools.js";
import { runAgentLoop } from "../api/_lib/agentLoop.js";
import { completeProJob, failProJob } from "../api/_lib/proJobs.js";
import { proOutputStream } from "./streams.js";

// Payload is fully prepared by /api/pro-generation (prompt building, RAG,
// PDF injection, quota check) so this task only does the long-running part:
// the PRO agentic tool loop.
//
// Images are the one exception. How they reach the model depends on which hop
// serves the run, and that is not known until the chain runs here — so the
// route ships the image URLs and this task shapes the messages per hop
// (api/_lib/vision.ts). When the route decided the matter itself, the messages
// arrive final and `visionImages` is absent.
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
  /**
   * Image URLs for this turn, already reduced to one transport by the route.
   * Absent when the route settled vision itself (no hop on the chain can see,
   * or the images were too large to serialise into a payload).
   */
  visionImages?: string[];
  /** Index in `apiMessages` of the user message the images belong to. */
  visionImageIndex?: number;
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

    // Once any token has been appended to the output stream, a status marker
    // written after it would flip the UI back to "Analyzing photo…" mid-answer.
    let hasStreamedContent = false;

    try {
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

      // Images the route left for this task to place. Without them the
      // messages are already final — either there was no image, or the route
      // transcribed it before queueing the job.
      const visionImages = payload.visionImages ?? [];
      const adaptForHop = visionImages.length > 0 && typeof payload.visionImageIndex === "number"
        ? createVisionAdapter({
            attachments: attachmentsFrom(visionImages),
            imageIndex: payload.visionImageIndex,
            extractText: extractImageContent,
            onOcrStart: async () => { if (!hasStreamedContent) await emitMarker("[IMAGE_ANALYZING]"); },
            onOcrEnd: async () => { if (!hasStreamedContent) await emitMarker("[IMAGE_ANALYZED]"); },
            log: (message) => logger.log(`[pro] ${message}`),
          })
        : passThroughVisionAdapter;

      if (payload.hadImageInput) {
        // The client put itself in "Analyzing photo…" the moment the user hit
        // send. Either the route already transcribed, or the first hop can see
        // and the looking happens inside the answer — both mean "Thinking…".
        // A later fallback to an OCR hop re-emits the pair around its own call.
        const firstHopSees = visionImages.length > 0
          && resolveVisionMode(providerChain[0] as VisionHop) === "native";
        if (firstHopSees || visionImages.length === 0) {
          await emitMarker("[IMAGE_ANALYZED]");
        }
      }

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
          emitContent: async (text) => { hasStreamedContent = true; await emitText(text); },
          emitToolText: async (text) => { hasStreamedContent = true; await emitText(`\n\n${text}\n\n`); },
          emitMarker: (marker) => emitMarker(marker),
        },
        callModel: async (messages, activeTools) => {
          const walkChain = (forceOcr: boolean) => runWithProviderFallback(
            providerChain,
            async (hop) => dispatchStreamingProvider(
              hop.provider,
              await adaptForHop(hop as VisionHop, messages, { forceOcr }),
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

          let run;
          try {
            run = await walkChain(false);
          } catch (error) {
            // PRO's whole chain is K3, so it is exactly the all-native case
            // with no cushion: one bad assumption about the endpoint takes out
            // every hop. Transcribe and walk it once more rather than failing
            // the job. See the matching retry in api/ai-proxy.ts.
            if (visionImages.length === 0 || !chainIsAllNative(providerChain as VisionHop[])) throw error;
            logger.warn("[pro] every hop failed with images attached; retrying the chain with transcription");
            run = await walkChain(true);
          }
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
