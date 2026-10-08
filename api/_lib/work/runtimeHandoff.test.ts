import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { WorkTask } from '../../../shared/work';
const mock = vi.hoisted(() => ({ rpc: vi.fn(), task: vi.fn(), entitlement: vi.fn(), connection: vi.fn(), transport: vi.fn(),
  trigger: vi.fn(), issue: vi.fn(), authorize: vi.fn(), verify: vi.fn(), stop: vi.fn(), eq: vi.fn(), limit: vi.fn() }));
vi.mock('@trigger.dev/sdk', () => ({ tasks: { trigger: mock.trigger } }));
vi.mock('./store.js', () => ({ WorkError: class extends Error { constructor(public code: string, public status = 503) { super(code); } },
  readWorkTask: mock.task, requireWorkEntitlement: mock.entitlement,
  workDatabase: () => ({ rpc: mock.rpc, from: () => query }),
}));
vi.mock('./upstreamTransport.js', () => ({ readWorkExecutionConnection: mock.connection, workUpstreamJson: mock.transport }));
vi.mock('./runtimeGrant.js', () => ({ authorizeWorkRuntimeGrant: mock.authorize, issueWorkRuntimeGrant: mock.issue,
  verifyWorkRuntimeGrant: mock.verify, requireRuntimeGatewayEnabled: () => undefined,
  runtimeModelAlias: (persona: string) => persona === 'pro' ? 'tm-pro' : persona === 'girlie' ? 'tm-girlie' : 'tm-air',
}));
vi.mock('./runtimeStop.js', () => ({ deliverOpenHandsStop: mock.stop }));
import { approveOpenHandsTask, openHandsTaskMessage, runOpenHandsLaunch, failOpenHandsLaunch,
  abortOpenHandsLaunch, recoverAbandonedOpenHandsLaunches } from './runtimeHandoff';
import { WorkError } from './store';

const taskId = '11111111-1111-4111-8111-111111111111', userId = '22222222-2222-4222-8222-222222222222';
const connectionId = '33333333-3333-4333-8333-333333333333', remoteId = '44444444-4444-4444-8444-444444444444';
const launchId = '55555555-5555-4555-8555-555555555555', at = Date.parse('2026-09-27T17:00:00.000Z');
const gateway = 'https://tm.example/api/work-model/v1', key = 'private-task-scoped-grant';
const plan = { title: 'Implement a page', approach: 'Build then verify', steps: [{ title: 'Build', description: 'Create the page' }], deliverables: ['page.html'], limitations: [] };
const baseTask: WorkTask = { id: taskId, user_id: userId, session_id: taskId, title: 'Page', goal: 'Create a page', instructions: 'Keep it accessible', persona: 'pro',
  status: 'running', plan, thread: [{ role: 'user', content: 'Use semantic HTML', at: new Date(at).toISOString() }],
  generation: 2, revision: 8, step_index: 0, summary: null, error: null, worker_id: 'openhands:' + remoteId,
  created_at: new Date(at).toISOString(), updated_at: new Date(at).toISOString() };
const baseLaunch = { id: launchId, task_id: taskId, user_id: userId, connection_id: connectionId, remote_conversation_id: remoteId,
  generation: 2, status: 'reserved', lease_id: null as string | null, lease_expires_at: null as string | null,
  created_at: new Date(at).toISOString(), updated_at: new Date(at).toISOString() };
let launch = { ...baseLaunch }, task = { ...baseTask };
const query = { select: () => query, eq: (...args: unknown[]) => { mock.eq(...args); return query; }, or: () => query,
  order: () => query, limit: mock.limit, maybeSingle: async () => ({ data: launch, error: null }) };
const connection = { id: connectionId, user_id: userId, service: 'openhands', base_url: 'https://agent.example',
  credential_ref: 'OWNER_ONE', scope_id: null, enabled: true, scope_verified_at: new Date(at).toISOString() };
function remoteInfo() { return { id: remoteId, execution_status: 'idle', confirmation_policy: { kind: 'AlwaysConfirm' },
  workspace: { kind: 'LocalWorkspace', working_dir: '/workspace/tm/' + taskId },
  agent: { llm: { model: 'openai/tm-pro', api_mode: 'chat', base_url: gateway, api_key: 'never-public' } } }; }
beforeEach(() => {
  vi.resetAllMocks(); vi.useFakeTimers(); vi.setSystemTime(at);
  for (const flag of ['TM_WORK_UPSTREAM_ENABLED', 'TM_WORK_MODEL_GATEWAY_ENABLED', 'TM_WORK_OPENHANDS_EXECUTION_ENABLED', 'TM_WORK_RUNTIME_STOP_RECOVERY_ENABLED']) vi.stubEnv(flag, 'true');
  vi.stubEnv('TM_WORK_MODEL_GATEWAY_BASE_URL', gateway); vi.stubEnv('TM_WORK_MODEL_GATEWAY_SECRET', 'server-only-signing-secret-for-tests'); vi.stubEnv('TRIGGER_SECRET_KEY', 'test-worker-key');
  launch = { ...baseLaunch }; task = { ...baseTask }; mock.task.mockImplementation(async () => task);
  mock.connection.mockResolvedValue(connection); mock.entitlement.mockResolvedValue(undefined);
  mock.trigger.mockResolvedValue({ id: 'trigger-job' }); mock.stop.mockResolvedValue(true);
  mock.issue.mockResolvedValue({ apiKey: key, model: 'tm-pro', expiresAt: new Date(at + 900000).toISOString() });
  mock.verify.mockReturnValue({ taskId, userId, conversationId: remoteId, generation: 2, persona: 'pro', expiresAt: at / 1000 + 900 });
  mock.authorize.mockImplementation(async () => { if (task.status !== 'running') throw new WorkError('WORK_RUNTIME_UNAUTHORIZED'); return task; });
  mock.limit.mockResolvedValue({ data: [], error: null });
  mock.rpc.mockImplementation(async (name: string, args: Record<string, unknown>) => {
    if (name === 'work_runtime_reserve') return { data: launch, error: null };
    if (name === 'work_runtime_launch_claim') {
      if (launch.status !== 'reserved') return { data: null, error: null };
      launch = { ...launch, status: 'launching', lease_id: String(args.p_lease), lease_expires_at: new Date(at + 180000).toISOString() };
      return { data: launch, error: null };
    }
    if (name === 'work_runtime_launch_started') launch = { ...launch, status: 'started', lease_id: null, lease_expires_at: null };
    if (name === 'work_runtime_launch_abort') { launch = { ...launch, status: 'cancelled', lease_id: null, lease_expires_at: null }; task = { ...task, status: 'cancelled' }; }
    return { data: true, error: null };
  });
  mock.transport.mockImplementation(async (_connection, path, options) => path === '/api/conversations' || !options
    ? remoteInfo() : { success: true });
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); });

describe('approved TM → real OpenHands API handoff', () => {
  it('reserves using verified owner/revision and queues only an opaque launch ID', async () => {
    task = { ...task, status: 'review', generation: 1, revision: 7, worker_id: 'native-worker' };
    await approveOpenHandsTask(taskId, userId, 7);
    expect(mock.rpc.mock.calls[0]).toEqual(['work_runtime_reserve', expect.objectContaining({ p_task: taskId, p_user: userId, p_revision: 7, p_connection: connectionId })]);
    expect(mock.trigger).toHaveBeenCalledWith('tm-work-openhands-launch', { launchId }, { idempotencyKey: 'tm-work-openhands-' + launchId });
    expect(JSON.stringify(mock.trigger.mock.calls)).not.toContain(task.goal); expect(mock.transport).not.toHaveBeenCalled();
  });
  it.each(['TM_WORK_OPENHANDS_EXECUTION_ENABLED', 'TRIGGER_SECRET_KEY', 'TM_WORK_MODEL_GATEWAY_SECRET'])('fails before reservation when %s is not ready', async flag => {
    vi.stubEnv(flag, ''); await expect(approveOpenHandsTask(taskId, userId, 7)).rejects.toThrow();
    expect(mock.rpc).not.toHaveBeenCalled(); expect(mock.trigger).not.toHaveBeenCalled();
  });
  it('cannot reserve after premium expires or runtime attestation is missing', async () => {
    mock.entitlement.mockRejectedValueOnce(new WorkError('WORK_PREMIUM_REQUIRED', 403));
    await expect(approveOpenHandsTask(taskId, userId, 7)).rejects.toThrow(); expect(mock.rpc).not.toHaveBeenCalled();
    mock.connection.mockRejectedValueOnce(new WorkError('WORK_RUNTIME_LAUNCH_SETUP_REQUIRED'));
    await expect(approveOpenHandsTask(taskId, userId, 7)).rejects.toThrow(); expect(mock.rpc).not.toHaveBeenCalled();
  });
  it('does not enqueue a stale/mismatched reservation or restart an accepted one', async () => {
    const original = mock.rpc.getMockImplementation()!;
    mock.rpc.mockResolvedValueOnce({ data: null, error: null }); await expect(approveOpenHandsTask(taskId, userId, 7)).rejects.toThrow();
    mock.rpc.mockResolvedValueOnce({ data: { ...launch, user_id: remoteId }, error: null }); await expect(approveOpenHandsTask(taskId, userId, 7)).rejects.toThrow();
    mock.rpc.mockImplementation(original); launch.status = 'started'; await approveOpenHandsTask(taskId, userId, 7);
    expect(mock.trigger).not.toHaveBeenCalled();
  });
  it('cancels uncertain queue delivery instead of falling back to another native worker', async () => {
    mock.trigger.mockRejectedValue(new Error('private-queue-key'));
    await expect(approveOpenHandsTask(taskId, userId, 7)).rejects.toMatchObject({ code: 'WORK_QUEUE_UNAVAILABLE' });
    expect(mock.rpc).toHaveBeenCalledWith('work_runtime_launch_abort', { p_launch: launchId, p_user: userId, p_error: 'WORK_RUNTIME_LAUNCH_FAILED' });
    expect(mock.stop).toHaveBeenCalledWith(taskId, userId, 2); expect(launch.status).toBe('cancelled');
  });
  it('creates idle, submits without auto-run, verifies again, starts explicitly, then records acceptance', async () => {
    await runOpenHandsLaunch(launchId);
    expect(mock.transport.mock.calls.map(call => [call[1], call[2]?.method ?? 'GET'])).toEqual([
      ['/api/conversations', 'POST'], ['/api/conversations/' + remoteId + '/events', 'POST'],
      ['/api/conversations/' + remoteId, 'GET'], ['/api/conversations/' + remoteId + '/run', 'POST'],
    ]);
    const payload = mock.transport.mock.calls[0][2].body;
    expect(payload.conversation_id).toBe(remoteId); expect(payload.confirmation_policy).toEqual({ kind: 'AlwaysConfirm' });
    expect(payload.agent.llm.api_key).toBe(key); expect(payload.initial_message).toBeNull();
    expect(mock.transport.mock.calls[1][2].body).toMatchObject({ run: false, role: 'user' });
    expect(mock.transport.mock.calls[1][2].body.content[0].text).toContain('Use semantic HTML');
    expect(mock.authorize).toHaveBeenCalledTimes(6); expect(launch.status).toBe('started');
    expect(mock.stop).not.toHaveBeenCalled();
  });
  it('does not replay a duplicate worker delivery', async () => {
    await runOpenHandsLaunch(launchId); mock.transport.mockClear(); await runOpenHandsLaunch(launchId);
    expect(mock.transport).not.toHaveBeenCalled(); expect(mock.issue).toHaveBeenCalledTimes(1);
  });
  it.each([{ confirmation_policy: { kind: 'NeverConfirm' } }, { execution_status: 'running' },
    { id: taskId }, { agent: { llm: { model: 'other-provider', api_mode: 'chat', base_url: gateway } } }])('cancels unsafe creation without sending or running the task %o', async patch => {
    mock.transport.mockResolvedValue({ ...remoteInfo(), ...patch });
    await expect(runOpenHandsLaunch(launchId)).rejects.toMatchObject({ code: 'WORK_RUNTIME_LAUNCH_FAILED' });
    expect(mock.transport).toHaveBeenCalledTimes(1); expect(launch.status).toBe('cancelled'); expect(mock.stop).toHaveBeenCalledOnce();
  });
  it('Stop between create and send prevents every later mutation', async () => {
    mock.transport.mockImplementationOnce(async () => { task = { ...task, status: 'cancelled' }; return remoteInfo(); });
    await expect(runOpenHandsLaunch(launchId)).rejects.toMatchObject({ code: 'WORK_RUNTIME_LAUNCH_FAILED' });
    expect(mock.transport).toHaveBeenCalledTimes(1); expect(mock.rpc).not.toHaveBeenCalledWith('work_runtime_launch_started', expect.anything());
  });
  it('Stop during a successful run acknowledgment does not falsely record started', async () => {
    mock.transport.mockImplementation(async (_connection, path, options) => {
      if (path.endsWith('/run')) task = { ...task, status: 'cancelled' };
      return path === '/api/conversations' || !options ? remoteInfo() : { success: true };
    });
    await expect(runOpenHandsLaunch(launchId)).rejects.toThrow();
    expect(mock.rpc).not.toHaveBeenCalledWith('work_runtime_launch_started', expect.anything()); expect(mock.stop).toHaveBeenCalledOnce();
  });
  it('rechecks the remote policy after task submission and before run', async () => {
    mock.transport.mockImplementation(async (_connection, path, options) => path === '/api/conversations' ? remoteInfo()
      : !options ? { ...remoteInfo(), confirmation_policy: { kind: 'NeverConfirm' } } : { success: true });
    await expect(runOpenHandsLaunch(launchId)).rejects.toThrow();
    expect(mock.transport.mock.calls.some(call => call[1].endsWith('/run'))).toBe(false);
  });
  it.each(['network', 'audit'])('cancels uncertain %s outcome without replay or private exception leakage', async failure => {
    if (failure === 'network') mock.transport.mockRejectedValueOnce(new Error('https://secret-host/?key=private'));
    else {
      const original = mock.rpc.getMockImplementation()!;
      mock.rpc.mockImplementation((...args) => args[0] === 'work_runtime_launch_started'
        ? Promise.resolve({ data: null, error: { message: 'private-db-key' } }) : original(...args));
    }
    await expect(runOpenHandsLaunch(launchId)).rejects.toMatchObject({ code: 'WORK_RUNTIME_LAUNCH_FAILED', message: 'WORK_RUNTIME_LAUNCH_FAILED' });
    expect(launch.status).toBe('cancelled'); expect(mock.issue).toHaveBeenCalledTimes(1); expect(mock.stop).toHaveBeenCalledOnce();
  });
  it('failure hooks and explicit abort work when execution is disabled', async () => {
    vi.stubEnv('TM_WORK_OPENHANDS_EXECUTION_ENABLED', 'false');
    await failOpenHandsLaunch(launchId); expect(launch.status).toBe('cancelled');
    await abortOpenHandsLaunch(launchId, userId, 'WORK_RUNTIME_LAUNCH_FAILED'); expect(mock.stop).toHaveBeenCalledWith(taskId, userId, 2);
  });
  it('does not abort a started run just because a duplicate worker failed', async () => {
    launch.status = 'started'; await failOpenHandsLaunch(launchId); expect(mock.rpc).not.toHaveBeenCalled(); expect(mock.stop).not.toHaveBeenCalled();
  });
  it('bounds approved task messages instead of silently truncating source instructions', () => {
    expect(openHandsTaskMessage(task).run).toBe(false);
    expect(() => openHandsTaskMessage({ ...task, goal: '🚀'.repeat(20000) })).toThrow();
  });
  it('uses private ledger owners for bounded abandonment recovery, never restarts', async () => {
    mock.limit.mockResolvedValue({ data: [{ ...launch, created_at: new Date(at - 600000).toISOString() }], error: null });
    await expect(recoverAbandonedOpenHandsLaunches()).resolves.toEqual({ checked: 1, cancelled: 1 });
    expect(mock.limit).toHaveBeenCalledWith(5); expect(mock.rpc).toHaveBeenCalledWith('work_runtime_launch_abort', {
      p_launch: launchId, p_user: userId, p_error: 'WORK_RUNTIME_LAUNCH_ABANDONED' });
    expect(mock.trigger).not.toHaveBeenCalled(); expect(mock.transport).not.toHaveBeenCalled();
  });
});
