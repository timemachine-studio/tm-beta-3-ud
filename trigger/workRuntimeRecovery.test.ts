import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const mock = vi.hoisted(() => ({ from: vi.fn(), deliver: vi.fn(), schedule: vi.fn(options => options), eq: vi.fn(), lte: vi.fn(), or: vi.fn(), limit: vi.fn(), recoverLaunches: vi.fn() }));
vi.mock('../api/_lib/work/runtimeHandoff.js', () => ({ recoverAbandonedOpenHandsLaunches: mock.recoverLaunches }));
vi.mock('@trigger.dev/sdk', () => ({ schedules: { task: mock.schedule } }));
vi.mock('../api/_lib/work/store.js', () => ({ WorkError: class extends Error { constructor(public code: string) { super(code); } }, workDatabase: () => ({ from: mock.from }) }));
vi.mock('../api/_lib/work/runtimeStop.js', () => ({ deliverOpenHandsStop: mock.deliver }));
import { recoverWorkRuntimeLifecycle, recoverWorkRuntimeStops, workRuntimeRecovery } from './workRuntimeRecovery';

const taskId = '11111111-1111-4111-8111-111111111111', owner = '22222222-2222-4222-8222-222222222222';
const row = { task_id: taskId, user_id: owner, generation: 2 };
beforeEach(() => {
  vi.clearAllMocks(); vi.stubEnv('TM_WORK_UPSTREAM_ENABLED', 'true'); vi.stubEnv('TM_WORK_RUNTIME_STOP_RECOVERY_ENABLED', 'true');
  const query = { select: () => query, eq: mock.eq, lte: mock.lte, or: mock.or, order: () => query, limit: mock.limit };
  mock.eq.mockReturnValue(query); mock.lte.mockReturnValue(query); mock.or.mockReturnValue(query); mock.from.mockReturnValue(query);
  mock.limit.mockResolvedValue({ data: [row], error: null }); mock.deliver.mockResolvedValue(true);
});
afterEach(() => vi.unstubAllEnvs());
describe('trusted runtime stop recovery', () => {
  it.each(['TM_WORK_UPSTREAM_ENABLED', 'TM_WORK_RUNTIME_STOP_RECOVERY_ENABLED'])('does nothing while %s is off', async flag => {
    vi.stubEnv(flag, 'false'); await expect(recoverWorkRuntimeStops()).resolves.toEqual({ enabled: false, checked: 0, acknowledged: 0, pending: 0 });
    expect(mock.from).not.toHaveBeenCalled(); expect(mock.deliver).not.toHaveBeenCalled();
  });
  it('reads a bounded due-outbox batch and derives owners only from its rows', async () => {
    await expect(recoverWorkRuntimeStops()).resolves.toEqual({ enabled: true, checked: 1, acknowledged: 1, pending: 0 });
    expect(mock.from).toHaveBeenCalledWith('work_runtime_stops'); expect(mock.eq).toHaveBeenCalledWith('status', 'pending');
    expect(mock.limit).toHaveBeenCalledWith(5); expect(mock.or.mock.calls[0][0]).toContain('lease_id.is.null');
    expect(mock.deliver).toHaveBeenCalledWith(taskId, owner, 2);
  });
  it('handles a failed or malformed row without blocking other targets or exposing IDs', async () => {
    mock.limit.mockResolvedValue({ data: [row, { ...row, task_id: owner }, { ...row, user_id: 'forged' }], error: null });
    mock.deliver.mockReset().mockRejectedValueOnce(new Error('private-key')).mockResolvedValueOnce(true);
    const result = await recoverWorkRuntimeStops(); expect(result).toEqual({ enabled: true, checked: 3, acknowledged: 1, pending: 2 });
    expect(mock.deliver).toHaveBeenCalledTimes(2); expect(JSON.stringify(result)).not.toContain(owner);
  });
  it('surfaces setup failure without leaking the database error', async () => {
    mock.limit.mockResolvedValue({ data: null, error: { message: 'private-key' } });
    await expect(recoverWorkRuntimeStops()).rejects.toMatchObject({ code: 'WORK_RUNTIME_STOP_SETUP_REQUIRED' });
  });
  it('does not register a recurring schedule automatically', () => {
    expect(workRuntimeRecovery).toMatchObject({ id: 'tm-work-runtime-stop-recovery', queue: { concurrencyLimit: 1 }, ttl: '5m' });
    expect(workRuntimeRecovery).not.toHaveProperty('cron');
  });
  it('continues stop delivery even when launch-recovery setup is unavailable', async () => {
    mock.recoverLaunches.mockRejectedValueOnce(new Error('private-db-key'));
    const result = await recoverWorkRuntimeLifecycle();
    expect(result).toEqual({ launches: null, stops: { enabled: true, checked: 1, acknowledged: 1, pending: 0 } });
    expect(mock.deliver).toHaveBeenCalledWith(taskId, owner, 2);
  });
});
