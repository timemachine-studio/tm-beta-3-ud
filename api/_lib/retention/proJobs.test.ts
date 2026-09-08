import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ from: vi.fn() }));
vi.mock('@supabase/supabase-js', () => ({ createClient: () => ({ from: mocks.from }) }));
vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'synthetic-key');
const { completeProJob, getProJobByRunId } = await import('../proJobs');
afterAll(() => vi.unstubAllEnvs());
afterEach(() => { vi.clearAllMocks(); vi.useRealTimers(); });
function query(result: unknown) {
  const filters: unknown[][] = [];
  const q = {
    update: vi.fn(() => q), select: vi.fn(() => q),
    eq: (...args: unknown[]) => { filters.push(['eq', ...args]); return q; },
    gt: (...args: unknown[]) => { filters.push(['gt', ...args]); return q; },
    maybeSingle: async () => result,
  };
  mocks.from.mockReturnValue(q);
  return { q, filters };
}
describe('PRO job retention boundary (mock database)', () => {
  it('prevents a late completion from reviving an expired job', async () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-09-06T12:00:00Z'));
    const fixture = query({ data: null, error: null });
    await expect(completeProJob('job', 'synthetic')).rejects.toThrow('pro_job_completion_failed_or_expired');
    expect(fixture.filters).toContainEqual(['eq', 'status', 'running']);
    expect(fixture.filters).toContainEqual(['gt', 'created_at', '2026-09-06T10:00:00.000Z']);
  });
  it('hides expired recovery data even before a cleanup job runs', async () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-09-06T12:00:00Z'));
    query({ data: { status: 'completed', created_at: '2026-09-06T08:00:00Z', updated_at: '2026-09-06T10:00:00Z', final_content: 'CANARY_PRIVATE' }, error: null });
    expect(await getProJobByRunId('run')).toBeNull();
  });
});
