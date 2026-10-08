import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import type { WorkTask } from '../../../shared/work.js';
import { readWorkTask, requireWorkEntitlement, workDatabase, WorkError } from './store.js';
import { readWorkConnection } from './upstreamTransport.js';

const claimsSchema = z.object({
  audience: z.literal('tm-work-model'), userId: z.uuid(), taskId: z.uuid(), connectionId: z.uuid(),
  conversationId: z.uuid(), grantId: z.uuid(), generation: z.number().int().nonnegative(),
  persona: z.enum(['default', 'girlie', 'pro']), issuedAt: z.number().int().nonnegative(), expiresAt: z.number().int().nonnegative(),
}).strict();
export type WorkRuntimeGrant = z.infer<typeof claimsSchema>;
const date = z.iso.datetime({ offset: true });
const bindingSchema = z.object({
  task_id: z.uuid(), user_id: z.uuid(), connection_id: z.uuid(), remote_conversation_id: z.uuid(),
  execution_enabled: z.literal(true), execution_verified_at: date,
  gateway_grant_id: z.uuid().nullable(), gateway_expires_at: date.nullable(), gateway_generation: z.number().int().nonnegative().nullable(),
  gateway_lease_id: z.uuid().nullable(), gateway_lease_expires_at: date.nullable(),
});
const bindingFields = 'task_id,user_id,connection_id,remote_conversation_id,execution_enabled,execution_verified_at,gateway_grant_id,gateway_expires_at,gateway_generation,gateway_lease_id,gateway_lease_expires_at';

export const runtimeModelAlias = (persona: WorkTask['persona']) => persona === 'pro' ? 'tm-pro' : persona === 'girlie' ? 'tm-girlie' : 'tm-air';
export function requireRuntimeGatewayEnabled() {
  if (process.env.TM_WORK_UPSTREAM_ENABLED !== 'true' || process.env.TM_WORK_MODEL_GATEWAY_ENABLED !== 'true') throw new WorkError('WORK_GATEWAY_DISABLED', 503);
}
function signingKey() {
  const key = process.env.TM_WORK_MODEL_GATEWAY_SECRET;
  if (!key || key.length < 32 || key.length > 256) throw new WorkError('WORK_GATEWAY_SETUP_REQUIRED', 503);
  return key;
}
function denied(): never { throw new WorkError('WORK_RUNTIME_UNAUTHORIZED', 403); }

/** Scoped credential, not a Supabase JWT or provider key. Never sent to a browser. */
export function verifyWorkRuntimeGrant(token: string): WorkRuntimeGrant {
  requireRuntimeGatewayEnabled();
  const key = signingKey();
  if (token.length > 2000) denied();
  const parts = /^tmw1\.([A-Za-z0-9_-]+)\.([A-Za-z0-9_-]{43})$/.exec(token);
  if (!parts) denied();
  const signature = Buffer.from(parts[2], 'base64url');
  const expected = createHmac('sha256', key).update('tmw1.' + parts[1]).digest();
  if (signature.length !== expected.length || !timingSafeEqual(signature, expected) || signature.toString('base64url') !== parts[2]) denied();
  let claims: WorkRuntimeGrant;
  try {
    const bytes = Buffer.from(parts[1], 'base64url');
    if (bytes.toString('base64url') !== parts[1]) denied();
    claims = claimsSchema.parse(JSON.parse(bytes.toString('utf8')));
  } catch { denied(); }
  const now = Math.floor(Date.now() / 1000);
  if (claims.issuedAt > now + 30 || claims.expiresAt <= now || claims.expiresAt <= claims.issuedAt
    || claims.expiresAt - claims.issuedAt > 900) denied();
  return claims;
}

async function executionContext(taskId: string, userId: string) {
  requireRuntimeGatewayEnabled();
  await requireWorkEntitlement(userId);
  const task = await readWorkTask(taskId, userId);
  const { data, error } = await workDatabase().from('work_runtime_bindings').select(bindingFields)
    .eq('task_id', taskId).eq('user_id', userId).maybeSingle();
  if (error) throw new WorkError('WORK_GATEWAY_SETUP_REQUIRED', 503);
  const parsed = bindingSchema.safeParse(data);
  if (!parsed.success) denied();
  const binding = parsed.data;
  const connection = await readWorkConnection(userId, 'openhands');
  if (!connection || connection.id !== binding.connection_id || binding.user_id !== userId || binding.task_id !== taskId
    || task.user_id !== userId || task.id !== taskId || task.status !== 'running'
    || task.worker_id !== 'openhands:' + binding.remote_conversation_id) denied();
  return { task, binding };
}

export async function authorizeWorkRuntimeGrant(claims: WorkRuntimeGrant, leaseId?: string): Promise<WorkTask> {
  if (claims.expiresAt <= Math.floor(Date.now() / 1000)) denied();
  const { task, binding } = await executionContext(claims.taskId, claims.userId);
  if (binding.connection_id !== claims.connectionId || binding.remote_conversation_id !== claims.conversationId
    || binding.gateway_grant_id !== claims.grantId || binding.gateway_generation !== claims.generation
    || !binding.gateway_expires_at || Date.parse(binding.gateway_expires_at) <= Date.now()
    || task.generation !== claims.generation || task.persona !== claims.persona) denied();
  if (leaseId && (binding.gateway_lease_id !== leaseId || !binding.gateway_lease_expires_at
    || Date.parse(binding.gateway_lease_expires_at) <= Date.now())) denied();
  return task;
}

/** Trusted provisioner helper only. Does NOT hand off a task or start an agent. */
export async function issueWorkRuntimeGrant(taskId: string, userId: string, ttlSeconds = 900) {
  const key = signingKey();
  if (!Number.isInteger(ttlSeconds) || ttlSeconds < 30 || ttlSeconds > 900) throw new WorkError('WORK_RUNTIME_INVALID_GRANT', 400);
  const { task, binding } = await executionContext(z.uuid().parse(taskId), z.uuid().parse(userId));
  if (binding.gateway_lease_id && binding.gateway_lease_expires_at && Date.parse(binding.gateway_lease_expires_at) > Date.now()) throw new WorkError('WORK_RUNTIME_BUSY', 409);
  const issuedAt = Math.floor(Date.now() / 1000);
  const claims = claimsSchema.parse({ audience: 'tm-work-model', taskId, userId, connectionId: binding.connection_id,
    conversationId: binding.remote_conversation_id, grantId: randomUUID(), generation: task.generation, persona: task.persona,
    issuedAt, expiresAt: issuedAt + ttlSeconds });
  const expiresAt = new Date(claims.expiresAt * 1000).toISOString();
  let update = workDatabase().from('work_runtime_bindings').update({ gateway_grant_id: claims.grantId,
    gateway_expires_at: expiresAt, gateway_generation: task.generation })
    .eq('task_id', taskId).eq('user_id', userId).eq('connection_id', binding.connection_id)
    .eq('remote_conversation_id', binding.remote_conversation_id).eq('execution_enabled', true);
  update = binding.gateway_grant_id ? update.eq('gateway_grant_id', binding.gateway_grant_id) : update.is('gateway_grant_id', null);
  update = binding.gateway_lease_id ? update.eq('gateway_lease_id', binding.gateway_lease_id) : update.is('gateway_lease_id', null);
  const { data, error } = await update.select('task_id').maybeSingle();
  if (error || data?.task_id !== taskId) throw new WorkError('WORK_RUNTIME_BUSY', 409);
  const payload = Buffer.from(JSON.stringify(claims)).toString('base64url');
  const signature = createHmac('sha256', key).update('tmw1.' + payload).digest('base64url');
  return { apiKey: 'tmw1.' + payload + '.' + signature, model: runtimeModelAlias(task.persona), expiresAt };
}

export async function claimWorkRuntimeLease(claims: WorkRuntimeGrant): Promise<string> {
  const leaseId = randomUUID();
  const { data, error } = await workDatabase().rpc('work_gateway_claim', { p_task: claims.taskId, p_user: claims.userId,
    p_grant: claims.grantId, p_generation: claims.generation, p_lease: leaseId });
  if (error) throw new WorkError('WORK_GATEWAY_SETUP_REQUIRED', 503);
  if (data !== true) throw new WorkError('WORK_RUNTIME_BUSY', 409);
  return leaseId;
}
export async function releaseWorkRuntimeLease(claims: WorkRuntimeGrant, leaseId: string): Promise<void> {
  try {
    const { error } = await workDatabase().rpc('work_gateway_release', { p_task: claims.taskId, p_user: claims.userId, p_lease: leaseId });
    if (error) console.warn('work_gateway_lease_release_failed');
  } catch { console.warn('work_gateway_lease_release_failed'); }
}
