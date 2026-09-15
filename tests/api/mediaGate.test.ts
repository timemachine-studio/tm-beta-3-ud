import { beforeEach, describe, expect, it, vi } from 'vitest';

// The gate derives its signing key from the service-role key at import time.
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'test-service-role-key';

const { getAuthenticatedRequestUser, checkRateLimit, incrementRateLimit } = vi.hoisted(() => ({
  getAuthenticatedRequestUser: vi.fn(),
  checkRateLimit: vi.fn(),
  incrementRateLimit: vi.fn(),
}));

vi.mock('../../api/_lib/auth.js', () => ({ getAuthenticatedRequestUser }));
vi.mock('../../api/_lib/rateLimit.js', () => ({ checkRateLimit, incrementRateLimit }));

import {
  admitMediaRequest,
  signMediaUrl,
  verifySignedMediaRequest,
} from '../../api/_lib/mediaGate.js';

function queryOf(url: string): Record<string, string> {
  return Object.fromEntries(new URL(url, 'http://localhost').searchParams.entries());
}

function response() {
  const res = {
    statusCode: 200,
    body: undefined as unknown,
    status: vi.fn((code: number) => { res.statusCode = code; return res; }),
    json: vi.fn((body: unknown) => { res.body = body; return res; }),
  };
  return res;
}

function request(query: Record<string, string>, headers: Record<string, string> = {}) {
  return { method: 'GET', query, headers, socket: { remoteAddress: '203.0.113.9' } };
}

describe('signed media URLs (pre-launch-audit.md A.2)', () => {
  it('round-trips a URL the server minted', () => {
    const url = signMediaUrl('/api/image', { prompt: 'a cat, comma', seed: '42', persona: 'default' }, 60);
    const query = queryOf(url);
    expect(query.sig).toBeTruthy();
    expect(verifySignedMediaRequest('/api/image', query)).toBe(true);
  });

  it('rejects a URL whose parameters were edited after signing', () => {
    const url = signMediaUrl('/api/image', { prompt: 'a cat', seed: '42' }, 60);
    const query = queryOf(url);
    expect(verifySignedMediaRequest('/api/image', { ...query, prompt: 'a dog' })).toBe(false);
    expect(verifySignedMediaRequest('/api/image', { ...query, extra: '1' })).toBe(false);
    expect(verifySignedMediaRequest('/api/music', query)).toBe(false);
  });

  it('rejects an expired URL and one with no signature at all', () => {
    const expired = queryOf(signMediaUrl('/api/image', { prompt: 'x' }, -1));
    expect(verifySignedMediaRequest('/api/image', expired)).toBe(false);
    expect(verifySignedMediaRequest('/api/image', { prompt: 'x' })).toBe(false);
  });
});

describe('admitMediaRequest', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    checkRateLimit.mockResolvedValue({ allowed: true, providers: [] });
    incrementRateLimit.mockResolvedValue(undefined);
    getAuthenticatedRequestUser.mockResolvedValue(null);
  });

  it('refuses a forged Sec-Fetch-Site / Referer with no token and no signature', async () => {
    const res = response();
    const access = await admitMediaRequest(
      request({ prompt: 'x' }, { 'sec-fetch-site': 'same-origin', referer: 'https://timemachinechat.com/' }) as never,
      res as never,
      'image',
      '/api/image',
    );
    expect(access).toBeNull();
    expect(res.statusCode).toBe(401);
    expect(checkRateLimit).not.toHaveBeenCalled();
  });

  it('admits a signed URL anonymously, on the per-IP media bucket, and charges after success', async () => {
    const query = queryOf(signMediaUrl('/api/image', { prompt: 'x', seed: '1' }, 60));
    const res = response();
    const access = await admitMediaRequest(request(query) as never, res as never, 'image', '/api/image');
    expect(access?.via).toBe('signature');
    expect(checkRateLimit).toHaveBeenCalledWith(null, '203.0.113.9', '__media__:image', expect.objectContaining({ limitOverride: expect.any(Number) }));
    expect(incrementRateLimit).not.toHaveBeenCalled();
    await access!.charge();
    expect(incrementRateLimit).toHaveBeenCalledWith(null, '203.0.113.9', '__media__:image', { provider: 'pollinations' });
  });

  it('admits a bearer token on the user bucket and 429s when it is spent', async () => {
    getAuthenticatedRequestUser.mockResolvedValue({ id: 'user-1' });
    const ok = await admitMediaRequest(request({ prompt: 'x' }) as never, response() as never, 'music', '/api/music');
    expect(ok?.via).toBe('bearer');
    expect(checkRateLimit).toHaveBeenCalledWith('user-1', '203.0.113.9', '__media__:music', expect.anything());

    checkRateLimit.mockResolvedValue({ allowed: false, reason: 'limit', limit: 10 });
    const res = response();
    const refused = await admitMediaRequest(request({ prompt: 'x' }) as never, res as never, 'music', '/api/music');
    expect(refused).toBeNull();
    expect(res.statusCode).toBe(429);
  });

  it('fails closed when the limiter backend is down', async () => {
    checkRateLimit.mockResolvedValue({ allowed: false, reason: 'backend_error' });
    const query = queryOf(signMediaUrl('/api/image', { prompt: 'x' }, 60));
    const res = response();
    expect(await admitMediaRequest(request(query) as never, res as never, 'image', '/api/image')).toBeNull();
    expect(res.statusCode).toBe(503);
  });

  it('takes the first hop of a comma-separated x-forwarded-for', async () => {
    const query = queryOf(signMediaUrl('/api/image', { prompt: 'x' }, 60));
    await admitMediaRequest(request(query, { 'x-forwarded-for': '198.51.100.7, 10.0.0.1' }) as never, response() as never, 'image', '/api/image');
    expect(checkRateLimit).toHaveBeenCalledWith(null, '198.51.100.7', expect.any(String), expect.anything());
  });
});
