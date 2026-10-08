import { z } from 'zod';
import { tasks, runs } from '@trigger.dev/sdk';
import type { VercelRequest, VercelResponse } from '../vercelTypes.js';
import { getAuthenticatedRequestUser, createUserScopedClient, getRequestAccessToken } from '../auth.js';
import { applyCors, hasAcceptableOrigin } from '../cors.js';
import { rejectIfTooLarge } from '../validation.js';
import { ACTIVE_WORK_STATUSES, workRequestSchema, workTaskSchema, type WorkTask } from '../../../shared/work.js';
import { checkpoint, readWorkTask, requireWorkEntitlement, workCapabilities, workDatabase, WorkError, workSnapshot } from './store.js';
import type { workGeneration } from '../../../trigger/workGeneration.js';
import { workIntegrationNameSchema } from '../../../shared/workIntegrations.js';
import { readWorkConnectionStatuses, readWorkIntegration } from './integrations.js';
import { cancelOpenHandsTask, deliverOpenHandsStop, isOpenHandsWorker } from './runtimeStop.js';
import { approveOpenHandsTask } from './runtimeHandoff.js';
import { readWorkHermes } from './hermes.js';

const ERROR_MESSAGES: Record<string, string> = {
  WORK_SETUP_REQUIRED: 'Work is not configured on this server yet.',
  WORK_PREMIUM_REQUIRED: 'Work is available to premium TimeMachine accounts.',
  WORK_NOT_FOUND: 'This task is not available in your account.',
  WORK_STATE_CHANGED: 'The task changed. Refresh it and try again.',
  WORK_ACTIVE_TASK_EXISTS: 'Finish or stop your active Work task before starting another.',
  WORK_SESSION_UNAVAILABLE: 'The chat could not be saved. Your draft is still here.',
  WORK_QUEUE_UNAVAILABLE: 'The background worker could not start. Your task is saved; revise it to retry.',
  WORK_SOURCE_READ_ONLY: 'Original uploads are read-only. Edit a generated file instead.',
  WORK_INTEGRATION_SETUP_REQUIRED: 'This connection needs administrator setup. Your saved task is unchanged.',
  WORK_UPSTREAM_UNAVAILABLE: 'The connected service is unavailable. Your TimeMachine task is preserved.',
  WORK_UPSTREAM_INVALID_RESPONSE: 'The connected service returned an incompatible response.',
  WORK_UPSTREAM_TIMEOUT: 'The connected service timed out. Try again shortly.',
  WORK_EVENT_CURSOR_EXPIRED: 'This event page expired or the task changed. Check the connection again for current events.',
  WORK_RUNTIME_STOP_SETUP_REQUIRED: 'Remote stop needs administrator recovery. Do not assume the sandbox has stopped.',
  WORK_RUNTIME_STEERING_UNAVAILABLE: 'Remote steering is not enabled yet. Stop this run before requesting a new plan.',
  WORK_RUNTIME_APPROVAL_UNAVAILABLE: 'Remote tool approval is not enabled yet. This action cannot start a native worker for a remote task.',
  WORK_RUNTIME_EXECUTION_DISABLED: 'Hosted OpenHands execution is not enabled on this server yet.',
  WORK_RUNTIME_LAUNCH_SETUP_REQUIRED: 'The isolated runtime needs administrator setup. No native fallback was started.',
  WORK_RUNTIME_LAUNCH_FAILED: 'Runtime launch was not confirmed. Stop this task; remote pause may need administrator recovery.',
  WORK_RUNTIME_PROMPT_TOO_LARGE: 'The approved plan and instructions are too large for this runtime. Shorten them before approving.',
};
async function enqueue(task: WorkTask) {
  try {
    if (process.env.TM_WORK_ENABLED !== 'true' || !process.env.TRIGGER_SECRET_KEY) throw new WorkError('WORK_SETUP_REQUIRED');
    const handle = await tasks.trigger<typeof workGeneration>('tm-work-generation', { taskId: task.id, generation: task.generation }, { idempotencyKey: `work-${task.id}-${task.generation}` });
    // A fast worker may already have changed state: attach only if still queued.
    await workDatabase().from('work_tasks').update({ worker_id: handle.id }).eq('id', task.id).eq('user_id', task.user_id).eq('status', 'queued').eq('generation', task.generation);
  } catch {
    await checkpoint(task, ['queued'], { status: 'failed', error: 'WORK_QUEUE_UNAVAILABLE' }, 'run.failed', 'Could not start the background worker', undefined, task.revision).catch(() => undefined);
    throw new WorkError('WORK_QUEUE_UNAVAILABLE');
  }
}
export default async function handler(req: VercelRequest, res: VercelResponse) {
  applyCors(req, res, 'GET, POST, OPTIONS');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (!['GET', 'POST'].includes(req.method ?? '')) return res.status(405).json({ error: { code: 'METHOD_NOT_ALLOWED', message: 'Use GET or POST.' } });
  if (!hasAcceptableOrigin(req)) return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Origin not allowed.' } });
  const user = await getAuthenticatedRequestUser(req);
  try {
    if (req.method === 'GET' && req.query.capabilities === '1') return res.status(200).json(await workCapabilities(user?.id ?? null));
    if (!user) return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Sign in to use Work.' } });
    if (req.method === 'GET') {
      await requireWorkEntitlement(user.id);
      if (req.query.hermes === '1') return res.status(200).json(await readWorkHermes(user.id));
      if (req.query.connections === '1') return res.status(200).json(await readWorkConnectionStatuses(user.id));
      if (req.query.integration !== undefined) {
        const service = workIntegrationNameSchema.parse(req.query.integration);
        const id = z.uuid().parse(req.query.taskId);
        const cursor = req.query.eventCursor === undefined ? undefined : z.string().min(1).max(3010).parse(req.query.eventCursor);
        return res.status(200).json(await readWorkIntegration(id, user.id, service, cursor));
      }
      if (req.query.taskId) {
        const id = z.uuid().parse(req.query.taskId);
        return res.status(200).json(await workSnapshot(id, user.id));
      }
      const sessionId = req.query.sessionId ? z.uuid().parse(req.query.sessionId) : null;
      let query = workDatabase().from('work_tasks').select('*').eq('user_id', user.id).order('updated_at', { ascending: false }).limit(30);
      if (sessionId) query = query.eq('session_id', sessionId);
      const { data, error } = await query;
      if (error) throw new WorkError('WORK_STORAGE_UNAVAILABLE');
      return res.status(200).json({ tasks: (data ?? []).map(row => workTaskSchema.parse(row)) });
    }
    if (rejectIfTooLarge(req, res)) return;
    const body = workRequestSchema.parse(req.body);
    // Stopping owned work remains available when premium expires. All other
    // operations still require the server-owned entitlement.
    if (body.action !== 'cancel') await requireWorkEntitlement(user.id);
    if (body.action === 'create') {
      if (process.env.TM_WORK_ENABLED !== 'true' || !process.env.TRIGGER_SECRET_KEY) throw new WorkError('WORK_SETUP_REQUIRED');
      const db = workDatabase();
      // The request ID is the task ID. Retrying a timed-out POST never creates
      // a second billable task, even if the first response was lost.
      const { data: duplicate, error: duplicateError } = await db.from('work_tasks').select('*').eq('id', body.requestId).eq('user_id', user.id).maybeSingle();
      if (duplicateError) throw new WorkError('WORK_STORAGE_UNAVAILABLE');
      if (duplicate) return res.status(200).json(await workSnapshot(duplicate.id, user.id));
      const accessToken = getRequestAccessToken(req);
      const scoped = accessToken ? createUserScopedClient(accessToken) : null;
      if (!scoped) throw new WorkError('WORK_SESSION_UNAVAILABLE');
      const { data: session, error: sessionError } = await scoped.from('chat_sessions').select('id').eq('id', body.sessionId).eq('user_id', user.id).maybeSingle();
      if (sessionError) throw new WorkError('WORK_SESSION_UNAVAILABLE');
      if (!session) {
        const { error } = await scoped.from('chat_sessions').insert({ id: body.sessionId, user_id: user.id, name: 'Work: ' + body.goal.slice(0, 60), persona: body.persona });
        if (error) throw new WorkError('WORK_SESSION_UNAVAILABLE');
      }
      const { data: row, error } = await db.from('work_tasks').insert({
        id: body.requestId, user_id: user.id, session_id: body.sessionId,
        goal: body.goal, instructions: body.instructions, persona: body.persona,
        title: body.goal.slice(0, 120), thread: [{ role: 'user', content: body.goal, at: new Date().toISOString() }],
      }).select('*').single();
      if (error || !row) throw new WorkError(error?.code === '23505' ? 'WORK_ACTIVE_TASK_EXISTS' : 'WORK_WRITE_FAILED', error?.code === '23505' ? 409 : 503);
      const task = workTaskSchema.parse(row);
      if (body.files.length) {
        const { error } = await db.from('work_files').insert(body.files.map(file => ({ ...file, task_id: task.id, source: true })));
        if (error) {
          await checkpoint(task, ['queued'], { status: 'failed', error: 'WORK_SOURCE_UPLOAD_FAILED' }, 'run.failed', 'Source upload failed');
          throw new WorkError('WORK_WRITE_FAILED');
        }
      }
      await enqueue(task);
      return res.status(202).json(await workSnapshot(task.id, user.id));
    }
    let task = await readWorkTask(body.taskId, user.id);
    switch (body.action) {
      case 'approve':
        if (body.runtime === 'openhands') {
          await approveOpenHandsTask(task.id, user.id, body.revision);
          break;
        }
        if (isOpenHandsWorker(task.worker_id)) throw new WorkError('WORK_RUNTIME_APPROVAL_UNAVAILABLE', 409);
        if (!task.plan) throw new WorkError('WORK_STATE_CHANGED', 409);
        task = await checkpoint(task, ['review'], { status: 'queued', error: null, worker_id: null, generation: task.generation + 1 }, 'permission.approved', 'You approved the plan', undefined, body.revision);
        await enqueue(task);
        break;
      case 'cancel': {
        if (isOpenHandsWorker(task.worker_id)) {
          task = await cancelOpenHandsTask(task);
          // Cancellation is durable first. Delivery is best effort here; the
          // saved outbox needs a trusted recovery scheduler for unattended retry.
          await deliverOpenHandsStop(task.id, task.user_id, task.generation).catch(() => {
            console.warn('work_runtime_stop_delivery_pending');
          });
          break;
        }
        if (task.status === 'cancelled') break;
        task = await checkpoint(task, ACTIVE_WORK_STATUSES, { status: 'cancelled' }, 'run.cancelled', 'You stopped the task');
        if (task.worker_id) await runs.cancel(task.worker_id).catch(() => undefined);
        break;
      }
      case 'steer': {
        // A local thread append is not a delivered remote steering message.
        // Never silently restart native execution while a remote agent survives.
        if (isOpenHandsWorker(task.worker_id)) throw new WorkError('WORK_RUNTIME_STEERING_UNAVAILABLE', 409);
        // Steering while executing is appended, not a second parallel worker.
        const active = ['queued', 'planning', 'running'].includes(task.status);
        const append_turn = { role: 'user', content: body.message, at: new Date().toISOString() };
        if (task.thread.length >= 70) throw new WorkError('WORK_THREAD_LIMIT', 422);
        task = await checkpoint(task, ['queued', 'planning', 'review', 'running', 'completed', 'failed', 'cancelled'], active ? { append_turn } : { status: 'queued', plan: null, step_index: 0, summary: null, error: null, worker_id: null, generation: task.generation + 1, append_turn }, 'user.steering', active ? 'You added direction for the next step' : 'You requested a revised plan', undefined, body.revision);
        if (!active) await enqueue(task);
        break;
      }
      case 'save_file': {
        const snapshot = await workSnapshot(task.id, user.id);
        const file = snapshot.files.find(file => file.path === body.path);
        if (!file) throw new WorkError('WORK_NOT_FOUND', 404);
        if (file.source) throw new WorkError('WORK_SOURCE_READ_ONLY', 403);
        await checkpoint(task, ['review', 'completed', 'failed', 'cancelled'], {}, 'artifact.updated', 'You edited ' + file.path, { path: file.path, kind: file.kind, content: body.content, expected_revision: body.revision });
        break;
      }
    }
    return res.status(200).json(await workSnapshot(task.id, user.id));
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: { code: 'WORK_INVALID_INPUT', message: 'Check the task input, file paths and size limits.' } });
    const code = error instanceof WorkError ? error.code : 'WORK_UNAVAILABLE';
    console.error('work_request_failed', code);
    return res.status(error instanceof WorkError ? error.status : 503).json({ error: { code, message: ERROR_MESSAGES[code] ?? 'Work could not complete this request. Your saved task and files are preserved.' } });
  }
}
