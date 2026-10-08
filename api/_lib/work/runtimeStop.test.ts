import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { WorkTask } from '../../../shared/work';
const mock = vi.hoisted(() => ({ rpc: vi.fn(), task: vi.fn(), connection: vi.fn(), transport: vi.fn() }));
vi.mock('./store.js', () => ({ WorkError: class extends Error { constructor(public code: string, public status = 503) { super(code); } },
  readWorkTask: mock.task, workDatabase: () => ({ rpc: mock.rpc }),
}));
vi.mock('./upstreamTransport.js', () => ({ readWorkConnection: mock.connection, workUpstreamJson: mock.transport }));
import { cancelOpenHandsTask, deliverOpenHandsStop, isOpenHandsWorker, openHandsWorkerConversation } from './runtimeStop';

const taskId = '11111111-1111-4111-8111-111111111111', userId = '22222222-2222-4222-8222-222222222222';
const connectionId = '33333333-3333-4333-8333-333333333333', remoteId = '44444444-4444-4444-8444-444444444444';
const date = '2026-09-27T15:00:00.000Z';
const task: WorkTask = { id: taskId, user_id: userId, session_id: remoteId, title: 'Task', goal: 'Goal', instructions: '', persona: 'pro',
  status: 'cancelled', plan: null, thread: [], generation: 2, revision: 3, step_index: 0, summary: null, error: null,
  worker_id: 'openhands:' + remoteId, created_at: date, updated_at: date };
const connection = { id: connectionId, user_id: userId, service: 'openhands' };
const stop = { task_id: taskId, user_id: userId, connection_id: connectionId, remote_conversation_id: remoteId,
  worker_id: task.worker_id, generation: 2, status: 'pending', lease_expires_at: '2026-09-27T15:00:40.000Z' };
function claim(patch = {}) {
  mock.rpc.mockImplementation(async (name: string, args: { p_lease?: string }) => name === 'work_runtime_stop_claim'
    ? { data: { ...stop, lease_id: args.p_lease, ...patch }, error: null } : { data: true, error: null });
}
beforeEach(() => {
  vi.resetAllMocks(); vi.useFakeTimers(); vi.setSystemTime(new Date(date)); vi.stubEnv('TM_WORK_UPSTREAM_ENABLED', 'true');
  claim(); mock.task.mockResolvedValue(task); mock.connection.mockResolvedValue(connection);
  mock.transport.mockResolvedValueOnce({ id: remoteId, execution_status: 'running' })
    .mockResolvedValueOnce({ success: true }).mockResolvedValueOnce({ id: remoteId, execution_status: 'paused', api_key: 'private-runtime-value' });
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); });

describe('owned OpenHands Stop delivery', () => {
  it('separates native workers and malformed OpenHands identifiers', () => {
    expect(isOpenHandsWorker('trigger-1')).toBe(false); expect(isOpenHandsWorker(null)).toBe(false);
    expect(isOpenHandsWorker('openhands:invalid')).toBe(true);
    expect(() => openHandsWorkerConversation('openhands:invalid')).toThrow();
    expect(openHandsWorkerConversation(task.worker_id)).toBe(remoteId);
  });
  it('atomically cancels using server-owned generation and worker scope', async () => {
    mock.rpc.mockResolvedValue({ data: task, error: null });
    await expect(cancelOpenHandsTask({ ...task, status: 'running' })).resolves.toEqual(task);
    expect(mock.rpc).toHaveBeenCalledWith('work_runtime_cancel', { p_task: taskId, p_user: userId, p_generation: 2, p_worker: task.worker_id });
    expect(mock.transport).not.toHaveBeenCalled();
  });
  it.each([{ data: null, error: null }, { data: null, error: { message: 'private-key' } },
    { data: { ...task, user_id: remoteId }, error: null }, { data: { ...task, status: 'running' }, error: null }])('rejects a failed or mismatched cancellation %o', async result => {
    mock.rpc.mockResolvedValue(result); await expect(cancelOpenHandsTask(task)).rejects.toThrow(); expect(mock.transport).not.toHaveBeenCalled();
  });
  it('claims an exclusive delivery lease then verifies pause without exposing raw state', async () => {
    await expect(deliverOpenHandsStop(taskId, userId, 2)).resolves.toBe(true);
    expect(mock.connection).toHaveBeenCalledWith(userId, 'openhands');
    expect(mock.transport).toHaveBeenNthCalledWith(1, connection, '/api/conversations/' + remoteId);
    expect(mock.transport).toHaveBeenNthCalledWith(2, connection, '/api/conversations/' + remoteId + '/pause', { method: 'POST', body: {} });
    expect(mock.transport).toHaveBeenNthCalledWith(3, connection, '/api/conversations/' + remoteId);
    expect(mock.rpc.mock.calls[1][1]).toMatchObject({ p_task: taskId, p_user: userId, p_generation: 2, p_ack: true, p_error: null });
    expect(JSON.stringify(mock.rpc.mock.calls)).not.toContain('private-runtime-value');
  });
  it('does not make any database or network call when disabled', async () => {
    vi.stubEnv('TM_WORK_UPSTREAM_ENABLED', 'false'); await expect(deliverOpenHandsStop(taskId, userId, 2)).resolves.toBe(false);
    expect(mock.rpc).not.toHaveBeenCalled(); expect(mock.transport).not.toHaveBeenCalled();
  });
  it('leaves active leases and acknowledged/not-due stops untouched', async () => {
    mock.rpc.mockResolvedValue({ data: null, error: null }); await expect(deliverOpenHandsStop(taskId, userId, 2)).resolves.toBe(false);
    expect(mock.transport).not.toHaveBeenCalled(); expect(mock.rpc).toHaveBeenCalledTimes(1);
  });
  it.each([{ user_id: remoteId }, { task_id: remoteId }, { generation: 3 }, { lease_id: remoteId },
    { status: 'acknowledged' }, { lease_expires_at: date }])('rejects forged or expired delivery scope %o', async patch => {
    claim(patch); await expect(deliverOpenHandsStop(taskId, userId, 2)).rejects.toThrow(); expect(mock.transport).not.toHaveBeenCalled();
  });
  it.each([{ generation: 3 }, { status: 'running' }, { worker_id: 'trigger-1' }, { user_id: remoteId }])('does not pause a replacement task %o', async patch => {
    mock.task.mockResolvedValue({ ...task, ...patch }); await expect(deliverOpenHandsStop(taskId, userId, 2)).resolves.toBe(false);
    expect(mock.transport).not.toHaveBeenCalled(); expect(mock.rpc.mock.calls[1][1]).toMatchObject({ p_ack: false, p_error: 'WORK_RUNTIME_STOP_SETUP_REQUIRED' });
  });
  it('does not follow a reassigned connection', async () => {
    mock.connection.mockResolvedValue({ ...connection, id: remoteId }); await expect(deliverOpenHandsStop(taskId, userId, 2)).resolves.toBe(false);
    expect(mock.transport).not.toHaveBeenCalled();
  });
  it.each([{ success: false }, {}])('does not acknowledge invalid pause responses %o', async value => {
    mock.transport.mockReset().mockResolvedValueOnce({ id: remoteId, execution_status: 'running' }).mockResolvedValueOnce(value);
    await expect(deliverOpenHandsStop(taskId, userId, 2)).resolves.toBe(false);
    expect(mock.rpc.mock.calls[1][1]).toMatchObject({ p_ack: false, p_error: 'WORK_RUNTIME_STOP_UNCONFIRMED' });
  });
  it.each([{ id: remoteId, execution_status: 'running' }, { id: remoteId, execution_status: 'waiting_for_confirmation' },
    { id: connectionId, execution_status: 'paused' }, { id: remoteId }])('does not acknowledge an unconfirmed/wrong remote state %o', async value => {
    mock.transport.mockReset().mockResolvedValueOnce({ id: remoteId, execution_status: 'running' }).mockResolvedValueOnce({ success: true }).mockResolvedValueOnce(value);
    await expect(deliverOpenHandsStop(taskId, userId, 2)).resolves.toBe(false);
    expect(mock.rpc.mock.calls[1][1]).toMatchObject({ p_ack: false, p_error: 'WORK_RUNTIME_STOP_UNCONFIRMED' });
  });
  it('records redacted retryable transport failure without discarding the stop', async () => {
    mock.transport.mockReset().mockRejectedValue(new Error('https://private-host/?secret=private-key'));
    await expect(deliverOpenHandsStop(taskId, userId, 2)).resolves.toBe(false);
    expect(mock.rpc.mock.calls[1][1]).toMatchObject({ p_ack: false, p_error: 'WORK_UPSTREAM_UNAVAILABLE' });
    expect(JSON.stringify(mock.rpc.mock.calls)).not.toContain('private-key');
  });
  it.each(['paused', 'finished', 'idle', 'error', 'stuck'])('recovers a lost pause acknowledgment from %s state without repeating the mutation', async execution_status => {
    mock.transport.mockReset().mockResolvedValue({ id: remoteId, execution_status });
    await expect(deliverOpenHandsStop(taskId, userId, 2)).resolves.toBe(true);
    expect(mock.transport).toHaveBeenCalledTimes(1);
    expect(mock.transport).toHaveBeenCalledWith(connection, '/api/conversations/' + remoteId);
  });
  it('does not mutate a mismatched conversation returned by the initial state read', async () => {
    mock.transport.mockReset().mockResolvedValue({ id: connectionId, execution_status: 'running' });
    await expect(deliverOpenHandsStop(taskId, userId, 2)).resolves.toBe(false);
    expect(mock.transport).toHaveBeenCalledTimes(1);
  });
  it.each(['returned', 'thrown'])('does not claim durable acknowledgment after %s storage failure', async kind => {
    const original = mock.rpc.getMockImplementation()!;
    mock.rpc.mockImplementation(async (...args) => {
      if (args[0] !== 'work_runtime_stop_finish') return original(...args);
      if (kind === 'thrown') throw new Error('private-db-key');
      return { data: null, error: { message: 'private-db-key' } };
    });
    await expect(deliverOpenHandsStop(taskId, userId, 2)).resolves.toBe(false);
  });
});
