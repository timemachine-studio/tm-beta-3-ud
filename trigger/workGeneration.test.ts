import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { WorkFile, WorkTask } from '../shared/work';
const mocks = vi.hoisted(() => ({ model: vi.fn(), entitlement: vi.fn(), checkpoint: vi.fn(), snapshot: vi.fn(), search: vi.fn(), fetch: vi.fn() }));
vi.mock('@trigger.dev/sdk', () => ({ task: (definition: unknown) => definition }));
vi.mock('../api/_lib/work/model.js', () => ({ workModel: mocks.model }));
vi.mock('../api/_lib/webSearch.js', () => ({ runWebSearch: mocks.search, formatResultsForModel: JSON.stringify }));
vi.mock('../api/_lib/webFetch.js', () => ({ fetchWebPage: mocks.fetch, formatPageForModel: JSON.stringify }));
let state: WorkTask;
let files: WorkFile[];
vi.mock('../api/_lib/work/store.js', () => ({
  WorkError: class extends Error { constructor(public code: string) { super(code); } },
  requireWorkEntitlement: mocks.entitlement, checkpoint: mocks.checkpoint, workSnapshot: mocks.snapshot,
  workDatabase: () => ({ from: (table: string) => table === 'work_config_versions' ? { upsert: async () => ({ error: null }) } : { select: () => ({ eq: () => ({ single: async () => ({ data: { user_id: '22222222-2222-4222-8222-222222222222' }, error: null }) }) }) } }),
}));
import { runWork } from './workGeneration';
import { WorkError } from '../api/_lib/work/store';
const plan = { title: 'A useful brief', approach: 'Read and draft a brief.', steps: [{ title: 'Write', description: 'Save brief.md' }], deliverables: ['brief.md'], limitations: [] };
beforeEach(() => {
  vi.clearAllMocks();
  state = { id: '11111111-1111-4111-8111-111111111111', user_id: '22222222-2222-4222-8222-222222222222', session_id: '33333333-3333-4333-8333-333333333333', title: 'Brief', goal: 'Write a brief', instructions: '', persona: 'pro', status: 'queued', plan: null, thread: [], step_index: 0, revision: 0, generation: 0, summary: null, error: null, worker_id: null, created_at: '2026-09-27T00:00:00Z', updated_at: '2026-09-27T00:00:00Z' };
  files = [];
  mocks.entitlement.mockResolvedValue(undefined);
  mocks.snapshot.mockImplementation(async () => ({ task: { ...state, thread: [...state.thread] }, files: [...files], activity: [], traces: [] }));
  mocks.checkpoint.mockImplementation(async (_task, statuses, patch, _type, _title, file, revision, worker, generation) => {
    if (!statuses.includes(state.status) || revision !== undefined && revision !== state.revision || worker !== undefined && worker !== state.worker_id || generation !== undefined && generation !== state.generation) throw new WorkError('WORK_STATE_CHANGED');
    if (file) files.push({ id: '44444444-4444-4444-8444-444444444444', task_id: state.id, source: false, revision: 1, updated_at: state.updated_at, ...file });
    if (patch.append_turn) state.thread = [...state.thread, patch.append_turn];
    const { append_turn: _turn, ...rest } = patch;
    state = { ...state, ...rest, revision: state.revision + 1 };
    return { ...state, thread: [...state.thread] };
  });
});
describe('durable Work worker', () => {
  it('plans and waits for approval without executing a tool', async () => {
    mocks.model.mockResolvedValue(plan);
    await runWork(state.id, 0, 'worker');
    expect(state.status).toBe('review'); expect(state.plan).toEqual(plan);
    expect(files).toHaveLength(0); expect(mocks.search).not.toHaveBeenCalled();
    expect(mocks.model).toHaveBeenCalledTimes(1);
  });
  it('keeps queued steering from invalidating a generation', async () => {
    state.revision = 4; state.thread.push({ role: 'user', content: 'Use concise language', at: state.created_at });
    mocks.model.mockResolvedValue(plan);
    await runWork(state.id, 0, 'worker');
    expect(state.status).toBe('review'); expect(state.thread[0].content).toBe('Use concise language');
  });
  it('ignores old generations and duplicate running deliveries', async () => {
    state.generation = 1; await runWork(state.id, 0, 'old');
    state.status = 'running'; await runWork(state.id, 1, 'duplicate');
    expect(mocks.model).not.toHaveBeenCalled(); expect(mocks.checkpoint).not.toHaveBeenCalled();
  });
  it('saves a real output before marking an approved task complete', async () => {
    state.plan = plan;
    mocks.model.mockResolvedValueOnce({ action: 'write_file', path: 'brief.md', kind: 'markdown', content: '# Actual output' }).mockResolvedValueOnce({ action: 'finish_step', summary: 'Saved brief.md.' });
    await runWork(state.id, 0, 'worker');
    expect(state.status).toBe('completed'); expect(files[0].content).toBe('# Actual output'); expect(state.step_index).toBe(1);
    expect(mocks.checkpoint.mock.calls.filter(call => call[3] === 'artifact.updated')).toHaveLength(1);
  });
  it('cannot write after cancellation during a model call', async () => {
    state.plan = plan;
    mocks.model.mockImplementation(async () => { state.status = 'cancelled'; return { action: 'write_file', path: 'late.md', kind: 'markdown', content: 'Too late' }; });
    await runWork(state.id, 0, 'worker');
    expect(state.status).toBe('cancelled'); expect(files).toHaveLength(0);
  });
  it('preserves steering appended while planning', async () => {
    mocks.model.mockImplementation(async () => { state.thread.push({ role: 'user', content: 'An extra requirement', at: state.created_at }); return plan; });
    await runWork(state.id, 0, 'worker');
    expect(state.thread.map(turn => turn.content)).toContain('An extra requirement');
  });
  it('stops a worker after another generation takes ownership', async () => {
    state.plan = plan;
    mocks.model.mockImplementation(async () => { state.worker_id = 'replacement'; state.generation++; return { action: 'write_file', path: 'stale.md', kind: 'markdown', content: 'Old run' }; });
    await runWork(state.id, 0, 'worker');
    expect(files).toHaveLength(0); expect(state.status).toBe('running');
  });
  it('fails boundedly rather than fabricate deliverables', async () => {
    state.plan = plan; mocks.model.mockResolvedValue({ action: 'finish_step', summary: 'Done without output' });
    await runWork(state.id, 0, 'worker');
    expect(state.status).toBe('failed'); expect(state.error).toBe('WORK_BUDGET_EXHAUSTED'); expect(mocks.model).toHaveBeenCalledTimes(8);
  });
  it('never overwrites an original upload', async () => {
    state.plan = plan; files = [{ id: '44444444-4444-4444-8444-444444444444', task_id: state.id, path: 'source.md', kind: 'markdown', content: 'Original', source: true, revision: 1, updated_at: state.updated_at }];
    mocks.model.mockResolvedValue({ action: 'write_file', path: 'source.md', kind: 'markdown', content: 'Changed' });
    await runWork(state.id, 0, 'worker');
    expect(files[0].content).toBe('Original'); expect(state.status).toBe('failed');
  });
});
