import type { VercelResponse } from '@vercel/node';

// One error vocabulary for the whole API. The client maps each code to a
// specific message and recovery action; before this, everything collapsed to
// "Failed to generate response. Please try again." (production-check.md 1.7).
export type ApiErrorCode =
  | 'RATE_LIMITED'
  | 'AUTH_REQUIRED'
  | 'AUTH_EXPIRED'
  | 'FORBIDDEN'
  | 'BAD_REQUEST'
  | 'PAYLOAD_TOO_LARGE'
  | 'PROVIDER_DOWN'
  | 'TIMEOUT'
  | 'UNAVAILABLE'
  | 'UNKNOWN';

export const STATUS_FOR_CODE: Record<ApiErrorCode, number> = {
  RATE_LIMITED: 429,
  AUTH_REQUIRED: 401,
  AUTH_EXPIRED: 401,
  FORBIDDEN: 403,
  BAD_REQUEST: 400,
  PAYLOAD_TOO_LARGE: 413,
  PROVIDER_DOWN: 502,
  TIMEOUT: 504,
  UNAVAILABLE: 503,
  UNKNOWN: 500,
};

// Wire prefix for out-of-band JSON frames inside a text/plain stream. The
// client's createStreamChunkParser already decodes these, which is why a
// mid-stream failure does not need a new marker (1.9).
export const CONTROL_FRAME_PREFIX = '\u001e';

export interface ApiErrorBody {
  error: { code: ApiErrorCode; message: string };
  [extra: string]: unknown;
}

export function apiErrorBody(
  code: ApiErrorCode,
  message: string,
  extra: Record<string, unknown> = {},
): ApiErrorBody {
  return { error: { code, message }, ...extra };
}

/**
 * Send a structured error. Safe to call after streaming has begun: once the
 * response has committed its headers, `res.status()` is a no-op and
 * `.end(text)` would append the error to the assistant's message instead
 * (1.9). In that case the error goes out as a control frame and the stream
 * ends *without* the [STATUS_END] sentinel — which is what tells the client
 * the turn failed rather than finished.
 */
export function sendApiError(
  res: VercelResponse,
  code: ApiErrorCode,
  message: string,
  extra: Record<string, unknown> = {},
): void {
  if (!res.headersSent) {
    res.status(STATUS_FOR_CODE[code]).json(apiErrorBody(code, message, extra));
    return;
  }
  if (!res.writableEnded) {
    res.write(CONTROL_FRAME_PREFIX + JSON.stringify({ type: 'error', code, message }) + '\n');
    res.end();
  }
}
