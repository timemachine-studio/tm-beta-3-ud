import { EventEmitter } from 'node:events';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { VercelRequest, VercelResponse } from '../../api/_lib/vercelTypes';
const mock = vi.hoisted(() => ({ enabled: vi.fn(), verify: vi.fn(), authorize: vi.fn(), claim: vi.fn(), release: vi.fn(), model: vi.fn() }));
vi.mock('../../api/_lib/work/runtimeGrant.js', () => ({ requireRuntimeGatewayEnabled: mock.enabled, verifyWorkRuntimeGrant: mock.verify,
  authorizeWorkRuntimeGrant: mock.authorize, claimWorkRuntimeLease: mock.claim, releaseWorkRuntimeLease: mock.release,
  runtimeModelAlias: (persona: string) => persona === 'pro' ? 'tm-pro' : persona === 'girlie' ? 'tm-girlie' : 'tm-air',
}));
vi.mock('../../api/_lib/work/runtimeModel.js', () => ({ workRuntimeModel: mock.model }));
import handler from '../../api/_lib/work/runtimeGateway';
import { WorkError } from '../../api/_lib/work/store';
const body = { model: 'tm-air', messages: [{ role: 'user', content: 'Do a task' }] };
const request = (override = {}, headers: Record<string, string> = { authorization: 'Bearer scoped-key' }) => Object.assign(new EventEmitter(), { method: 'POST', body: { ...body, ...override }, headers, query: {} }) as VercelRequest;
function response() { return Object.assign(new EventEmitter(), { status: vi.fn().mockReturnThis(), setHeader: vi.fn(),
  json: vi.fn().mockReturnThis(), write: vi.fn(), end: vi.fn(), writableEnded: false, destroyed: false }) as unknown as VercelResponse; }
beforeEach(() => { vi.clearAllMocks(); mock.enabled.mockReturnValue(undefined); mock.verify.mockReturnValue({ taskId: 'task', userId: 'owner' });
  mock.authorize.mockResolvedValue({ persona: 'default' }); mock.claim.mockResolvedValue('assigned-lease'); mock.release.mockResolvedValue(undefined);
  mock.model.mockResolvedValue({ content: 'done', toolCalls: [], finishReason: 'stop' }); });
describe('server-to-server TM model gateway', () => {
  it('returns the authorized alias without fabricated usage or provider identity', async () => {
    const req = request(), res = response(); await handler(req, res);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ model: 'tm-air', object: 'chat.completion' }));
    expect(vi.mocked(res.json).mock.calls[0][0]).not.toHaveProperty('usage'); expect(mock.release).toHaveBeenCalledWith({ taskId: 'task', userId: 'owner' }, 'assigned-lease');
    expect(req.listenerCount('aborted')).toBe(0); expect(res.listenerCount('close')).toBe(0);
  });
  it('returns indexed validated tool calls as buffered SSE and a DONE marker', async () => {
    mock.model.mockResolvedValue({ content: '', toolCalls: [{ id: 'call-1', type: 'function', function: { name: 'read_file', arguments: '{}' } }], finishReason: 'tool_calls' });
    const res = response(); await handler(request({ stream: true }), res);
    const chunks = vi.mocked(res.write).mock.calls.map(call => String(call[0])).join('');
    expect(chunks).toContain('"index":0'); expect(chunks).toContain('"finish_reason":"tool_calls"'); expect(chunks).not.toContain('scoped-key');
    expect(res.end).toHaveBeenCalledWith('data: [DONE]\n\n'); expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'text/event-stream; charset=utf-8');
  });
  it('rejects missing authorization and browser origins before model calls', async () => {
    for (const [headers, code] of [[{}, 401], [{ authorization: 'Bearer scoped-key', origin: 'http://localhost:5174' }, 403]] as const) {
      const res = response(); await handler(request({}, headers), res); expect(res.status).toHaveBeenCalledWith(code);
    } expect(mock.model).not.toHaveBeenCalled(); expect(mock.claim).not.toHaveBeenCalled();
  });
  it('rejects disabled gateways, alias switching and malformed tool input', async () => {
    mock.enabled.mockImplementationOnce(() => { throw new WorkError('WORK_GATEWAY_DISABLED', 503); });
    const disabled = response(); await handler(request(), disabled); expect(disabled.status).toHaveBeenCalledWith(503);
    const mismatch = response(); await handler(request({ model: 'tm-pro' }), mismatch); expect(mismatch.status).toHaveBeenCalledWith(403);
    const invalid = response(); await handler(request({ model: 'other-provider' }), invalid); expect(invalid.status).toHaveBeenCalledWith(400);
    expect(mock.model).not.toHaveBeenCalled();
  });
  it('does not dispatch without an exclusive lease', async () => { mock.claim.mockRejectedValue(new WorkError('WORK_RUNTIME_BUSY', 409));
    const res = response(); await handler(request(), res); expect(res.status).toHaveBeenCalledWith(409); expect(mock.model).not.toHaveBeenCalled(); expect(mock.release).not.toHaveBeenCalled(); });
  it('revalidates authority before sending and redacts unexpected provider details', async () => {
    mock.authorize.mockResolvedValueOnce({ persona: 'default' }).mockRejectedValueOnce(new WorkError('WORK_RUNTIME_UNAUTHORIZED', 403));
    const res = response(); await handler(request(), res); expect(res.status).toHaveBeenCalledWith(403); expect(res.write).not.toHaveBeenCalled(); expect(mock.release).toHaveBeenCalledTimes(1);
    mock.model.mockRejectedValue(new Error('https://private-api.invalid secret-provider-key')); const error = response(); await handler(request(), error);
    expect(JSON.stringify(vi.mocked(error.json).mock.calls)).not.toContain('secret-provider-key');
  });
  it('cancels a disconnected request, cleans listeners and releases the lease', async () => {
    const req = request(), res = response(); let signal!: AbortSignal;
    mock.model.mockImplementation(async (_grant, _lease, _request, passed: AbortSignal) => { signal = passed; req.emit('aborted'); return { content: 'late answer', toolCalls: [], finishReason: 'stop' }; });
    await handler(req, res); expect(signal.aborted).toBe(true); expect(res.status).toHaveBeenCalledWith(409); expect(mock.release).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(vi.mocked(res.json).mock.calls)).not.toContain('late answer');
  });
});
