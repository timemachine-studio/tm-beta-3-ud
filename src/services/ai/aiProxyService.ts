import { Message, ImageDimensions } from '../../types/chat';
import { AI_PERSONAS } from '../../config/constants';
import { supabase } from '../../lib/supabase';
import type { McpApprovalRequest } from '../../types/flightControls';
import type { McpApprovalDecision } from '../../types/flightControls';

export interface YouTubeMusicData {
  videoId: string;
  title: string;
  artist: string;
  thumbnail: string;
}

interface AIResponse {
  content: string;
  thinking?: string;
  youtubeMusic?: YouTubeMusicData;
  mcpApproval?: McpApprovalRequest;
}

async function requestHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  return {
    'Content-Type': 'application/json',
    ...(data.session?.access_token ? { Authorization: `Bearer ${data.session.access_token}` } : {}),
  };
}

// Custom error class for rate limits
class RateLimitError extends Error {
  type: string;

  constructor(message: string) {
    super(message);
    this.type = 'rateLimit';
    this.name = 'RateLimitError';
  }
}

// User profile info for memory context
export interface UserMemoryContext {
  nickname?: string;
  about_me?: string;
}

// ─── Shared stream chunk parser ─────────────────────────────────────────────
// Parses the app's wire protocol (text + [STATUS:] markers + \u001e control
// frames). Used by both the classic /api/ai-proxy stream and the Trigger.dev
// backed PRO stream.
interface StreamChunkParserCallbacks {
  onChunk?: (chunk: string) => void;
  onStatusChange?: (status: string) => void;
  onYoutubeMusic?: (music: YouTubeMusicData) => void;
  onMcpApproval?: (approval: McpApprovalRequest) => void;
  onControlEvent?: (event: any) => void;
}

function createStreamChunkParser(callbacks: StreamChunkParserCallbacks) {
  let controlFrame: string | null = null;
  let fullContent = '';

  const push = (decoded: string) => {
    let chunk = '';
    for (const character of decoded) {
      if (controlFrame !== null) {
        if (character === '\n') {
          try {
            const event = JSON.parse(controlFrame);
            if (event.type === 'mcp_approval' && event.payload && callbacks.onMcpApproval) {
              callbacks.onMcpApproval(event.payload as McpApprovalRequest);
            } else if (callbacks.onControlEvent) {
              callbacks.onControlEvent(event);
            }
          } catch (eventError) {
            console.error('Invalid AI control event:', eventError);
          }
          controlFrame = null;
        } else {
          controlFrame += character;
        }
      } else if (character === '\u001e') {
        controlFrame = '';
      } else {
        chunk += character;
      }
    }

    // Check for image analysis status markers
    if (chunk.includes('[IMAGE_ANALYZING]')) {
      chunk = chunk.replace('[IMAGE_ANALYZING]', '');
      if (callbacks.onStatusChange) callbacks.onStatusChange('analyzing_photo');
    }
    if (chunk.includes('[IMAGE_ANALYZED]')) {
      chunk = chunk.replace('[IMAGE_ANALYZED]', '');
      if (callbacks.onStatusChange) callbacks.onStatusChange('thinking');
    }

    // Check for custom tool/status markers
    if (chunk.includes('[STATUS:')) {
      const regex = /\[STATUS:(.*?)\]/g;
      let match;
      while ((match = regex.exec(chunk)) !== null) {
        const statusText = match[1];
        if (callbacks.onStatusChange) callbacks.onStatusChange(statusText);
      }
      chunk = chunk.replace(/\[STATUS:.*?\]/g, '');
    }
    if (chunk.includes('[STATUS_END]')) {
      chunk = chunk.replace(/\[STATUS_END\]/g, '');
      if (callbacks.onStatusChange) callbacks.onStatusChange('thinking');
    }

    // Check for YouTube Music marker
    const musicMatch = chunk.match(/\[YOUTUBE_MUSIC\](.*?)\[\/YOUTUBE_MUSIC\]/);
    if (musicMatch) {
      try {
        const music = JSON.parse(musicMatch[1]);
        if (callbacks.onYoutubeMusic) callbacks.onYoutubeMusic(music);
      } catch (e) {
        console.error('Error parsing YouTube music data:', e);
      }
      chunk = chunk.replace(/\[YOUTUBE_MUSIC\].*?\[\/YOUTUBE_MUSIC\]/, '');
    }

    if (chunk && callbacks.onChunk) {
      callbacks.onChunk(chunk);
    }
    fullContent += chunk;
  };

  return { push, getFullContent: () => fullContent };
}

function extractReasoningFromContent(fullContent: string): { content: string; thinking?: string } {
  const reasoningBlocks = [...fullContent.matchAll(/<(reason|think)>([\s\S]*?)<\/\1>/gi)].map(m => m[2].trim());
  const thinking = reasoningBlocks.length > 0 ? reasoningBlocks.join('\n\n') : undefined;
  const content = fullContent.replace(/<(reason|think)>[\s\S]*?<\/\1>/gi, '').trim();
  return { content, thinking };
}

// ─── TimeMachine PRO background generation client ───────────────────────────
export interface ProRunCallbacks {
  onChunk?: (chunk: string) => void;
  onStatusChange?: (status: string) => void;
  onComplete?: (response: AIResponse) => void;
  onError?: (error: Error) => void;
}

export async function getActiveProRun(chatSessionId: string): Promise<{ runId: string } | null> {
  try {
    const response = await fetch(`/api/pro-generation?chatSessionId=${encodeURIComponent(chatSessionId)}`, {
      headers: await requestHeaders(),
    });
    if (!response.ok) return null;
    const data = await response.json();
    return data.active && data.runId ? { runId: data.runId } : null;
  } catch {
    return null;
  }
}

async function getProRunStatus(runId: string): Promise<{ status: string; error?: string | null; finalContent?: string | null } | null> {
  try {
    const response = await fetch(`/api/pro-generation?runId=${encodeURIComponent(runId)}`, {
      headers: await requestHeaders(),
    });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

// Reads a PRO generation stream to completion, reconnecting transparently
// whenever the stream proxy ends its (platform-capped) response. Chunk
// indexes are absolute, so reconnects resume exactly where they left off.
export async function streamProRun(runId: string, callbacks: ProRunCallbacks): Promise<void> {
  const { onChunk, onStatusChange, onComplete, onError } = callbacks;

  let sawTerminal = false;
  let terminalError: string | null = null;

  const parser = createStreamChunkParser({
    onChunk,
    onStatusChange,
    onControlEvent: (event) => {
      if (event?.type === 'pro_done') {
        sawTerminal = true;
      } else if (event?.type === 'pro_error') {
        sawTerminal = true;
        terminalError = typeof event.message === 'string' && event.message
          ? event.message
          : 'PRO generation failed';
      }
    },
  });

  const headers = await requestHeaders();
  let index = 0;
  let failures = 0;
  let emptyRounds = 0;

  while (!sawTerminal) {
    let framesThisRound = 0;

    try {
      const response = await fetch(`/api/pro-stream?runId=${encodeURIComponent(runId)}&start=${index}`, { headers });

      if (!response.ok || !response.body) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `PRO stream error: ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const frame = JSON.parse(line);
            if (typeof frame.i === 'number') index = frame.i + 1;
            if (typeof frame.d === 'string') {
              framesThisRound++;
              parser.push(frame.d);
            }
          } catch (frameError) {
            console.error('Invalid PRO stream frame:', frameError);
          }
        }

        if (sawTerminal) {
          // Terminal frame received — close the connection and finish.
          try { await reader.cancel(); } catch { /* ignore */ }
          break;
        }
      }

      failures = 0;

      if (sawTerminal) break;

      if (framesThisRound === 0) {
        // Nothing arrived on this connection: the run may have ended without
        // a terminal frame (e.g. crash). Confirm via the job status.
        emptyRounds++;
        if (emptyRounds >= 2) {
          emptyRounds = 0;
          const status = await getProRunStatus(runId);
          if (status?.status === 'completed') break;
          if (status?.status === 'failed') {
            if (onError) onError(new Error(status.error || 'PRO generation failed'));
            return;
          }
        }
      } else {
        emptyRounds = 0;
      }
    } catch (error) {
      failures++;
      console.error(`PRO stream connection failed (attempt ${failures}):`, error);
      if (failures >= 6) {
        if (onError) onError(error instanceof Error ? error : new Error('PRO stream failed'));
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, Math.min(1000 * failures, 5000)));
    }
  }

  if (terminalError) {
    if (onError) onError(new Error(terminalError));
    return;
  }

  const { content, thinking } = extractReasoningFromContent(parser.getFullContent());
  if (onComplete) {
    onComplete({ content, thinking });
  }
}

// Starts a PRO background run. Throws RateLimitError on quota exhaustion.
async function startProRun(body: Record<string, unknown>): Promise<string> {
  const response = await fetch('/api/pro-generation', {
    method: 'POST',
    headers: await requestHeaders(),
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    if (response.status === 429 || errorData.type === 'rateLimit') {
      throw new RateLimitError('Rate limit exceeded');
    }
    throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
  }

  const data = await response.json();
  return data.runId as string;
}

// Streaming response handler
export async function generateAIResponseStreaming(
  messages: Message[],
  imageData?: string | string[],
  systemPrompt: string = '', // Not used anymore, kept for compatibility
  currentPersona: keyof typeof AI_PERSONAS = 'default',
  heatLevel?: number,
  inputImageUrls?: string[],
  imageDimensions?: ImageDimensions,
  onChunk?: (chunk: string) => void,
  onComplete?: (response: AIResponse) => void,
  onError?: (error: Error) => void,
  _userId?: string,
  userMemories?: UserMemoryContext,
  specialMode?: string,
  onStatusChange?: (status: string) => void,
  pdfData?: string,
  pdfFileName?: string,
  pdfExtractedText?: string,
  flowState?: boolean,
  chatSessionId?: string,
  onMcpApproval?: (approval: McpApprovalRequest) => void,
): Promise<void> {
  try {
    // TimeMachine PRO runs in the background (Trigger.dev) so long generations
    // are not bound by Vercel's serverless time limit.
    if (currentPersona === 'pro') {
      const runId = await startProRun({
        messages: messages.map(msg => ({
          content: msg.content,
          isAI: msg.isAI
        })),
        persona: currentPersona,
        imageData,
        heatLevel,
        inputImageUrls,
        imageDimensions,
        stream: true,
        userMemories,
        specialMode,
        pdfData,
        pdfFileName,
        pdfExtractedText,
        chatSessionId,
      });

      await streamProRun(runId, { onChunk, onStatusChange, onComplete, onError });
      return;
    }

    // Call the Vercel API route with streaming enabled
    const response = await fetch('/api/ai-proxy', {
      method: 'POST',
      headers: await requestHeaders(),
      body: JSON.stringify({
        messages: messages.map(msg => ({
          content: msg.content,
          isAI: msg.isAI
        })),
        persona: currentPersona,
        imageData,
        heatLevel,
        inputImageUrls,
        imageDimensions,
        stream: true,
        flowState,
        userMemories,
        specialMode,
        pdfData,
        pdfFileName,
        pdfExtractedText,
        chatSessionId,
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));

      // Check for rate limit errors
      if (response.status === 429 || errorData.type === 'rateLimit') {
        throw new RateLimitError('Rate limit exceeded');
      }

      throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
    }

    if (!response.body) {
      throw new Error('No response body received');
    }

    // Process streaming response
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let youtubeMusic: YouTubeMusicData | undefined;

    const parser = createStreamChunkParser({
      onChunk,
      onStatusChange,
      onYoutubeMusic: (music) => { youtubeMusic = music; },
      onMcpApproval,
    });

    try {
      while (true) {
        const { done, value } = await reader.read();

        if (done) break;

        parser.push(decoder.decode(value, { stream: true }));
      }

      // Extract reasoning and clean content
      const { content: cleanContent, thinking } = extractReasoningFromContent(parser.getFullContent());

      if (onComplete) {
        onComplete({
          content: cleanContent,
          thinking,
          youtubeMusic,
        });
      }

    } catch (streamError) {
      console.error('Stream processing error:', streamError);
      if (onError) {
        onError(streamError instanceof Error ? streamError : new Error('Stream processing failed'));
      }
    }

  } catch (error) {
    console.error('Error calling AI proxy:', error);

    if (error instanceof RateLimitError) {
      if (onError) onError(error);
      return;
    }

    const fallbackError = error instanceof Error ? error : new Error('Unknown error occurred');
    if (onError) {
      onError(fallbackError);
    }
  }
}

// Non-streaming response (existing function, kept for compatibility)
export async function generateAIResponse(
  messages: Message[],
  imageData?: string | string[],
  systemPrompt: string = '', // Not used anymore, kept for compatibility
  currentPersona: keyof typeof AI_PERSONAS = 'default',
  heatLevel?: number,
  inputImageUrls?: string[],
  imageDimensions?: ImageDimensions,
  _userId?: string,
  userMemories?: UserMemoryContext,
  specialMode?: string,
  pdfData?: string,
  pdfFileName?: string,
  pdfExtractedText?: string,
  flowState?: boolean,
  chatSessionId?: string,
): Promise<AIResponse> {
  try {
    // TimeMachine PRO runs in the background (Trigger.dev): start the run,
    // then poll its job status until the generation completes.
    if (currentPersona === 'pro') {
      const runId = await startProRun({
        messages: messages.map(msg => ({
          content: msg.content,
          isAI: msg.isAI
        })),
        persona: currentPersona,
        imageData,
        heatLevel,
        inputImageUrls,
        imageDimensions,
        stream: false,
        userMemories,
        specialMode,
        pdfData,
        pdfFileName,
        pdfExtractedText,
        chatSessionId,
      });

      const deadline = Date.now() + 45 * 60 * 1000;
      while (Date.now() < deadline) {
        const status = await getProRunStatus(runId);

        if (status?.status === 'completed') {
          const { content, thinking } = extractReasoningFromContent(status.finalContent || '');
          return { content, thinking };
        }

        if (status?.status === 'failed') {
          throw new Error(status.error || 'PRO generation failed');
        }

        await new Promise((resolve) => setTimeout(resolve, 3000));
      }

      throw new Error('PRO generation timed out');
    }

    // Call the Vercel API route without streaming
    const response = await fetch('/api/ai-proxy', {
      method: 'POST',
      headers: await requestHeaders(),
      body: JSON.stringify({
        messages: messages.map(msg => ({
          content: msg.content,
          isAI: msg.isAI
        })),
        persona: currentPersona,
        imageData,
        heatLevel,
        inputImageUrls,
        imageDimensions,
        stream: false,
        flowState,
        userMemories,
        specialMode,
        pdfData,
        pdfFileName,
        pdfExtractedText,
        chatSessionId,
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));

      // Check for rate limit errors
      if (response.status === 429 || errorData.type === 'rateLimit') {
        throw new RateLimitError('Rate limit exceeded');
      }

      throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
    }

    // Get the complete JSON response
    const result = await response.json();
    return result;

  } catch (error) {
    console.error('Error calling AI proxy:', error);

    if (error instanceof RateLimitError) {
      throw error; // Re-throw rate limit errors to be handled by the UI
    }

    if (error instanceof Error) {
      // Return simplified error message for other errors
      return {
        content: "I apologize, but I'm having trouble connecting right now. Please try again in a moment."
      };
    }

    return {
      content: "I apologize, but I'm having trouble connecting right now. Please try again in a moment."
    };
  }
}

export async function resolveMcpApproval(
  runId: string,
  decision: McpApprovalDecision,
): Promise<{ content: string; status: string }> {
  const response = await fetch('/api/mcp-approval', {
    method: 'POST',
    headers: await requestHeaders(),
    body: JSON.stringify({ runId, decision }),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(result.error || 'MCP approval failed') as Error & { uncertainOutcome?: boolean };
    error.uncertainOutcome = Boolean(result.uncertainOutcome);
    throw error;
  }
  return result;
}
