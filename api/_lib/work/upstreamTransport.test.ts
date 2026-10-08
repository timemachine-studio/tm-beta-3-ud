import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const database = vi.hoisted(() => ({ from: vi.fn() }));
vi.mock('./store.js', () => ({
  WorkError: class extends Error { constructor(public code: string, public status = 503) { super(code); } },
  workDatabase: () => database,
}));
import { readWorkConnection, readWorkExecutionConnection, workUpstreamJson, type WorkServiceConnection } from './upstreamTransport';

const connection: WorkServiceConnection = {
  id: '11111111-1111-4111-8111-111111111111', user_id: '22222222-2222-4222-8222-222222222222',
  service: 'openhands', base_url: 'https://sandbox.example/api-prefix', credential_ref: 'OWNER_ONE',
  scope_id: null, enabled: true, scope_verified_at: '2026-09-27T00:00:00Z',
};
const fetchMock = vi.fn();
beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock); fetchMock.mockReset();
  vi.stubEnv('TM_WORK_UPSTREAM_ORIGINS', 'https://sandbox.example');
  vi.stubEnv('TM_WORK_UPSTREAM_SECRET_OWNER_ONE', 'private-upstream-key');
  vi.stubEnv('TM_WORK_ALLOW_LOOPBACK', 'false');
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.useRealTimers(); });

describe('Work upstream transport', () => {
  it('uses scoped bearer authentication for Hermes metadata', async () => {
    fetchMock.mockResolvedValue(Response.json({ ok: true }));
    await workUpstreamJson({ ...connection, service: 'hermes' }, '/v1/capabilities');
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ redirect: 'error', headers: { Authorization: 'Bearer private-upstream-key' } });
    expect(fetchMock.mock.calls[0][1].headers['X-Session-API-Key']).toBeUndefined();
  });
  it('reads only the requested owner and service with enabled connections', async () => {
    const query = { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), maybeSingle: vi.fn().mockResolvedValue({ data: connection, error: null }) };
    database.from.mockReturnValue(query);
    await expect(readWorkConnection(connection.user_id, 'openhands')).resolves.toEqual(connection);
    expect(query.eq.mock.calls).toEqual([['user_id', connection.user_id], ['service', 'openhands'], ['enabled', true]]);
  });
  it.each([
    { user_id: '33333333-3333-4333-8333-333333333333' }, { service: 'agenta' }, { scope_verified_at: null },
    { credential_ref: 'SUPABASE_SERVICE_ROLE_KEY/../../' }, { enabled: false }, { scope_id: '33333333-3333-4333-8333-333333333333' },
  ])('rejects an invalid or unverified connection row %j', async overrides => {
    const query = { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), maybeSingle: vi.fn().mockResolvedValue({ data: { ...connection, ...overrides }, error: null }) };
    database.from.mockReturnValue(query);
    await expect(readWorkConnection(connection.user_id, 'openhands')).rejects.toMatchObject({ code: 'WORK_INTEGRATION_SETUP_REQUIRED' });
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('returns missing connections as disconnected but schema/query errors as setup-required', async () => {
    const query = { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }) };
    database.from.mockReturnValue(query);
    await expect(readWorkConnection(connection.user_id, 'agenta')).resolves.toBeNull();
    query.maybeSingle.mockResolvedValue({ data: null, error: { message: 'private-db-detail' } } as never);
    await expect(readWorkConnection(connection.user_id, 'agenta')).rejects.toMatchObject({ message: 'WORK_INTEGRATION_SETUP_REQUIRED' });
  });
  it('requires a separate administrator execution attestation before launch', async () => {
    const single = vi.fn().mockResolvedValueOnce({ data: connection, error: null })
      .mockResolvedValueOnce({ data: { execution_verified_at: '2026-09-27T00:00:00Z' }, error: null });
    const query = { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), maybeSingle: single };
    database.from.mockReturnValue(query);
    await expect(readWorkExecutionConnection(connection.user_id)).resolves.toEqual(connection);
    expect(query.eq).toHaveBeenCalledWith('id', connection.id);
    expect(query.select).toHaveBeenCalledWith('execution_verified_at');
  });
  it.each([{ execution_verified_at: null }, { execution_verified_at: 'bad-date' }])('does not confuse monitoring with execution permission %o', data => {
    const single = vi.fn().mockResolvedValueOnce({ data: connection, error: null }).mockResolvedValueOnce({ data, error: null });
    const query = { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), maybeSingle: single };
    database.from.mockReturnValue(query);
    return expect(readWorkExecutionConnection(connection.user_id)).rejects.toMatchObject({ code: 'WORK_RUNTIME_LAUNCH_SETUP_REQUIRED' });
  });
  it('keeps configured API prefixes and credentials on a no-redirect server request', async () => {
    fetchMock.mockResolvedValue(Response.json({ ok: true }));
    await expect(workUpstreamJson(connection, '/api/conversations/test')).resolves.toEqual({ ok: true });
    const [target, options] = fetchMock.mock.calls[0];
    expect(String(target)).toBe('https://sandbox.example/api-prefix/api/conversations/test');
    expect(options).toMatchObject({ redirect: 'error', credentials: 'omit', cache: 'no-store', headers: { 'X-Session-API-Key': 'private-upstream-key' } });
    expect(options.headers.Authorization).toBeUndefined();
  });
  it('uses Agenta project-bound ApiKey authentication, not a bearer token', async () => {
    fetchMock.mockResolvedValue(Response.json({ traces: [] }));
    await workUpstreamJson({ ...connection, service: 'agenta' }, '/simple/traces/query', { method: 'POST', query: { project_id: 'assigned-project' }, body: { trace: {} } });
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ method: 'POST', headers: { Authorization: 'ApiKey private-upstream-key' } });
    expect(fetchMock.mock.calls[0][1].headers['X-Session-API-Key']).toBeUndefined();
  });
  it.each(['https://attacker.example', 'http://sandbox.example', 'https://user:password@sandbox.example', 'https://sandbox.example?key=secret', 'https://sandbox.example#key', 'http://localhost:3000'])('rejects untrusted target %s before fetch', async base_url => {
    await expect(workUpstreamJson({ ...connection, base_url }, '/simple/traces/query')).rejects.toMatchObject({ code: 'WORK_INTEGRATION_SETUP_REQUIRED' });
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it.each(['//attacker.example', '/../secrets', '/api/%2e%2e/secrets', '/api?key=secret'])('rejects path escape %s', async path => {
    await expect(workUpstreamJson(connection, path)).rejects.toMatchObject({ code: 'WORK_INTEGRATION_SETUP_REQUIRED' });
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('permits loopback only with explicit non-production opt-in', async () => {
    vi.stubEnv('TM_WORK_UPSTREAM_ORIGINS', 'http://127.0.0.1:3000'); vi.stubEnv('TM_WORK_ALLOW_LOOPBACK', 'true');
    vi.stubEnv('NODE_ENV', 'development'); vi.stubEnv('VERCEL', '');
    fetchMock.mockResolvedValue(Response.json({ ok: true }));
    await workUpstreamJson({ ...connection, base_url: 'http://127.0.0.1:3000' }, '/api/conversations/test');
    vi.stubEnv('NODE_ENV', 'production');
    await expect(workUpstreamJson({ ...connection, base_url: 'http://127.0.0.1:3000' }, '/api/conversations/test')).rejects.toMatchObject({ code: 'WORK_INTEGRATION_SETUP_REQUIRED' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it('fails closed when its scoped credential is missing or contains a newline', async () => {
    vi.stubEnv('TM_WORK_UPSTREAM_SECRET_OWNER_ONE', '');
    await expect(workUpstreamJson(connection, '/api/conversations/test')).rejects.toMatchObject({ code: 'WORK_INTEGRATION_SETUP_REQUIRED' });
    vi.stubEnv('TM_WORK_UPSTREAM_SECRET_OWNER_ONE', 'private-key\nextra-header');
    await expect(workUpstreamJson(connection, '/api/conversations/test')).rejects.toMatchObject({ code: 'WORK_INTEGRATION_SETUP_REQUIRED' });
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('redacts upstream exception and error bodies', async () => {
    fetchMock.mockResolvedValue(new Response('private-upstream-key', { status: 403 }));
    await expect(workUpstreamJson(connection, '/api/conversations/test')).rejects.toMatchObject({ message: 'WORK_UPSTREAM_UNAVAILABLE', status: 502 });
    fetchMock.mockRejectedValue(new Error('private-upstream-key'));
    await expect(workUpstreamJson(connection, '/api/conversations/test')).rejects.toMatchObject({ message: 'WORK_UPSTREAM_UNAVAILABLE' });
  });
  it('bounds decoded response bytes even without content-length', async () => {
    fetchMock.mockResolvedValue(new Response('"' + 'x'.repeat(524288) + '"', { headers: { 'Content-Type': 'application/json' } }));
    await expect(workUpstreamJson(connection, '/api/conversations/test')).rejects.toMatchObject({ code: 'WORK_UPSTREAM_INVALID_RESPONSE' });
  });
  it('rejects oversized advertised responses and non-JSON responses', async () => {
    fetchMock.mockResolvedValue(new Response('{}', { headers: { 'Content-Type': 'application/json', 'Content-Length': '524289' } }));
    await expect(workUpstreamJson(connection, '/api/conversations/test')).rejects.toMatchObject({ code: 'WORK_UPSTREAM_INVALID_RESPONSE' });
    fetchMock.mockResolvedValue(new Response('<html>sign in</html>', { headers: { 'Content-Type': 'text/html' } }));
    await expect(workUpstreamJson(connection, '/api/conversations/test')).rejects.toMatchObject({ code: 'WORK_UPSTREAM_INVALID_RESPONSE' });
  });
  it('rejects invalid JSON as an upstream protocol failure', async () => {
    fetchMock.mockResolvedValue(new Response('{"private":', { headers: { 'Content-Type': 'application/json' } }));
    await expect(workUpstreamJson(connection, '/api/conversations/test')).rejects.toMatchObject({ code: 'WORK_UPSTREAM_INVALID_RESPONSE', status: 502 });
  });
  it('aborts stalled fetches and returns a bounded timeout without secrets', async () => {
    vi.useFakeTimers();
    fetchMock.mockImplementation((_url, options) => new Promise((_resolve, reject) => options.signal.addEventListener('abort', () => reject(new Error('private-upstream-key')))));
    const check = expect(workUpstreamJson(connection, '/api/conversations/test')).rejects.toMatchObject({ code: 'WORK_UPSTREAM_TIMEOUT', status: 504 });
    await vi.advanceTimersByTimeAsync(10000); await check;
  });
});
