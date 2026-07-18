import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Shared store for TimeMachine PRO background generation jobs.
// Used by the Vercel API routes and by the Trigger.dev task.

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://etpehiyzlkhknzceizar.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

let cachedClient: SupabaseClient | null = null;

function getClient(): SupabaseClient {
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
    throw new Error(`Failed to create PRO generation job: ${error.message}`);
  }

  return data as ProGenerationJob;
}

export async function attachProJobRunId(jobId: string, runId: string): Promise<void> {
  const { error } = await getClient()
    .from('pro_generation_jobs')
    .update({ run_id: runId })
    .eq('id', jobId);

  if (error) {
    console.error('[PRO jobs] Failed to attach run id:', error);
  }
}

export async function completeProJob(jobId: string, finalContent: string): Promise<void> {
  const { error } = await getClient()
    .from('pro_generation_jobs')
    .update({ status: 'completed', final_content: finalContent })
    .eq('id', jobId);

  if (error) {
    console.error('[PRO jobs] Failed to mark job completed:', error);
  }
}

export async function failProJob(jobId: string, message: string): Promise<void> {
  const { error } = await getClient()
    .from('pro_generation_jobs')
    .update({ status: 'failed', error: message.slice(0, 2000) })
    .eq('id', jobId);

  if (error) {
    console.error('[PRO jobs] Failed to mark job failed:', error);
  }
}

export async function getProJobByRunId(runId: string): Promise<ProGenerationJob | null> {
  const { data, error } = await getClient()
    .from('pro_generation_jobs')
    .select('*')
    .eq('run_id', runId)
    .maybeSingle();

  if (error) {
    console.error('[PRO jobs] Lookup by run id failed:', error);
    return null;
  }

  return (data as ProGenerationJob) ?? null;
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
    console.error('[PRO jobs] Active job lookup failed:', error);
    return null;
  }

  return (data as ProGenerationJob) ?? null;
}
