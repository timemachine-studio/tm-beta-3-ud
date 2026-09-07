import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import type { VercelRequest, VercelResponse } from '@vercel/node';
const mocks = vi.hoisted(() => ({ from: vi.fn(), deleteUser: vi.fn(), purge: vi.fn() }));
vi.mock('@supabase/supabase-js', () => ({ createClient: () => ({ from: mocks.from, auth: { admin: { deleteUser: mocks.deleteUser } } }) }));
vi.mock('../auth.js', () => ({ getAuthenticatedRequestUser: async () => ({ id: 'owner' }) }));
vi.mock('../cors.js', () => ({ applyCors: vi.fn(), hasAcceptableOrigin: () => true }));
vi.mock('./accountStorage.js', () => ({ purgeUserStorage: mocks.purge }));
vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'synthetic-test-key');
const { default: handler } = await import('../../delete-account');
afterAll(() => vi.unstubAllEnvs());
function response() {
  const value = { statusCode: 0, body: undefined as unknown,
    status(code: number) { value.statusCode = code; return value; },
    json(body: unknown) { value.body = body; return value; }, setHeader: vi.fn(),
  }; return value;
}
function setup(external: boolean, failingTable?: string) {
  mocks.from.mockImplementation((table: string) => {
    let select = false;
    const query = {
      select: () => { select = true; return query; }, delete: () => query,
      eq: () => query, not: () => query, limit: () => query,
      then: (resolve: (value: unknown) => unknown) => Promise.resolve(resolve({ data: select && external ? [{ id: 'job' }] : [], error: table === failingTable ? { message: 'CANARY_PRIVATE' } : null })),
    }; return query;
  });
  mocks.purge.mockResolvedValue(undefined);
  mocks.deleteUser.mockResolvedValue({ error: null });
}
afterEach(() => { vi.resetAllMocks(); vi.restoreAllMocks(); });
describe('account deletion ordering (mock services)', () => {
  it('keeps external job mapping and account before any destructive step', async () => {
    setup(true);
    const res = response();
    await handler({ method: 'POST', headers: {} } as VercelRequest, res as unknown as VercelResponse);
    expect(res.statusCode).toBe(503);
    expect(mocks.purge).not.toHaveBeenCalled();
    expect(mocks.deleteUser).not.toHaveBeenCalled();
  });
  it('preserves auth on a data error, including missing schema', async () => {
    setup(false, 'chat_messages');
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = response();
    await handler({ method: 'POST', headers: {} } as VercelRequest, res as unknown as VercelResponse);
    expect(res.statusCode).toBe(500);
    expect(mocks.deleteUser).not.toHaveBeenCalled();
    expect(mocks.from.mock.calls.some(([table]) => table === 'profiles')).toBe(false);
    expect(JSON.stringify(res.body)).not.toContain('CANARY_PRIVATE');
  });
  it('deletes auth only after supported store cleanup succeeds', async () => {
    setup(false);
    const res = response();
    await handler({ method: 'POST', headers: {} } as VercelRequest, res as unknown as VercelResponse);
    expect(res.statusCode).toBe(200);
    expect(mocks.deleteUser).toHaveBeenCalledWith('owner');
    expect(mocks.purge).toHaveBeenCalledTimes(2);
  });
});
