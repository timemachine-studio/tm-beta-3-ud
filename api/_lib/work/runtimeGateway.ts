import { randomUUID } from 'node:crypto';
import type { VercelRequest, VercelResponse } from '../vercelTypes.js';
import { WorkError } from './store.js';
import { authorizeWorkRuntimeGrant, claimWorkRuntimeLease, releaseWorkRuntimeLease, requireRuntimeGatewayEnabled,
  runtimeModelAlias, verifyWorkRuntimeGrant, type WorkRuntimeGrant } from './runtimeGrant.js';
import { parseWorkRuntimeRequest } from './runtimeProtocol.js';
import { workRuntimeModel } from './runtimeModel.js';

const messages: Record<string, string> = {
  WORK_GATEWAY_DISABLED: 'The Work runtime model gateway is disabled.',
  WORK_GATEWAY_SETUP_REQUIRED: 'The Work runtime model gateway needs administrator setup.',
  WORK_RUNTIME_UNAUTHORIZED: 'Runtime authorization is unavailable or expired.',
  WORK_RUNTIME_BUSY: 'Another runtime request is active, or the task changed. Retry after refreshing its authorization.',
  WORK_RUNTIME_BAD_REQUEST: 'Unsupported or invalid completion request.',
  WORK_RUNTIME_PAYLOAD_TOO_LARGE: 'Completion requests must be under 256 KiB.',
  WORK_RUNTIME_MODEL_MISMATCH: 'This model alias is not authorized for this task.',
  WORK_QUOTA_REACHED: 'The TimeMachine quota is reached.',
  WORK_QUOTA_UNAVAILABLE: 'The TimeMachine quota could not be verified.',
  WORK_MODEL_TIMEOUT: 'The completion exceeded its deadline.',
  WORK_MODEL_CANCELLED: 'The completion was cancelled.',
  WORK_TRACE_WRITE_FAILED: 'The completion audit could not be saved.',
};

/** Server-to-server only. No browser issuance, runtime launch, or provider keys. */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store');
  const controller = new AbortController();
  let claims: WorkRuntimeGrant | undefined, leaseId: string | undefined;
  const onDisconnect = () => { if (!res.writableEnded) controller.abort(new WorkError('WORK_MODEL_CANCELLED', 409)); };
  req.once('aborted', onDisconnect); res.once('close', onDisconnect);
  const deadline = setTimeout(() => controller.abort(new WorkError('WORK_MODEL_TIMEOUT', 504)), 120000);
  try {
    if (req.method !== 'POST') throw new WorkError('METHOD_NOT_ALLOWED', 405);
    if (req.headers.origin !== undefined) throw new WorkError('WORK_RUNTIME_UNAUTHORIZED', 403);
    requireRuntimeGatewayEnabled();
    const authorization = req.headers.authorization;
    if (typeof authorization !== 'string' || !/^Bearer \S+$/.test(authorization)) throw new WorkError('UNAUTHORIZED', 401);
    claims = verifyWorkRuntimeGrant(authorization.slice(7));
    const task = await authorizeWorkRuntimeGrant(claims);
    const request = parseWorkRuntimeRequest(req.body);
    if (request.model !== runtimeModelAlias(task.persona)) throw new WorkError('WORK_RUNTIME_MODEL_MISMATCH', 403);
    leaseId = await claimWorkRuntimeLease(claims);
    const completion = await workRuntimeModel(claims, leaseId, request, controller.signal);
    if (controller.signal.aborted) throw controller.signal.reason;
    await authorizeWorkRuntimeGrant(claims, leaseId);
    if (controller.signal.aborted) throw controller.signal.reason;
    const base = { id: 'chatcmpl-' + randomUUID(), created: Math.floor(Date.now() / 1000), model: request.model };
    const output = { role: 'assistant', content: completion.content || null,
      ...(completion.toolCalls.length ? { tool_calls: completion.toolCalls } : {}) };
    if (!request.stream) return res.status(200).json({ ...base, object: 'chat.completion',
      choices: [{ index: 0, message: output, finish_reason: completion.finishReason }] });
    res.status(200); res.setHeader('Content-Type', 'text/event-stream; charset=utf-8'); res.setHeader('X-Accel-Buffering', 'no');
    const delta = { ...output, ...(completion.toolCalls.length ? { tool_calls: completion.toolCalls.map((call, index) => ({ index, ...call })) } : {}) };
    res.write('data: ' + JSON.stringify({ ...base, object: 'chat.completion.chunk', choices: [{ index: 0, delta, finish_reason: null }] }) + '\n\n');
    res.write('data: ' + JSON.stringify({ ...base, object: 'chat.completion.chunk', choices: [{ index: 0, delta: {}, finish_reason: completion.finishReason }] }) + '\n\n');
    res.end('data: [DONE]\n\n');
  } catch (cause) {
    if (res.destroyed || res.writableEnded) return;
    const error = controller.signal.reason instanceof WorkError ? controller.signal.reason : cause;
    const code = error instanceof WorkError ? error.code : 'WORK_MODEL_UNAVAILABLE';
    const status = error instanceof WorkError ? error.status : 502;
    return res.status(status).json({ error: { code, type: status === 400 || status === 413 ? 'invalid_request_error' : 'runtime_error',
      message: messages[code] ?? 'The TimeMachine runtime completion is unavailable.' } });
  } finally {
    clearTimeout(deadline); req.off('aborted', onDisconnect); res.off('close', onDisconnect); controller.abort();
    if (claims && leaseId) await releaseWorkRuntimeLease(claims, leaseId);
  }
}
