import { Message, ImageDimensions } from '../../types/chat';
import { AI_PERSONAS } from '../../config/constants';
import { supabase } from '../../lib/supabase';
import type { McpApprovalRequest } from '../../types/flightControls';
import type { McpApprovalDecision } from '../../types/flightControls';
import { ChatError, chatErrorFromResponse, isRetryableCode, toChatErrorCode } from './chatErrors';

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
  onControlEvent?: (event: { type?: string; message?: unknown; code?: unknown }) => void;
}

function createStreamChunkParser(callbacks: StreamChunkParserCallbacks) {
  let controlFrame: string | null = null;
  let fullContent = '';
  // The server writes [STATUS_END] as the last thing before res.end(). Its
  // absence is the only way to tell a truncated stream from a finished one —
  // `done` is true for both (production-check.md 1.9).
  let sawStatusEnd = false;

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
      sawStatusEnd = true;
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

  return {
    push,
    getFullContent: () => fullContent,
    sawStatusEnd: () => sawStatusEnd,
  };
}

// ─── Time and retry budget for a streaming attempt ──────────────────────────
// vercel.json gives ai-proxy a 300s maxDuration, so without a client budget a
// stalled upstream leaves the user watching a spinner for five minutes
// (production-check.md 1.5 / 1.11).
const TIME_TO_FIRST_TOKEN_MS = 60_000;
const TOTAL_STREAM_BUDGET_MS = 180_000;
const MAX_RETRIES = 2;

type TimeoutKind = 'first_token' | 'total' | null;

interface StreamBudget {
  signal: AbortSignal;
  /** Which deadline fired, if the abort came from us rather than the caller. */
  timedOut: () => TimeoutKind;
  firstTokenArrived: () => void;
  dispose: () => void;
}

function createStreamBudget(callerSignal?: AbortSignal): StreamBudget {
  const controller = new AbortController();
  let kind: TimeoutKind = null;

  const firstTokenTimer = setTimeout(() => {
    kind = 'first_token';
    controller.abort();
  }, TIME_TO_FIRST_TOKEN_MS);

  const totalTimer = setTimeout(() => {
    kind = 'total';
    controller.abort();
  }, TOTAL_STREAM_BUDGET_MS);

  const forwardAbort = () => controller.abort();
  if (callerSignal) {
    if (callerSignal.aborted) controller.abort();
    else callerSignal.addEventListener('abort', forwardAbort);
  }

  return {
    signal: controller.signal,
    timedOut: () => kind,
    firstTokenArrived: () => clearTimeout(firstTokenTimer),
    dispose: () => {
      clearTimeout(firstTokenTimer);
      clearTimeout(totalTimer);
      if (callerSignal) callerSignal.removeEventListener('abort', forwardAbort);
    },
  };
}

/**
 * Give a thrown value a ChatError code, and record whether the attempt had
 * already streamed tokens — a partially delivered generation must never be
 * retried, because there is no way to resume it.
 */
function annotateStreamError(thrown: unknown, budget: StreamBudget, streamedAnything: boolean): ChatError {
  let error: ChatError;

  if (thrown instanceof ChatError) {
    error = thrown;
  } else if (thrown instanceof DOMException && thrown.name === 'AbortError') {
    const kind = budget.timedOut();
    error = kind
      ? new ChatError('TIMEOUT', kind === 'first_token'
        ? 'The model did not start responding in time.'
        : 'The response took too long and was stopped.')
      : new ChatError('ABORTED', 'Generation stopped.');
  } else if (thrown instanceof TypeError) {
    // fetch() rejects with TypeError when the network itself failed.
    error = new ChatError('NETWORK', "Couldn't reach TimeMachine.");
  } else {
    error = new ChatError('UNKNOWN', thrown instanceof Error ? thrown.message : 'Unknown error occurred');
  }

  (error as ChatError & { streamedAnything?: boolean }).streamedAnything = streamedAnything;
  return error;
}

function backoffDelay(attemptIndex: number): number {
  const base = 500 * Math.pow(2, attemptIndex);
  return base + Math.random() * base * 0.5; // jitter, so retries don't sync up
}

/**
 * Retry idempotent failures a couple of times with exponential backoff.
 * Never retries a request that already streamed tokens, and never retries a
 * user-caused failure (rate limit, expired session, oversized payload).
 */
async function runWithRetries<T>(attempt: () => Promise<T>): Promise<T> {
  let lastError: unknown;

  for (let i = 0; i <= MAX_RETRIES; i++) {
    try {
      return await attempt();
    } catch (error) {
      lastError = error;
      const chatError = error instanceof ChatError ? error : null;
      const alreadyStreamed = Boolean(
        (error as { streamedAnything?: boolean } | null)?.streamedAnything
      );

      if (!chatError || alreadyStreamed || !isRetryableCode(chatError.code) || i === MAX_RETRIES) {
        throw error;
      }
      await new Promise(resolve => setTimeout(resolve, backoffDelay(i)));
    }
  }

  throw lastError;
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

      if (!response.ok) throw await chatErrorFromResponse(response);
      if (!response.body) throw new ChatError('PROVIDER_DOWN', 'PRO stream returned no body');

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
    const failure = await chatErrorFromResponse(response);
    if (failure.code === 'RATE_LIMITED') throw new RateLimitError(failure.message);
    throw failure;
  }

  const data = await response.json();
  return data.runId as string;
}

// Streaming response handler
export async function generateAIResponseStreaming(
  messages: Message[],
  imageData?: string | string[],
  _systemPrompt: string = '', // Not used anymore, kept for positional compatibility
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
  signal?: AbortSignal,
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

    const requestBody = JSON.stringify({
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
    });

    const headers = await requestHeaders();
    let youtubeMusic: YouTubeMusicData | undefined;

    // One attempt at the streaming endpoint. Throws ChatError on every failure
    // path so the caller has a code to act on.
    const attempt = async (): Promise<{ content: string; thinking?: string }> => {
      const budget = createStreamBudget(signal);
      // True once the first byte of the model's answer has been delivered to
      // the UI. A request that has already streamed can never be retried —
      // there is no resume, and re-running would duplicate the output.
      let streamedAnything = false;

      try {
        const response = await fetch('/api/ai-proxy', {
          method: 'POST',
          headers,
          body: requestBody,
          signal: budget.signal,
        });

        if (!response.ok) throw await chatErrorFromResponse(response);
        if (!response.body) throw new ChatError('PROVIDER_DOWN', 'No response body received');

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        // An error control frame beats the missing-sentinel check: it carries
        // the real reason the generation stopped.
        let frameError: ChatError | null = null;

        const parser = createStreamChunkParser({
          onChunk: (chunk) => {
            streamedAnything = true;
            budget.firstTokenArrived();
            if (onChunk) onChunk(chunk);
          },
          onStatusChange,
          onYoutubeMusic: (music) => { youtubeMusic = music; },
          onMcpApproval: onMcpApproval
            ? (approval) => { streamedAnything = true; onMcpApproval(approval); }
            : undefined,
          onControlEvent: (event) => {
            if (event?.type === 'error') {
              frameError = new ChatError(
                toChatErrorCode(event.code),
                typeof event.message === 'string' ? event.message : 'The model provider failed mid-response.',
                parser.getFullContent(),
              );
            }
          },
        });

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            parser.push(decoder.decode(value, { stream: true }));
          }
        } finally {
          try { await reader.cancel(); } catch { /* already closed */ }
        }

        if (frameError) throw frameError;

        // A cancelled request is not a provider failure. Check this before the
        // sentinel test: aborting can end the stream cleanly rather than
        // rejecting the read, which would otherwise read as a truncation.
        if (budget.signal.aborted) {
          const kind = budget.timedOut();
          throw kind
            ? new ChatError('TIMEOUT', kind === 'first_token'
              ? 'The model did not start responding in time.'
              : 'The response took too long and was stopped.',
              parser.getFullContent())
            : new ChatError('ABORTED', 'Generation stopped.', parser.getFullContent());
        }

        // `done` is true for a clean finish AND for a stream that died
        // mid-flight. Only the sentinel distinguishes them; without this check
        // a truncated generation ran straight into onComplete and painted an
        // empty bubble with no error and no spinner (1.9).
        if (!parser.sawStatusEnd()) {
          throw new ChatError(
            'TRUNCATED',
            'The response was cut off before it finished.',
            parser.getFullContent(),
          );
        }

        return extractReasoningFromContent(parser.getFullContent());
      } catch (attemptError) {
        throw annotateStreamError(attemptError, budget, streamedAnything);
      } finally {
        budget.dispose();
      }
    };

    const { content: cleanContent, thinking } = await runWithRetries(attempt);

    if (onComplete) {
      onComplete({
        content: cleanContent,
        thinking,
        youtubeMusic,
      });
    }

  } catch (error) {
    // Never log prompt or response content, only the failure itself.
    console.error('AI proxy request failed:', error instanceof Error ? error.message : error);

    if (error instanceof RateLimitError) {
      if (onError) onError(error);
      return;
    }
    if (error instanceof ChatError) {
      // Rate limits still surface through the dedicated modal path.
      if (onError) onError(error.code === 'RATE_LIMITED' ? new RateLimitError(error.message) : error);
      return;
    }

    if (onError) {
      onError(new ChatError('UNKNOWN', error instanceof Error ? error.message : 'Unknown error occurred'));
    }
  }
}

// Non-streaming response (existing function, kept for compatibility)
export async function generateAIResponse(
  messages: Message[],
  imageData?: string | string[],
  _systemPrompt: string = '', // Not used anymore, kept for positional compatibility
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
      const failure = await chatErrorFromResponse(response);
      if (failure.code === 'RATE_LIMITED') throw new RateLimitError(failure.message);
      throw failure;
    }

    // Get the complete JSON response
    const result = await response.json();
    return result;

  } catch (error) {
    console.error('AI proxy request failed:', error instanceof Error ? error.message : error);

    if (error instanceof RateLimitError || error instanceof ChatError) throw error;

    // Returning an apology *as the assistant's answer* is what made outages
    // look like successful generations. Failures throw now, so the caller can
    // show a retryable error instead (1.7 / 1.9).
    if (error instanceof TypeError) {
      throw new ChatError('NETWORK', "Couldn't reach TimeMachine.");
    }
    throw new ChatError('UNKNOWN', error instanceof Error ? error.message : 'Unknown error occurred');
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
