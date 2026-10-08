import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { WorkTask } from '../../../shared/work';
import type { WorkRuntimeGrant } from './runtimeGrant';
const mock = vi.hoisted(() => ({ authorize: vi.fn(), quota: vi.fn(), increment: vi.fn(), dispatch: vi.fn(), completion: vi.fn(), insert: vi.fn(), upsert: vi.fn(), export: vi.fn() }));
vi.mock('../../ai-proxy.js', () => ({ dispatchStreamingProvider: mock.dispatch }));
vi.mock('../personaRoutes.js', () => ({ AIR_ROUTE: { provider: 'air', model: 'air-model', fallbacks: [{ provider: 'backup', model: 'backup-model' }] }, PRO_ROUTE: { provider: 'pro', model: 'pro-model', fallbacks: [] } }));
vi.mock('../providerResilience.js', () => ({ runWithProviderFallback: async (chain: unknown[], attempt: (hop: unknown) => Promise<unknown>) => {
  let failure; for (const hop of chain) { try { return { value: await attempt(hop) }; } catch (error) { failure = error; } } throw failure;
} }));
vi.mock('../rateLimit.js', () => ({ checkRateLimit: mock.quota, incrementRateLimit: mock.increment }));
vi.mock('./runtimeGrant.js', () => ({ authorizeWorkRuntimeGrant: mock.authorize }));
vi.mock('./runtimeProtocol.js', async original => ({ ...await original<typeof import('./runtimeProtocol')>(), readWorkRuntimeCompletion: mock.completion }));
vi.mock('./integrations.js', () => ({ exportWorkModelCall: mock.export }));
vi.mock('./store.js', () => ({ WorkError: class extends Error { constructor(public code: string, public status = 503) { super(code); } },
  workDatabase: () => ({ from: () => ({ upsert: mock.upsert, insert: mock.insert }) }),
}));
import { workRuntimeModel } from './runtimeModel';
import { parseWorkRuntimeRequest } from './runtimeProtocol';
const task = { id: '11111111-1111-4111-8111-111111111111', user_id: '22222222-2222-4222-8222-222222222222', persona: 'default', goal: 'private user goal', instructions: 'private constraints' } as WorkTask;
const claims = { taskId: task.id, userId: task.user_id } as WorkRuntimeGrant;
const request = parseWorkRuntimeRequest({ model: 'tm-air', messages: [{ role: 'user', content: 'private prompt' }], tools: [{ type: 'function', function: { name: 'read_file', parameters: { type: 'object' } } }], max_tokens: 900 });
const run = (signal = new AbortController().signal) => workRuntimeModel(claims, 'lease', request, signal);
beforeEach(() => { vi.clearAllMocks(); mock.authorize.mockResolvedValue(task); mock.quota.mockResolvedValue({ allowed: true, providers: ['air', 'backup', 'pro'] });
  mock.increment.mockResolvedValue(undefined); mock.dispatch.mockResolvedValue({}); mock.completion.mockResolvedValue({ content: 'answer', toolCalls: [], finishReason: 'stop' });
  mock.insert.mockResolvedValue({ error: null }); mock.upsert.mockResolvedValue({ error: null }); mock.export.mockResolvedValue(undefined);
});
describe('TM runtime model routing', () => {
  it('uses TM routing and bounded tool-capable config, then saves local metadata before export', async () => {
    await expect(run()).resolves.toMatchObject({ content: 'answer' });
    expect(mock.dispatch.mock.calls[0][0]).toBe('air'); expect(mock.dispatch.mock.calls[0][2][0].function.name).toBe('read_file');
    expect(mock.dispatch.mock.calls[0][3]).toMatchObject({ model: 'air-model', maxTokens: 900 });
    expect(mock.insert.mock.invocationCallOrder[0]).toBeLessThan(mock.export.mock.invocationCallOrder[0]);
    expect(JSON.stringify(mock.export.mock.calls)).not.toContain('private'); expect(JSON.stringify(mock.insert.mock.calls)).not.toContain('private');
    expect(mock.insert.mock.calls[0][0]).toMatchObject({ input_tokens: null, estimated_cost: null, phase: 'runtime_completion' });
    expect(mock.authorize).toHaveBeenCalledWith(claims, 'lease');
  });
  it.each(['girlie', 'pro'] as const)('preserves %s routing', async persona => { mock.authorize.mockResolvedValue({ ...task, persona }); await run();
    expect(mock.dispatch.mock.calls[0][0]).toBe(persona === 'pro' ? 'pro' : 'air'); });
  it('never calls a provider after revocation before a hop', async () => {
    mock.authorize.mockResolvedValueOnce(task).mockRejectedValueOnce(new Error('revoked')); await expect(run()).rejects.toThrow('revoked'); expect(mock.dispatch).not.toHaveBeenCalled();
  });
  it('does not rerun a successful model if local audit persistence fails', async () => {
    mock.insert.mockResolvedValue({ error: {} }); await expect(run()).rejects.toMatchObject({ code: 'WORK_TRACE_WRITE_FAILED' });
    expect(mock.dispatch).toHaveBeenCalledTimes(1); expect(mock.increment).toHaveBeenCalledTimes(1); expect(mock.export).not.toHaveBeenCalled();
  });
  it('fails closed before a paid call when prompt provenance cannot be saved', async () => { mock.upsert.mockResolvedValue({ error: {} });
    await expect(run()).rejects.toMatchObject({ code: 'WORK_TRACE_WRITE_FAILED' }); expect(mock.dispatch).not.toHaveBeenCalled(); });
  it('does not return or retry an answer if authority changes while it is generated', async () => {
    mock.authorize.mockResolvedValueOnce(task).mockResolvedValueOnce(task).mockResolvedValueOnce(task).mockRejectedValueOnce(new Error('cancelled during generation'));
    await expect(run()).rejects.toThrow('cancelled during generation'); expect(mock.dispatch).toHaveBeenCalledTimes(1); expect(mock.increment).toHaveBeenCalledTimes(1);
  });
  it('does not rerun a successful model if the audit client throws a transport error', async () => {
    mock.insert.mockRejectedValue(new Error('private audit connection details'));
    await expect(run()).rejects.toMatchObject({ code: 'WORK_TRACE_WRITE_FAILED' }); expect(mock.dispatch).toHaveBeenCalledTimes(1); expect(mock.export).not.toHaveBeenCalled();
  });
  it('fails closed if quota lookup throws between authorization and dispatch', async () => {
    mock.quota.mockResolvedValueOnce({ allowed: true, providers: ['air', 'backup'] }).mockRejectedValueOnce(new Error('private quota store detail'));
    await expect(run()).rejects.toMatchObject({ code: 'WORK_QUOTA_UNAVAILABLE' }); expect(mock.dispatch).not.toHaveBeenCalled();
  });
  it('charges and traces opened invalid output before falling back', async () => {
    mock.completion.mockRejectedValueOnce(new Error('invalid output')); await run();
    expect(mock.dispatch).toHaveBeenCalledTimes(2); expect(mock.increment).toHaveBeenCalledTimes(2);
    expect(mock.insert.mock.calls[0][0].outcome).toBe('invalid_output'); expect(mock.insert.mock.calls[1][0].provider).toBe('backup');
  });
  it('records unopened failures without charging them', async () => { mock.dispatch.mockRejectedValueOnce(new Error('opening failed')); await run();
    expect(mock.increment).toHaveBeenCalledTimes(1); expect(mock.insert.mock.calls[0][0].outcome).toBe('failed'); });
  it('cannot bypass quotas or run after request cancellation', async () => {
    mock.quota.mockResolvedValue({ allowed: false, providers: [] }); await expect(run()).rejects.toMatchObject({ code: 'WORK_QUOTA_REACHED' }); expect(mock.dispatch).not.toHaveBeenCalled();
    mock.quota.mockResolvedValue({ allowed: true, providers: ['air'] }); const controller = new AbortController(); controller.abort();
    await expect(run(controller.signal)).rejects.toMatchObject({ code: 'WORK_MODEL_CANCELLED' }); expect(mock.dispatch).not.toHaveBeenCalled();
  });
});
