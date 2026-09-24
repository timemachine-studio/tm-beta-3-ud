-- PRO privacy boundary: Trigger.dev receives only an opaque job id.
-- The fully prepared request is staged here, claimed exactly once by the
-- service-role worker, and erased in the same transaction before model work.

alter table public.pro_generation_jobs
  add column if not exists request_payload jsonb,
  add column if not exists request_claimed_at timestamptz;

create or replace function public.claim_pro_generation_payload(p_job_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payload jsonb;
begin
  select request_payload
    into v_payload
    from public.pro_generation_jobs
   where id = p_job_id
     and status = 'running'
     and request_payload is not null
     and created_at > now() - interval '2 hours'
   for update;

  if v_payload is null then
    return null;
  end if;

  update public.pro_generation_jobs
     set request_payload = null,
         request_claimed_at = now()
   where id = p_job_id;

  return v_payload;
end;
$$;

revoke all on function public.claim_pro_generation_payload(uuid) from public;
revoke all on function public.claim_pro_generation_payload(uuid) from anon;
revoke all on function public.claim_pro_generation_payload(uuid) from authenticated;
grant execute on function public.claim_pro_generation_payload(uuid) to service_role;

-- All application reads already go through authenticated API routes. Removing
-- this direct policy prevents a future client query from selecting the
-- transient request_payload column while it is waiting to be claimed.
drop policy if exists "pro_generation_jobs_select_own" on public.pro_generation_jobs;

comment on column public.pro_generation_jobs.request_payload is
  'Transient prepared PRO request; atomically erased when the worker claims it.';
comment on function public.claim_pro_generation_payload(uuid) is
  'Service-role-only destructive claim for a prepared PRO request.';
