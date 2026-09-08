import { proContentExpired, RETENTION } from './retention/policy.js';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

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

export async function createProJob(userId: string | null, chatSessionId: string | null): Promise<ProGenerationJob> {
  const { data, error } = await getClient()
    .from('pro_generation_jobs')
    .insert({
      user_id: userId,
      chat_session_id: chatSessionId,
      persona: 'pro',
      status: 'running',
    })
    .select()
    .single();

  if (error) {
    throw new Error('pro_job_create_failed');
  }

  return data as ProGenerationJob;
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
    .update({ status: 'completed', final_content: finalContent, error: null })
    .eq('id', jobId).eq('status', 'running')
    .gt('created_at', new Date(Date.now() - RETENTION.abandonedRunMs).toISOString()).select('id').maybeSingle();

  if (error || !data) throw new Error('pro_job_completion_failed_or_expired');
}

export async function failProJob(jobId: string, _message: string): Promise<void> {
  const { error } = await getClient()
    .from('pro_generation_jobs')
    .update({ status: 'failed', error: 'PRO_GENERATION_FAILED', final_content: null })
    .eq('id', jobId).eq('status', 'running');

  if (error) {
    throw new Error('pro_job_failure_write_failed');
  }
}

export async function getProJobByRunId(runId: string): Promise<ProGenerationJob | null> {
  const { data, error } = await getClient()
    .from('pro_generation_jobs')
    .select('*')
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
    .select('*')
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
