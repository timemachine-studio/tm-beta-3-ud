-- Explicit staging-only rollback canary. Apply the four Work migrations first.
-- Needs a quiescent test account/session without an OpenHands connection.
-- No remote requests or live model calls. Run manually, never on production.
begin;
do $$
declare owner_id uuid; session_uuid uuid; task_uuid uuid:=gen_random_uuid();
  connection_uuid uuid:=gen_random_uuid(); remote_uuid uuid:=gen_random_uuid();
  grant_uuid uuid:=gen_random_uuid(); lease_one uuid:=gen_random_uuid(); lease_two uuid:=gen_random_uuid();
  worker text; before_revision int; result jsonb;
begin
  select s.user_id,s.id into owner_id,session_uuid from public.chat_sessions s
    where not exists(select 1 from public.work_tasks t where t.user_id=s.user_id and t.status in ('queued','planning','review','running'))
      and not exists(select 1 from public.work_service_connections c where c.user_id=s.user_id and c.service='openhands') limit 1;
  if owner_id is null then raise exception 'Lifecycle canary needs a quiescent staging account without an OpenHands connection'; end if;
  -- Intentionally expired membership: owners must still be able to Stop.
  insert into public.work_entitlements(user_id,enabled,expires_at) values(owner_id,false,now()-interval '1 day')
    on conflict(user_id) do update set enabled=false,expires_at=now()-interval '1 day';
  worker:='openhands:'||remote_uuid::text;
  insert into public.work_tasks(id,user_id,session_id,title,goal,persona,status,generation,worker_id)
    values(task_uuid,owner_id,session_uuid,'Stop canary','Verify durable stop','pro','running',2,worker);
  insert into public.work_service_connections(id,user_id,service,base_url,credential_ref,enabled,scope_verified_at)
    values(connection_uuid,owner_id,'openhands','https://lifecycle-canary.example.invalid/'||remote_uuid::text,
      'CANARY_'||upper(replace(remote_uuid::text,'-','')),true,now());
  insert into public.work_runtime_bindings(task_id,user_id,connection_id,remote_conversation_id,execution_enabled,execution_verified_at,
    gateway_grant_id,gateway_expires_at,gateway_generation)
    values(task_uuid,owner_id,connection_uuid,remote_uuid,true,now(),grant_uuid,now()+interval '5 minutes',2);
  if public.work_runtime_cancel(task_uuid,gen_random_uuid(),2,worker) is not null
    or public.work_runtime_cancel(task_uuid,owner_id,3,worker) is not null
    or public.work_runtime_cancel(task_uuid,owner_id,2,'openhands:'||gen_random_uuid()::text) is not null then
    raise exception 'Forged stop scope accepted'; end if;
  result:=public.work_runtime_cancel(task_uuid,owner_id,2,worker);
  if result is null or result->>'status'<>'cancelled' then raise exception 'Owner cancellation denied'; end if;
  before_revision:=(result->>'revision')::int;
  if not exists(select 1 from public.work_runtime_bindings where task_id=task_uuid and gateway_grant_id is null
    and gateway_expires_at is null and gateway_generation is null) then raise exception 'Grant was not revoked'; end if;
  if not exists(select 1 from public.work_runtime_stops where task_id=task_uuid and generation=2 and status='pending'
    and connection_id=connection_uuid and remote_conversation_id=remote_uuid) then raise exception 'Frozen stop target not saved'; end if;
  result:=public.work_runtime_cancel(task_uuid,owner_id,2,worker);
  if (result->>'revision')::int<>before_revision then raise exception 'Stop retry duplicated cancellation'; end if;
  if public.work_runtime_stop_claim(task_uuid,gen_random_uuid(),2,lease_one) is not null
    or public.work_runtime_stop_claim(task_uuid,owner_id,3,lease_one) is not null then raise exception 'Forged lease scope accepted'; end if;
  if public.work_runtime_stop_claim(task_uuid,owner_id,2,lease_one) is null then raise exception 'Valid stop lease denied'; end if;
  if public.work_runtime_stop_claim(task_uuid,owner_id,2,lease_two) is not null then raise exception 'Concurrent stop lease accepted'; end if;
  if public.work_runtime_stop_finish(task_uuid,owner_id,2,null,true,null)
    or public.work_runtime_stop_finish(task_uuid,owner_id,2,lease_two,true,null) then raise exception 'Wrong/null stop lease accepted'; end if;
  if not public.work_runtime_stop_finish(task_uuid,owner_id,2,lease_one,false,'WORK_UPSTREAM_UNAVAILABLE') then raise exception 'Failure could not be journaled'; end if;
  if not exists(select 1 from public.work_runtime_stops where task_id=task_uuid and status='pending' and lease_id is null
    and last_error='WORK_UPSTREAM_UNAVAILABLE' and next_attempt_at>now()) then raise exception 'Failed delivery was lost or acknowledged'; end if;
  update public.work_runtime_stops set next_attempt_at=now() where task_id=task_uuid;
  if public.work_runtime_stop_claim(task_uuid,owner_id,2,lease_two) is null then raise exception 'Delivery retry denied'; end if;
  if not public.work_runtime_stop_finish(task_uuid,owner_id,2,lease_two,true,null) then raise exception 'Delivery acknowledgment denied'; end if;
  if public.work_runtime_stop_claim(task_uuid,owner_id,2,lease_one) is not null then raise exception 'Acknowledged stop was redelivered'; end if;
  if has_function_privilege('authenticated','public.work_runtime_cancel(uuid,uuid,integer,text)','EXECUTE')
    or has_function_privilege('anon','public.work_runtime_cancel(uuid,uuid,integer,text)','EXECUTE')
    or has_function_privilege('authenticated','public.work_runtime_stop_claim(uuid,uuid,integer,uuid)','EXECUTE')
    or has_function_privilege('anon','public.work_runtime_stop_claim(uuid,uuid,integer,uuid)','EXECUTE')
    or has_function_privilege('authenticated','public.work_runtime_stop_finish(uuid,uuid,integer,uuid,boolean,text)','EXECUTE')
    or has_function_privilege('anon','public.work_runtime_stop_finish(uuid,uuid,integer,uuid,boolean,text)','EXECUTE')
    or has_table_privilege('authenticated','public.work_runtime_stops','SELECT') then raise exception 'Browser can access the stop outbox'; end if;
  -- A missing binding still cancels TM model access but requires recovery.
  delete from public.work_runtime_stops where task_id=task_uuid;
  delete from public.work_runtime_bindings where task_id=task_uuid;
  update public.work_tasks set status='running',generation=3 where id=task_uuid;
  result:=public.work_runtime_cancel(task_uuid,owner_id,3,worker);
  if result is null or result->>'status'<>'cancelled'
    or not exists(select 1 from public.work_runtime_stops where task_id=task_uuid and generation=3 and status='blocked'
      and connection_id is null and last_error='WORK_RUNTIME_STOP_SETUP_REQUIRED') then raise exception 'Unbound cancellation did not fail closed'; end if;
end $$;
rollback;
