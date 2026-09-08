import { afterEach, describe, expect, it, vi } from 'vitest';
import type { VercelRequest, VercelResponse } from '@vercel/node';

const mocks = vi.hoisted(() => ({ trigger: vi.fn(), cleanup: vi.fn(), createClient: vi.fn(), auth: vi.fn() }));
vi.mock('@trigger.dev/sdk', () => ({ tasks: { trigger: mocks.trigger } }));
vi.mock('@supabase/supabase-js', () => ({ createClient: mocks.createClient }));
vi.mock('./cleanup.js', () => ({ cleanupProcessingData: mocks.cleanup }));
vi.mock('../../ai-proxy.js', () => ({ AI_PERSONAS: { pro: {} } }));
vi.mock('../auth.js', () => ({ getAuthenticatedRequestUser: mocks.auth }));
vi.mock('../cors.js', () => ({ applyCors: vi.fn(), hasAcceptableOrigin: () => true }));
import cleanupHandler from '../../retention-cleanup';
import proHandler from '../../pro-generation';

function response() {
  const value = { statusCode: 0, body: undefined as unknown, headers: {} as Record<string, unknown>,
    status(code: number) { value.statusCode = code; return value; },
    json(body: unknown) { value.body = body; return value; },
    setHeader(key: string, item: unknown) { value.headers[key] = item; },
  };
  return value;
}
function req(headers = {}, method = 'POST') { return { headers, method, body: {} } as VercelRequest; }
afterEach(() => { vi.clearAllMocks(); vi.unstubAllEnvs(); });

describe('retention API boundaries (mock services)', () => {
  it('rejects a malformed PRO body before auth, persistence or dispatch', async () => {
    const res = response();
    await proHandler(req(), res as unknown as VercelResponse);
    expect(res.statusCode).toBe(400);
    expect(mocks.trigger).not.toHaveBeenCalled();
    expect(mocks.auth).not.toHaveBeenCalled();
    expect(res.headers['Cache-Control']).toBe('no-store');
  });
  it('rejects cleanup with no secret, a short secret or the wrong token', async () => {
    for (const secret of ['', 'short', 'x'.repeat(32)]) {
      vi.stubEnv('RETENTION_CLEANUP_SECRET', secret);
      const res = response();
      await cleanupHandler(req({ authorization: 'Bearer wrong' }), res as unknown as VercelResponse);
      expect(res.statusCode).toBe(401);
    }
    expect(mocks.cleanup).not.toHaveBeenCalled();
  });
  it('keeps destructive cleanup disabled even with a valid token', async () => {
    vi.stubEnv('RETENTION_CLEANUP_SECRET', 'x'.repeat(32));
    vi.stubEnv('RETENTION_CLEANUP_ENABLED', 'false');
    const res = response();
    await cleanupHandler(req({ authorization: `Bearer ${'x'.repeat(32)}` }), res as unknown as VercelResponse);
    expect(res.statusCode).toBe(503);
    expect(mocks.cleanup).not.toHaveBeenCalled();
  });
  it('reports success only after enabled cleanup resolves, and hides failure details', async () => {
    vi.stubEnv('RETENTION_CLEANUP_SECRET', 'x'.repeat(32));
    vi.stubEnv('RETENTION_CLEANUP_ENABLED', 'true');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'synthetic');
    const res = response();
    mocks.cleanup.mockResolvedValueOnce(undefined);
    await cleanupHandler(req({ authorization: `Bearer ${'x'.repeat(32)}` }), res as unknown as VercelResponse);
    expect(res.statusCode).toBe(200);
    mocks.cleanup.mockRejectedValueOnce(new Error('CANARY_PRIVATE'));
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    await cleanupHandler(req({ authorization: `Bearer ${'x'.repeat(32)}` }), res as unknown as VercelResponse);
    expect(res.statusCode).toBe(503);
    expect(JSON.stringify(res.body)).not.toContain('CANARY_PRIVATE');
    expect(JSON.stringify(log.mock.calls)).not.toContain('CANARY_PRIVATE');
    log.mockRestore();
  });
});
