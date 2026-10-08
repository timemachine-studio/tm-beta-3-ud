import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { workTaskSchema, type WorkTask } from '../../../shared/work.js';
import { readWorkTask, workDatabase, WorkError } from './store.js';
import { readWorkConnection, workUpstreamJson } from './upstreamTransport.js';

const uuid = z.uuid();
const date = z.iso.datetime({ offset: true });
const stopSchema = z.object({
  task_id: uuid, user_id: uuid, generation: z.number().int().nonnegative(), worker_id: z.string().max(200),
  connection_id: uuid, remote_conversation_id: uuid, status: z.literal('pending'),
  lease_id: uuid, lease_expires_at: date,
});
const stoppedConversation = z.object({ id: uuid,
  execution_status: z.enum(['paused', 'finished', 'idle', 'error', 'stuck']),
});
const currentConversation = z.object({ id: uuid,
  execution_status: z.enum(['running', 'waiting_for_confirmation', 'paused', 'finished', 'idle', 'error', 'stuck']),
});

export function isOpenHandsWorker(workerId: string | null | undefined) {
  // Malformed OpenHands IDs also belong to this path; never send them to Trigger.
  return Boolean(workerId?.startsWith('openhands:'));
}
export function openHandsWorkerConversation(workerId: string | null | undefined): string {
  if (!workerId?.startsWith('openhands:')) throw new WorkError('WORK_RUNTIME_STOP_SETUP_REQUIRED');
  const parsed = uuid.safeParse(workerId.slice('openhands:'.length));
  if (!parsed.success) throw new WorkError('WORK_RUNTIME_STOP_SETUP_REQUIRED');
  return parsed.data;
}

/** Atomic local cancellation + grant revocation + frozen remote pause outbox. */
export async function cancelOpenHandsTask(task: WorkTask): Promise<WorkTask> {
  openHandsWorkerConversation(task.worker_id);
  const { data, error } = await workDatabase().rpc('work_runtime_cancel', {
    p_task: task.id, p_user: task.user_id, p_generation: task.generation, p_worker: task.worker_id,
  });
  if (error) throw new WorkError('WORK_RUNTIME_STOP_SETUP_REQUIRED');
  if (!data) throw new WorkError('WORK_STATE_CHANGED', 409);
  const parsed = workTaskSchema.safeParse(data);
  if (!parsed.success || parsed.data.id !== task.id || parsed.data.user_id !== task.user_id
    || parsed.data.status !== 'cancelled' || parsed.data.generation !== task.generation
    || parsed.data.worker_id !== task.worker_id) throw new WorkError('WORK_RUNTIME_STOP_SETUP_REQUIRED');
  return parsed.data;
}

/** Trusted recovery helper. No entitlement gate: stopping must remain possible
 * after billing expires. The API establishes owner; a scheduler must do so too.
 * Returns false unless delivery and the durable acknowledgment both succeeded. */
export async function deliverOpenHandsStop(taskId: string, userId: string, generation: number): Promise<boolean> {
  uuid.parse(taskId); uuid.parse(userId);
  if (!Number.isInteger(generation) || generation < 0) return false;
  // Disabled means no outbound request, not a successful remote pause.
  if (process.env.TM_WORK_UPSTREAM_ENABLED !== 'true') return false;
  const leaseId = randomUUID();
  const { data, error } = await workDatabase().rpc('work_runtime_stop_claim', {
    p_task: taskId, p_user: userId, p_generation: generation, p_lease: leaseId,
  });
  if (error) throw new WorkError('WORK_RUNTIME_STOP_SETUP_REQUIRED');
  if (!data) return false;
  const parsed = stopSchema.safeParse(data);
  if (!parsed.success || parsed.data.task_id !== taskId || parsed.data.user_id !== userId
    || parsed.data.generation !== generation || parsed.data.lease_id !== leaseId
    || Date.parse(parsed.data.lease_expires_at) <= Date.now()) throw new WorkError('WORK_RUNTIME_STOP_SETUP_REQUIRED');
  const stop = parsed.data;
  let acknowledged = false;
  let failure = 'WORK_UPSTREAM_UNAVAILABLE';
  try {
    if (openHandsWorkerConversation(stop.worker_id) !== stop.remote_conversation_id) throw new WorkError('WORK_RUNTIME_STOP_SETUP_REQUIRED');
    // Recheck after claiming: don't pause an old run after a replacement starts.
    const task = await readWorkTask(taskId, userId);
    if (task.status !== 'cancelled' || task.generation !== generation || task.worker_id !== stop.worker_id
      || task.id !== taskId || task.user_id !== userId) throw new WorkError('WORK_RUNTIME_STOP_SETUP_REQUIRED');
    const connection = await readWorkConnection(userId, 'openhands');
    if (!connection || connection.id !== stop.connection_id) throw new WorkError('WORK_RUNTIME_STOP_SETUP_REQUIRED');
    const path = '/api/conversations/' + stop.remote_conversation_id;
    // A previous pause may have succeeded even if its response/audit write was
    // lost. Read first; do not depend on POST being idempotent across SDK versions.
    const current = currentConversation.safeParse(await workUpstreamJson(connection, path));
    if (!current.success || current.data.id !== stop.remote_conversation_id) throw new WorkError('WORK_RUNTIME_STOP_UNCONFIRMED');
    if (!stoppedConversation.safeParse(current.data).success) {
      const result = z.object({ success: z.literal(true) }).safeParse(await workUpstreamJson(connection, path + '/pause', { method: 'POST', body: {} }));
      if (!result.success) throw new WorkError('WORK_RUNTIME_STOP_UNCONFIRMED');
      const state = stoppedConversation.safeParse(await workUpstreamJson(connection, path));
      if (!state.success || state.data.id !== stop.remote_conversation_id) throw new WorkError('WORK_RUNTIME_STOP_UNCONFIRMED');
    }
    acknowledged = true;
  } catch (err) {
    failure = err instanceof WorkError && ['WORK_RUNTIME_STOP_SETUP_REQUIRED', 'WORK_RUNTIME_STOP_UNCONFIRMED'].includes(err.code)
      ? err.code : 'WORK_UPSTREAM_UNAVAILABLE';
  }
  // A failed write/response cannot erase the outbox. Lease expiry permits retry;
  // a new attempt reads remote state before attempting another pause.
  try {
    const { data: saved, error: saveError } = await workDatabase().rpc('work_runtime_stop_finish', {
      p_task: taskId, p_user: userId, p_generation: generation, p_lease: leaseId,
      p_ack: acknowledged, p_error: acknowledged ? null : failure,
    });
    return !saveError && saved === true && acknowledged;
  } catch { return false; }
}
