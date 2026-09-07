import { purgeUserStorage } from './_lib/retention/accountStorage.js';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { getAuthenticatedRequestUser } from './_lib/auth.js';
import { applyCors, hasAcceptableOrigin } from './_lib/cors.js';

// ─── Account deletion ───────────────────────────────────────────────────────
// POST /api/delete-account — deletes the supported account stores, then
// removes auth only after those deletes succeed. Required by the privacy policy
// (production-check.md 0.8).
//
// This needs the service-role key: a user cannot delete their own auth record,
// and RLS-scoped deletes would leave rows behind in tables the user cannot
// reach. The id is taken from the verified JWT and never from the body.

const supabaseUrlFromEnv = process.env.VITE_SUPABASE_URL;
if (!supabaseUrlFromEnv) {
  throw new Error('VITE_SUPABASE_URL is not set.');
}
const supabaseUrl: string = supabaseUrlFromEnv;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

function createAdminClient() {
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// Tables holding user-scoped rows, keyed by user_id. Children before parents so
// a foreign key does not block the delete.
const USER_TABLES = [
  'mcp_tool_runs',
  'user_flight_control_settings',
  'chat_messages',
  'chat_sessions',
  'ai_memories',
  'user_images',
  'user_music',
  'pro_generation_jobs',
  'rate_limits',
] as const;

const STORAGE_BUCKETS = ['user-images', 'music-assets'] as const;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  applyCors(req, res, 'POST, OPTIONS');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!hasAcceptableOrigin(req)) return res.status(403).json({ error: 'Origin not allowed' });

  const user = await getAuthenticatedRequestUser(req);
  if (!user) return res.status(401).json({ error: 'Sign in is required' });

  if (!serviceRoleKey) {
    console.error('delete_account_unavailable: SUPABASE_SERVICE_ROLE_KEY is not set');
    return res.status(503).json({
      error: 'Account deletion is temporarily unavailable. Please contact support.',
    });
  }

  const admin = createAdminClient();
  // Do not erase the only mapping to processor-held payloads/streams and then
  // claim deletion completed. External deletion must be reconciled first.
  const { data: processorJobs, error: processorError } = await admin.from('pro_generation_jobs')
    .select('id').eq('user_id', user.id).not('run_id', 'is', null).limit(1);
  if (processorError || processorJobs?.length) {
    return res.status(503).json({ error: 'Account deletion needs support to verify background processing data removal. Your account has been kept so the request can be completed.' });
  }

  const failures: string[] = [];

  for (const bucket of STORAGE_BUCKETS) {
    try {
      await purgeUserStorage(admin, bucket, user.id);
    } catch {
      failures.push(`storage:${bucket}`);
    }
  }

  for (const table of USER_TABLES) {
    const { error } = await admin.from(table).delete().eq('user_id', user.id);
    // Missing schema is a failed verification, never proof of deletion.
    if (error) {
      failures.push(table);
    }
  }

  if (failures.length > 0) {
    console.error(`delete_account_partial user=${user.id} failed=${failures.join(',')}`);
    return res.status(500).json({
      error: 'Some of your data could not be deleted. Please contact support so we can finish the job.',
      incomplete: failures,
    });
  }

  const { error: profileError } = await admin.from('profiles').delete().eq('id', user.id);
  if (profileError) return res.status(503).json({ error: 'Profile deletion failed. Your account has been kept; retry or contact support.' });
  const { error: authError } = await admin.auth.admin.deleteUser(user.id);
  if (authError) return res.status(503).json({ error: 'Sign-in account deletion failed. Please retry or contact support.' });
  return res.status(200).json({ deleted: true });
}
