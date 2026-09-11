/** Wire shapes used by the existing OpenAI-compatible provider adapters. */
export interface ProviderToolCall {
  id: string;
  type: string;
  function: { name: string; arguments: string };
}
export interface ProviderMessage {
  role: string;
  // Multimodal turns carry an array of parts instead of a plain string. Only
  // the user message a native-vision run attaches images to ever takes that
  // shape — everything else stays a string, so `typeof content === 'string'`
  // is the guard to reach for.
  content: string | ProviderContentPart[] | null;
  tool_calls?: ProviderToolCall[];
  tool_call_id?: string;
  name?: string;
}
export interface ProviderTool {
  type: string;
  function: { name: string; description?: string; parameters: Record<string, unknown> };
}
export interface ProviderRequest {
  model: string;
  messages: ProviderMessage[];
  temperature?: number;
  max_tokens?: number;
  max_completion_tokens?: number;
  top_p?: number;
  stream: boolean;
  tools?: ProviderTool[];
  tool_choice?: string;
  reasoning_effort?: string;
  thinking_budget?: number;
  thinking?: null;
}
export interface ProviderResponse {
  choices?: { message?: ProviderMessage }[];
}

export interface ModelConfig extends VisionCapability {
  model: string;
  temperature: number;
  maxTokens: number;
  systemPrompt?: string;
  systemPromptsByHeatLevel?: Record<number, string>;
  reasoningEffort?: string;
  provider?: string;
  // A vision annotation sits next to the model it describes: Flow State names
  // its own model, so it declares its own capability too.
  flowState?: VisionCapability & { provider?: string; model: string; temperature: number; maxTokens: number; reasoningEffort?: string };
}
export interface SpecialModeConfig extends ModelConfig {
  systemPrompt: string;
  tools: string[];
}

// ─── Vision ─────────────────────────────────────────────────────────────────

/**
 * How a run gets images in front of the model.
 *
 * 'native'  — the image is sent to the model itself as an `image_url` content
 *             part. Only for models that actually accept one; a text-only
 *             model answers a multimodal request with a 400.
 * 'ocr'     — a separate vision model transcribes the image and the text is
 *             spliced into the user's message. Lossy, slower, and one extra
 *             upstream call, but it works on any model.
 *
 * The capability belongs to the (provider, model) pair, not to the persona:
 * special modes and Flow State swap the model out from under the persona, and
 * a fallback hop runs a different model again. See api/_lib/vision.ts.
 */
export type VisionMode = 'native' | 'ocr';

/** Whether native image parts carry the hosted URL or the inline base64. */
export type ImageTransport = 'url' | 'base64';

export interface VisionCapability {
  vision?: VisionMode;
  imageTransport?: ImageTransport;
}

/** One part of a multimodal message body. */
export interface ProviderContentPart {
  type: 'text' | 'image_url';
  text?: string;
  image_url?: { url: string };
}
