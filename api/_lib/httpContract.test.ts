import { describe, expect, it, vi } from 'vitest';
import type { IncomingHttpHeaders, ServerResponse } from 'node:http';
import { getRequestAccessToken } from './auth.js';
import { applyCors, hasAcceptableOrigin } from './cors.js';
import {
  ApiRequestError,
  parseVercelBody,
  parseVercelCookies,
  parseVercelQuery,
  VERCEL_PAYLOAD_LIMIT_BYTES,
  withVercelResponseHelpers,
} from './nodeHttpAdapter.js';
import type { VercelRequest } from './vercelTypes.js';

function request(overrides: Record<string, unknown> = {}): VercelRequest {
  return {
    method: 'GET',
    headers: {},
    query: {},
    cookies: {},
    body: undefined,
    socket: { remoteAddress: '127.0.0.1' },
    ...overrides,
  } as unknown as VercelRequest;
}

function responseDouble() {
  const headers = new Map<string, unknown>();
  const end = vi.fn();
  const write = vi.fn();
  const raw = {
    statusCode: 200,
    setHeader: vi.fn((name: string, value: unknown) => { headers.set(name.toLowerCase(), value); }),
    hasHeader: vi.fn((name: string) => headers.has(name.toLowerCase())),
    getHeader: vi.fn((name: string) => headers.get(name.toLowerCase())),
    end,
    write,
  } as unknown as ServerResponse;
  return { raw, headers, end, write };
}

describe('local Vercel request compatibility', () => {
  it('preserves repeated query values as arrays', () => {
    expect(parseVercelQuery(new URLSearchParams('q=one&q=two&single=value'))).toEqual({
      q: ['one', 'two'],
      single: 'value',
    });
  });

  it('parses cookies without failing on malformed encoding', () => {
    expect(parseVercelCookies('session=hello%20world; broken=%E0%A4%A')).toEqual({
      session: 'hello world',
      broken: '%E0%A4%A',
    });
  });

  it('matches Vercel body helpers for JSON, forms, text, binary, and absent bodies', () => {
    const body = (contentType: string, value: string | Buffer) => parseVercelBody(
      'POST',
      { 'content-type': contentType } as IncomingHttpHeaders,
      Buffer.isBuffer(value) ? value : Buffer.from(value),
    );

    expect(body('application/json', '{"ok":true}')).toEqual({ ok: true });
    expect(body('application/x-www-form-urlencoded', 'tag=a&tag=b')).toEqual({ tag: ['a', 'b'] });
    expect(body('text/plain', 'hello')).toBe('hello');
    expect(body('application/octet-stream', Buffer.from([1, 2]))).toEqual(Buffer.from([1, 2]));
    expect(parseVercelBody('GET', {}, Buffer.alloc(0))).toBeUndefined();
  });

  it('rejects malformed JSON and payloads above the platform limit', () => {
    expect(() => parseVercelBody('POST', { 'content-type': 'application/json' }, Buffer.from('{')))
      .toThrow(ApiRequestError);
    try {
      parseVercelBody('POST', {}, Buffer.alloc(VERCEL_PAYLOAD_LIMIT_BYTES + 1));
      throw new Error('expected oversized payload rejection');
    } catch (error) {
      expect(error).toBeInstanceOf(ApiRequestError);
      expect((error as ApiRequestError).statusCode).toBe(413);
    }
  });
});

describe('local Vercel response compatibility', () => {
  it('chains status and serializes JSON with its content type', () => {
    const { raw, headers, end } = responseDouble();
    const res = withVercelResponseHelpers(raw);

    expect(res.status(201)).toBe(res);
    expect(res.json({ created: true })).toBe(res);
    expect(raw.statusCode).toBe(201);
    expect(headers.get('content-type')).toBe('application/json; charset=utf-8');
    expect(end).toHaveBeenCalledWith('{"created":true}');
  });

  it('sends buffers unchanged and leaves Node streaming methods intact', () => {
    const { raw, headers, end, write } = responseDouble();
    const originalWrite = raw.write;
    const res = withVercelResponseHelpers(raw);

    expect(res.write).toBe(originalWrite);
    res.write('chunk\n');
    res.send(Buffer.from([1, 2, 3]));
    expect(write).toHaveBeenCalledWith('chunk\n');
    expect(headers.get('content-type')).toBe('application/octet-stream');
    expect(end).toHaveBeenCalledWith(Buffer.from([1, 2, 3]));
  });
});

describe('shared auth and CORS contract', () => {
  it('extracts only a non-empty bearer token', () => {
    expect(getRequestAccessToken(request({ headers: { authorization: 'Bearer token-1' } }))).toBe('token-1');
    expect(getRequestAccessToken(request({ headers: { authorization: 'Basic token-1' } }))).toBeNull();
    expect(getRequestAccessToken(request({ headers: { authorization: 'Bearer   ' } }))).toBeNull();
  });

  it('accepts a same-origin request and writes the complete CORS response', () => {
    const req = request({
      headers: {
        origin: 'http://localhost:5173',
        host: 'localhost:5173',
      },
    });
    const { raw, headers } = responseDouble();
    const res = withVercelResponseHelpers(raw);

    expect(hasAcceptableOrigin(req)).toBe(true);
    applyCors(req, res, 'GET, OPTIONS');
    expect(headers.get('access-control-allow-origin')).toBe('http://localhost:5173');
    expect(headers.get('access-control-allow-methods')).toBe('GET, OPTIONS');
    expect(headers.get('vary')).toBe('Origin');
  });
});
