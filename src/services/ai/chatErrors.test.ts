import { describe, it, expect } from 'vitest';
import { ChatError, chatErrorFromResponse, chatErrorCopy, isRetryableCode, toChatErrorCode } from './chatErrors';
import { CHAT_ERROR_COPY } from './chatErrors';
import type { ChatErrorCode } from '../../types/chat';

const json = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

describe('toChatErrorCode', () => {
  it('maps the API envelope code', () => {
    expect(toChatErrorCode('PROVIDER_DOWN')).toBe('PROVIDER_DOWN');
    expect(toChatErrorCode('AUTH_REQUIRED')).toBe('AUTH_EXPIRED');
    expect(toChatErrorCode('UNAVAILABLE')).toBe('PROVIDER_DOWN');
  });

  it('falls back to the HTTP status when there is no code', () => {
    expect(toChatErrorCode(undefined, 429)).toBe('RATE_LIMITED');
    expect(toChatErrorCode(undefined, 413)).toBe('PAYLOAD_TOO_LARGE');
    expect(toChatErrorCode(undefined, 504)).toBe('TIMEOUT');
    expect(toChatErrorCode(undefined, 418)).toBe('UNKNOWN');
  });
});

describe('chatErrorFromResponse', () => {
  it('reads the structured envelope', async () => {
    const err = await chatErrorFromResponse(
      json({ error: { code: 'PAYLOAD_TOO_LARGE', message: 'Request body too large' } }, 413)
    );
    expect(err.code).toBe('PAYLOAD_TOO_LARGE');
    expect(err.message).toBe('Request body too large');
  });

  // Other endpoints still return `{ error: 'some string' }`.
  it('still understands the legacy string shape', async () => {
    const err = await chatErrorFromResponse(json({ error: 'boom' }, 500));
    expect(err.code).toBe('UNKNOWN');
    expect(err.message).toBe('boom');
  });

  it('treats a 429 as a rate limit regardless of shape', async () => {
    expect((await chatErrorFromResponse(json({}, 429))).code).toBe('RATE_LIMITED');
    expect((await chatErrorFromResponse(json({ type: 'rateLimit' }, 200))).code).toBe('RATE_LIMITED');
  });

  it('never surfaces an unparseable body as the message', async () => {
    const err = await chatErrorFromResponse(new Response('<html>gateway</html>', { status: 502 }));
    expect(err.code).toBe('PROVIDER_DOWN');
    expect(err.message).not.toContain('<html>');
  });
});

describe('isRetryableCode', () => {
  it('retries transient upstream failures', () => {
    for (const code of ['PROVIDER_DOWN', 'TIMEOUT', 'NETWORK', 'TRUNCATED', 'EMPTY'] as ChatErrorCode[]) {
      expect(isRetryableCode(code)).toBe(true);
    }
  });

  it('does not retry failures the user has to act on', () => {
    for (const code of ['RATE_LIMITED', 'AUTH_EXPIRED', 'PAYLOAD_TOO_LARGE'] as ChatErrorCode[]) {
      expect(isRetryableCode(code)).toBe(false);
    }
  });
});

describe('chatErrorCopy', () => {
  // 1.7: every class gets a distinct, actionable line — the whole point was to
  // stop everything collapsing to "Failed to generate response."
  it('gives every code its own message', () => {
    const messages = Object.values(CHAT_ERROR_COPY);
    expect(new Set(messages).size).toBe(messages.length);
  });

  it('falls back to UNKNOWN copy for a missing code', () => {
    expect(chatErrorCopy(undefined)).toBe(CHAT_ERROR_COPY.UNKNOWN);
  });
});

describe('ChatError', () => {
  it('carries partial content so a truncated turn keeps what it streamed', () => {
    const err = new ChatError('TRUNCATED', 'cut off', 'half an answer');
    expect(err.partialContent).toBe('half an answer');
    expect(err).toBeInstanceOf(Error);
  });
});
