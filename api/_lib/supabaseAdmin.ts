import type { Database } from '../../src/types/database.js';
import { createClient } from '@supabase/supabase-js';

// The service-role client. It bypasses Row Level Security, so it is for
// genuinely system-level tables (rate_limits, the healthcare catalogue, job
// bookkeeping) — never for reading user-scoped data, which goes through
// createUserScopedClient in auth.ts (production-check.md 0.2).

const supabaseUrl = process.env.VITE_SUPABASE_URL;
if (!supabaseUrl) {
  // Fail fast rather than falling back to a hardcoded project URL: a stale
  // fallback silently points production at the wrong database.
  throw new Error('VITE_SUPABASE_URL is not set.');
}
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  // The anon-key fallback silently loses access to system-level tables. Since
  // rate_limits is RLS-locked to the service role (see
  // supabase/migrations/rate_limits_rls.sql) and checkRateLimit fails closed,
  // running without this key turns every request into a 503 with no obvious
  // cause. Say so at boot rather than leaving it to be diagnosed from traffic.
  console.error(
    'SUPABASE_SERVICE_ROLE_KEY is not set — falling back to the anon key. ' +
    'Rate limiting cannot read rate_limits under RLS and every request will 503.',
  );
}

export const supabaseAdmin = createClient<Database>(supabaseUrl, supabaseServiceKey);
