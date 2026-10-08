import { createHmac } from 'node:crypto';
import { z } from 'zod';
import { readWorkTask, requireWorkEntitlement, workDatabase, WorkError } from './store.js';
import { readWorkExecutionConnection } from './upstreamTransport.js';

const uuid = z.uuid(), integer = z.number().int().nonnegative(), date = z.iso.datetime({ offset: true });
const eventId = z.string().regex(/^[A-Za-z0-9_-]{1,96}$/);
const tool = z.enum(['terminal', 'file_editor', 'task_tracker', 'finish']);
const digest = z.string().regex(/^[a-f0-9]{64}$/);
const action = z.object({
  id: eventId, kind: z.literal('ActionEvent'), source: z.literal('agent'), tool_name: tool,
  tool_call_id: eventId,
  tool_call: z.object({ id: eventId, type: z.literal('function'), function: z.object({ name: tool, arguments: z.string().max(32000) }) }),
  action: z.record(z.string(), z.unknown()),
});
/** Internal trusted-runtime snapshot contract, NOT an upstream response schema
 * or browser input. A future adapter must prove complete active-branch capture;
 * passing recent event search results here is expressly unsupported. */
const snapshot = z.object({
  conversationId: uuid, headId: eventId, executionStatus: z.literal('waiting_for_confirmation'),
  confirmationPolicy: z.literal('AlwaysConfirm'), actions: z.array(action).min(1).max(8),
}).strict();
const kinds = { terminal: 'TerminalAction', file_editor: 'FileEditorAction', task_tracker: 'TaskTrackerAction', finish: 'FinishAction' } as const;

function invalid(): never { throw new WorkError('WORK_CONFIRMATION_INVALID_SNAPSHOT', 502); }
function canonical(value: unknown, depth = 0, budget = { nodes: 0 }): string {
  if (depth > 10 || ++budget.nodes > 2000) invalid();
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'number' && Number.isFinite(value)) return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(item => canonical(item, depth + 1, budget)).join(',') + ']';
  if (value && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype) {
    return '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + canonical((value as Record<string, unknown>)[key], depth + 1, budget)).join(',') + '}';
  }
  invalid();
}
/** HMAC avoids exposing low-entropy command contents through guessable hashes.
 * Raw arguments/reasoning/commands never leave memory or enter the ledger. */
export function fingerprintWorkConfirmation(raw: unknown) {
  const secret = process.env.TM_WORK_CONFIRMATION_SECRET;
  if (!secret || secret.length < 32 || secret.length > 256) throw new WorkError('WORK_CONFIRMATION_SETUP_REQUIRED');
  let encoded: string;
  try { encoded = canonical(raw); } catch { invalid(); }
  if (Buffer.byteLength(encoded) > 131072) invalid();
  const parsed = snapshot.safeParse(raw);
  if (!parsed.success) invalid();
  const value = parsed.data, ids = new Set<string>(), calls = new Set<string>();
  for (const item of value.actions) {
    if (ids.has(item.id) || calls.has(item.tool_call_id) || item.tool_call.id !== item.tool_call_id
      || item.tool_call.function.name !== item.tool_name || item.action.kind !== kinds[item.tool_name]) invalid();
    ids.add(item.id); calls.add(item.tool_call_id);
    let argumentsValue: unknown;
    try { argumentsValue = JSON.parse(item.tool_call.function.arguments); } catch { invalid(); }
    if (!argumentsValue || typeof argumentsValue !== 'object' || Array.isArray(argumentsValue)) invalid();
    canonical(argumentsValue); canonical(item.action);
  }
  const fingerprint = createHmac('sha256', secret).update('tm-work-confirmation-v1\0').update(canonical({
    conversationId: value.conversationId, headId: value.headId,
    // Order matters: the SDK executes pending actions chronologically.
    actions: value.actions.map(item => ({ id: item.id, tool: item.tool_name, callId: item.tool_call_id,
      arguments: JSON.parse(item.tool_call.function.arguments), action: item.action })),
  })).digest('hex');
  return { fingerprint, tools: value.actions.map(item => item.tool_name), conversationId: value.conversationId };
}

const binding = z.object({ task_id: uuid, user_id: uuid, connection_id: uuid, remote_conversation_id: uuid,
  execution_enabled: z.literal(true), execution_verified_at: date, gateway_grant_id: uuid,
  gateway_expires_at: date, gateway_generation: integer });
export const workConfirmationRowSchema = z.object({
  id: uuid, task_id: uuid, user_id: uuid, generation: integer, task_revision: integer,
  connection_id: uuid, remote_conversation_id: uuid, grant_id: uuid, fingerprint: digest,
  tools: z.array(tool).min(1).max(8), revision: z.number().int().positive(),
  status: z.enum(['pending', 'decided', 'invalidated']), delivery_status: z.literal('blocked'),
  decision: z.enum(['approve', 'reject']).nullable(), decision_request_id: uuid.nullable(),
  expires_at: date, created_at: date, decided_at: date.nullable(),
}).refine(value => (value.decision === null) === (value.decision_request_id === null)
  && (value.decision === null) === (value.decided_at === null)
  && (value.status !== 'pending' || value.decision === null)
  && (value.status !== 'decided' || value.decision !== null));
type Confirmation = z.infer<typeof workConfirmationRowSchema>;

async function context(taskId: string, userId: string) {
  if (process.env.TM_WORK_CONFIRMATION_LEDGER_ENABLED !== 'true') throw new WorkError('WORK_CONFIRMATION_DISABLED');
  await requireWorkEntitlement(userId);
  const task = await readWorkTask(uuid.parse(taskId), uuid.parse(userId));
  if (task.id !== taskId || task.user_id !== userId || task.status !== 'running') throw new WorkError('WORK_STATE_CHANGED', 409);
  const connection = await readWorkExecutionConnection(userId);
  const { data, error } = await workDatabase().from('work_runtime_bindings').select('*').eq('task_id', taskId).eq('user_id', userId).maybeSingle();
  const parsed = binding.safeParse(data);
  if (error) throw new WorkError('WORK_CONFIRMATION_SETUP_REQUIRED');
  if (!parsed.success || parsed.data.task_id !== taskId || parsed.data.user_id !== userId
    || parsed.data.connection_id !== connection.id || task.worker_id !== 'openhands:' + parsed.data.remote_conversation_id
    || task.generation !== parsed.data.gateway_generation || Date.parse(parsed.data.gateway_expires_at) <= Date.now()) {
    throw new WorkError('WORK_STATE_CHANGED', 409);
  }
  return { task, binding: parsed.data };
}
function row(raw: unknown, taskId: string, userId: string): Confirmation {
  const parsed = workConfirmationRowSchema.safeParse(raw);
  if (!parsed.success || parsed.data.task_id !== taskId || parsed.data.user_id !== userId
    || parsed.data.status === 'invalidated' || Date.parse(parsed.data.expires_at) <= Date.now()) throw new WorkError('WORK_CONFIRMATION_SETUP_REQUIRED');
  return parsed.data;
}

/** Private persistence only. No remote fetch, run, approval or model call.
 * The normal API/worker does not call this until a trustworthy snapshot adapter exists. */
export async function saveWorkConfirmationReview(taskId: string, userId: string, revision: number, raw: unknown) {
  const current = await context(taskId, userId);
  if (current.task.revision !== revision) throw new WorkError('WORK_STATE_CHANGED', 409);
  const safe = fingerprintWorkConfirmation(raw);
  if (safe.conversationId !== current.binding.remote_conversation_id) invalid();
  const { data, error } = await workDatabase().rpc('work_confirmation_review', {
    p_task: taskId, p_user: userId, p_generation: current.task.generation, p_revision: revision,
    p_connection: current.binding.connection_id, p_conversation: safe.conversationId, p_grant: current.binding.gateway_grant_id,
    p_fingerprint: safe.fingerprint, p_tools: safe.tools,
  });
  if (error) throw new WorkError('WORK_CONFIRMATION_SETUP_REQUIRED');
  if (!data) throw new WorkError('WORK_STATE_CHANGED', 409);
  const saved = row(data, taskId, userId);
  if (saved.generation !== current.task.generation || saved.task_revision !== revision || saved.connection_id !== current.binding.connection_id
    || saved.remote_conversation_id !== safe.conversationId || saved.grant_id !== current.binding.gateway_grant_id
    || saved.fingerprint !== safe.fingerprint || JSON.stringify(saved.tools) !== JSON.stringify(safe.tools)) throw new WorkError('WORK_CONFIRMATION_SETUP_REQUIRED');
  return saved;
}

/** Records intent, NOT delivered authorization. Identical request retries return
 * the saved outcome; a conflicting decision/request cannot overwrite it. */
export async function recordWorkConfirmationDecision(taskId: string, userId: string, reviewId: string,
  revision: number, requestId: string, decision: 'approve' | 'reject') {
  const current = await context(taskId, userId);
  const { data, error } = await workDatabase().rpc('work_confirmation_decide', {
    p_task: taskId, p_user: userId, p_review: uuid.parse(reviewId), p_revision: z.number().int().positive().parse(revision),
    p_request: uuid.parse(requestId), p_decision: z.enum(['approve', 'reject']).parse(decision),
    p_generation: current.task.generation, p_task_revision: current.task.revision,
  });
  if (error) throw new WorkError('WORK_CONFIRMATION_SETUP_REQUIRED');
  if (!data) throw new WorkError('WORK_STATE_CHANGED', 409);
  const saved = row(data, taskId, userId);
  if (saved.id !== reviewId || saved.generation !== current.task.generation || saved.task_revision !== current.task.revision
    || saved.connection_id !== current.binding.connection_id || saved.remote_conversation_id !== current.binding.remote_conversation_id
    || saved.grant_id !== current.binding.gateway_grant_id || saved.status !== 'decided' || saved.revision !== revision + 1
    || saved.decision !== decision || saved.decision_request_id !== requestId) throw new WorkError('WORK_CONFIRMATION_SETUP_REQUIRED');
  return saved;
}
