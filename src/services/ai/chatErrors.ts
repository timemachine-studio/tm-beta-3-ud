import type { ChatErrorCode } from '../../types/chat';

/**
 * A generation failure with a machine-readable cause.
 *
 * Before this, every failure collapsed to "Failed to generate response." —
 * rate limit, expired session, provider outage and network loss were
 * indistinguishable to the user and in support (production-check.md 1.7).
 */
export class ChatError extends Error {
  readonly code: ChatErrorCode;
  /** Whatever streamed before the failure, so the UI can keep showing it. */
  readonly partialContent?: string;

  constructor(code: ChatErrorCode, message: string, partialContent?: string) {
    super(message);
    this.name = 'ChatError';
    this.code = code;
    this.partialContent = partialContent;
  }
}

/** Codes that describe a transient upstream problem worth retrying. */
export function isRetryableCode(code: ChatErrorCode): boolean {
  return code === 'PROVIDER_DOWN' || code === 'TIMEOUT' || code === 'NETWORK'
    || code === 'TRUNCATED' || code === 'EMPTY';
}

const HTTP_STATUS_TO_CODE: Record<number, ChatErrorCode> = {
  400: 'UNKNOWN',
  401: 'AUTH_EXPIRED',
  403: 'AUTH_EXPIRED',
  408: 'TIMEOUT',
  413: 'PAYLOAD_TOO_LARGE',
  429: 'RATE_LIMITED',
  500: 'UNKNOWN',
  502: 'PROVIDER_DOWN',
  503: 'PROVIDER_DOWN',
  504: 'TIMEOUT',
};

const API_CODE_TO_CHAT_CODE: Record<string, ChatErrorCode> = {
  RETENTION_UNVERIFIED: 'RETENTION_UNVERIFIED',
  RATE_LIMITED: 'RATE_LIMITED',
  AUTH_REQUIRED: 'AUTH_EXPIRED',
  AUTH_EXPIRED: 'AUTH_EXPIRED',
  FORBIDDEN: 'AUTH_EXPIRED',
  BAD_REQUEST: 'UNKNOWN',
  PAYLOAD_TOO_LARGE: 'PAYLOAD_TOO_LARGE',
  PROVIDER_DOWN: 'PROVIDER_DOWN',
  TIMEOUT: 'TIMEOUT',
  UNAVAILABLE: 'PROVIDER_DOWN',
  UNKNOWN: 'UNKNOWN',
};

export function toChatErrorCode(apiCode: unknown, status?: number): ChatErrorCode {
  if (typeof apiCode === 'string' && API_CODE_TO_CHAT_CODE[apiCode]) {
    return API_CODE_TO_CHAT_CODE[apiCode];
  }
  if (status && HTTP_STATUS_TO_CODE[status]) return HTTP_STATUS_TO_CODE[status];
  return 'UNKNOWN';
}

/**
 * Turn a non-OK response into a ChatError.
 *
 * Handles both shapes the API can return: the structured
 * `{ error: { code, message } }` envelope (1.7) and the older
 * `{ error: 'some string', type: 'rateLimit' }` that other endpoints still use.
 */
export async function chatErrorFromResponse(response: Response): Promise<ChatError> {
  const body = await response.json().catch(() => ({} as Record<string, unknown>));
  const envelope = (body as { error?: unknown }).error;

  if (envelope && typeof envelope === 'object') {
    const { code, message } = envelope as { code?: string; message?: string };
    return new ChatError(toChatErrorCode(code, response.status), message || 'Request failed');
  }

  // Legacy shape.
  if ((body as { type?: string }).type === 'rateLimit' || response.status === 429) {
    return new ChatError('RATE_LIMITED', 'Rate limit exceeded');
  }
  const legacyMessage = typeof envelope === 'string' ? envelope : `Request failed (${response.status})`;
  return new ChatError(toChatErrorCode(undefined, response.status), legacyMessage);
}

/**
 * What the user reads. One distinct, actionable line per class — never a
 * stack trace and never an upstream error body.
 */
export const CHAT_ERROR_COPY: Record<ChatErrorCode, string> = {
  RETENTION_UNVERIFIED: 'Background PRO is unavailable while data retention is being verified. You can use Air.',
  RATE_LIMITED: "You've used up your messages for now.",
  AUTH_EXPIRED: 'Your session expired. Sign in again to continue.',
  PROVIDER_DOWN: 'The model is having a rough moment.',
  PAYLOAD_TOO_LARGE: 'That attachment is too large to send.',
  TIMEOUT: 'That took too long and timed out.',
  TRUNCATED: 'The response was cut off before it finished.',
  EMPTY: 'The model came back with nothing.',
  ABORTED: 'Generation stopped.',
  NETWORK: "Couldn't reach TimeMachine. Check your connection.",
  UNKNOWN: "Couldn't get a response.",
};

export function chatErrorCopy(code: ChatErrorCode | undefined): string {
  return CHAT_ERROR_COPY[code ?? 'UNKNOWN'] ?? CHAT_ERROR_COPY.UNKNOWN;
}
