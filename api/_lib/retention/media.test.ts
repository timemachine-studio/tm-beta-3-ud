import { afterEach, describe, expect, it, vi } from 'vitest';
import type { VercelRequest, VercelResponse } from '@vercel/node';
vi.mock('../auth.js', () => ({ getAuthenticatedRequestUser: async () => ({ id: 'synthetic-owner' }) }));
vi.mock('../cors.js', () => ({ applyCors: vi.fn(), hasAcceptableOrigin: () => true, isSameOriginSubresource: () => true }));
import image from '../../image';
import music from '../../music';
import cover from '../../musicCover';
function response() {
  const value = { statusCode: 0, body: undefined as unknown, headers: {} as Record<string, unknown>,
    status(code: number) { value.statusCode = code; return value; },
    json(body: unknown) { value.body = body; return value; },
    send(body: unknown) { value.body = body; return value; },
    setHeader(key: string, item: unknown) { value.headers[key] = item; },
  }; return value;
}
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });
describe('media processing retention (mock provider responses)', () => {
  it.each([['image', image], ['music', music], ['cover', cover]] as const)('%s avoids public caches and content-bearing diagnostics', async (_name, handler) => {
    const fetchMock = vi.fn().mockResolvedValueOnce(new Response('synthetic-media', { status: 200 })).mockResolvedValueOnce(new Response('CANARY_PRIVATE_UPSTREAM', { status: 502 }));
    vi.stubGlobal('fetch', fetchMock);
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const req = { method: 'GET', headers: {}, query: { prompt: 'CANARY_PRIVATE_PROMPT' } } as unknown as VercelRequest;
    const res = response();
    await handler(req, res as unknown as VercelResponse);
    expect(res.statusCode).toBe(200);
    expect(res.headers['Cache-Control']).toBe('no-store');
    await handler(req, res as unknown as VercelResponse);
    expect(res.statusCode).toBe(502);
    expect(JSON.stringify([res.body, log.mock.calls, error.mock.calls])).not.toContain('CANARY_PRIVATE');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
