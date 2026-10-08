import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { workActivitySchema, workFileSchema, workTaskSchema, workTraceSchema, type WorkCapabilities, type WorkSnapshot, type WorkStatus, type WorkTask } from '../../../shared/work.js';

export class WorkError extends Error {
  constructor(public code: string, public status = 503) { super(code); }
}
let client: SupabaseClient | undefined;
export function workDatabase(): SupabaseClient {
  if (!process.env.VITE_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) throw new WorkError('WORK_SETUP_REQUIRED');
  return client ??= createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
}
export async function hasWorkEntitlement(userId: string): Promise<boolean> {
  const { data, error } = await workDatabase().from('work_entitlements').select('enabled,expires_at').eq('user_id', userId).maybeSingle();
  if (error) throw new WorkError('WORK_SETUP_REQUIRED');
  return Boolean(data?.enabled && (!data.expires_at || Date.parse(data.expires_at) > Date.now()));
}
export async function requireWorkEntitlement(userId: string): Promise<void> {
  if (!await hasWorkEntitlement(userId)) throw new WorkError('WORK_PREMIUM_REQUIRED', 403);
}
export async function workCapabilities(userId: string | null): Promise<WorkCapabilities> {
  const background = Boolean(process.env.TRIGGER_SECRET_KEY && process.env.TM_WORK_ENABLED === 'true');
  const base = { cloud: background, local: true, background, openhands: false, agenta: false };
  if (!userId) return { ...base, access: 'sign_in', message: 'Sign in to check your Work access.' };
  try {
    const allowed = await hasWorkEntitlement(userId);
    if (!allowed) return { ...base, access: 'premium', message: 'Work is for premium TimeMachine accounts. Subscription checkout is not available yet.' };
    const { error } = await workDatabase().from('work_tasks').select('id').eq('user_id', userId).limit(1);
    if (error) return { ...base, access: 'setup', message: 'Work needs its database migration applied by the TM administrator.' };
    return { ...base, access: 'allowed', message: background ? null : 'Cloud Work needs its background worker enabled by the TM administrator. Local Work is available.' };
  } catch { return { ...base, access: 'setup', message: 'Work is not configured on this server yet.' }; }
}
/** System-role queries always carry the owner established by verified auth. */
export async function readWorkTask(id: string, userId: string): Promise<WorkTask> {
  const { data, error } = await workDatabase().from('work_tasks').select('*').eq('id', id).eq('user_id', userId).maybeSingle();
  if (error) throw new WorkError('WORK_STORAGE_UNAVAILABLE');
  if (!data) throw new WorkError('WORK_NOT_FOUND', 404);
  return workTaskSchema.parse(data);
}
export async function workSnapshot(id: string, userId: string): Promise<WorkSnapshot> {
  const task = await readWorkTask(id, userId);
  const db = workDatabase();
  const [files, events, traces] = await Promise.all([
    db.from('work_files').select('*').eq('task_id', task.id).order('path').limit(24),
    db.from('work_events').select('*').eq('task_id', task.id).order('sequence', { ascending: false }).limit(200),
    db.from('work_model_calls').select('id,phase,provider,model,outcome,latency_ms,input_tokens,output_tokens,estimated_cost,config_version,created_at').eq('task_id', task.id).order('created_at').limit(100),
  ]);
  if (files.error || events.error || traces.error) throw new WorkError('WORK_STORAGE_UNAVAILABLE');
  return { task, files: (files.data ?? []).map(file => workFileSchema.parse(file)), activity: (events.data ?? []).reverse().map(event => workActivitySchema.parse(event)), traces: (traces.data ?? []).map(trace => workTraceSchema.parse(trace)) };
}
export async function checkpoint(
  task: Pick<WorkTask, 'id' | 'user_id'>, statuses: WorkStatus[], patch: Record<string, unknown>,
  type: string, title: string, file?: { path: string; kind: string; content: string; expected_revision?: number }, revision?: number, workerId?: string, generation?: number,
): Promise<WorkTask> {
  const { data, error } = await workDatabase().rpc('work_checkpoint', {
    p_id: task.id, p_user: task.user_id, p_statuses: statuses, p_patch: patch,
    p_type: type, p_title: title, p_file: file ?? null, p_revision: revision ?? null, p_worker: workerId ?? null, p_generation: generation ?? null,
  });
  if (error) throw new WorkError(error.code === '23505' ? 'WORK_ACTIVE_TASK_EXISTS' : 'WORK_WRITE_FAILED', error.code === '23505' ? 409 : 503);
  if (!data) throw new WorkError('WORK_STATE_CHANGED', 409);
  return workTaskSchema.parse(data);
}
