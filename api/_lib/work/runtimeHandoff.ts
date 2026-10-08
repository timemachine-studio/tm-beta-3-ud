import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { tasks } from '@trigger.dev/sdk';
import type { WorkTask } from '../../../shared/work.js';
import { readWorkTask, requireWorkEntitlement, workDatabase, WorkError } from './store.js';
import { readWorkExecutionConnection, workUpstreamJson } from './upstreamTransport.js';
import { authorizeWorkRuntimeGrant, issueWorkRuntimeGrant, requireRuntimeGatewayEnabled, verifyWorkRuntimeGrant } from './runtimeGrant.js';
import { prepareOpenHandsLaunch, verifyOpenHandsLaunchResponse, workRuntimeGatewayBaseUrl } from './runtimeLaunch.js';
import { deliverOpenHandsStop } from './runtimeStop.js';
import type { workOpenHandsLaunch } from '../../../trigger/workOpenHandsLaunch.js';

const uuid = z.uuid(), date = z.iso.datetime({ offset: true });
export const workRuntimeLaunchSchema = z.object({
  id: uuid, task_id: uuid, user_id: uuid, connection_id: uuid, remote_conversation_id: uuid,
  generation: z.number().int().nonnegative(), status: z.enum(['reserved', 'launching', 'started', 'cancelled']),
  lease_id: uuid.nullable(), lease_expires_at: date.nullable(),
  created_at: date, updated_at: date,
});
type Launch = z.infer<typeof workRuntimeLaunchSchema>;
const success = z.object({ success: z.literal(true) });
const worker = (launch: Launch) => 'openhands:' + launch.remote_conversation_id;

function requireHandoffEnabled() {
  requireRuntimeGatewayEnabled();
  if (process.env.TM_WORK_OPENHANDS_EXECUTION_ENABLED !== 'true') throw new WorkError('WORK_RUNTIME_EXECUTION_DISABLED');
  workRuntimeGatewayBaseUrl();
  const secret = process.env.TM_WORK_MODEL_GATEWAY_SECRET;
  if (!secret || secret.length < 32 || secret.length > 256) throw new WorkError('WORK_GATEWAY_SETUP_REQUIRED');
}
async function readLaunch(id: string, userId?: string): Promise<Launch> {
  let query = workDatabase().from('work_runtime_launches').select('*').eq('id', uuid.parse(id));
  if (userId) query = query.eq('user_id', uuid.parse(userId));
  const { data, error } = await query.maybeSingle();
  const parsed = workRuntimeLaunchSchema.safeParse(data);
  if (error || !parsed.success || parsed.data.id !== id || (userId && parsed.data.user_id !== userId)) throw new WorkError('WORK_RUNTIME_LAUNCH_SETUP_REQUIRED');
  return parsed.data;
}

/** Uses only the approved TM task; no extra hidden instructions or files are
 * inferred. Upload transfer is a separate gate, enforced in reservation SQL. */
export function openHandsTaskMessage(task: WorkTask) {
  const text = 'Carry out this approved TimeMachine Work task in the isolated workspace. Follow the approved plan. '
    + 'Do not claim outputs or actions you have not performed. Tool execution requires user confirmation.\n'
    + JSON.stringify({ goal: task.goal, instructions: task.instructions, approved_plan: task.plan,
      steering: task.thread.filter(turn => turn.role === 'user').slice(-12).map(turn => turn.content) });
  const message = { role: 'user' as const, content: [{ type: 'text', text }], run: false };
  if (Buffer.byteLength(text) > 60000 || Buffer.byteLength(JSON.stringify(message)) > 65536) {
    throw new WorkError('WORK_RUNTIME_PROMPT_TOO_LARGE', 400);
  }
  return message;
}

/** Called only after verified-owner plan approval. This does not provision a
 * sandbox; the runtime connection must already be separately attested. */
export async function approveOpenHandsTask(taskId: string, userId: string, revision: number): Promise<void> {
  uuid.parse(taskId); uuid.parse(userId); z.number().int().nonnegative().parse(revision);
  requireHandoffEnabled();
  if (!process.env.TRIGGER_SECRET_KEY) throw new WorkError('WORK_RUNTIME_LAUNCH_SETUP_REQUIRED');
  await requireWorkEntitlement(userId);
  const task = await readWorkTask(taskId, userId);
  if (task.id !== taskId || task.user_id !== userId) throw new WorkError('WORK_NOT_FOUND', 404);
  if (!task.plan) throw new WorkError('WORK_STATE_CHANGED', 409);
  openHandsTaskMessage(task); // Validate byte bounds before creating a reservation.
  const connection = await readWorkExecutionConnection(userId);
  const { data, error } = await workDatabase().rpc('work_runtime_reserve', {
    p_task: taskId, p_user: userId, p_revision: revision, p_connection: connection.id, p_conversation: randomUUID(),
  });
  if (error) throw new WorkError('WORK_RUNTIME_LAUNCH_SETUP_REQUIRED');
  if (!data) throw new WorkError('WORK_STATE_CHANGED', 409);
  const launch = workRuntimeLaunchSchema.parse(data);
  if (launch.task_id !== taskId || launch.user_id !== userId || launch.connection_id !== connection.id) throw new WorkError('WORK_RUNTIME_LAUNCH_SETUP_REQUIRED');
  if (launch.status !== 'reserved') return; // A lost response must not restart work.
  try {
    await tasks.trigger<typeof workOpenHandsLaunch>('tm-work-openhands-launch', { launchId: launch.id }, {
      idempotencyKey: 'tm-work-openhands-' + launch.id,
    });
  } catch {
    await abortOpenHandsLaunch(launch.id, userId, 'WORK_RUNTIME_LAUNCH_FAILED').catch(() => {
      console.warn('work_runtime_launch_recovery_required');
    });
    throw new WorkError('WORK_QUEUE_UNAVAILABLE');
  }
}

async function currentLaunch(launch: Launch, leaseId: string) {
  requireHandoffEnabled();
  await requireWorkEntitlement(launch.user_id);
  const task = await readWorkTask(launch.task_id, launch.user_id);
  const current = await readLaunch(launch.id, launch.user_id);
  const connection = await readWorkExecutionConnection(launch.user_id);
  if (task.id !== launch.task_id || task.user_id !== launch.user_id || task.status !== 'running'
    || task.generation !== launch.generation || task.worker_id !== worker(launch)
    || current.status !== 'launching' || current.lease_id !== leaseId || !current.lease_expires_at
    || Date.parse(current.lease_expires_at) <= Date.now() || current.task_id !== launch.task_id
    || current.generation !== launch.generation || current.remote_conversation_id !== launch.remote_conversation_id
    || current.connection_id !== launch.connection_id || connection.id !== launch.connection_id) {
    throw new WorkError('WORK_STATE_CHANGED', 409);
  }
  return { task, connection };
}

/** One claimed launch, no automatic mutation replay. Real Agent Server API
 * operations are performed here, not a native simulated coding loop. */
export async function runOpenHandsLaunch(launchId: string): Promise<void> {
  requireHandoffEnabled();
  const original = await readLaunch(launchId);
  const leaseId = randomUUID();
  const { data, error } = await workDatabase().rpc('work_runtime_launch_claim', { p_launch: original.id, p_lease: leaseId });
  if (error) throw new WorkError('WORK_RUNTIME_LAUNCH_SETUP_REQUIRED');
  if (!data) return; // Duplicate, cancelled or already started delivery.
  const parsed = workRuntimeLaunchSchema.safeParse(data);
  if (!parsed.success || parsed.data.id !== original.id || parsed.data.user_id !== original.user_id
    || parsed.data.task_id !== original.task_id || parsed.data.connection_id !== original.connection_id
    || parsed.data.remote_conversation_id !== original.remote_conversation_id || parsed.data.generation !== original.generation
    || parsed.data.status !== 'launching' || parsed.data.lease_id !== leaseId) throw new WorkError('WORK_RUNTIME_LAUNCH_SETUP_REQUIRED');
  const launch = parsed.data;
  try {
    let context = await currentLaunch(launch, leaseId);
    const grant = await issueWorkRuntimeGrant(launch.task_id, launch.user_id);
    const claims = verifyWorkRuntimeGrant(grant.apiKey);
    const payload = await prepareOpenHandsLaunch(launch.task_id, launch.user_id, grant.apiKey);
    context = await currentLaunch(launch, leaseId);
    await authorizeWorkRuntimeGrant(claims);
    const created = await workUpstreamJson(context.connection, '/api/conversations', { method: 'POST', body: payload });
    const expected = { model: payload.agent.llm.model, baseUrl: payload.agent.llm.base_url };
    verifyOpenHandsLaunchResponse(created, launch.remote_conversation_id, launch.task_id, expected);
    context = await currentLaunch(launch, leaseId);
    await authorizeWorkRuntimeGrant(claims);
    const root = '/api/conversations/' + launch.remote_conversation_id;
    success.parse(await workUpstreamJson(context.connection, root + '/events', { method: 'POST', body: openHandsTaskMessage(context.task) }));
    context = await currentLaunch(launch, leaseId);
    await authorizeWorkRuntimeGrant(claims);
    verifyOpenHandsLaunchResponse(await workUpstreamJson(context.connection, root), launch.remote_conversation_id, launch.task_id, expected);
    // Recheck after network I/O before starting. AlwaysConfirm is a runtime
    // gate; the prompt is not relied upon to enforce tool authorization.
    context = await currentLaunch(launch, leaseId);
    await authorizeWorkRuntimeGrant(claims);
    success.parse(await workUpstreamJson(context.connection, root + '/run', { method: 'POST', body: {} }));
    await currentLaunch(launch, leaseId);
    await authorizeWorkRuntimeGrant(claims);
    const saved = await workDatabase().rpc('work_runtime_launch_started', { p_launch: launch.id, p_lease: leaseId });
    if (saved.error || saved.data !== true) throw new WorkError('WORK_RUNTIME_LAUNCH_SETUP_REQUIRED');
  } catch {
    await abortOpenHandsLaunch(launch.id, launch.user_id, 'WORK_RUNTIME_LAUNCH_FAILED').catch(() => {
      console.warn('work_runtime_launch_recovery_required');
    });
    throw new WorkError('WORK_RUNTIME_LAUNCH_FAILED');
  }
}

/** Cancellation/recovery does not require billing or the execution flag. */
export async function abortOpenHandsLaunch(launchId: string, userId: string, reason: 'WORK_RUNTIME_LAUNCH_FAILED' | 'WORK_RUNTIME_LAUNCH_ABANDONED') {
  const launch = await readLaunch(launchId, userId);
  const { data, error } = await workDatabase().rpc('work_runtime_launch_abort', { p_launch: launch.id, p_user: userId, p_error: reason });
  if (error || data !== true) throw new WorkError('WORK_RUNTIME_LAUNCH_SETUP_REQUIRED');
  await deliverOpenHandsStop(launch.task_id, launch.user_id, launch.generation).catch(() => {
    console.warn('work_runtime_stop_delivery_pending');
  });
}

/** Worker failure hook derives owner from the private ledger, never a payload. */
export async function failOpenHandsLaunch(launchId: string) {
  const launch = await readLaunch(launchId);
  if (launch.status !== 'started') await abortOpenHandsLaunch(launch.id, launch.user_id, 'WORK_RUNTIME_LAUNCH_FAILED');
}

/** Safe recovery policy is cancel, not mutation replay. The RPC rechecks the
 * deadline under lock, so a stale scan cannot cancel a newly claimed launch. */
export async function recoverAbandonedOpenHandsLaunches() {
  if (process.env.TM_WORK_RUNTIME_STOP_RECOVERY_ENABLED !== 'true') return { checked: 0, cancelled: 0 };
  const now = new Date().toISOString(), cutoff = new Date(Date.now() - 300000).toISOString();
  const { data, error } = await workDatabase().from('work_runtime_launches').select('*')
    .or('and(status.eq.reserved,created_at.lte.' + cutoff + '),and(status.eq.launching,lease_expires_at.lte.' + now + ')')
    .order('updated_at').limit(5);
  if (error) throw new WorkError('WORK_RUNTIME_LAUNCH_SETUP_REQUIRED');
  const results = await Promise.all((data ?? []).map(async row => {
    const launch = workRuntimeLaunchSchema.safeParse(row);
    if (!launch.success) return false;
    try { await abortOpenHandsLaunch(launch.data.id, launch.data.user_id, 'WORK_RUNTIME_LAUNCH_ABANDONED'); return true; }
    catch { return false; }
  }));
  return { checked: results.length, cancelled: results.filter(Boolean).length };
}
