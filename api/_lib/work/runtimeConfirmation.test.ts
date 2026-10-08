import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ entitlement: vi.fn(), task: vi.fn(), connection: vi.fn(), rpc: vi.fn(), single: vi.fn() }));
vi.mock('./store.js', async importOriginal => ({ ...await importOriginal<typeof import('./store.js')>(),
  requireWorkEntitlement: mocks.entitlement, readWorkTask: mocks.task,
  workDatabase: () => ({ from: () => ({ select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: mocks.single }) }) }) }), rpc: mocks.rpc }),
}));
vi.mock('./upstreamTransport.js', () => ({ readWorkExecutionConnection: mocks.connection }));
import { fingerprintWorkConfirmation, saveWorkConfirmationReview, recordWorkConfirmationDecision } from './runtimeConfirmation';
const task = '11111111-1111-4111-8111-111111111111', user = '22222222-2222-4222-8222-222222222222';
const connection = '33333333-3333-4333-8333-333333333333', conversation = '44444444-4444-4444-8444-444444444444';
const grant = '55555555-5555-4555-8555-555555555555', review = '66666666-6666-4666-8666-666666666666', request = '77777777-7777-4777-8777-777777777777';
const snapshot = () => ({ conversationId: conversation, headId: 'head-1', executionStatus: 'waiting_for_confirmation', confirmationPolicy: 'AlwaysConfirm',
  actions: [{ id: 'action-1', source: 'agent', kind: 'ActionEvent', tool_name: 'terminal', tool_call_id: 'call-1',
    tool_call: { id: 'call-1', type: 'function', function: { name: 'terminal', arguments: '{"command":"private command","timeout":10}' } },
    action: { kind: 'TerminalAction', command: 'private command', timeout: 10 }, thought: 'private reasoning' }],
});
const binding = () => ({ task_id: task, user_id: user, connection_id: connection, remote_conversation_id: conversation,
  execution_enabled: true, execution_verified_at: '2026-09-28T00:00:00Z', gateway_grant_id: grant,
  gateway_generation: 2, gateway_expires_at: new Date(Date.now() + 300000).toISOString() });
const row = () => ({ id: review, task_id: task, user_id: user, generation: 2, task_revision: 4, connection_id: connection,
  remote_conversation_id: conversation, grant_id: grant, ...fingerprintWorkConfirmation(snapshot()), revision: 1, status: 'pending',
  delivery_status: 'blocked', decision: null, decision_request_id: null, expires_at: new Date(Date.now() + 60000).toISOString(),
  created_at: '2026-09-28T00:00:00Z', decided_at: null });
beforeEach(() => {
  vi.resetAllMocks(); vi.stubEnv('TM_WORK_CONFIRMATION_SECRET', 's'.repeat(48)); vi.stubEnv('TM_WORK_CONFIRMATION_LEDGER_ENABLED', 'true');
  mocks.entitlement.mockResolvedValue(undefined); mocks.task.mockResolvedValue({ id: task, user_id: user, generation: 2, revision: 4, status: 'running', worker_id: 'openhands:' + conversation });
  mocks.connection.mockResolvedValue({ id: connection }); mocks.single.mockResolvedValue({ data: binding(), error: null });
});
afterEach(() => vi.unstubAllEnvs());
describe('private confirmation fingerprint', () => {
  it('stores only keyed fingerprints and tool categories, never command or reasoning', () => {
    expect(JSON.stringify(fingerprintWorkConfirmation(snapshot()))).not.toContain('private');
    expect(fingerprintWorkConfirmation(snapshot()).tools).toEqual(['terminal']);
  });
  it('normalizes object key order while preserving execution payload changes', () => {
    const original = fingerprintWorkConfirmation(snapshot()).fingerprint, changed = snapshot();
    changed.actions[0].tool_call.function.arguments = '{"timeout":10,"command":"private command"}';
    expect(fingerprintWorkConfirmation(changed).fingerprint).toBe(original);
    changed.actions[0].action.command = 'different command';
    expect(fingerprintWorkConfirmation(changed).fingerprint).not.toBe(original);
  });
  it('binds the active branch head and ordered pending action set', () => {
    const changed = snapshot(), original = fingerprintWorkConfirmation(changed).fingerprint;
    changed.headId = 'head-2'; expect(fingerprintWorkConfirmation(changed).fingerprint).not.toBe(original);
    changed.actions.push({ ...structuredClone(changed.actions[0]), id: 'action-2', tool_call_id: 'call-2', tool_call: { ...changed.actions[0].tool_call, id: 'call-2' } });
    const ordered = fingerprintWorkConfirmation(changed).fingerprint;
    changed.actions.reverse(); expect(fingerprintWorkConfirmation(changed).fingerprint).not.toBe(ordered);
  });
  it('excludes private reasoning and rotates with its server key', () => {
    const value = snapshot(), original = fingerprintWorkConfirmation(value).fingerprint;
    value.actions[0].thought = 'other private reasoning'; expect(fingerprintWorkConfirmation(value).fingerprint).toBe(original);
    vi.stubEnv('TM_WORK_CONFIRMATION_SECRET', 'x'.repeat(48)); expect(fingerprintWorkConfirmation(value).fingerprint).not.toBe(original);
  });
  it.each(['tool_call_id', 'tool_name', 'id'] as const)('rejects mismatched/duplicate %s', field => {
    const value = snapshot();
    if (field === 'id') value.actions.push(structuredClone(value.actions[0])); else value.actions[0][field] = 'different';
    expect(() => fingerprintWorkConfirmation(value)).toThrow('WORK_CONFIRMATION_INVALID_SNAPSHOT');
  });
  it.each(['null', '[]', 'private malformed command', '{"command":"' + 'x'.repeat(33000) + '"}'])('redacts invalid argument errors', argumentsText => {
    const value = snapshot(); value.actions[0].tool_call.function.arguments = argumentsText;
    expect(() => fingerprintWorkConfirmation(value)).toThrow('WORK_CONFIRMATION_INVALID_SNAPSHOT');
  });
  it('rejects recent-page shapes, unknown policy and excessive nesting', () => {
    expect(() => fingerprintWorkConfirmation({ items: snapshot().actions })).toThrow('WORK_CONFIRMATION_INVALID_SNAPSHOT');
    expect(() => fingerprintWorkConfirmation({ ...snapshot(), confirmationPolicy: 'NeverConfirm' })).toThrow('WORK_CONFIRMATION_INVALID_SNAPSHOT');
    let deep: unknown = {}; for (let i = 0; i < 15; i++) deep = { deep };
    expect(() => fingerprintWorkConfirmation({ ...snapshot(), extra: deep })).toThrow('WORK_CONFIRMATION_INVALID_SNAPSHOT');
  });
  it('requires a separate server secret', () => {
    vi.stubEnv('TM_WORK_CONFIRMATION_SECRET', 'short'); expect(() => fingerprintWorkConfirmation(snapshot())).toThrow('WORK_CONFIRMATION_SETUP_REQUIRED');
  });
});
describe('service-only intent persistence', () => {
  it('does no reads or writes when disabled', async () => {
    vi.stubEnv('TM_WORK_CONFIRMATION_LEDGER_ENABLED', 'false');
    await expect(saveWorkConfirmationReview(task, user, 4, snapshot())).rejects.toThrow('WORK_CONFIRMATION_DISABLED');
    expect(mocks.entitlement).not.toHaveBeenCalled(); expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it('requires entitlement before reading connection configuration', async () => {
    mocks.entitlement.mockRejectedValue(new Error('WORK_FORBIDDEN'));
    await expect(saveWorkConfirmationReview(task, user, 4, snapshot())).rejects.toThrow('WORK_FORBIDDEN'); expect(mocks.connection).not.toHaveBeenCalled();
  });
  it.each([{ gateway_grant_id: null }, { gateway_generation: 3 }, { gateway_expires_at: '2000-01-01T00:00:00Z' }, { connection_id: grant }, { execution_enabled: false }])('rejects revoked or stale binding %j', override => {
    mocks.single.mockResolvedValue({ data: { ...binding(), ...override }, error: null });
    return expect(saveWorkConfirmationReview(task, user, 4, snapshot())).rejects.toThrow('WORK_STATE_CHANGED');
  });
  it('sends no raw payload to the database and validates the returned authority', async () => {
    mocks.rpc.mockResolvedValue({ data: row(), error: null });
    expect((await saveWorkConfirmationReview(task, user, 4, snapshot())).delivery_status).toBe('blocked');
    expect(JSON.stringify(mocks.rpc.mock.calls)).not.toContain('private');
    mocks.rpc.mockResolvedValue({ data: { ...row(), grant_id: connection }, error: null });
    await expect(saveWorkConfirmationReview(task, user, 4, snapshot())).rejects.toThrow('WORK_CONFIRMATION_SETUP_REQUIRED');
  });
  it('rejects stale database decisions instead of overwriting them', async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: null });
    await expect(recordWorkConfirmationDecision(task, user, review, 1, request, 'approve')).rejects.toThrow('WORK_STATE_CHANGED');
  });
  it('returns the same blocked intent on identical response retries', async () => {
    mocks.rpc.mockResolvedValue({ data: { ...row(), revision: 2, status: 'decided', decision: 'approve', decision_request_id: request, decided_at: '2026-09-28T00:00:00Z' }, error: null });
    const first = await recordWorkConfirmationDecision(task, user, review, 1, request, 'approve');
    expect(await recordWorkConfirmationDecision(task, user, review, 1, request, 'approve')).toEqual(first);
    await expect(recordWorkConfirmationDecision(task, user, review, 1, request, 'reject')).rejects.toThrow('WORK_CONFIRMATION_SETUP_REQUIRED');
  });
});
