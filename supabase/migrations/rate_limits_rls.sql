-- ============================================================================
-- rate_limits: lock the table to the service role
-- production-check.md 0.4 follow-up
--
-- Problem: the table was readable with the public anon key. Verified against
-- the live project — an unauthenticated PostgREST request returned full rows,
-- exposing every user_id and IP address that has used the app, plus each one's
-- usage count. If writes were also open, a user could reset their own counter
-- and the limit would mean nothing.
--
-- Nothing in the browser bundle touches this table. The only reader/writer is
-- api/ai-proxy.ts (checkRateLimit / incrementRateLimit / getRemainingQuota) and
-- api/delete-account.ts, both server-side. The client gets its remaining count
-- from GET /api/ai-proxy?quota=<persona> instead.
--
-- The service role bypasses RLS, so enabling RLS with no permissive policy for
-- anon/authenticated denies the public roles and leaves the server unaffected.
--
-- ⚠ AFTER APPLYING THIS: SUPABASE_SERVICE_ROLE_KEY must be set wherever the API
--   runs, including local dev. api/ai-proxy.ts falls back to the anon key when
--   it is unset, and with this policy in place that fallback can no longer read
--   the table — checkRateLimit fails closed and every request returns 503.
-- ============================================================================

alter table public.rate_limits enable row level security;
alter table public.rate_limits force row level security;

-- Drop any permissive policy that may already exist from an earlier setup.
do $$
declare
  policy_name text;
begin
  for policy_name in
    select policyname from pg_policies
    where schemaname = 'public' and tablename = 'rate_limits'
  loop
    execute format('drop policy if exists %I on public.rate_limits', policy_name);
  end loop;
end $$;

-- No policy is created on purpose. With RLS enabled and zero policies, anon and
-- authenticated get nothing; the service role still has full access because it
-- bypasses RLS entirely.

-- Belt and braces: revoke the table grants PostgREST relies on, so the public
-- roles cannot reach it even if a permissive policy is added by mistake later.
revoke all on public.rate_limits from anon, authenticated;

-- ─── Verify ─────────────────────────────────────────────────────────────────
-- Expect rowsecurity = true and zero rows from pg_policies:
--
--   select relrowsecurity as rls_enabled, relforcerowsecurity as forced
--   from pg_class where oid = 'public.rate_limits'::regclass;
--
--   select count(*) as policy_count from pg_policies
--   where schemaname = 'public' and tablename = 'rate_limits';
--
-- Then, from a shell, confirm the anon key is refused (expect [] or a 401/403,
-- never rows):
--
--   curl -s -H "apikey: $VITE_SUPABASE_ANON_KEY" \
--     "$VITE_SUPABASE_URL/rest/v1/rate_limits?select=id&limit=1"
