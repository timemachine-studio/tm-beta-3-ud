-- Apply after work_model_gateway.sql. No automatic deployment.
begin;
create table if not exists public.work_runtime_stops (
  task_id uuid not null, user_id uuid not null, generation int not null check (generation >= 0),
  worker_id text not null check (worker_id ~ '^openhands:[0-9a-f-]{36}$'),
  connection_id uuid, remote_conversation_id uuid not null,
  status text not null check (status in ('pending','blocked','acknowledged')),
  attempts int not null default 0 check (attempts >= 0),
  lease_id uuid, lease_expires_at timestamptz, next_attempt_at timestamptz not null default now(),
  last_error text check (last_error in ('WORK_RUNTIME_STOP_SETUP_REQUIRED','WORK_RUNTIME_STOP_UNCONFIRMED','WORK_UPSTREAM_UNAVAILABLE')),
  created_at timestamptz not null default now(), acknowledged_at timestamptz,
  primary key (task_id,generation),
  foreign key (task_id,user_id) references public.work_tasks(id,user_id) on delete cascade,
  foreign key (connection_id,user_id) references public.work_service_connections(id,user_id),
  check (worker_id = 'openhands:' || remote_conversation_id::text),
  check ((lease_id is null) = (lease_expires_at is null)),
  check (status = 'blocked' or connection_id is not null),
  check ((status = 'acknowledged') = (acknowledged_at is not null))
);
create index if not exists work_runtime_stops_due on public.work_runtime_stops(next_attempt_at)
  where status = 'pending';
alter table public.work_runtime_stops enable row level security;
revoke all on public.work_runtime_stops from public, anon, authenticated;
grant all on public.work_runtime_stops to service_role;

-- Cancellation never requires a current premium entitlement. Owner comes from
-- verified auth in the API, or a trusted recovery worker, never a request body.
create or replace function public.work_runtime_cancel(p_task uuid,p_user uuid,p_generation int,p_worker text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare t public.work_tasks; b public.work_runtime_bindings; remote_id uuid; bound boolean;
begin
  if p_worker is null or p_generation is null or p_worker !~ '^openhands:[0-9a-f-]{36}$' then return null; end if;
  begin remote_id := substring(p_worker from 11)::uuid; exception when invalid_text_representation then return null; end;
  select * into t from public.work_tasks where id=p_task and user_id=p_user for update;
  if not found or t.generation <> p_generation or t.worker_id is distinct from p_worker
    or t.status not in ('queued','planning','review','running','cancelled') then return null; end if;
  select * into b from public.work_runtime_bindings where task_id=p_task and user_id=p_user for update;
  bound := found and b.remote_conversation_id = remote_id;
  -- Cancelled state already denies every gateway response, including in-flight
  -- completions. Explicitly revoke the nonce too; do not reuse it on recovery.
  update public.work_runtime_bindings set gateway_grant_id=null,gateway_expires_at=null,gateway_generation=null
    where task_id=p_task and user_id=p_user;
  if t.status <> 'cancelled' then
    update public.work_tasks set status='cancelled',revision=revision+1,updated_at=now()
      where id=p_task returning * into t;
    insert into public.work_events(task_id,sequence,type,title) values(p_task,t.revision,'runtime.stop_requested',
      case when bound then 'Stopped TM model access; remote agent pause requested'
        else 'Stopped TM model access; remote pause needs administrator recovery' end);
  end if;
  insert into public.work_runtime_stops(task_id,user_id,generation,worker_id,connection_id,remote_conversation_id,status,last_error)
    values(p_task,p_user,p_generation,p_worker,case when bound then b.connection_id else null end,remote_id,
      case when bound then 'pending' else 'blocked' end,case when bound then null else 'WORK_RUNTIME_STOP_SETUP_REQUIRED' end)
    on conflict (task_id,generation) do nothing;
  return to_jsonb(t);
end $$;

create or replace function public.work_runtime_stop_claim(p_task uuid,p_user uuid,p_generation int,p_lease uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare s public.work_runtime_stops; t public.work_tasks;
begin
  if p_lease is null then return null; end if;
  -- Same task -> outbox lock order as cancel/finish avoids deadlocks.
  select * into t from public.work_tasks where id=p_task and user_id=p_user for update;
  if not found then return null; end if;
  select * into s from public.work_runtime_stops where task_id=p_task and user_id=p_user and generation=p_generation for update;
  if not found or s.status <> 'pending' or s.next_attempt_at > now()
    or (s.lease_id is not null and s.lease_expires_at > now()) then return null; end if;
  -- Refuse a changed task rather than pausing a replacement run by mistake.
  if t.status <> 'cancelled' or t.generation <> p_generation or t.worker_id is distinct from s.worker_id then return null; end if;
  update public.work_runtime_stops set lease_id=p_lease,lease_expires_at=now()+interval '60 seconds',attempts=attempts+1
    where task_id=p_task and generation=p_generation returning * into s;
  return to_jsonb(s);
end $$;

create or replace function public.work_runtime_stop_finish(p_task uuid,p_user uuid,p_generation int,p_lease uuid,p_ack boolean,p_error text)
returns boolean language plpgsql security definer set search_path=public as $$
declare s public.work_runtime_stops; t public.work_tasks;
begin
  if p_lease is null or p_ack is null or (not p_ack and (p_error is null or p_error not in
    ('WORK_RUNTIME_STOP_SETUP_REQUIRED','WORK_RUNTIME_STOP_UNCONFIRMED','WORK_UPSTREAM_UNAVAILABLE'))) then return false; end if;
  select * into t from public.work_tasks where id=p_task and user_id=p_user for update;
  if not found then return false; end if;
  select * into s from public.work_runtime_stops where task_id=p_task and user_id=p_user and generation=p_generation for update;
  if not found or s.status <> 'pending' or s.lease_id is null or s.lease_id is distinct from p_lease or s.lease_expires_at <= now()
    or t.status <> 'cancelled' or t.generation <> p_generation or t.worker_id is distinct from s.worker_id then return false; end if;
  update public.work_runtime_stops set status=case when p_ack then 'acknowledged' else 'pending' end,
    last_error=case when p_ack then null else p_error end,
    acknowledged_at=case when p_ack then now() else null end,
    lease_id=null,lease_expires_at=null,next_attempt_at=now()+interval '60 seconds'
    where task_id=p_task and generation=p_generation;
  -- Redacted activity identifies pending delivery; never report transport
  -- failure as a successful remote stop. No raw endpoint/command/key is stored.
  update public.work_tasks set revision=revision+1,updated_at=now() where id=p_task returning * into t;
  insert into public.work_events(task_id,sequence,type,title) values(p_task,t.revision,
    case when p_ack then 'runtime.pause_acknowledged' else 'runtime.pause_pending' end,
    case when p_ack then 'Remote agent pause confirmed; sandbox cleanup is separate'
      else 'Remote pause is unconfirmed; the saved stop request needs retry' end);
  return true;
end $$;
revoke all on function public.work_runtime_cancel(uuid,uuid,int,text),public.work_runtime_stop_claim(uuid,uuid,int,uuid),
  public.work_runtime_stop_finish(uuid,uuid,int,uuid,boolean,text) from public,anon,authenticated;
grant execute on function public.work_runtime_cancel(uuid,uuid,int,text),public.work_runtime_stop_claim(uuid,uuid,int,uuid),
  public.work_runtime_stop_finish(uuid,uuid,int,uuid,boolean,text) to service_role;
commit;
