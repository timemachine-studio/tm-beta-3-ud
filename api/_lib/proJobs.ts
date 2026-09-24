import { proContentExpired, RETENTION } from './retention/policy.js';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { ProGenerationPayload } from '../../trigger/proGeneration.js';

// Shared store for TimeMachine PRO background generation jobs.
// Used by the Vercel API routes and by the Trigger.dev task.

const supabaseUrlFromEnv = process.env.VITE_SUPABASE_URL;
if (!supabaseUrlFromEnv) {
  // Fail fast rather than falling back to a hardcoded project URL: a stale
  // fallback silently points production at the wrong database.
  throw new Error('VITE_SUPABASE_URL is not set.');
}
const supabaseUrl: string = supabaseUrlFromEnv;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

let cachedClient: SupabaseClient | null = null;

function getClient(): SupabaseClient {
  if (!supabaseServiceKey) throw new Error('pro_job_storage_unavailable');
  if (!cachedClient) {
    cachedClient = createClient(supabaseUrl, supabaseServiceKey);
  }
  return cachedClient;
}

export type ProJobStatus = 'running' | 'completed' | 'failed';

export interface ProGenerationJob {
  id: string;
  created_at: string;
  updated_at: string;
  user_id: string | null;
  chat_session_id: string | null;
  run_id: string | null;
  persona: string;
  status: ProJobStatus;
  error: string | null;
  final_content: string | null;
}

// Deliberately excludes request_payload. Status and recovery routes must never
// pull a prepared prompt back out of the database after the worker claims it.
const SAFE_JOB_COLUMNS = 'id,created_at,updated_at,user_id,chat_session_id,run_id,persona,status,error,final_content';

export async function createProJob(userId: string | null, chatSessionId: string | null): Promise<ProGenerationJob> {
  const { data, error } = await getClient()
    .from('pro_generation_jobs')
    .insert({
      user_id: userId,
      chat_session_id: chatSessionId,
      persona: 'pro',
      status: 'running',
    })
    .select(SAFE_JOB_COLUMNS)
    .single();

  if (error) {
    throw new Error('pro_job_create_failed');
  }

  return data as ProGenerationJob;
}

/**
 * Stage the prepared request in our transient store. Trigger.dev receives only
 * the opaque job id, so its retained run payload cannot contain prompts,
 * attachment text, tool code, memories, or IP addresses.
 */
export async function storeProJobPayload(jobId: string, payload: ProGenerationPayload): Promise<void> {
  const { data, error } = await getClient()
    .from('pro_generation_jobs')
    .update({ request_payload: payload, request_claimed_at: null })
    .eq('id', jobId)
    .eq('status', 'running')
    .select('id')
    .maybeSingle();

  if (error || !data) throw new Error('pro_job_payload_store_failed');
}

/** Atomically returns and erases the prepared request before model work. */
export async function claimProJobPayload(jobId: string): Promise<ProGenerationPayload> {
  const { data, error } = await getClient().rpc('claim_pro_generation_payload', { p_job_id: jobId });
  if (error || !data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('pro_job_payload_missing_or_expired');
  }
  return { ...(data as unknown as ProGenerationPayload), jobId };
}

export async function attachProJobRunId(jobId: string, runId: string): Promise<void> {
  const { error } = await getClient()
    .from('pro_generation_jobs')
    .update({ run_id: runId })
    .eq('id', jobId);

  if (error) {
    throw new Error('pro_job_attach_failed');
  }
}

export async function completeProJob(jobId: string, finalContent: string): Promise<void> {
  const { data, error } = await getClient()
    .from('pro_generation_jobs')
    .update({ status: 'completed', final_content: finalContent, error: null, request_payload: null })
    .eq('id', jobId).eq('status', 'running')
    .gt('created_at', new Date(Date.now() - RETENTION.abandonedRunMs).toISOString()).select('id').maybeSingle();

  if (error || !data) throw new Error('pro_job_completion_failed_or_expired');
}

export async function failProJob(jobId: string, _message: string): Promise<void> {
  const { error } = await getClient()
    .from('pro_generation_jobs')
    .update({ status: 'failed', error: 'PRO_GENERATION_FAILED', final_content: null, request_payload: null })
    .eq('id', jobId).eq('status', 'running');

  if (error) {
    throw new Error('pro_job_failure_write_failed');
  }
}

export async function getProJobByRunId(runId: string): Promise<ProGenerationJob | null> {
  const { data, error } = await getClient()
    .from('pro_generation_jobs')
    .select(SAFE_JOB_COLUMNS)
    .eq('run_id', runId)
    .maybeSingle();

  if (error) {
    console.error('[PRO jobs] Lookup by run id failed:');
    return null;
  }

  const job = data as ProGenerationJob | null;
  return job && !proContentExpired(job) ? job : null;
}

export async function getActiveProJob(chatSessionId: string, userId: string | null): Promise<ProGenerationJob | null> {
  let query = getClient()
    .from('pro_generation_jobs')
    .select(SAFE_JOB_COLUMNS)
    .eq('chat_session_id', chatSessionId)
    .eq('status', 'running')
    .order('created_at', { ascending: false })
    .limit(1);

  // Logged-in users can only see their own jobs; anonymous jobs are keyed by
  // the unguessable chat session UUID.
  query = userId ? query.eq('user_id', userId) : query.is('user_id', null);

  const { data, error } = await query.maybeSingle();

  if (error) {
    console.error('[PRO jobs] Active job lookup failed:');
    return null;
  }

  const job = data as ProGenerationJob | null;
  return job && !proContentExpired(job) ? job : null;
}
