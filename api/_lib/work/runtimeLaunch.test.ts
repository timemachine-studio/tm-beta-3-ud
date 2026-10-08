import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const mock = vi.hoisted(() => ({ verify: vi.fn(), authorize: vi.fn() }));
vi.mock('./runtimeGrant.js', () => ({ verifyWorkRuntimeGrant: mock.verify, authorizeWorkRuntimeGrant: mock.authorize,
  runtimeModelAlias: (persona: string) => persona === 'pro' ? 'tm-pro' : persona === 'girlie' ? 'tm-girlie' : 'tm-air',
}));
import { prepareOpenHandsLaunch, verifyOpenHandsLaunchResponse } from './runtimeLaunch';

const taskId = '11111111-1111-4111-8111-111111111111', userId = '22222222-2222-4222-8222-222222222222';
const remoteId = '44444444-4444-4444-8444-444444444444';
const task = { id: taskId, user_id: userId, generation: 2, persona: 'pro', plan: { title: 'Approved plan' } };
const credential = 'task-scoped-gateway-grant-not-provider-key';
beforeEach(() => {
  vi.resetAllMocks(); vi.stubEnv('TM_WORK_MODEL_GATEWAY_BASE_URL', 'https://tm.example/api/work-model/v1/');
  mock.verify.mockReturnValue({ taskId, userId, conversationId: remoteId, expiresAt: Math.floor(Date.now() / 1000) + 900 });
  mock.authorize.mockResolvedValue(task);
});
afterEach(() => vi.unstubAllEnvs());

describe('server-only OpenHands launch contract', () => {
  it.each(['default', 'girlie', 'pro'])('uses the bound %s TM mind with explicit chat transport and no retries', async persona => {
    mock.authorize.mockResolvedValue({ ...task, persona });
    const launch = await prepareOpenHandsLaunch(taskId, userId, credential);
    expect(launch.agent.llm).toMatchObject({ model: 'openai/' + (persona === 'default' ? 'tm-air' : persona === 'girlie' ? 'tm-girlie' : 'tm-pro'),
      base_url: 'https://tm.example/api/work-model/v1', api_key: credential, api_mode: 'chat', num_retries: 0, native_tool_calling: true, log_completions: false });
    expect(launch.agent.llm.max_output_tokens).toBe(persona === 'pro' ? 10000 : 7000);
    expect(launch.confirmation_policy).toEqual({ kind: 'AlwaysConfirm' });
    expect(launch.initial_message).toBeNull(); expect(launch.autotitle).toBe(false);
    expect(launch.workspace.working_dir).toBe('/workspace/tm/' + taskId);
    expect(launch.agent.tool_concurrency_limit).toBe(1); expect(launch.max_iterations).toBe(24);
    for (const forbidden of ['plugins', 'hook_config', 'client_tools', 'secrets', 'agent_profile_id']) expect(launch).not.toHaveProperty(forbidden);
  });
  it('rejects a credential issued for another task or account before reading protected data', async () => {
    mock.verify.mockReturnValue({ taskId: remoteId, userId });
    await expect(prepareOpenHandsLaunch(taskId, userId, credential)).rejects.toMatchObject({ code: 'WORK_RUNTIME_UNAUTHORIZED' });
    expect(mock.authorize).not.toHaveBeenCalled();
  });
  it('requires a saved plan and time to safely prepare the runtime', async () => {
    mock.authorize.mockResolvedValue({ ...task, plan: null });
    await expect(prepareOpenHandsLaunch(taskId, userId, credential)).rejects.toThrow();
    mock.authorize.mockResolvedValue(task); mock.verify.mockReturnValue({ taskId, userId, expiresAt: Math.floor(Date.now() / 1000) + 30 });
    await expect(prepareOpenHandsLaunch(taskId, userId, credential)).rejects.toThrow();
  });
  it.each(['', 'http://tm.example/api/work-model/v1', 'https://user:key@tm.example/api/work-model/v1',
    'https://tm.example/api/work-model/v1?token=private', 'https://tm.example/api/work-model/v1#private',
    'https://tm.example/other', 'https://localhost/api/work-model/v1'])('rejects unsafe/unconfigured gateway target %s', async base => {
    vi.stubEnv('TM_WORK_MODEL_GATEWAY_BASE_URL', base); await expect(prepareOpenHandsLaunch(taskId, userId, credential)).rejects.toThrow();
    expect(mock.authorize).not.toHaveBeenCalled();
  });
  it('allows explicit loopback only outside production and Vercel', async () => {
    vi.stubEnv('TM_WORK_MODEL_GATEWAY_BASE_URL', 'http://localhost:5174/api/work-model/v1');
    vi.stubEnv('TM_WORK_ALLOW_LOOPBACK', 'true'); vi.stubEnv('NODE_ENV', 'test'); vi.stubEnv('VERCEL', '');
    await expect(prepareOpenHandsLaunch(taskId, userId, credential)).resolves.toBeDefined();
    vi.stubEnv('NODE_ENV', 'production'); await expect(prepareOpenHandsLaunch(taskId, userId, credential)).rejects.toThrow();
    vi.stubEnv('NODE_ENV', 'test'); vi.stubEnv('VERCEL', '1'); await expect(prepareOpenHandsLaunch(taskId, userId, credential)).rejects.toThrow();
  });
  const response = { id: remoteId, execution_status: 'idle', confirmation_policy: { kind: 'AlwaysConfirm' },
    workspace: { kind: 'LocalWorkspace', working_dir: '/workspace/tm/' + taskId } };
  it('validates idle creation without returning the credential-bearing remote response', () => {
    expect(verifyOpenHandsLaunchResponse({ ...response, api_key: credential }, remoteId, taskId)).toBeUndefined();
  });
  it.each([{ id: taskId }, { execution_status: 'running' }, { confirmation_policy: { kind: 'NeverConfirm' } },
    { confirmation_policy: {} }, { workspace: { kind: 'LocalWorkspace', working_dir: '/' } }])('rejects unsafe remote creation %o', patch => {
    expect(() => verifyOpenHandsLaunchResponse({ ...response, ...patch }, remoteId, taskId)).toThrow();
  });
  it('requires the actual launch profile to use TM chat transport rather than a provider bypass', () => {
    const expected = { model: 'openai/tm-pro', baseUrl: 'https://tm.example/api/work-model/v1' };
    const llm = { model: expected.model, base_url: expected.baseUrl, api_mode: 'chat' };
    expect(() => verifyOpenHandsLaunchResponse({ ...response, agent: { llm } }, remoteId, taskId, expected)).not.toThrow();
    for (const patch of [{ model: 'claude-direct' }, { base_url: 'https://provider.example' }, { api_mode: 'responses' }]) {
      expect(() => verifyOpenHandsLaunchResponse({ ...response, agent: { llm: { ...llm, ...patch } } }, remoteId, taskId, expected)).toThrow();
    }
  });
});
