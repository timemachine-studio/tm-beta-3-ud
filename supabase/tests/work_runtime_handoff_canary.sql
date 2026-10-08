-- Explicit staging-only rollback canary. Apply all five Work migrations first.
-- Requires a quiescent staging account/session without an OpenHands connection.
-- Storage/RPC checks only: no runtime requests, credentials or model calls.
begin;
do $$
declare owner_id uuid; session_uuid uuid; task_uuid uuid:=gen_random_uuid();
  connection_uuid uuid:=gen_random_uuid(); remote_uuid uuid:=gen_random_uuid();
  lease_uuid uuid:=gen_random_uuid(); launch_uuid uuid; result jsonb; item text; role_name text;
begin
  select s.user_id,s.id into owner_id,session_uuid from public.chat_sessions s
    where not exists(select 1 from public.work_tasks t where t.user_id=s.user_id and t.status in ('queued','planning','review','running'))
      and not exists(select 1 from public.work_service_connections c where c.user_id=s.user_id and c.service='openhands')
      and not exists(select 1 from public.work_runtime_stops r where r.user_id=s.user_id and r.status<>'acknowledged') limit 1;
  if owner_id is null then raise exception 'Handoff canary needs a quiescent staging account'; end if;
  insert into public.work_entitlements(user_id,enabled,expires_at) values(owner_id,false,null)
    on conflict(user_id) do update set enabled=false,expires_at=null;
  insert into public.work_service_connections(id,user_id,service,base_url,credential_ref,enabled,scope_verified_at)
    values(connection_uuid,owner_id,'openhands','https://handoff-canary.example.invalid',
      'CANARY_'||upper(replace(remote_uuid::text,'-','')),true,now());
  insert into public.work_tasks(id,user_id,session_id,title,goal,persona,status,generation,revision,plan,worker_id)
    values(task_uuid,owner_id,session_uuid,'Handoff canary','Verify approved-plan handoff','pro','review',1,4,
      '{"steps":[{"title":"Produce a draft"}]}','native-canary-worker');
  if public.work_runtime_reserve(task_uuid,owner_id,4,connection_uuid,remote_uuid) is not null then
    raise exception 'Missing entitlement/attestation accepted'; end if;
  update public.work_entitlements set enabled=true where user_id=owner_id;
  if public.work_runtime_reserve(task_uuid,owner_id,4,connection_uuid,remote_uuid) is not null then
    raise exception 'Unattested execution accepted'; end if;
  update public.work_service_connections set execution_verified_at=now() where id=connection_uuid;
  if public.work_runtime_reserve(task_uuid,owner_id,3,connection_uuid,remote_uuid) is not null
    or public.work_runtime_reserve(task_uuid,gen_random_uuid(),4,connection_uuid,remote_uuid) is not null
    or public.work_runtime_reserve(task_uuid,owner_id,4,gen_random_uuid(),remote_uuid) is not null then
    raise exception 'Forged owner/connection or stale review accepted'; end if;
  insert into public.work_files(task_id,path,kind,content,source) values(task_uuid,'source.txt','text','Not transferred',true);
  if public.work_runtime_reserve(task_uuid,owner_id,4,connection_uuid,remote_uuid) is not null then
    raise exception 'Untransferred file accepted'; end if;
  delete from public.work_files where task_id=task_uuid;
  result:=public.work_runtime_reserve(task_uuid,owner_id,4,connection_uuid,remote_uuid);
  if result is null or result->>'status'<>'reserved' or (result->>'generation')::int<>2 then
    raise exception 'Reservation did not invalidate native generation'; end if;
  launch_uuid:=(result->>'id')::uuid;
  if not exists(select 1 from public.work_tasks where id=task_uuid and status='running' and revision=5
    and worker_id='openhands:'||remote_uuid::text) then raise exception 'Task handoff was not atomic'; end if;
  result:=public.work_runtime_reserve(task_uuid,owner_id,4,connection_uuid,gen_random_uuid());
  if result is null or (result->>'id')::uuid<>launch_uuid then raise exception 'Approval retry manufactured a new launch'; end if;
  if public.work_runtime_launch_abort(launch_uuid,owner_id,'WORK_RUNTIME_LAUNCH_ABANDONED') then
    raise exception 'Fresh reservation was considered abandoned'; end if;
  if public.work_runtime_launch_claim(launch_uuid,lease_uuid) is null then raise exception 'Valid claim denied'; end if;
  if public.work_runtime_launch_claim(launch_uuid,gen_random_uuid()) is not null then raise exception 'Duplicate launch claimed'; end if;
  -- Stale recovery scan must not cancel a newly claimed lease.
  update public.work_runtime_launches set created_at=now()-interval '10 minutes' where id=launch_uuid;
  if public.work_runtime_launch_abort(launch_uuid,owner_id,'WORK_RUNTIME_LAUNCH_ABANDONED') then
    raise exception 'Stale recovery cancelled fresh claim'; end if;
  if public.work_runtime_launch_started(launch_uuid,gen_random_uuid())
    or public.work_runtime_launch_started(launch_uuid,lease_uuid) then raise exception 'Wrong lease or missing model grant accepted'; end if;
  update public.work_runtime_bindings set gateway_grant_id=gen_random_uuid(),gateway_expires_at=now()+interval '15 minutes',
    gateway_generation=2 where task_id=task_uuid;
  update public.work_service_connections set scope_verified_at=null where id=connection_uuid;
  if not exists(select 1 from public.work_runtime_bindings where task_id=task_uuid and not execution_enabled and gateway_grant_id is null)
    or public.work_runtime_launch_started(launch_uuid,lease_uuid) then raise exception 'Scope revocation did not revoke launch authority'; end if;
  update public.work_service_connections set scope_verified_at=now() where id=connection_uuid;
  update public.work_runtime_bindings set execution_enabled=true,gateway_grant_id=gen_random_uuid(),
    gateway_expires_at=now()+interval '15 minutes',gateway_generation=2 where task_id=task_uuid;
  update public.work_service_connections set execution_verified_at=null where id=connection_uuid;
  if not exists(select 1 from public.work_runtime_bindings where task_id=task_uuid and not execution_enabled and gateway_grant_id is null)
    or public.work_runtime_launch_started(launch_uuid,lease_uuid) then raise exception 'Execution revocation did not revoke launch authority'; end if;
  update public.work_service_connections set execution_verified_at=now() where id=connection_uuid;
  update public.work_runtime_bindings set execution_enabled=true,execution_verified_at=now(),gateway_grant_id=gen_random_uuid(),
    gateway_expires_at=now()+interval '15 minutes',gateway_generation=2 where task_id=task_uuid;
  if not public.work_runtime_launch_started(launch_uuid,lease_uuid) then raise exception 'Authorized start acknowledgment denied'; end if;
  if public.work_runtime_launch_started(launch_uuid,lease_uuid) then raise exception 'Start acknowledgment replayed'; end if;
  if not public.work_runtime_launch_abort(launch_uuid,owner_id,'WORK_RUNTIME_LAUNCH_FAILED') then raise exception 'Uncertain started task could not be cancelled'; end if;
  if not exists(select 1 from public.work_runtime_stops where task_id=task_uuid and status='pending' and resolution is null)
    or not exists(select 1 from public.work_runtime_bindings where task_id=task_uuid and gateway_grant_id is null) then
    raise exception 'Dispatched launch lost its pause requirement'; end if;
  -- Simulate storage acknowledgment, not a real remote pause, within rollback.
  if public.work_runtime_stop_claim(task_uuid,owner_id,2,lease_uuid) is null
    or not public.work_runtime_stop_finish(task_uuid,owner_id,2,lease_uuid,true,null) then raise exception 'Stop ledger could not be resolved'; end if;
  task_uuid:=gen_random_uuid(); remote_uuid:=gen_random_uuid();
  insert into public.work_tasks(id,user_id,session_id,goal,persona,status,revision,plan)
    values(task_uuid,owner_id,session_uuid,'Check undispatched recovery','default','review',0,'{"steps":[]}');
  result:=public.work_runtime_reserve(task_uuid,owner_id,0,connection_uuid,remote_uuid);
  if result is null then raise exception 'Resolved stop blocked next reservation'; end if;
  launch_uuid:=(result->>'id')::uuid;
  update public.work_runtime_launches set created_at=now()-interval '6 minutes' where id=launch_uuid;
  if not public.work_runtime_launch_abort(launch_uuid,owner_id,'WORK_RUNTIME_LAUNCH_ABANDONED') then raise exception 'Stale reservation not recovered'; end if;
  if not exists(select 1 from public.work_runtime_stops where task_id=task_uuid and status='acknowledged' and resolution='never_dispatched')
    or public.work_runtime_launch_claim(launch_uuid,lease_uuid) is not null then raise exception 'Undispatched cancellation was not proven/resolved'; end if;
  task_uuid:=gen_random_uuid(); remote_uuid:=gen_random_uuid();
  insert into public.work_tasks(id,user_id,session_id,goal,persona,status,revision,plan)
    values(task_uuid,owner_id,session_uuid,'Check expired lease recovery','girlie','review',0,'{"steps":[]}');
  result:=public.work_runtime_reserve(task_uuid,owner_id,0,connection_uuid,remote_uuid);
  launch_uuid:=(result->>'id')::uuid;
  if launch_uuid is null or public.work_runtime_launch_claim(launch_uuid,lease_uuid) is null then raise exception 'Recovery fixture claim denied'; end if;
  update public.work_runtime_launches set lease_expires_at=now()-interval '1 second' where id=launch_uuid;
  if not public.work_runtime_launch_abort(launch_uuid,owner_id,'WORK_RUNTIME_LAUNCH_ABANDONED')
    or not exists(select 1 from public.work_runtime_stops where task_id=task_uuid and status='pending' and resolution is null) then
    raise exception 'Expired dispatched lease was acknowledged without remote proof'; end if;
  foreach role_name in array array['anon','authenticated'] loop
    foreach item in array array['public.work_runtime_reserve(uuid,uuid,integer,uuid,uuid)',
      'public.work_runtime_launch_claim(uuid,uuid)','public.work_runtime_launch_started(uuid,uuid)',
      'public.work_runtime_launch_abort(uuid,uuid,text)','public.work_runtime_revoke_connection()'] loop
      if has_function_privilege(role_name,item,'EXECUTE') then raise exception 'Browser can invoke privileged handoff'; end if;
    end loop;
    if has_table_privilege(role_name,'public.work_runtime_launches','SELECT')
      or has_table_privilege(role_name,'public.work_runtime_launches','INSERT') then raise exception 'Browser can access private launch ledger'; end if;
  end loop;
end $$;
rollback;
