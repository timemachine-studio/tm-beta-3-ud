-- ============================================================================
-- rate_limits: atomic increments and no duplicate buckets
-- pre-launch-audit.md A.5
--
-- Problem 1: bumpBucket in api/_lib/rateLimit.ts did select → update, so two
-- generations completing at once lost one increment (last writer wins).
--
-- Problem 2: the first-ever charge for a (user, persona) or (ip, persona) did
-- select → insert. Two completing at once inserted two rows, and from then on
-- readBucketCount's maybeSingle() threw on the multi-row result. Because the
-- limiter fails closed, that user (or IP) got 503 on every request until
-- someone deleted a row by hand.
--
-- This file adds the unique indexes that make the second row impossible, and
-- one function that does the whole read-reset-increment in a single statement
-- so concurrent charges serialise on the row lock instead of racing. The
-- application calls the function when it exists and falls back to the old
-- path when it does not, so applying this is safe at any time — but until it
-- is applied, neither fix is in effect.
--
-- Run in the Supabase SQL editor with a privileged role.
-- ============================================================================

-- Collapse any duplicates that already exist, keeping the most recent window.
delete from public.rate_limits a
using public.rate_limits b
where a.persona = b.persona
  and a.user_id is not distinct from b.user_id
  and a.ip_address is not distinct from b.ip_address
  and (a.window_start < b.window_start or (a.window_start = b.window_start and a.id < b.id));

create unique index if not exists rate_limits_user_persona_key
  on public.rate_limits (user_id, persona)
  where user_id is not null;

create unique index if not exists rate_limits_ip_persona_key
  on public.rate_limits (ip_address, persona)
  where ip_address is not null;

-- Charge (or, with a negative amount, refund) one bucket in a single statement.
-- Resets the 24-hour window when it has expired; never lets a refund drive the
-- count below zero. Returns the count after the change.
create or replace function public.bump_rate_limit(
  p_persona text,
  p_user_id uuid,
  p_ip_address text,
  p_amount integer
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  if p_user_id is null and p_ip_address is null then
    raise exception 'bump_rate_limit: one of p_user_id or p_ip_address is required';
  end if;

  if p_user_id is not null then
    insert into public.rate_limits (user_id, ip_address, persona, message_count, window_start, updated_at)
    values (p_user_id, null, p_persona, greatest(p_amount, 0), now(), now())
    on conflict (user_id, persona) where user_id is not null
    do update set
      message_count = case
        when public.rate_limits.window_start < now() - interval '24 hours' then greatest(p_amount, 0)
        else greatest(public.rate_limits.message_count + p_amount, 0)
      end,
      window_start = case
        when public.rate_limits.window_start < now() - interval '24 hours' then now()
        else public.rate_limits.window_start
      end,
      updated_at = now()
    returning message_count into v_count;
  else
    insert into public.rate_limits (user_id, ip_address, persona, message_count, window_start, updated_at)
    values (null, p_ip_address, p_persona, greatest(p_amount, 0), now(), now())
    on conflict (ip_address, persona) where ip_address is not null
    do update set
      message_count = case
        when public.rate_limits.window_start < now() - interval '24 hours' then greatest(p_amount, 0)
        else greatest(public.rate_limits.message_count + p_amount, 0)
      end,
      window_start = case
        when public.rate_limits.window_start < now() - interval '24 hours' then now()
        else public.rate_limits.window_start
      end,
      updated_at = now()
    returning message_count into v_count;
  end if;

  return v_count;
end;
$$;

-- Only the service role may call it; the table itself is already locked to
-- the service role (rate_limits_rls.sql).
revoke all on function public.bump_rate_limit(text, uuid, text, integer) from public, anon, authenticated;
grant execute on function public.bump_rate_limit(text, uuid, text, integer) to service_role;

-- ─── Verify ─────────────────────────────────────────────────────────────────
--   select indexname from pg_indexes where tablename = 'rate_limits';
--   select public.bump_rate_limit('default', null, '__verify__', 1);  -- 1
--   select public.bump_rate_limit('default', null, '__verify__', 1);  -- 2
--   select public.bump_rate_limit('default', null, '__verify__', -5); -- 0
--   delete from public.rate_limits where ip_address = '__verify__';
