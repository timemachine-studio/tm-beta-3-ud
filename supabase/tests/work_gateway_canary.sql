-- Explicit staging-only check after all three Work migrations. Needs a
-- quiescent test account/session. No remote calls; changes always roll back.
begin;
do $$
declare owner_id uuid; session_uuid uuid;
  task_uuid uuid := gen_random_uuid(); connection_uuid uuid := gen_random_uuid();
  remote_uuid uuid := gen_random_uuid(); grant_uuid uuid := gen_random_uuid();
  lease_one uuid := gen_random_uuid(); lease_two uuid := gen_random_uuid();
begin
  select s.user_id,s.id into owner_id,session_uuid from public.chat_sessions s
    where not exists (select 1 from public.work_tasks t where t.user_id = s.user_id
      and t.status in ('queued','planning','review','running')) limit 1;
  if owner_id is null then raise exception 'Gateway canary needs a quiescent staging test account/session'; end if;
  insert into public.work_entitlements(user_id,enabled,expires_at) values(owner_id,true,null)
    on conflict(user_id) do update set enabled = true, expires_at = null;
  insert into public.work_tasks(id,user_id,session_id,title,goal,persona,status,generation,worker_id)
    values(task_uuid,owner_id,session_uuid,'Gateway canary','Verify isolated authorization','pro','running',2,'openhands:' || remote_uuid::text);
  insert into public.work_service_connections(id,user_id,service,base_url,credential_ref,enabled,scope_verified_at)
    values(connection_uuid,owner_id,'openhands','https://gateway-canary.example.invalid/' || remote_uuid::text,
      'CANARY_' || upper(replace(remote_uuid::text,'-','')),true,now());
  insert into public.work_runtime_bindings(task_id,user_id,connection_id,remote_conversation_id)
    values(task_uuid,owner_id,connection_uuid,remote_uuid);
  begin
    update public.work_runtime_bindings set execution_enabled = true where task_id = task_uuid;
    raise exception 'Execution could be enabled without an attestation';
  exception when check_violation then null; end;
  begin
    update public.work_runtime_bindings set gateway_grant_id = grant_uuid,gateway_expires_at = now() + interval '5 minutes' where task_id = task_uuid;
    raise exception 'Incomplete grant could be stored';
  exception when check_violation then null; end;
  update public.work_runtime_bindings set execution_enabled = true,execution_verified_at = now(),
    gateway_grant_id = grant_uuid,gateway_expires_at = now() + interval '5 minutes',gateway_generation = 2 where task_id = task_uuid;
  if public.work_gateway_claim(task_uuid,gen_random_uuid(),grant_uuid,2,lease_one)
    or public.work_gateway_claim(task_uuid,owner_id,gen_random_uuid(),2,lease_one)
    or public.work_gateway_claim(task_uuid,owner_id,grant_uuid,3,lease_one) then raise exception 'Forged owner/grant/generation accepted'; end if;
  if not public.work_gateway_claim(task_uuid,owner_id,grant_uuid,2,lease_one) then raise exception 'Valid lease denied'; end if;
  if public.work_gateway_claim(task_uuid,owner_id,grant_uuid,2,lease_two) then raise exception 'Concurrent lease accepted'; end if;
  perform public.work_gateway_release(task_uuid,owner_id,lease_two);
  if not exists(select 1 from public.work_runtime_bindings where task_id = task_uuid and gateway_lease_id = lease_one) then raise exception 'Wrong lease could release active request'; end if;
  perform public.work_gateway_release(task_uuid,owner_id,lease_one);
  update public.work_runtime_bindings set gateway_grant_id = null,gateway_expires_at = null,gateway_generation = null where task_id = task_uuid;
  if public.work_gateway_claim(task_uuid,owner_id,grant_uuid,2,lease_two) then raise exception 'Revoked grant accepted'; end if;
  if has_function_privilege('authenticated','public.work_gateway_claim(uuid,uuid,uuid,integer,uuid)','EXECUTE')
    or has_function_privilege('anon','public.work_gateway_claim(uuid,uuid,uuid,integer,uuid)','EXECUTE')
    or has_function_privilege('authenticated','public.work_gateway_release(uuid,uuid,uuid)','EXECUTE')
    or has_function_privilege('anon','public.work_gateway_release(uuid,uuid,uuid)','EXECUTE') then raise exception 'Browser can execute gateway lease RPC'; end if;
end $$;
rollback;
