/**
 * How images reach the model.
 *
 * The OCR pipeline was built when nothing we routed to could see. A separate
 * vision model transcribed the image to text and that text was spliced into
 * the user's message. It is lossy by construction — layout, colour, spatial
 * relationships and anything the transcriber judged unimportant are gone
 * before the answering model ever sees the turn — and it costs an extra
 * upstream round trip on the critical path.
 *
 * Models that accept image parts should get the image. OCR stays as the
 * fallback for the ones that cannot, because a text-only model answers a
 * multimodal request with a 400, not with a degraded answer.
 *
 * The capability belongs to the (provider, model) pair, never to the persona.
 * Three things change the model out from under a persona at runtime — special
 * modes, Flow State, and a fallback hop — so a persona-level "this persona can
 * see" flag is wrong as soon as any of them fires. Everything here resolves
 * per hop, and the decision is re-made for each hop the run actually tries.
 */

import type {
  ImageTransport,
  ProviderContentPart,
  ProviderMessage,
  VisionCapability,
  VisionMode,
} from './providerTypes.js';

/**
 * Unknown models get OCR.
 *
 * Guessing 'native' for an unlisted model turns an image message into a hard
 * 400 from the provider; guessing 'ocr' turns it into a slightly worse answer.
 * Only one of those is recoverable, so the default is the survivable one.
 */
export const DEFAULT_VISION_MODE: VisionMode = 'ocr';

/**
 * Vision capability per model, and the transport that model wants.
 *
 * Keys are matched most-specific first: `'provider:model'`, then bare
 * `'model'`. Use the qualified form when one provider serves a vision model
 * over an endpoint that will not take image parts — the model is capable, that
 * route to it is not.
 *
 * This table is the fallback. A `vision:` field written next to a model in
 * AI_PERSONAS (or in a special-mode config) wins over it, so a one-off
 * override does not need an entry here.
 *
 * Adding a model: an entry is only worth having if the pair has actually been
 * exercised with an image. An unverified 'native' guess is worse than leaving
 * the model out, because leaving it out gets it OCR.
 */
export const MODEL_VISION: Record<string, VisionCapability> = {
  // ─ Verified multimodal ─
  'qwen/qwen3.6-27b': { vision: 'native' },
  'meta-llama/llama-4-scout-17b-16e-instruct': { vision: 'native' },
  'moonshotai/kimi-k3': { vision: 'native' },
  'logfare/kimi-k3': { vision: 'native' },
  'kimi-k3-extended': { vision: 'native' },
  // The OCR transcriber itself, listed so a run that happens to route to it
  // does not transcribe an image in order to hand it to a model that could
  // have looked at it directly.
  'deepseek/deepseek-v4-flash-vision-exp': { vision: 'native' },

  // ─ Text-only: these need OCR ─
  'glm-5.2-extended': { vision: 'ocr' },
  'openai/gpt-oss-20b': { vision: 'ocr' },

  // ─ Special-mode models, not yet exercised with an image ─
  // Listed explicitly so this table reads as a full inventory of what the app
  // can route to rather than a partial one. They resolve to OCR either way;
  // flip an entry to 'native' once the pair has been tried with a real image.
  'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning': { vision: 'ocr' },
  'deepseek-ai/deepseek-v4-flash-0731': { vision: 'ocr' },
  // AMD Radeon Cloud. Text generation and tool calling were verified against
  // the live endpoint; an image was not sent, so it gets OCR per the rule
  // above. Flip it once the pair has actually been tried with one.
  'DeepSeek-V4-Flash': { vision: 'ocr' },
  // LLM7's own model catalog reports minimax-m2.7 as `modalities.input:
  // ["text"]` and `capabilities.vision: false`, so this one is the provider's
  // own statement rather than an untested guess.
  'minimax-m2.7': { vision: 'ocr' },
  // Eaon's route (ai.eaon.dev) serves the same MiniMax line under prefixed
  // ids; same text-only statement applies.
  'eaon/minimax-m2.7-highspeed': { vision: 'ocr' },
  'eaon/minimax-m3': { vision: 'ocr' },
  // Gemini Flash is multimodal by spec, but an image has not been sent
  // through Eaon's route yet. OCR until it has — see AI_PERSONAS.default.
  'eaon/gemini-3.8-flash': { vision: 'ocr' },
  // `default` is a routing selector, so which upstream serves it can change.
  // OCR is the safe reading: an image sent to a text-only upstream is a hard
  // 400, an unnecessary transcription is only a worse answer.
  'llm7:default': { vision: 'ocr' },
};

/** The upstream that transcribes images for OCR-mode hops. */
export const OCR_MODEL = {
  model: 'deepseek/deepseek-v4-flash-vision-exp',
  maxTokens: 4000,
  temperature: 0.3,
} as const;

/** Placeholder the client sends when a turn is images with no words. */
export const IMAGE_PLACEHOLDER = '[Image message]';

export interface VisionHop extends VisionCapability {
  provider: string;
  model: string;
}

/**
 * The capability for one hop: explicit annotation, then `provider:model`, then
 * `model`, then the safe default.
 */
export function resolveVisionCapability(hop: VisionHop): Required<Pick<VisionCapability, 'vision'>> & VisionCapability {
  const qualified = MODEL_VISION[`${hop.provider}:${hop.model}`];
  const byModel = MODEL_VISION[hop.model];
  return {
    vision: hop.vision ?? qualified?.vision ?? byModel?.vision ?? DEFAULT_VISION_MODE,
    imageTransport: hop.imageTransport ?? qualified?.imageTransport ?? byModel?.imageTransport,
  };
}

export function resolveVisionMode(hop: VisionHop): VisionMode {
  return resolveVisionCapability(hop).vision;
}

/**
 * True when every hop on a chain expects to see the image itself.
 *
 * Such a chain has no cushion under it. `vision: 'native'` is an assertion
 * about a provider's endpoint, not just about the model, and an endpoint that
 * turns out not to take image parts answers 400 — for every hop, since they
 * all made the same assertion. A mixed chain self-heals (the native hop fails,
 * the OCR hop below it answers); an all-native one fails the turn outright.
 * Callers use this to decide whether a transcribed retry is worth one more
 * walk of the chain. See the retry in api/ai-proxy.ts.
 */
export function chainIsAllNative(hops: VisionHop[]): boolean {
  return hops.length > 0 && hops.every(hop => resolveVisionMode(hop) === 'native');
}

/**
 * The images on a turn, in both the forms we hold them in.
 *
 * `hosted` are the public URLs the composer uploaded to before sending;
 * `inline` are the base64 data URLs from the same request. They are not
 * guaranteed to be the same length — the composer drops uploads that failed —
 * so they are kept apart rather than zipped.
 */
export interface VisionAttachments {
  inline: string[];
  hosted: string[];
}

export function collectAttachments(
  imageData: string | string[] | undefined,
  inputImageUrls: string[] | undefined,
): VisionAttachments {
  const inline = imageData ? (Array.isArray(imageData) ? imageData : [imageData]) : [];
  return { inline, hosted: Array.isArray(inputImageUrls) ? inputImageUrls : [] };
}

export function hasAttachments(attachments: VisionAttachments): boolean {
  return attachments.inline.length > 0 || attachments.hosted.length > 0;
}

/**
 * Which copies of the images to put on the wire.
 *
 * Hosted URLs are preferred: they are a few hundred bytes each instead of a
 * few megabytes, which matters for the request body and matters a lot for the
 * PRO job payload. They are only usable when every image made it up — a short
 * `hosted` list means some upload failed, and sending the survivors would drop
 * an image the user is asking about without saying so.
 *
 * `imageTransport: 'base64'` on a hop forces the inline copy, for a provider
 * that will not fetch a URL it did not mint.
 */
export function selectVisionImages(
  attachments: VisionAttachments,
  transport: ImageTransport | undefined,
): string[] {
  const { inline, hosted } = attachments;
  const hostedComplete = hosted.length > 0 && hosted.length >= inline.length;

  if (transport === 'base64') return inline.length > 0 ? inline : hosted;
  if (transport === 'url') return hostedComplete ? hosted : inline;
  return hostedComplete ? hosted : (inline.length > 0 ? inline : hosted);
}

/**
 * Attachments from one already-resolved list of image URLs.
 *
 * For PRO, whose model call runs on Trigger.dev: the route picks the transport
 * before the job is queued (the payload has to stay small) and ships a single
 * list, so both native attachment and transcription work from the same URLs.
 */
export function attachmentsFrom(imageUrls: string[]): VisionAttachments {
  return { inline: imageUrls, hosted: imageUrls };
}

/** Images to hand the OCR transcriber. Always the inline copy when we have it. */
export function selectOcrImages(attachments: VisionAttachments): string[] {
  return attachments.inline.length > 0 ? attachments.inline : attachments.hosted;
}

// ─── Message shaping ────────────────────────────────────────────────────────

/** The user's own words on a turn, with the images-only placeholder stripped. */
export function userPromptOf(message: ProviderMessage | undefined): string {
  const content = typeof message?.content === 'string' ? message.content : '';
  return content === IMAGE_PLACEHOLDER ? '' : content;
}

/**
 * The generate_image tool takes the original image by URL, not by anything the
 * model transcribes or describes, so an edit request has to be recognised as
 * one. Both vision modes carry this.
 */
function imageEditHint(count: number): string {
  return `\n\n[IMPORTANT: The user has attached ${count} image(s) to this message. If the user is asking to edit, modify, or transform the image — use the generate_image tool with process="edit" and write a detailed prompt describing the desired result. The image URLs and dimensions are automatically handled by the system.]`;
}

function replaceAt(
  messages: ProviderMessage[],
  index: number,
  content: string | ProviderContentPart[],
): ProviderMessage[] {
  if (index < 0 || index >= messages.length) return messages;
  const next = [...messages];
  next[index] = { ...next[index], content };
  return next;
}

/** Attach the images to the message as parts the model itself will look at. */
export function applyNativeVision(
  messages: ProviderMessage[],
  index: number,
  imageUrls: string[],
): ProviderMessage[] {
  if (imageUrls.length === 0) return messages;

  const prompt = userPromptOf(messages[index]);
  const text = prompt
    ? `${prompt}${imageEditHint(imageUrls.length)}`
    : `The user shared ${imageUrls.length === 1 ? 'this image' : 'these images'} without a caption. Respond to what you see.${imageEditHint(imageUrls.length)}`;

  const parts: ProviderContentPart[] = [
    { type: 'text', text },
    ...imageUrls.map((url): ProviderContentPart => ({ type: 'image_url', image_url: { url } })),
  ];

  return replaceAt(messages, index, parts);
}

/**
 * Splice a transcription into the message. `extractedText` of null means the
 * transcription failed — the turn still has to go somewhere, so the model is
 * told plainly that it cannot see the image rather than being left to answer
 * as if there were none.
 */
export function applyOcrVision(
  messages: ProviderMessage[],
  index: number,
  imageCount: number,
  extractedText: string | null,
): ProviderMessage[] {
  const prompt = userPromptOf(messages[index]);

  if (extractedText === null) {
    return replaceAt(messages, index, prompt
      ? `[The user attached an image but text extraction failed. Please respond to their message as best you can. If the user wanted to edit the image, use the generate_image tool with process="edit" and describe what the user wants.]\n\nUser's message: ${prompt}`
      : `[The user attached an image but text extraction failed. Let them know you couldn't process the image and ask them to try again.]`);
  }

  return replaceAt(messages, index, prompt
    ? `[Content extracted from the attached image(s):\n${extractedText}\n]${imageEditHint(imageCount)}\n\nUser's message: ${prompt}`
    : `[Content extracted from the attached image(s):\n${extractedText}\n]\n\nThe user shared this image. Respond based on the extracted content above.`);
}

// ─── Per-hop adaptation ─────────────────────────────────────────────────────

export interface VisionAdapterOptions {
  attachments: VisionAttachments;
  /**
   * Index of the user message the images belong to. Captured before the agent
   * loop starts: the loop appends assistant and tool messages after it, so the
   * index stays valid while "the last message" does not.
   */
  imageIndex: number;
  /** Runs the transcriber. Called at most once per run, and only if needed. */
  extractText: (imageUrls: string[]) => Promise<string>;
  /** Fires around the transcription, for the "Analyzing photo…" marker. */
  onOcrStart?: () => void | Promise<void>;
  onOcrEnd?: () => void | Promise<void>;
  log?: (message: string) => void;
}

/**
 * Shapes the messages for whichever hop is about to run.
 *
 * This is deliberately per-hop rather than done once up front. The primary may
 * be able to see and the fallback may not, and which one serves the turn is
 * not known until the primary has already failed. Deciding once, before the
 * chain runs, means either transcribing an image the primary never needed or
 * handing image parts to a fallback that will reject them.
 *
 * The transcription is memoised — including its failure — so a chain that
 * walks three OCR hops still makes one transcriber call.
 */
export function createVisionAdapter(opts: VisionAdapterOptions) {
  const { attachments, imageIndex, extractText, onOcrStart, onOcrEnd, log } = opts;

  const nativeCache = new Map<string, string[]>();
  let ocrPromise: Promise<string | null> | null = null;

  const transcribe = (): Promise<string | null> => {
    if (!ocrPromise) {
      ocrPromise = (async () => {
        const images = selectOcrImages(attachments);
        try {
          await onOcrStart?.();
          const text = await extractText(images);
          return text;
        } catch (error) {
          // Never rethrown: a failed transcription degrades the turn, it does
          // not fail it. The message says so explicitly so the model does not
          // answer as though no image had been attached.
          console.error('[vision] transcription failed:', error instanceof Error ? error.message : error);
          return null;
        } finally {
          await onOcrEnd?.();
        }
      })();
    }
    return ocrPromise;
  };

  return async function adaptForHop(
    hop: VisionHop,
    messages: ProviderMessage[],
    options: { forceOcr?: boolean } = {},
  ): Promise<ProviderMessage[]> {
    if (!hasAttachments(attachments)) return messages;

    const capability = resolveVisionCapability(hop);

    if (capability.vision === 'native' && !options.forceOcr) {
      const key = capability.imageTransport ?? 'auto';
      let images = nativeCache.get(key);
      if (!images) {
        images = selectVisionImages(attachments, capability.imageTransport);
        nativeCache.set(key, images);
      }
      if (images.length > 0) {
        log?.(`vision: ${hop.provider}/${hop.model} sees ${images.length} image(s) natively`);
        return applyNativeVision(messages, imageIndex, images);
      }
      // Declared native but nothing survived selection: fall through to OCR
      // rather than sending a turn that silently has no image in it.
      log?.(`vision: ${hop.provider}/${hop.model} is native but no image URLs resolved; using OCR`);
    }

    log?.(`vision: ${hop.provider}/${hop.model} needs OCR`);
    const extracted = await transcribe();
    return applyOcrVision(messages, imageIndex, selectOcrImages(attachments).length, extracted);
  };
}

/** An adapter for a run with no images: every hop gets the messages unchanged. */
export const passThroughVisionAdapter = async (
  _hop: VisionHop,
  messages: ProviderMessage[],
  _options?: { forceOcr?: boolean },
): Promise<ProviderMessage[]> => messages;
