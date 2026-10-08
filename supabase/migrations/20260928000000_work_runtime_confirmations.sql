-- Local proposal only; apply after work_runtime_handoff. No remote delivery.
begin;
create table public.work_runtime_confirmations (
  id uuid primary key default gen_random_uuid(), task_id uuid not null, user_id uuid not null,
  generation int not null check(generation>=0), task_revision int not null check(task_revision>=0),
  connection_id uuid not null, remote_conversation_id uuid not null, grant_id uuid not null,
  fingerprint text not null check(fingerprint ~ '^[a-f0-9]{64}$'),
  tools text[] not null check(cardinality(tools) between 1 and 8
    and array_position(tools,null) is null and tools <@ array['terminal','file_editor','task_tracker','finish']::text[]),
  revision int not null default 1 check(revision>0),
  status text not null default 'pending' check(status in ('pending','decided','invalidated')),
  delivery_status text not null default 'blocked' check(delivery_status='blocked'),
  decision text check(decision in ('approve','reject')), decision_request_id uuid, decided_at timestamptz,
  expires_at timestamptz not null, created_at timestamptz not null default now(),
  foreign key(task_id,user_id) references public.work_tasks(id,user_id) on delete cascade,
  foreign key(connection_id,user_id) references public.work_service_connections(id,user_id),
  unique(task_id,generation,fingerprint), unique(user_id,decision_request_id),
  check((decision is null)=(decision_request_id is null) and (decision is null)=(decided_at is null)),
  check((status<>'pending' or decision is null) and (status<>'decided' or decision is not null))
);
create unique index work_confirmation_one_pending on public.work_runtime_confirmations(task_id,generation) where status='pending';
alter table public.work_runtime_confirmations enable row level security;
revoke all on public.work_runtime_confirmations from public,anon,authenticated;
grant all on public.work_runtime_confirmations to service_role;

-- Always acquire task -> connection -> binding -> entitlement -> review locks.
-- Connection/binding invalidation triggers do not acquire a task lock.
create function public.work_confirmation_authority(p_task uuid,p_user uuid,p_generation int,p_revision int)
returns jsonb language plpgsql security definer set search_path=public as $$
declare t public.work_tasks; b public.work_runtime_bindings; c public.work_service_connections;
begin
  select * into t from public.work_tasks where id=p_task and user_id=p_user for update;
  if not found or t.status<>'running' or t.generation is distinct from p_generation or t.revision is distinct from p_revision then return null; end if;
  select * into b from public.work_runtime_bindings where task_id=p_task and user_id=p_user;
  if not found then return null; end if;
  select * into c from public.work_service_connections where id=b.connection_id and user_id=p_user for share;
  if not found or c.service<>'openhands' or not c.enabled or c.scope_verified_at is null or c.execution_verified_at is null then return null; end if;
  select * into b from public.work_runtime_bindings where task_id=p_task and user_id=p_user for update;
  if not found or b.connection_id<>c.id or not b.execution_enabled or b.execution_verified_at is null
    or b.gateway_grant_id is null or b.gateway_expires_at is null or b.gateway_expires_at<=clock_timestamp()
    or b.gateway_generation is distinct from t.generation or t.worker_id is distinct from 'openhands:'||b.remote_conversation_id::text then return null; end if;
  perform 1 from public.work_entitlements where user_id=p_user and enabled and (expires_at is null or expires_at>clock_timestamp()) for share;
  if not found then return null; end if;
  if not exists(select 1 from public.work_runtime_launches where task_id=p_task and user_id=p_user and generation=t.generation
    and connection_id=b.connection_id and remote_conversation_id=b.remote_conversation_id and status='started') then return null; end if;
  return to_jsonb(b);
end $$;

create function public.work_confirmation_review(p_task uuid,p_user uuid,p_generation int,p_revision int,
  p_connection uuid,p_conversation uuid,p_grant uuid,p_fingerprint text,p_tools text[])
returns jsonb language plpgsql security definer set search_path=public as $$
declare authority jsonb; r public.work_runtime_confirmations;
begin
  if p_fingerprint is null or p_fingerprint !~ '^[a-f0-9]{64}$' or p_tools is null
    or cardinality(p_tools) not between 1 and 8 or array_position(p_tools,null) is not null
    or not p_tools <@ array['terminal','file_editor','task_tracker','finish']::text[] then return null; end if;
  authority:=public.work_confirmation_authority(p_task,p_user,p_generation,p_revision);
  if authority is null or (authority->>'connection_id')::uuid is distinct from p_connection
    or (authority->>'remote_conversation_id')::uuid is distinct from p_conversation
    or (authority->>'gateway_grant_id')::uuid is distinct from p_grant then return null; end if;
  select * into r from public.work_runtime_confirmations where task_id=p_task and user_id=p_user and generation=p_generation and fingerprint=p_fingerprint for update;
  if found then
    if r.status='invalidated' or r.expires_at<=clock_timestamp() or r.task_revision<>p_revision
      or r.connection_id<>p_connection or r.remote_conversation_id<>p_conversation or r.grant_id<>p_grant or r.tools<>p_tools then return null; end if;
    return to_jsonb(r);
  end if;
  if (select count(*) from public.work_runtime_confirmations where task_id=p_task)>=100 then return null; end if;
  update public.work_runtime_confirmations set status='invalidated',revision=revision+1 where task_id=p_task and status<>'invalidated';
  insert into public.work_runtime_confirmations(task_id,user_id,generation,task_revision,connection_id,remote_conversation_id,grant_id,fingerprint,tools,expires_at)
    values(p_task,p_user,p_generation,p_revision,p_connection,p_conversation,p_grant,p_fingerprint,p_tools,
      least(clock_timestamp()+interval '5 minutes',(authority->>'gateway_expires_at')::timestamptz)) returning * into r;
  return to_jsonb(r);
end $$;

create function public.work_confirmation_decide(p_task uuid,p_user uuid,p_review uuid,p_revision int,p_request uuid,
  p_decision text,p_generation int,p_task_revision int)
returns jsonb language plpgsql security definer set search_path=public as $$
declare authority jsonb; r public.work_runtime_confirmations;
begin
  if p_request is null or p_revision is null or p_revision<1 or p_decision is null or p_decision not in ('approve','reject') then return null; end if;
  authority:=public.work_confirmation_authority(p_task,p_user,p_generation,p_task_revision);
  if authority is null then return null; end if;
  select * into r from public.work_runtime_confirmations where id=p_review and task_id=p_task and user_id=p_user for update;
  if not found or r.status='invalidated' or r.expires_at<=clock_timestamp() or r.generation<>p_generation or r.task_revision<>p_task_revision
    or r.connection_id is distinct from (authority->>'connection_id')::uuid
    or r.remote_conversation_id is distinct from (authority->>'remote_conversation_id')::uuid
    or r.grant_id is distinct from (authority->>'gateway_grant_id')::uuid then return null; end if;
  if r.status='decided' then
    if r.revision=p_revision+1 and r.decision=p_decision and r.decision_request_id=p_request then return to_jsonb(r); end if;
    return null;
  end if;
  if r.revision<>p_revision or exists(select 1 from public.work_runtime_confirmations where user_id=p_user and decision_request_id=p_request) then return null; end if;
  update public.work_runtime_confirmations set status='decided',revision=revision+1,decision=p_decision,
    decision_request_id=p_request,decided_at=clock_timestamp() where id=r.id returning * into r;
  return to_jsonb(r);
exception when unique_violation then return null;
end $$;

create function public.work_confirmation_invalidate() returns trigger
language plpgsql security definer set search_path=public as $$
begin
  if tg_table_name='work_tasks' then
    if new.generation is distinct from old.generation or new.revision is distinct from old.revision
      or new.status is distinct from old.status or new.worker_id is distinct from old.worker_id then
      update public.work_runtime_confirmations set status='invalidated',revision=revision+1 where task_id=new.id and status<>'invalidated';
    end if;
  elsif tg_table_name='work_runtime_bindings' then
    if new is distinct from old then
      update public.work_runtime_confirmations set status='invalidated',revision=revision+1 where task_id=new.task_id and status<>'invalidated';
    end if;
  elsif tg_table_name='work_service_connections' then
    update public.work_runtime_confirmations set status='invalidated',revision=revision+1 where connection_id=new.id and status<>'invalidated';
  else
    update public.work_runtime_confirmations set status='invalidated',revision=revision+1 where user_id=new.user_id and status<>'invalidated';
  end if;
  return new;
end $$;
create trigger work_confirmation_task_changed after update of generation,revision,status,worker_id on public.work_tasks
  for each row execute function public.work_confirmation_invalidate();
-- Only authority fields: gateway model-call lease changes must not invalidate a review.
create trigger work_confirmation_binding_changed after update of connection_id,remote_conversation_id,execution_enabled,execution_verified_at,
  gateway_grant_id,gateway_expires_at,gateway_generation on public.work_runtime_bindings for each row execute function public.work_confirmation_invalidate();
create trigger work_confirmation_connection_changed after update of enabled,scope_verified_at,execution_verified_at,base_url,credential_ref,scope_id
  on public.work_service_connections for each row execute function public.work_confirmation_invalidate();
create trigger work_confirmation_entitlement_changed after update of enabled,expires_at on public.work_entitlements
  for each row execute function public.work_confirmation_invalidate();
revoke all on function public.work_confirmation_authority(uuid,uuid,int,int),
  public.work_confirmation_review(uuid,uuid,int,int,uuid,uuid,uuid,text,text[]),
  public.work_confirmation_decide(uuid,uuid,uuid,int,uuid,text,int,int),public.work_confirmation_invalidate() from public,anon,authenticated;
grant execute on function public.work_confirmation_authority(uuid,uuid,int,int),
  public.work_confirmation_review(uuid,uuid,int,int,uuid,uuid,uuid,text,text[]),
  public.work_confirmation_decide(uuid,uuid,uuid,int,uuid,text,int,int) to service_role;
commit;
