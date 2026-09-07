import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { getAuthenticatedRequestUser } from './_lib/auth.js';
import { applyCors, hasAcceptableOrigin } from './_lib/cors.js';

// ─── Account deletion ───────────────────────────────────────────────────────
// POST /api/delete-account — purges everything we hold for the caller and then
// removes the auth user itself. Required by the privacy policy
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
type AdminClient = ReturnType<typeof createAdminClient>;

// Tables holding user-scoped rows, keyed by user_id. Children before parents so
// a foreign key does not block the delete.
const USER_TABLES = [
  'chat_messages',
  'chat_sessions',
  'ai_memories',
  'user_images',
  'user_music',
  'pro_generation_jobs',
  'rate_limits',
] as const;

const STORAGE_BUCKETS = ['user-images', 'music-assets'] as const;

async function purgeBucket(
  admin: AdminClient,
  bucket: string,
  userId: string,
): Promise<void> {
  // Uploads are stored under a per-user prefix.
  const { data, error } = await admin.storage.from(bucket).list(userId, { limit: 1000 });
  if (error || !data?.length) return;

  const paths = data.map((entry) => `${userId}/${entry.name}`);
  await admin.storage.from(bucket).remove(paths);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  applyCors(req, res, 'POST, OPTIONS');

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

  const failures: string[] = [];

  for (const bucket of STORAGE_BUCKETS) {
    try {
      await purgeBucket(admin, bucket, user.id);
    } catch {
      failures.push(`storage:${bucket}`);
    }
  }

  for (const table of USER_TABLES) {
    const { error } = await admin.from(table).delete().eq('user_id', user.id);
    // A table that does not exist in this project is not a failure to report to
    // the user, but anything else is: we must not claim data was deleted when
    // it was not.
    if (error && !/does not exist|schema cache/i.test(error.message)) {
      failures.push(table);
    }
  }

  const { error: profileError } = await admin.from('profiles').delete().eq('id', user.id);
  if (profileError) failures.push('profiles');

  const { error: authError } = await admin.auth.admin.deleteUser(user.id);
  if (authError) failures.push('auth');

  if (failures.length > 0) {
    console.error(`delete_account_partial user=${user.id} failed=${failures.join(',')}`);
    return res.status(500).json({
      error: 'Some of your data could not be deleted. Please contact support so we can finish the job.',
      incomplete: failures,
    });
  }

  return res.status(200).json({ deleted: true });
}
