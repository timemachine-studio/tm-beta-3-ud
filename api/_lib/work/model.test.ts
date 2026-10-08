import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import type { WorkTask } from '../../../shared/work';
const mocks = vi.hoisted(() => ({ entitlement: vi.fn(), task: vi.fn(), quota: vi.fn(), increment: vi.fn(), dispatch: vi.fn(), content: vi.fn(), insert: vi.fn(), export: vi.fn() }));
vi.mock('../../ai-proxy.js', () => ({ dispatchStreamingProvider: mocks.dispatch }));
vi.mock('../personaRoutes.js', () => ({ AIR_ROUTE: { provider: 'air-provider', model: 'air-model', fallbacks: [] }, PRO_ROUTE: { provider: 'pro-provider', model: 'pro-model', fallbacks: [] } }));
vi.mock('../providerResilience.js', () => ({ runWithProviderFallback: async (chain: unknown[], execute: (hop: unknown) => Promise<unknown>) => ({ value: await execute(chain[0]) }) }));
vi.mock('../rateLimit.js', () => ({ checkRateLimit: mocks.quota, incrementRateLimit: mocks.increment }));
vi.mock('./stream.js', () => ({ readWorkContent: mocks.content }));
vi.mock('./integrations.js', () => ({ exportWorkModelCall: mocks.export }));
vi.mock('./store.js', () => ({
  WorkError: class extends Error { constructor(public code: string, public status = 503) { super(code); } },
  requireWorkEntitlement: mocks.entitlement, readWorkTask: mocks.task,
  workDatabase: () => ({ from: () => ({ insert: mocks.insert }) }),
}));
import { workModel } from './model';
const task = { id: '11111111-1111-4111-8111-111111111111', user_id: '22222222-2222-4222-8222-222222222222',
  persona: 'default', status: 'planning', generation: 2, worker_id: 'worker-2' } as WorkTask;
beforeEach(() => {
  vi.clearAllMocks(); mocks.entitlement.mockResolvedValue(undefined); mocks.task.mockResolvedValue(task);
  mocks.quota.mockResolvedValue({ allowed: true, providers: ['air-provider', 'pro-provider'] });
  mocks.dispatch.mockResolvedValue({}); mocks.content.mockResolvedValue('{"answer":"done"}');
  mocks.insert.mockResolvedValue({ error: null }); mocks.export.mockResolvedValue(undefined);
});
describe('TM native model-call integration', () => {
  it('records locally before exporting metadata and uses the selected TM route', async () => {
    await expect(workModel(task, 'plan', [{ role: 'user', content: 'private-user-input' }], z.object({ answer: z.string() }))).resolves.toEqual({ answer: 'done' });
    expect(mocks.dispatch.mock.calls[0][0]).toBe('air-provider');
    expect(mocks.insert.mock.invocationCallOrder[0]).toBeLessThan(mocks.export.mock.invocationCallOrder[0]);
    const record = mocks.insert.mock.calls[0][0];
    expect(record).toMatchObject({ task_id: task.id, provider: 'air-provider', model: 'air-model', outcome: 'completed', input_tokens: null, estimated_cost: null });
    expect(mocks.export).toHaveBeenCalledWith(task.id, task.user_id, record.id, expect.objectContaining({ configVersion: record.config_version, inputTokens: null, estimatedCost: null }));
    expect(JSON.stringify(mocks.export.mock.calls)).not.toContain('private-user-input');
  });
  it('keeps PRO on TM PRO routing instead of upstream provider defaults', async () => {
    await workModel({ ...task, persona: 'pro' }, 'act', [], z.object({ answer: z.string() }));
    expect(mocks.dispatch.mock.calls[0][0]).toBe('pro-provider');
  });
  it('counts malformed opened completions and records invalid output metadata', async () => {
    mocks.content.mockResolvedValue('not json');
    await expect(workModel(task, 'plan', [], z.object({ answer: z.string() }))).rejects.toThrow();
    expect(mocks.increment).toHaveBeenCalledTimes(1);
    expect(mocks.export.mock.calls[0][3]).toMatchObject({ outcome: 'invalid_output' });
  });
  it('does not export if the authoritative local trace write fails', async () => {
    mocks.insert.mockResolvedValue({ error: { message: 'private-db-detail' } });
    await expect(workModel(task, 'plan', [], z.object({ answer: z.string() }))).rejects.toMatchObject({ code: 'WORK_TRACE_WRITE_FAILED' });
    expect(mocks.export).not.toHaveBeenCalled();
  });
  it('cannot contact a provider or Agenta after worker ownership changed', async () => {
    mocks.task.mockResolvedValue({ ...task, generation: 3 });
    await expect(workModel(task, 'plan', [], z.object({ answer: z.string() }))).rejects.toMatchObject({ code: 'WORK_STATE_CHANGED' });
    expect(mocks.dispatch).not.toHaveBeenCalled(); expect(mocks.export).not.toHaveBeenCalled();
  });
});
