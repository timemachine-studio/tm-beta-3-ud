import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { VercelRequest, VercelResponse } from '../../api/_lib/vercelTypes';
const mocks = vi.hoisted(() => ({ user: vi.fn(), entitlement: vi.fn(), read: vi.fn(), snapshot: vi.fn(), checkpoint: vi.fn(), trigger: vi.fn(), cancel: vi.fn(), capabilities: vi.fn(), integration: vi.fn(), connections: vi.fn(), hermes: vi.fn(), runtimeCancel: vi.fn(), runtimeStop: vi.fn(), runtimeApprove: vi.fn() }));
vi.mock('../../api/_lib/work/hermes.js', () => ({ readWorkHermes: mocks.hermes }));
vi.mock('../../api/_lib/work/runtimeHandoff.js', () => ({ approveOpenHandsTask: mocks.runtimeApprove }));
vi.mock('../../api/_lib/work/runtimeStop.js', () => ({ cancelOpenHandsTask: mocks.runtimeCancel, deliverOpenHandsStop: mocks.runtimeStop,
  isOpenHandsWorker: (workerId?: string) => Boolean(workerId?.startsWith('openhands:')) }));
vi.mock('../../api/_lib/work/integrations.js', () => ({ readWorkIntegration: mocks.integration, readWorkConnectionStatuses: mocks.connections }));
vi.mock('@trigger.dev/sdk', () => ({ tasks: { trigger: mocks.trigger }, runs: { cancel: mocks.cancel } }));
vi.mock('../../api/_lib/auth.js', () => ({ getAuthenticatedRequestUser: mocks.user, createUserScopedClient: vi.fn(), getRequestAccessToken: vi.fn() }));
vi.mock('../../api/_lib/cors.js', () => ({ applyCors: vi.fn(), hasAcceptableOrigin: () => true }));
vi.mock('../../api/_lib/validation.js', () => ({ rejectIfTooLarge: () => false }));
vi.mock('../../api/_lib/work/store.js', () => ({
  WorkError: class extends Error { constructor(public code: string, public status = 503) { super(code); } },
  requireWorkEntitlement: mocks.entitlement, readWorkTask: mocks.read, workSnapshot: mocks.snapshot, checkpoint: mocks.checkpoint, workCapabilities: mocks.capabilities, workDatabase: vi.fn(),
}));
import handler from '../../api/_lib/work/handler';
import { WorkError } from '../../api/_lib/work/store';
const owner = '22222222-2222-4222-8222-222222222222';
const id = '11111111-1111-4111-8111-111111111111';
const request = (body: unknown, query = {}, method = 'POST') => ({ method, body, query, headers: {} }) as VercelRequest;
function response() { return { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis(), end: vi.fn(), setHeader: vi.fn() } as unknown as VercelResponse; }
beforeEach(() => { vi.resetAllMocks(); mocks.user.mockResolvedValue({ id: owner }); mocks.entitlement.mockResolvedValue(undefined); mocks.snapshot.mockResolvedValue({ task: { id } }); });
describe('Work API authority', () => {
  it('uses verified ownership for Hermes discovery and ignores supplied server/account', async () => {
    await handler(request(null, { hermes: '1', userId: 'attacker', base_url: 'https://attacker.example' }, 'GET'), response());
    expect(mocks.hermes).toHaveBeenCalledWith(owner);
    expect(mocks.snapshot).not.toHaveBeenCalled();
  });
  it('denies guest and non-premium Hermes discovery before reading upstream', async () => {
    mocks.user.mockResolvedValue(null);
    const guest = response(); await handler(request(null, { hermes: '1' }, 'GET'), guest);
    expect(guest.status).toHaveBeenCalledWith(401);
    mocks.user.mockResolvedValue({ id: owner }); mocks.entitlement.mockRejectedValue(new WorkError('WORK_PREMIUM_REQUIRED', 403));
    const denied = response(); await handler(request(null, { hermes: '1' }, 'GET'), denied);
    expect(denied.status).toHaveBeenCalledWith(403); expect(mocks.hermes).not.toHaveBeenCalled();
  });
  it('uses the authenticated account for configuration checks, not a supplied account', async () => {
    await handler(request(null, { connections: '1', userId: 'attacker' }, 'GET'), response());
    expect(mocks.connections).toHaveBeenCalledWith(owner); expect(mocks.snapshot).not.toHaveBeenCalled();
  });
  it('denies guest configuration checks', async () => {
    mocks.user.mockResolvedValue(null);
    const res = response(); await handler(request(null, { connections: '1' }, 'GET'), res);
    expect(res.status).toHaveBeenCalledWith(401); expect(mocks.connections).not.toHaveBeenCalled();
  });
  it('routes an integration read with verified owner, never request-supplied scope', async () => {
    const res = response(); await handler(request(null, { taskId: id, integration: 'agenta', userId: 'attacker', project_id: 'attacker', base_url: 'https://attacker.example' }, 'GET'), res);
    expect(mocks.integration).toHaveBeenCalledWith(id, owner, 'agenta', undefined); expect(mocks.snapshot).not.toHaveBeenCalled();
  });
  it('routes a bounded event cursor with authenticated ownership', async () => {
    await handler(request(null, { taskId: id, integration: 'openhands', eventCursor: 'encrypted-cursor', userId: 'attacker' }, 'GET'), response());
    expect(mocks.integration).toHaveBeenCalledWith(id, owner, 'openhands', 'encrypted-cursor');
  });
  it.each(['', 'x'.repeat(3011), ['cursor', 'other']])('rejects malformed event cursor query values %#', eventCursor => {
    const res = response();
    return handler(request(null, { taskId: id, integration: 'openhands', eventCursor }, 'GET'), res).then(() => {
      expect(res.status).toHaveBeenCalledWith(400); expect(mocks.integration).not.toHaveBeenCalled();
    });
  });
  it('rejects unknown integrations, missing task IDs and array query values', async () => {
    for (const query of [{ taskId: id, integration: 'shell' }, { integration: 'agenta' }, { taskId: id, integration: ['agenta', 'openhands'] }]) {
      const res = response(); await handler(request(null, query, 'GET'), res); expect(res.status).toHaveBeenCalledWith(400);
    }
    expect(mocks.integration).not.toHaveBeenCalled();
  });
  it('does not permit a guest or non-premium integration read', async () => {
    mocks.user.mockResolvedValue(null);
    const guest = response(); await handler(request(null, { taskId: id, integration: 'openhands' }, 'GET'), guest);
    expect(guest.status).toHaveBeenCalledWith(401);
    mocks.user.mockResolvedValue({ id: owner }); mocks.entitlement.mockRejectedValue(new WorkError('WORK_PREMIUM_REQUIRED', 403));
    const unpaid = response(); await handler(request(null, { taskId: id, integration: 'agenta' }, 'GET'), unpaid);
    expect(unpaid.status).toHaveBeenCalledWith(403); expect(mocks.integration).not.toHaveBeenCalled();
  });
  it('does not let a guest create, read or mutate a task', async () => {
    mocks.user.mockResolvedValue(null);
    const res = response(); await handler(request({ action: 'cancel', taskId: id }), res);
    expect(res.status).toHaveBeenCalledWith(401); expect(mocks.checkpoint).not.toHaveBeenCalled(); expect(mocks.entitlement).not.toHaveBeenCalled();
  });
  it('checks server entitlement before reading a task', async () => {
    mocks.entitlement.mockRejectedValue(new WorkError('WORK_PREMIUM_REQUIRED', 403));
    const res = response(); await handler(request(null, { taskId: id }, 'GET'), res);
    expect(res.status).toHaveBeenCalledWith(403); expect(mocks.snapshot).not.toHaveBeenCalled();
  });
  it('scopes reads to verified owner rather than a query owner', async () => {
    const res = response(); await handler(request(null, { taskId: id, userId: 'attacker' }, 'GET'), res);
    expect(mocks.snapshot).toHaveBeenCalledWith(id, owner);
  });
  it('rejects forged owner fields and missing approval revisions', async () => {
    const res = response(); await handler(request({ action: 'approve', taskId: id, user_id: owner }), res);
    expect(res.status).toHaveBeenCalledWith(400); expect(mocks.checkpoint).not.toHaveBeenCalled();
  });
  it('persists cancellation before cancelling the external worker', async () => {
    mocks.read.mockResolvedValue({ id, user_id: owner, status: 'running', worker_id: 'run-1' });
    mocks.checkpoint.mockResolvedValue({ id, user_id: owner, status: 'cancelled', worker_id: 'run-1' }); mocks.cancel.mockResolvedValue(undefined);
    await handler(request({ action: 'cancel', taskId: id }), response());
    expect(mocks.checkpoint.mock.invocationCallOrder[0]).toBeLessThan(mocks.cancel.mock.invocationCallOrder[0]);
    expect(mocks.checkpoint.mock.calls[0][2]).toMatchObject({ status: 'cancelled' });
  });
  it('routes an OpenHands stop to its durable outbox, never Trigger', async () => {
    const remote = { id, user_id: owner, status: 'running', worker_id: 'openhands:' + id, generation: 2 };
    mocks.read.mockResolvedValue(remote); mocks.runtimeCancel.mockResolvedValue({ ...remote, status: 'cancelled' }); mocks.runtimeStop.mockResolvedValue(true);
    const res = response(); await handler(request({ action: 'cancel', taskId: id }), res);
    expect(mocks.runtimeCancel).toHaveBeenCalledWith(remote); expect(mocks.runtimeStop).toHaveBeenCalledWith(id, owner, 2);
    expect(mocks.runtimeCancel.mock.invocationCallOrder[0]).toBeLessThan(mocks.runtimeStop.mock.invocationCallOrder[0]);
    expect(mocks.cancel).not.toHaveBeenCalled(); expect(mocks.checkpoint).not.toHaveBeenCalled(); expect(res.status).toHaveBeenCalledWith(200);
  });
  it('permits owner Stop after premium expires without permitting other mutations', async () => {
    mocks.entitlement.mockRejectedValue(new WorkError('WORK_PREMIUM_REQUIRED', 403));
    mocks.read.mockResolvedValue({ id, user_id: owner, status: 'running', worker_id: 'run-1' });
    mocks.checkpoint.mockResolvedValue({ id, user_id: owner, status: 'cancelled', worker_id: 'run-1' }); mocks.cancel.mockResolvedValue(undefined);
    const res = response(); await handler(request({ action: 'cancel', taskId: id }), res);
    expect(mocks.entitlement).not.toHaveBeenCalled(); expect(res.status).toHaveBeenCalledWith(200);
    const approve = response(); await handler(request({ action: 'approve', taskId: id, revision: 2 }), approve);
    expect(approve.status).toHaveBeenCalledWith(403);
  });
  it('retries a previously cancelled remote task without fabricating a fresh cancellation', async () => {
    const remote = { id, user_id: owner, status: 'cancelled', worker_id: 'openhands:' + id, generation: 2 };
    mocks.read.mockResolvedValue(remote); mocks.runtimeCancel.mockResolvedValue(remote); mocks.runtimeStop.mockResolvedValue(false);
    await handler(request({ action: 'cancel', taskId: id }), response());
    expect(mocks.runtimeCancel).toHaveBeenCalledWith(remote); expect(mocks.runtimeStop).toHaveBeenCalledOnce(); expect(mocks.cancel).not.toHaveBeenCalled();
  });
  it('preserves the saved cancellation after a thrown delivery error and redacts it', async () => {
    const remote = { id, user_id: owner, status: 'running', worker_id: 'openhands:' + id, generation: 2 };
    mocks.read.mockResolvedValue(remote); mocks.runtimeCancel.mockResolvedValue({ ...remote, status: 'cancelled' });
    mocks.runtimeStop.mockRejectedValue(new Error('private-endpoint-and-key'));
    const res = response(); await handler(request({ action: 'cancel', taskId: id }), res);
    expect(res.status).toHaveBeenCalledWith(200); expect(JSON.stringify(vi.mocked(res.json).mock.calls)).not.toContain('private-endpoint-and-key');
  });
  it('never mistakes a saved remote thread append for delivered steering', async () => {
    mocks.read.mockResolvedValue({ id, user_id: owner, status: 'running', worker_id: 'openhands:' + id });
    const res = response(); await handler(request({ action: 'steer', taskId: id, revision: 2, message: 'Change course' }), res);
    expect(res.status).toHaveBeenCalledWith(409); expect(mocks.checkpoint).not.toHaveBeenCalled(); expect(mocks.trigger).not.toHaveBeenCalled();
  });
  it('never starts a second native worker when a remote task needs approval', async () => {
    mocks.read.mockResolvedValue({ id, user_id: owner, status: 'review', worker_id: 'openhands:' + id, plan: {} });
    const res = response(); await handler(request({ action: 'approve', taskId: id, revision: 2 }), res);
    expect(res.status).toHaveBeenCalledWith(409); expect(mocks.checkpoint).not.toHaveBeenCalled(); expect(mocks.trigger).not.toHaveBeenCalled();
  });
  it('uses the verified owner and reviewed revision for an explicit OpenHands approval', async () => {
    mocks.read.mockResolvedValue({ id, user_id: owner, status: 'review' }); mocks.runtimeApprove.mockResolvedValue(undefined);
    const res = response(); await handler(request({ action: 'approve', taskId: id, revision: 7, runtime: 'openhands' }), res);
    expect(mocks.runtimeApprove).toHaveBeenCalledWith(id, owner, 7); expect(res.status).toHaveBeenCalledWith(200);
    expect(mocks.trigger).not.toHaveBeenCalled(); expect(mocks.checkpoint).not.toHaveBeenCalled();
  });
  it('does not expose unknown exception details', async () => {
    mocks.read.mockRejectedValue(new Error('service-key-secret-value'));
    const res = response(); await handler(request({ action: 'cancel', taskId: id }), res);
    expect(JSON.stringify(vi.mocked(res.json).mock.calls)).not.toContain('service-key-secret-value');
  });
  it('returns capability information to guests without private task reads', async () => {
    mocks.user.mockResolvedValue(null); mocks.capabilities.mockResolvedValue({ access: 'sign_in' });
    await handler(request(null, { capabilities: '1' }, 'GET'), response());
    expect(mocks.capabilities).toHaveBeenCalledWith(null); expect(mocks.snapshot).not.toHaveBeenCalled();
  });
});
