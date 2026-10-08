import { createHmac } from 'node:crypto';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
const mock = vi.hoisted(() => ({ task: vi.fn(), entitlement: vi.fn(), connection: vi.fn(), single: vi.fn(), rpc: vi.fn(), update: vi.fn(), eq: vi.fn(), is: vi.fn() }));
vi.mock('./store.js', () => ({ WorkError: class extends Error { constructor(public code: string, public status = 503) { super(code); } },
  readWorkTask: mock.task, requireWorkEntitlement: mock.entitlement,
  workDatabase: () => { const query = { select: () => query, eq: (...args: unknown[]) => { mock.eq(...args); return query; },
    is: (...args: unknown[]) => { mock.is(...args); return query; }, update: (...args: unknown[]) => { mock.update(...args); return query; }, maybeSingle: mock.single };
    return { from: () => query, rpc: mock.rpc }; },
}));
vi.mock('./upstreamTransport.js', () => ({ readWorkConnection: mock.connection }));
import { authorizeWorkRuntimeGrant, claimWorkRuntimeLease, issueWorkRuntimeGrant, releaseWorkRuntimeLease, verifyWorkRuntimeGrant } from './runtimeGrant';

const taskId = '11111111-1111-4111-8111-111111111111', userId = '22222222-2222-4222-8222-222222222222';
const connectionId = '33333333-3333-4333-8333-333333333333', conversationId = '44444444-4444-4444-8444-444444444444';
const grantId = '55555555-5555-4555-8555-555555555555', leaseId = '66666666-6666-4666-8666-666666666666';
const secret = 'test-only-runtime-signing-secret-not-a-provider-key';
const at = Date.parse('2026-09-27T15:00:00Z');
const claims = { audience: 'tm-work-model' as const, taskId, userId, connectionId, conversationId, grantId, generation: 2,
  persona: 'pro' as const, issuedAt: at / 1000, expiresAt: at / 1000 + 300 };
const binding = { task_id: taskId, user_id: userId, connection_id: connectionId, remote_conversation_id: conversationId,
  execution_enabled: true, execution_verified_at: new Date(at).toISOString(), gateway_grant_id: grantId,
  gateway_expires_at: new Date(at + 300000).toISOString(), gateway_generation: 2, gateway_lease_id: leaseId,
  gateway_lease_expires_at: new Date(at + 180000).toISOString() };
const task = { id: taskId, user_id: userId, status: 'running', worker_id: 'openhands:' + conversationId, generation: 2, persona: 'pro' };
function token(value: unknown = claims) { const data = Buffer.from(JSON.stringify(value)).toString('base64url');
  return 'tmw1.' + data + '.' + createHmac('sha256', secret).update('tmw1.' + data).digest('base64url'); }
beforeEach(() => { vi.clearAllMocks(); vi.useFakeTimers(); vi.setSystemTime(at);
  vi.stubEnv('TM_WORK_UPSTREAM_ENABLED', 'true'); vi.stubEnv('TM_WORK_MODEL_GATEWAY_ENABLED', 'true'); vi.stubEnv('TM_WORK_MODEL_GATEWAY_SECRET', secret);
  mock.task.mockResolvedValue(task); mock.entitlement.mockResolvedValue(undefined); mock.connection.mockResolvedValue({ id: connectionId });
  mock.single.mockResolvedValue({ data: binding, error: null }); mock.rpc.mockResolvedValue({ data: true, error: null });
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); });

describe('TM runtime grants', () => {
  it('verifies bounded signed claims without contacting a database', () => { expect(verifyWorkRuntimeGrant(token())).toEqual(claims); expect(mock.task).not.toHaveBeenCalled(); });
  it('rejects tampering, extra claims, wrong audience and noncanonical signatures', () => {
    for (const invalid of [token().replace('tmw1.', 'tmw2.'), token().slice(0, -1) + '!', token({ ...claims, audience: 'chat' }), token({ ...claims, provider: 'attacker' })])
      expect(() => verifyWorkRuntimeGrant(invalid)).toThrow();
  });
  it('rejects expired/future/overlong grants and weak configuration', () => {
    for (const invalid of [token({ ...claims, expiresAt: at / 1000 }), token({ ...claims, issuedAt: at / 1000 + 60 }), token({ ...claims, expiresAt: at / 1000 + 901 })])
      expect(() => verifyWorkRuntimeGrant(invalid)).toThrow();
    vi.stubEnv('TM_WORK_MODEL_GATEWAY_SECRET', 'weak'); expect(() => verifyWorkRuntimeGrant(token())).toThrow();
  });
  it('fails closed while disabled', () => { vi.stubEnv('TM_WORK_MODEL_GATEWAY_ENABLED', 'false'); expect(() => verifyWorkRuntimeGrant(token())).toThrow(); });
  it('rechecks premium and the assigned task/connection/lease', async () => {
    await expect(authorizeWorkRuntimeGrant(claims, leaseId)).resolves.toEqual(task);
    expect(mock.task).toHaveBeenCalledWith(taskId, userId); expect(mock.connection).toHaveBeenCalledWith(userId, 'openhands');
    expect(mock.eq).toHaveBeenCalledWith('user_id', userId);
  });
  it.each(['cancelled', 'review', 'completed'])('rejects a %s task', async status => { mock.task.mockResolvedValue({ ...task, status });
    await expect(authorizeWorkRuntimeGrant(claims)).rejects.toMatchObject({ code: 'WORK_RUNTIME_UNAUTHORIZED' }); });
  it.each([{ generation: 3 }, { persona: 'default' }, { worker_id: 'native-worker' }, { user_id: conversationId }])('rejects changed task authority %o', async patch => {
    mock.task.mockResolvedValue({ ...task, ...patch }); await expect(authorizeWorkRuntimeGrant(claims)).rejects.toMatchObject({ code: 'WORK_RUNTIME_UNAUTHORIZED' });
  });
  it.each([{ execution_enabled: false }, { execution_verified_at: null }, { gateway_grant_id: null }, { connection_id: conversationId },
    { gateway_generation: 3 }, { gateway_lease_id: grantId }, { gateway_expires_at: new Date(at).toISOString() }, { gateway_lease_expires_at: new Date(at).toISOString() }])('rejects changed binding %o', async patch => {
    mock.single.mockResolvedValue({ data: { ...binding, ...patch }, error: null });
    await expect(authorizeWorkRuntimeGrant(claims, leaseId)).rejects.toMatchObject({ code: 'WORK_RUNTIME_UNAUTHORIZED' });
  });
  it('never reads task data after entitlement denial', async () => {
    mock.entitlement.mockRejectedValue(new Error('denied')); await expect(authorizeWorkRuntimeGrant(claims)).rejects.toThrow(); expect(mock.task).not.toHaveBeenCalled();
  });
  it('issues through a compare-and-swap without starting work or exposing a provider key', async () => {
    mock.single.mockResolvedValueOnce({ data: { ...binding, gateway_lease_id: null, gateway_lease_expires_at: null }, error: null }).mockResolvedValueOnce({ data: { task_id: taskId }, error: null });
    const issued = await issueWorkRuntimeGrant(taskId, userId, 120);
    expect(issued.model).toBe('tm-pro'); expect(verifyWorkRuntimeGrant(issued.apiKey)).toMatchObject({ taskId, userId, generation: 2, expiresAt: at / 1000 + 120 });
    expect(mock.update.mock.calls[0][0]).not.toHaveProperty('worker_id'); expect(mock.is).toHaveBeenCalledWith('gateway_lease_id', null);
    expect(mock.eq).toHaveBeenCalledWith('gateway_grant_id', grantId);
  });
  it('does not rotate an active lease or issue an excessive lifetime', async () => {
    await expect(issueWorkRuntimeGrant(taskId, userId)).rejects.toMatchObject({ code: 'WORK_RUNTIME_BUSY' });
    await expect(issueWorkRuntimeGrant(taskId, userId, 901)).rejects.toMatchObject({ code: 'WORK_RUNTIME_INVALID_GRANT' }); expect(mock.update).not.toHaveBeenCalled();
  });
  it('requires the database lease claim and releases only its own lease', async () => {
    const lease = await claimWorkRuntimeLease(claims); expect(mock.rpc.mock.calls[0][1]).toMatchObject({ p_user: userId, p_task: taskId, p_grant: grantId, p_generation: 2, p_lease: lease });
    await releaseWorkRuntimeLease(claims, lease); expect(mock.rpc).toHaveBeenLastCalledWith('work_gateway_release', { p_task: taskId, p_user: userId, p_lease: lease });
    mock.rpc.mockResolvedValue({ data: false, error: null }); await expect(claimWorkRuntimeLease(claims)).rejects.toMatchObject({ code: 'WORK_RUNTIME_BUSY' });
  });
  it('does not replace a successful model response with a release error', async () => {
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => undefined); mock.rpc.mockRejectedValue(new Error('private db details'));
    await expect(releaseWorkRuntimeLease(claims, leaseId)).resolves.toBeUndefined(); expect(warning).toHaveBeenCalledWith('work_gateway_lease_release_failed'); warning.mockRestore();
  });
});
