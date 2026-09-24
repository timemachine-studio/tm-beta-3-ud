import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ from: vi.fn(), rpc: vi.fn() }));
vi.mock('@supabase/supabase-js', () => ({ createClient: () => ({ from: mocks.from, rpc: mocks.rpc }) }));
vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'synthetic-key');
const { claimProJobPayload, completeProJob, getProJobByRunId, storeProJobPayload } = await import('../proJobs');
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
  it('stages a prepared request in the transient payload column', async () => {
    const fixture = query({ data: { id: 'job' }, error: null });
    const payload = { jobId: 'job', apiMessages: [], tools: [], model: 'model', temperature: 0, maxTokens: 10, provider: 'provider', userId: 'user', ip: 'ip' };
    await storeProJobPayload('job', payload);
    expect(fixture.q.update).toHaveBeenCalledWith({ request_payload: payload, request_claimed_at: null });
    expect(fixture.filters).toContainEqual(['eq', 'status', 'running']);
  });
  it('claims the request through the destructive service-role RPC', async () => {
    mocks.rpc.mockResolvedValueOnce({ data: { jobId: 'wrong', apiMessages: [] }, error: null });
    const payload = await claimProJobPayload('job');
    expect(mocks.rpc).toHaveBeenCalledWith('claim_pro_generation_payload', { p_job_id: 'job' });
    expect(payload.jobId).toBe('job');
  });
  it('fails closed when a request was already claimed or expired', async () => {
    mocks.rpc.mockResolvedValueOnce({ data: null, error: null });
    await expect(claimProJobPayload('job')).rejects.toThrow('pro_job_payload_missing_or_expired');
  });
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
