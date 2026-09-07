/** Wire shapes used by the existing OpenAI-compatible provider adapters. */
export interface ProviderToolCall {
  id: string;
  type: string;
  function: { name: string; arguments: string };
}
export interface ProviderMessage {
  role: string;
  content: string | null;
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

export interface ModelConfig {
  model: string;
  temperature: number;
  maxTokens: number;
  systemPrompt?: string;
  systemPromptsByHeatLevel?: Record<number, string>;
  reasoningEffort?: string;
  provider?: string;
  flowState?: { provider?: string; model: string; temperature: number; maxTokens: number };
}
export interface SpecialModeConfig extends ModelConfig {
  systemPrompt: string;
  tools: string[];
}
