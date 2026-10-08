import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ entitlement: vi.fn(), single: vi.fn(), upstream: vi.fn(), from: vi.fn() }));
vi.mock('./store.js', () => ({ requireWorkEntitlement: mocks.entitlement, workDatabase: () => ({ from: mocks.from }),
  WorkError: class extends Error { constructor(public code: string, public status = 503) { super(code); } } }));
vi.mock('./upstreamTransport.js', () => ({ workUpstreamJson: mocks.upstream }));
import { readWorkHermes } from './hermes';
const owner = '22222222-2222-4222-8222-222222222222';
const row = { id: '11111111-1111-4111-8111-111111111111', user_id: owner, base_url: 'https://hermes.example/p/owner',
  credential_ref: 'OWNER_ONE', enabled: true, scope_verified_at: '2026-09-28T00:00:00Z', revision: 1 };
const capabilities = { object: 'hermes.api_server.capabilities', platform: 'hermes-agent', auth: { type: 'bearer', required: true },
  runtime: { mode: 'server_agent', tool_execution: 'server', split_runtime: false }, features: { skills_api: true, run_stop: true }, model: 'private-model' };
beforeEach(() => {
  vi.resetAllMocks(); vi.stubEnv('TM_WORK_HERMES_MONITORING_ENABLED', 'true');
  mocks.entitlement.mockResolvedValue(undefined); mocks.single.mockResolvedValue({ data: row, error: null });
  mocks.from.mockReturnValue({ select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), maybeSingle: mocks.single });
  mocks.upstream.mockResolvedValueOnce(capabilities).mockResolvedValueOnce({ object: 'list', data: [{ name: 'research', description: 'A brief', category: null, instructions: 'private instructions' }] });
});
afterEach(() => vi.unstubAllEnvs());
it('makes only two metadata GETs and strips private source fields', async () => {
  const result = await readWorkHermes(owner);
  expect(result).toMatchObject({ connected: true, executionEnabled: false, features: ['skills_api', 'run_stop'], skills: [{ name: 'research', description: 'A brief', category: null }] });
  expect(JSON.stringify(result)).not.toContain('private');
  expect(mocks.upstream.mock.calls.map(call => call[1])).toEqual(['/v1/capabilities', '/v1/skills']);
  expect(mocks.entitlement).toHaveBeenCalledTimes(2);
});
it('does no I/O when disabled or entitlement fails', async () => {
  vi.stubEnv('TM_WORK_HERMES_MONITORING_ENABLED', 'false');
  expect(await readWorkHermes(owner)).toMatchObject({ connected: false });
  expect(mocks.from).not.toHaveBeenCalled();
  mocks.entitlement.mockRejectedValue(new Error('premium required'));
  await expect(readWorkHermes(owner)).rejects.toThrow('premium required');
  expect(mocks.upstream).not.toHaveBeenCalled();
});
it.each([{ user_id: '33333333-3333-4333-8333-333333333333' }, { scope_verified_at: null }, { enabled: false }])('rejects unattested or foreign assignments %j', async overrides => {
  mocks.single.mockResolvedValue({ data: { ...row, ...overrides }, error: null });
  await expect(readWorkHermes(owner)).rejects.toMatchObject({ code: 'WORK_INTEGRATION_SETUP_REQUIRED' });
  expect(mocks.upstream).not.toHaveBeenCalled();
});
it('discards metadata if assignment changes during I/O', async () => {
  mocks.single.mockResolvedValueOnce({ data: row, error: null }).mockResolvedValueOnce({ data: { ...row, revision: 3 }, error: null });
  await expect(readWorkHermes(owner)).rejects.toMatchObject({ code: 'WORK_STATE_CHANGED', status: 409 });
});
it('rejects unauthenticated capability responses', async () => {
  mocks.upstream.mockReset().mockResolvedValue({ ...capabilities, auth: { type: 'bearer', required: false } });
  await expect(readWorkHermes(owner)).rejects.toMatchObject({ code: 'WORK_UPSTREAM_INVALID_RESPONSE' });
  expect(mocks.upstream).toHaveBeenCalledTimes(1);
});
it('rejects duplicate skill identities', async () => {
  mocks.upstream.mockReset().mockResolvedValueOnce(capabilities).mockResolvedValueOnce({ object: 'list', data: Array(2).fill({ name: 'same', description: '', category: null }) });
  await expect(readWorkHermes(owner)).rejects.toMatchObject({ code: 'WORK_UPSTREAM_INVALID_RESPONSE' });
});
it('bounds the visible catalog and makes truncation explicit', async () => {
  mocks.upstream.mockReset().mockResolvedValueOnce(capabilities).mockResolvedValueOnce({ object: 'list', data: Array.from({ length: 51 }, (_, i) => ({ name: `skill-${i}`, description: '', category: null })) });
  const result = await readWorkHermes(owner);
  expect(result.skills).toHaveLength(50); expect(result.skillCatalogTruncated).toBe(true);
});
