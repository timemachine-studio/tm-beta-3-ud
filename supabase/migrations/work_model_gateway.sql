-- After work_harness.sql and work_upstream_connections.sql. Not auto-applied.
begin;
alter table public.work_runtime_bindings
  add column if not exists execution_enabled boolean not null default false,
  add column if not exists execution_verified_at timestamptz,
  add column if not exists gateway_grant_id uuid,
  add column if not exists gateway_expires_at timestamptz,
  add column if not exists gateway_generation integer,
  add column if not exists gateway_lease_id uuid,
  add column if not exists gateway_lease_expires_at timestamptz;
alter table public.work_runtime_bindings
  add constraint work_runtime_execution_attested check (not execution_enabled or execution_verified_at is not null),
  add constraint work_runtime_grant_complete check (
    (gateway_grant_id is null and gateway_expires_at is null and gateway_generation is null) or
    (gateway_grant_id is not null and gateway_expires_at is not null and gateway_generation is not null and gateway_generation >= 0)),
  add constraint work_runtime_lease_complete check (
    (gateway_lease_id is null and gateway_lease_expires_at is null) or
    (gateway_lease_id is not null and gateway_lease_expires_at is not null));

-- Serializes runtime model calls across server processes. Lock task first,
-- matching work_checkpoint's order; never extend an existing live lease.
create or replace function public.work_gateway_claim(
  p_task uuid, p_user uuid, p_grant uuid, p_generation integer, p_lease uuid
) returns boolean language plpgsql security definer set search_path = public as $$
declare t public.work_tasks; b public.work_runtime_bindings;
begin
  if p_lease is null then return false; end if;
  select * into t from public.work_tasks where id = p_task and user_id = p_user for update;
  if not found or t.status <> 'running' or t.generation <> p_generation then return false; end if;
  select * into b from public.work_runtime_bindings where task_id = p_task and user_id = p_user for update;
  if not found or not b.execution_enabled or b.execution_verified_at is null
    or b.gateway_grant_id is distinct from p_grant or b.gateway_generation is distinct from p_generation
    or b.gateway_expires_at is null or b.gateway_expires_at <= now()
    or t.worker_id is distinct from ('openhands:' || b.remote_conversation_id::text)
    or (b.gateway_lease_id is not null and b.gateway_lease_expires_at > now()) then return false; end if;
  if not exists (select 1 from public.work_service_connections c where c.id = b.connection_id
    and c.user_id = p_user and c.service = 'openhands' and c.enabled and c.scope_verified_at is not null)
    or not exists (select 1 from public.work_entitlements e where e.user_id = p_user
      and e.enabled and (e.expires_at is null or e.expires_at > now())) then return false; end if;
  update public.work_runtime_bindings set gateway_lease_id = p_lease,
    gateway_lease_expires_at = now() + interval '5 minutes' where task_id = p_task and user_id = p_user;
  return true;
end $$;

create or replace function public.work_gateway_release(p_task uuid, p_user uuid, p_lease uuid)
returns void language sql security definer set search_path = public as $$
  update public.work_runtime_bindings set gateway_lease_id = null, gateway_lease_expires_at = null
    where task_id = p_task and user_id = p_user and gateway_lease_id = p_lease;
$$;
revoke all on function public.work_gateway_claim(uuid,uuid,uuid,integer,uuid) from public, anon, authenticated;
revoke all on function public.work_gateway_release(uuid,uuid,uuid) from public, anon, authenticated;
grant execute on function public.work_gateway_claim(uuid,uuid,uuid,integer,uuid) to service_role;
grant execute on function public.work_gateway_release(uuid,uuid,uuid) to service_role;
comment on column public.work_runtime_bindings.execution_verified_at is
  'Administrator attestation of tenant isolation and approval enforcement; model gateway does not prove sandbox safety.';
comment on column public.work_runtime_bindings.gateway_grant_id is
  'Revocable nonce for short-lived server-to-server model access. Not a provider key.';
commit;
