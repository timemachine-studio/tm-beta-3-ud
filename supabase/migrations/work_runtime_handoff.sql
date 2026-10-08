-- Apply after work_runtime_lifecycle.sql. No implicit runtime provisioning.
begin;
alter table public.work_service_connections add column if not exists execution_verified_at timestamptz;
alter table public.work_service_connections add constraint work_connection_execution_service
  check (execution_verified_at is null or service='openhands');
comment on column public.work_service_connections.execution_verified_at is
  'Administrator attestation of owner-dedicated isolated Agent Server without host mounts/socket; not an automatic proof.';
-- Revoking connection-level execution attestation revokes all existing model
-- grants too, not merely future launch eligibility.
create or replace function public.work_runtime_revoke_connection() returns trigger
language plpgsql security definer set search_path=public as $$
begin
  if new.execution_verified_at is null or new.scope_verified_at is null or not new.enabled then
    update public.work_runtime_bindings set execution_enabled=false,gateway_grant_id=null,gateway_expires_at=null,gateway_generation=null
      where connection_id=new.id and user_id=new.user_id;
  end if;
  return new;
end $$;
create trigger work_runtime_connection_revoked after update of execution_verified_at,scope_verified_at,enabled
  on public.work_service_connections for each row execute function public.work_runtime_revoke_connection();
revoke all on function public.work_runtime_revoke_connection() from public,anon,authenticated;
create table if not exists public.work_runtime_launches (
  id uuid primary key default gen_random_uuid(), task_id uuid not null, user_id uuid not null,
  connection_id uuid not null, remote_conversation_id uuid not null, generation int not null check(generation>=0),
  status text not null default 'reserved' check(status in ('reserved','launching','started','cancelled')),
  lease_id uuid, lease_expires_at timestamptz,
  error text check(error in ('WORK_RUNTIME_LAUNCH_FAILED','WORK_RUNTIME_LAUNCH_ABANDONED')),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  foreign key(task_id,user_id) references public.work_tasks(id,user_id) on delete cascade,
  foreign key(connection_id,user_id) references public.work_service_connections(id,user_id),
  unique(task_id,generation), unique(connection_id,remote_conversation_id),
  check ((lease_id is null)=(lease_expires_at is null)),
  check (status<>'launching' or lease_id is not null)
);
alter table public.work_runtime_launches enable row level security;
revoke all on public.work_runtime_launches from public,anon,authenticated;
grant all on public.work_runtime_launches to service_role;
create index if not exists work_launch_abandoned on public.work_runtime_launches(lease_expires_at)
  where status='launching';
alter table public.work_runtime_stops add column if not exists resolution text
  check(resolution in ('never_dispatched'));

create or replace function public.work_runtime_reserve(p_task uuid,p_user uuid,p_revision int,p_connection uuid,p_conversation uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare t public.work_tasks; c public.work_service_connections; l public.work_runtime_launches;
begin
  if p_revision is null or p_conversation is null then return null; end if;
  -- Owner-level serialization prevents concurrent launch/stop reservations.
  perform pg_advisory_xact_lock(hashtextextended('tm-work-runtime:'||p_user::text,0));
  select * into t from public.work_tasks where id=p_task and user_id=p_user for update;
  if not found then return null; end if;
  -- An approval-response retry refers to the same previous revision. Never
  -- manufacture a second reservation, even after the first queue response is lost.
  select * into l from public.work_runtime_launches where task_id=p_task and user_id=p_user and generation=t.generation;
  if found and t.revision=p_revision+1 and t.worker_id='openhands:'||l.remote_conversation_id::text then return to_jsonb(l); end if;
  if t.status<>'review' or t.revision<>p_revision or t.plan is null or jsonb_typeof(t.plan)<>'object'
    or exists(select 1 from public.work_runtime_bindings where task_id=p_task)
    or exists(select 1 from public.work_runtime_stops where user_id=p_user and status<>'acknowledged') then return null; end if;
  if not exists(select 1 from public.work_entitlements where user_id=p_user and enabled and (expires_at is null or expires_at>now())) then return null; end if;
  select * into c from public.work_service_connections where id=p_connection and user_id=p_user and service='openhands'
    and enabled and scope_verified_at is not null and execution_verified_at is not null for share;
  if not found then return null; end if;
  -- Upload copying is not implemented yet. Fail closed instead of claiming the
  -- agent can read a source that was never transferred into its sandbox.
  if exists(select 1 from public.work_files where task_id=p_task) then return null; end if;
  update public.work_tasks set status='running',worker_id='openhands:'||p_conversation::text,generation=generation+1,
    error=null,revision=revision+1,updated_at=now() where id=p_task returning * into t;
  insert into public.work_runtime_bindings(task_id,user_id,connection_id,remote_conversation_id,execution_enabled,execution_verified_at)
    values(p_task,p_user,c.id,p_conversation,true,c.execution_verified_at);
  insert into public.work_runtime_launches(task_id,user_id,connection_id,remote_conversation_id,generation)
    values(p_task,p_user,c.id,p_conversation,t.generation) returning * into l;
  insert into public.work_events(task_id,sequence,type,title) values(p_task,t.revision,'runtime.approved','Preparing your approved plan in OpenHands');
  return to_jsonb(l);
end $$;

create or replace function public.work_runtime_launch_claim(p_launch uuid,p_lease uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare l public.work_runtime_launches; t public.work_tasks;
begin
  if p_lease is null then return null; end if;
  select * into l from public.work_runtime_launches where id=p_launch;
  if not found then return null; end if;
  select * into t from public.work_tasks where id=l.task_id and user_id=l.user_id for update;
  if not found then return null; end if;
  select * into l from public.work_runtime_launches where id=p_launch for update;
  if not found then return null; end if;
  if t.id is null or l.status<>'reserved' or t.status<>'running' or t.generation<>l.generation
    or t.worker_id is distinct from 'openhands:'||l.remote_conversation_id::text then return null; end if;
  if not exists(select 1 from public.work_entitlements where user_id=l.user_id and enabled and (expires_at is null or expires_at>now())) then return null; end if;
  update public.work_runtime_launches set status='launching',lease_id=p_lease,lease_expires_at=now()+interval '3 minutes',updated_at=now()
    where id=p_launch returning * into l;
  return to_jsonb(l);
end $$;

create or replace function public.work_runtime_launch_started(p_launch uuid,p_lease uuid)
returns boolean language plpgsql security definer set search_path=public as $$
declare l public.work_runtime_launches; t public.work_tasks;
begin
  if p_lease is null then return false; end if;
  select * into l from public.work_runtime_launches where id=p_launch;
  if not found then return false; end if;
  select * into t from public.work_tasks where id=l.task_id and user_id=l.user_id for update;
  if not found then return false; end if;
  select * into l from public.work_runtime_launches where id=p_launch for update;
  if not found then return false; end if;
  if l.status<>'launching' or l.lease_id is distinct from p_lease or l.lease_expires_at<=now()
    or t.status<>'running' or t.generation<>l.generation or t.worker_id is distinct from 'openhands:'||l.remote_conversation_id::text then return false; end if;
  if not exists(select 1 from public.work_entitlements where user_id=l.user_id and enabled and (expires_at is null or expires_at>now())) then return false; end if;
  if not exists(select 1 from public.work_runtime_bindings b join public.work_service_connections c on c.id=b.connection_id and c.user_id=b.user_id
    where b.task_id=l.task_id and b.user_id=l.user_id and b.connection_id=l.connection_id and b.remote_conversation_id=l.remote_conversation_id
      and b.execution_enabled and b.execution_verified_at is not null and b.gateway_grant_id is not null
      and b.gateway_generation=l.generation and b.gateway_expires_at>now()
      and c.service='openhands' and c.enabled and c.scope_verified_at is not null and c.execution_verified_at is not null) then return false; end if;
  update public.work_runtime_launches set status='started',lease_id=null,lease_expires_at=null,updated_at=now() where id=p_launch;
  update public.work_tasks set revision=revision+1,updated_at=now() where id=t.id returning * into t;
  insert into public.work_events(task_id,sequence,type,title) values(t.id,t.revision,'runtime.started','OpenHands accepted the task; tools still require your confirmation');
  return true;
end $$;

-- Used for queue failures, uncertain network outcomes and abandoned leases.
-- Cancel the assigned task and preserve a pause outbox, never replay mutations.
create or replace function public.work_runtime_launch_abort(p_launch uuid,p_user uuid,p_error text)
returns boolean language plpgsql security definer set search_path=public as $$
declare l public.work_runtime_launches; t public.work_tasks; cancelled jsonb;
begin
  if p_error is null or p_error not in ('WORK_RUNTIME_LAUNCH_FAILED','WORK_RUNTIME_LAUNCH_ABANDONED') then return false; end if;
  select * into l from public.work_runtime_launches where id=p_launch and user_id=p_user;
  if not found then return false; end if;
  select * into t from public.work_tasks where id=l.task_id and user_id=l.user_id for update;
  if not found then return false; end if;
  select * into l from public.work_runtime_launches where id=p_launch and user_id=p_user for update;
  if not found then return false; end if;
  if l.status='cancelled' then return true; end if;
  -- Recovery's earlier scan is not authority: a worker may have claimed the
  -- reservation since then. Recheck abandonment under this row lock.
  if p_error='WORK_RUNTIME_LAUNCH_ABANDONED' and not (
    (l.status='reserved' and l.created_at<=now()-interval '5 minutes') or
    (l.status='launching' and l.lease_expires_at<=now())) then return false; end if;
  if t.generation<>l.generation or t.worker_id is distinct from 'openhands:'||l.remote_conversation_id::text then return false; end if;
  cancelled:=public.work_runtime_cancel(t.id,t.user_id,t.generation,t.worker_id);
  if cancelled is null then return false; end if;
  if l.status='reserved' then
    -- No worker has ever claimed this reservation, and this task/ledger lock
    -- prevents a claim after cancellation. Resolve without pretending a remote
    -- pause occurred, or an uncreated UUID would block all future launches.
    update public.work_runtime_stops set status='acknowledged',acknowledged_at=now(),last_error=null,
      lease_id=null,lease_expires_at=null,resolution='never_dispatched'
      where task_id=l.task_id and user_id=l.user_id and generation=l.generation;
    update public.work_tasks set revision=revision+1,updated_at=now() where id=t.id returning * into t;
    insert into public.work_events(task_id,sequence,type,title) values(t.id,t.revision,'runtime.never_dispatched','Launch cancelled before dispatch; no remote pause was necessary');
  end if;
  update public.work_runtime_launches set status='cancelled',error=p_error,lease_id=null,lease_expires_at=null,updated_at=now() where id=p_launch;
  return true;
end $$;
revoke all on function public.work_runtime_reserve(uuid,uuid,int,uuid,uuid),public.work_runtime_launch_claim(uuid,uuid),
  public.work_runtime_launch_started(uuid,uuid),public.work_runtime_launch_abort(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.work_runtime_reserve(uuid,uuid,int,uuid,uuid),public.work_runtime_launch_claim(uuid,uuid),
  public.work_runtime_launch_started(uuid,uuid),public.work_runtime_launch_abort(uuid,uuid,text) to service_role;
commit;
