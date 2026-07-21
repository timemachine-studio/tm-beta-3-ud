import { supabase } from '../../lib/supabase';
import type { Message } from '../../types/chat';

export interface AdminPreset {
  id: string;
  label: string;
  prompt: string;
}

export interface AdminStatus {
  isAdmin: boolean;
  presets?: AdminPreset[];
}

export async function getAdminStatus(): Promise<AdminStatus> {
  const { data } = await supabase.auth.getSession();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(data.session?.access_token ? { Authorization: `Bearer ${data.session.access_token}` } : {}),
  };
  const response = await fetch('/api/admin', { headers });
  if (!response.ok) return { isAdmin: false };
  return (await response.json()) as AdminStatus;
}

export interface AdminPlaygroundConfig {
  customSystemPrompt: string;
  temperature: number;
  maxTokens: number;
  enabledSkillSlugs: string[];
  enabledMcpIds: string[];
  customSkills: Array<{ name: string; content: string }>;
  customMcpTools: Array<{ name: string; description: string; parameters: Record<string, unknown> }>;
  enableSmartThinking: boolean;
}

export interface AdminPlaygroundCallbacks {
  onChunk?: (chunk: string) => void;
  onStatusChange?: (status: string) => void;
  onComplete?: () => void;
  onError?: (error: Error) => void;
}

export interface AdminStreamRequest {
  messages: Message[];
  config: AdminPlaygroundConfig;
  signal?: AbortSignal;
}

export async function streamAdminPlayground(
  { messages, config, signal }: AdminStreamRequest,
  { onChunk, onStatusChange, onComplete, onError }: AdminPlaygroundCallbacks,
): Promise<void> {
  try {
    const { data } = await supabase.auth.getSession();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(data.session?.access_token ? { Authorization: `Bearer ${data.session.access_token}` } : {}),
    };

    const response = await fetch('/api/admin-proxy', {
      method: 'POST',
      headers,
      signal,
      body: JSON.stringify({
        messages: messages.map((msg) => ({ content: msg.content, isAI: msg.isAI })),
        customSystemPrompt: config.customSystemPrompt,
        temperature: config.temperature,
        maxTokens: config.maxTokens,
        enabledSkillSlugs: config.enabledSkillSlugs,
        enabledMcpIds: config.enabledMcpIds,
        customSkills: config.customSkills,
        customMcpTools: config.customMcpTools,
        enableSmartThinking: config.enableSmartThinking,
        stream: true,
      }),
    });

    if (!response.ok || !response.body) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Admin proxy error: ${response.status}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // Emit status markers live, strip them from the visible content stream.
      const markerRegex = /\[(STATUS:[^\]]*|STATUS_END|IMAGE_ANALYZING|IMAGE_ANALYZED|MEMORY_SAVED)\]/g;
      let cursor = 0;
      let match: RegExpExecArray | null;
      let emitted = '';
      while ((match = markerRegex.exec(buffer)) !== null) {
        emitted += buffer.slice(cursor, match.index);
        cursor = match.index + match[0].length;
        const token = match[0];
        if (token.startsWith('[STATUS:')) {
          const statusText = token.slice('[STATUS:'.length, -1);
          onStatusChange?.(statusText);
        } else if (token === '[STATUS_END]' || token === '[IMAGE_ANALYZED]' || token === '[MEMORY_SAVED]') {
          onStatusChange?.('thinking');
        } else if (token === '[IMAGE_ANALYZING]') {
          onStatusChange?.('analyzing_photo');
        }
      }

      // Keep any partial (spanning chunks) marker suffix out of the visible
      // text: only flush the safe portion before the last potential marker.
      const remainder = buffer.slice(cursor);
      const lastMarkerStart = remainder.search(/\[[A-Z]/);
      const safeEmit = lastMarkerStart === -1 ? remainder : remainder.slice(0, lastMarkerStart);
      buffer = lastMarkerStart === -1 ? '' : remainder.slice(lastMarkerStart);

      const textChunk = emitted + safeEmit;
      if (textChunk) onChunk?.(textChunk);
    }

    // Flush whatever is left as plain text (no marker in flight).
    if (buffer) onChunk?.(buffer);
    onComplete?.();
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') return;
    onError?.(error instanceof Error ? error : new Error('Admin stream failed'));
  }
}