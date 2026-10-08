import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ entitlement: vi.fn(), task: vi.fn(), connection: vi.fn(), transport: vi.fn(), from: vi.fn() }));
vi.mock('./store.js', () => ({
  WorkError: class extends Error { constructor(public code: string, public status = 503) { super(code); } },
  requireWorkEntitlement: mocks.entitlement, readWorkTask: mocks.task, workDatabase: () => ({ from: mocks.from }),
}));
vi.mock('./upstreamTransport.js', () => ({ readWorkConnection: mocks.connection, workUpstreamJson: mocks.transport }));
import { exportWorkModelCall, readWorkConnectionStatuses, readWorkIntegration } from './integrations';
import { WorkError } from './store';
const taskId = '11111111-1111-4111-8111-111111111111';
const userId = '22222222-2222-4222-8222-222222222222';
const connectionId = '33333333-3333-4333-8333-333333333333';
const remoteId = '44444444-4444-4444-8444-444444444444';
const projectId = '55555555-5555-4555-8555-555555555555';
const metadata = { phase: 'plan', provider: 'provider', model: 'model', outcome: 'completed' as const,
  configVersion: 'tm-work-prompt-hash', latencyMs: 210, inputTokens: null, outputTokens: null, estimatedCost: null };
const connection = { id: connectionId, user_id: userId, base_url: 'https://service.example', scope_id: projectId };
let binding: { remote_conversation_id: string } | null;
const eq = vi.fn();
beforeEach(() => {
  vi.clearAllMocks(); vi.stubEnv('TM_WORK_UPSTREAM_ENABLED', 'true'); vi.stubEnv('TM_WORK_AGENTA_EXPORT', 'true');
  mocks.entitlement.mockResolvedValue(undefined); mocks.task.mockResolvedValue({ id: taskId, user_id: userId, generation: 1, revision: 2, status: 'running', worker_id: 'openhands:' + remoteId });
  mocks.connection.mockResolvedValue(connection); binding = { remote_conversation_id: remoteId };
  const query = { select: vi.fn().mockReturnThis(), eq, maybeSingle: vi.fn(async () => ({ data: binding, error: null })) };
  eq.mockReturnValue(query); mocks.from.mockReturnValue(query);
});

describe('reconnectable OpenHands event metadata', () => {
  function remotePage(next: string | null = 'private-page-token') {
    mocks.transport.mockImplementation(async (_connection, path) => path.endsWith('/runtime')
      ? { runtime_status: 'available', can_resume: false }
      : path.endsWith('/events/search') ? { items: [{ id: 'event-id', kind: 'ActionEvent', timestamp: '2026-09-27T00:00:00Z', reasoning_content: 'private' }], next_page_id: next }
        : { id: remoteId, execution_status: 'waiting_for_confirmation' });
  }
  it('pages using only an encrypted task-bound cursor, never returning the upstream token', async () => {
    vi.stubEnv('TM_WORK_EVENT_CURSOR_SECRET', 's'.repeat(48)); remotePage();
    const first = await readWorkIntegration(taskId, userId, 'openhands');
    expect(first.eventPage).toMatchObject({ hasMore: true, nextCursor: expect.any(String) });
    expect(JSON.stringify(first)).not.toMatch(/private-page-token|reasoning_content/);
    mocks.transport.mockClear(); remotePage(null);
    const older = await readWorkIntegration(taskId, userId, 'openhands', first.eventPage!.nextCursor!);
    expect(older.eventPage).toEqual({ hasMore: false, nextCursor: null });
    expect(mocks.transport.mock.calls[2][2].query.page_id).toBe('private-page-token');
    expect(mocks.transport.mock.calls.every(call => !call[2].method || call[2].method === 'GET')).toBe(true);
  });
  it('reports incomplete history without inventing a cursor when paging is not configured', async () => {
    vi.stubEnv('TM_WORK_EVENT_CURSOR_SECRET', ''); remotePage();
    expect((await readWorkIntegration(taskId, userId, 'openhands')).eventPage).toEqual({ hasMore: true, nextCursor: null });
  });
  it('rejects a cursor after generation changes without contacting the upstream', async () => {
    vi.stubEnv('TM_WORK_EVENT_CURSOR_SECRET', 's'.repeat(48)); remotePage();
    const first = await readWorkIntegration(taskId, userId, 'openhands');
    mocks.task.mockResolvedValue({ id: taskId, user_id: userId, generation: 2, revision: 2 }); mocks.transport.mockClear();
    await expect(readWorkIntegration(taskId, userId, 'openhands', first.eventPage!.nextCursor!)).rejects.toMatchObject({ code: 'WORK_EVENT_CURSOR_EXPIRED' });
    expect(mocks.transport).not.toHaveBeenCalled();
  });
  it.each(['generation', 'revision', 'status', 'worker_id'])('discards events when %s changes during the read', async field => {
    remotePage(null);
    mocks.task.mockResolvedValueOnce({ id: taskId, user_id: userId, generation: 1, revision: 2, status: 'running', worker_id: 'openhands:' + remoteId })
      .mockResolvedValue({ id: taskId, user_id: userId, generation: 1, revision: 2, status: 'running', worker_id: 'openhands:' + remoteId, [field]: field === 'generation' || field === 'revision' ? 3 : 'cancelled' });
    await expect(readWorkIntegration(taskId, userId, 'openhands')).rejects.toMatchObject({ code: 'WORK_STATE_CHANGED', status: 409 });
  });
  it('discards a response after connection authority is revoked', async () => {
    remotePage(null); mocks.connection.mockResolvedValueOnce(connection).mockResolvedValue(null);
    await expect(readWorkIntegration(taskId, userId, 'openhands')).rejects.toMatchObject({ code: 'WORK_STATE_CHANGED' });
  });
  it('discards a response after binding reassignment', async () => {
    remotePage(null);
    mocks.transport.mockImplementation(async (_connection, path) => {
      binding = { remote_conversation_id: taskId };
      return path.endsWith('/runtime') ? { runtime_status: 'available', can_resume: false }
        : path.endsWith('/events/search') ? { items: [] } : { id: remoteId, execution_status: 'idle' };
    });
    await expect(readWorkIntegration(taskId, userId, 'openhands')).rejects.toMatchObject({ code: 'WORK_STATE_CHANGED' });
  });
  it('rechecks premium authority after network I/O', async () => {
    remotePage(null); mocks.entitlement.mockResolvedValueOnce(undefined).mockRejectedValue(new WorkError('WORK_PREMIUM_REQUIRED', 403));
    await expect(readWorkIntegration(taskId, userId, 'openhands')).rejects.toMatchObject({ code: 'WORK_PREMIUM_REQUIRED' });
  });
  it('rejects event cursors for Agenta before connection lookup', async () => {
    await expect(readWorkIntegration(taskId, userId, 'agenta', 'cursor')).rejects.toMatchObject({ status: 400 });
    expect(mocks.connection).not.toHaveBeenCalled();
  });
});
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });

describe('owner-scoped Work integrations', () => {
  it('requires premium entitlement before account connection configuration reads', async () => {
    mocks.entitlement.mockRejectedValue(new WorkError('WORK_PREMIUM_REQUIRED', 403));
    await expect(readWorkConnectionStatuses(userId)).rejects.toMatchObject({ status: 403 });
    expect(mocks.connection).not.toHaveBeenCalled(); expect(mocks.transport).not.toHaveBeenCalled();
  });
  it('checks configuration by verified owner and never returns credentials, URLs or project IDs', async () => {
    const result = await readWorkConnectionStatuses(userId);
    expect(mocks.connection.mock.calls).toEqual([[userId, 'openhands'], [userId, 'agenta']]);
    expect(result.connections).toHaveLength(2);
    expect(result.connections[0]).toMatchObject({ configured: true, executionEnabled: false, exportEnabled: false });
    expect(result.connections[1]).toMatchObject({ configured: true, exportEnabled: true });
    expect(JSON.stringify(result)).not.toContain('service.example'); expect(JSON.stringify(result)).not.toContain(projectId);
    expect(mocks.transport).not.toHaveBeenCalled();
  });
  it('does not query the connection store when upstream monitoring is disabled', async () => {
    vi.stubEnv('TM_WORK_UPSTREAM_ENABLED', 'false');
    const result = await readWorkConnectionStatuses(userId);
    expect(result.connections.every(item => !item.configured && !item.monitoringEnabled && !item.executionEnabled)).toBe(true);
    expect(mocks.connection).not.toHaveBeenCalled();
  });
  it('requires entitlement before reading a task or looking up a connection', async () => {
    mocks.entitlement.mockRejectedValue(new WorkError('WORK_PREMIUM_REQUIRED', 403));
    await expect(readWorkIntegration(taskId, userId, 'openhands')).rejects.toMatchObject({ status: 403 });
    expect(mocks.task).not.toHaveBeenCalled(); expect(mocks.connection).not.toHaveBeenCalled(); expect(mocks.transport).not.toHaveBeenCalled();
  });
  it('denies another owner task before any upstream request', async () => {
    mocks.task.mockRejectedValue(new WorkError('WORK_NOT_FOUND', 404));
    await expect(readWorkIntegration(taskId, userId, 'agenta')).rejects.toMatchObject({ status: 404 });
    expect(mocks.task).toHaveBeenCalledWith(taskId, userId); expect(mocks.connection).not.toHaveBeenCalled();
  });
  it('reports disabled and missing connections honestly without probing upstream', async () => {
    vi.stubEnv('TM_WORK_UPSTREAM_ENABLED', 'false');
    expect(await readWorkIntegration(taskId, userId, 'agenta')).toMatchObject({ connected: false, executionEnabled: false });
    expect(mocks.connection).not.toHaveBeenCalled();
    vi.stubEnv('TM_WORK_UPSTREAM_ENABLED', 'true'); mocks.connection.mockResolvedValue(null);
    expect(await readWorkIntegration(taskId, userId, 'openhands')).toMatchObject({ connected: false });
    expect(mocks.transport).not.toHaveBeenCalled();
  });
  it('scopes remote conversation bindings by owner, task and connection', async () => {
    binding = null;
    expect(await readWorkIntegration(taskId, userId, 'openhands')).toMatchObject({ connected: false });
    expect(eq.mock.calls).toEqual([['task_id', taskId], ['user_id', userId], ['connection_id', connectionId]]);
    expect(mocks.transport).not.toHaveBeenCalled();
  });
  it('uses official conversation endpoints but never returns credentials, prompts, workspace or runtime errors', async () => {
    mocks.transport.mockImplementation(async (_connection, path) => path.endsWith('/runtime')
      ? { runtime_status: 'available', can_resume: true, runtime_error: { message: 'private-secret' } }
      : path.endsWith('/events/search') ? { items: [{ id: 'event-id', kind: 'ActionEvent', timestamp: '2026-09-27T00:00:00Z', thought: 'private-thought', action: { command: 'secret-command' } }] }
        : { id: remoteId, execution_status: 'idle', agent: { llm: { api_key: 'private-secret' } }, workspace: '/private/path', persistence_dir: '/private/path' });
    const result = await readWorkIntegration(taskId, userId, 'openhands');
    expect(result).toMatchObject({ connected: true, executionEnabled: false, conversation: { id: remoteId, status: 'idle', runtimeStatus: 'available' } });
    expect(mocks.transport.mock.calls.map(call => call[1])).toEqual(['/api/conversations/' + remoteId, '/api/conversations/' + remoteId + '/runtime', '/api/conversations/' + remoteId + '/events/search']);
    expect(JSON.stringify(result)).not.toMatch(/private|secret-command|api_key|persistence_dir/);
  });
  it('rejects an unexpected conversation identity as an upstream error, not a client input error', async () => {
    mocks.transport.mockImplementation(async (_connection, path) => path.endsWith('/runtime') ? { runtime_status: 'available', can_resume: false }
      : path.endsWith('/events/search') ? { items: [] } : { id: taskId, execution_status: 'idle' });
    await expect(readWorkIntegration(taskId, userId, 'openhands')).rejects.toMatchObject({ code: 'WORK_UPSTREAM_INVALID_RESPONSE', status: 502 });
  });
  it('queries only assigned project and task-tagged traces, and strips private extra fields', async () => {
    mocks.transport.mockResolvedValue({ traces: [{ trace_id: '0123456789abcdef0123456789abcdef', tags: { tm_task_id: taskId, tm_source: 'work_model_call' }, data: { internals: { tm: { ...metadata, systemPrompt: 'private-prompt' } }, inputs: 'private-input', outputs: 'private-output' } }] });
    const result = await readWorkIntegration(taskId, userId, 'agenta');
    expect(mocks.transport).toHaveBeenCalledWith(connection, '/simple/traces/query', { method: 'POST', query: { project_id: projectId }, body: { trace: { tags: { tm_task_id: taskId, tm_source: 'work_model_call' } }, windowing: { limit: 20, order: 'descending' } } });
    expect(result.traces[0]).toMatchObject(metadata); expect(JSON.stringify(result)).not.toContain('private');
  });
  it('refuses traces belonging to a different task even if upstream ignores its filter', async () => {
    mocks.transport.mockResolvedValue({ traces: [{ trace_id: '0123456789abcdef0123456789abcdef', tags: { tm_task_id: remoteId, tm_source: 'work_model_call' }, data: { internals: { tm: metadata } } }] });
    await expect(readWorkIntegration(taskId, userId, 'agenta')).rejects.toMatchObject({ code: 'WORK_UPSTREAM_INVALID_RESPONSE', status: 502 });
  });
  it('exports actual call metadata and prompt version with unknown usage/cost left null', async () => {
    mocks.transport.mockResolvedValue({ count: 1, trace: { trace_id: 'returned-id' } });
    await exportWorkModelCall(taskId, userId, remoteId, metadata);
    expect(mocks.transport).toHaveBeenCalledWith(connection, '/simple/traces/', { method: 'POST', query: { project_id: projectId }, body: { trace: {
      origin: 'auto', kind: 'adhoc', channel: 'api', tags: { tm_task_id: taskId, tm_call_id: remoteId, tm_source: 'work_model_call' }, data: { internals: { tm: metadata } }, references: {}, links: {},
    } } });
  });
  it('never fails the model call when Agenta telemetry fails, and logs only a redacted code', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    mocks.transport.mockRejectedValue(new Error('private-service-key'));
    await expect(exportWorkModelCall(taskId, userId, remoteId, metadata)).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalledWith('work_agenta_export_failed'); expect(JSON.stringify(warn.mock.calls)).not.toContain('private');
  });
  it('does not contact Agenta at all unless both flags are enabled', async () => {
    vi.stubEnv('TM_WORK_AGENTA_EXPORT', 'false');
    await exportWorkModelCall(taskId, userId, remoteId, metadata);
    expect(mocks.task).not.toHaveBeenCalled(); expect(mocks.connection).not.toHaveBeenCalled(); expect(mocks.transport).not.toHaveBeenCalled();
  });
});
