-- Explicit staging-only rollback canary. Apply all six Work migrations first.
-- Requires a quiescent staging account. No Agent Server request or tool action.
begin;
do $$
declare owner_id uuid; session_uuid uuid; task_uuid uuid:=gen_random_uuid();
  connection_uuid uuid:=gen_random_uuid(); remote_uuid uuid:=gen_random_uuid();
  lease_uuid uuid:=gen_random_uuid(); grant_uuid uuid:=gen_random_uuid();
  launch_uuid uuid; review_uuid uuid; next_review_uuid uuid; request_uuid uuid:=gen_random_uuid();
  generation_number int; task_revision int; result jsonb; retry jsonb; role_name text; item text;
begin
  select s.user_id,s.id into owner_id,session_uuid from public.chat_sessions s
    where not exists(select 1 from public.work_tasks t where t.user_id=s.user_id and t.status in ('queued','planning','review','running'))
      and not exists(select 1 from public.work_service_connections c where c.user_id=s.user_id and c.service='openhands')
      and not exists(select 1 from public.work_runtime_stops r where r.user_id=s.user_id and r.status<>'acknowledged') limit 1;
  if owner_id is null then raise exception 'Confirmation canary needs a quiescent staging account'; end if;

  insert into public.work_entitlements(user_id,enabled,expires_at) values(owner_id,true,null)
    on conflict(user_id) do update set enabled=true,expires_at=null;
  insert into public.work_service_connections(id,user_id,service,base_url,credential_ref,enabled,scope_verified_at,execution_verified_at)
    values(connection_uuid,owner_id,'openhands','https://confirmation-canary.example.invalid',
      'CANARY_'||upper(replace(remote_uuid::text,'-','')),true,now(),now());
  insert into public.work_tasks(id,user_id,session_id,title,goal,persona,status,generation,revision,plan)
    values(task_uuid,owner_id,session_uuid,'Confirmation canary','Verify private tool-decision ledger','pro','review',1,4,
      '{"steps":[{"title":"Inspect a draft"}]}');
  result:=public.work_runtime_reserve(task_uuid,owner_id,4,connection_uuid,remote_uuid);
  if result is null then raise exception 'Confirmation fixture could not reserve runtime'; end if;
  launch_uuid:=(result->>'id')::uuid;
  generation_number:=(result->>'generation')::int;
  if generation_number<>2 or public.work_runtime_launch_claim(launch_uuid,lease_uuid) is null then
    raise exception 'Confirmation fixture could not claim launch'; end if;
  update public.work_runtime_bindings set gateway_grant_id=grant_uuid,gateway_expires_at=now()+interval '2 minutes',
    gateway_generation=generation_number where task_id=task_uuid;

  -- A claimed launch is not an established running conversation.
  select revision into task_revision from public.work_tasks where id=task_uuid;
  if public.work_confirmation_review(task_uuid,owner_id,generation_number,task_revision,
    connection_uuid,remote_uuid,grant_uuid,repeat('a',64),array['terminal']) is not null then
    raise exception 'Pre-start confirmation review accepted'; end if;
  if not public.work_runtime_launch_started(launch_uuid,lease_uuid) then raise exception 'Confirmation fixture start denied'; end if;
  select revision into task_revision from public.work_tasks where id=task_uuid;

  if public.work_confirmation_review(task_uuid,gen_random_uuid(),generation_number,task_revision,
    connection_uuid,remote_uuid,grant_uuid,repeat('a',64),array['terminal']) is not null
    or public.work_confirmation_review(task_uuid,owner_id,generation_number,task_revision-1,
      connection_uuid,remote_uuid,grant_uuid,repeat('a',64),array['terminal']) is not null
    or public.work_confirmation_review(task_uuid,owner_id,generation_number,task_revision,
      gen_random_uuid(),remote_uuid,grant_uuid,repeat('a',64),array['terminal']) is not null
    or public.work_confirmation_review(task_uuid,owner_id,generation_number,task_revision,
      connection_uuid,remote_uuid,gen_random_uuid(),repeat('a',64),array['terminal']) is not null then
    raise exception 'Forged owner, revision, connection or grant accepted'; end if;
  result:=public.work_confirmation_review(task_uuid,owner_id,generation_number,task_revision,
    connection_uuid,remote_uuid,grant_uuid,repeat('a',64),array['terminal','file_editor']);
  if result is null or result->>'status'<>'pending' or result->>'delivery_status'<>'blocked'
    or result->>'fingerprint'<>repeat('a',64) or result->'tools'<>'["terminal", "file_editor"]'::jsonb
    or (result->>'expires_at')::timestamptz>now()+interval '2 minutes 1 second' then
    raise exception 'Review was not privately bound and time-limited'; end if;
  review_uuid:=(result->>'id')::uuid;
  retry:=public.work_confirmation_review(task_uuid,owner_id,generation_number,task_revision,
    connection_uuid,remote_uuid,grant_uuid,repeat('a',64),array['terminal','file_editor']);
  if (retry->>'id')::uuid is distinct from review_uuid or (retry->>'revision')::int<>1 then
    raise exception 'Identical capture manufactured another review'; end if;

  if public.work_confirmation_decide(task_uuid,gen_random_uuid(),review_uuid,1,request_uuid,'approve',
    generation_number,task_revision) is not null
    or public.work_confirmation_decide(task_uuid,owner_id,review_uuid,2,request_uuid,'approve',
      generation_number,task_revision) is not null then raise exception 'Forged or stale decision accepted'; end if;
  result:=public.work_confirmation_decide(task_uuid,owner_id,review_uuid,1,request_uuid,'approve',
    generation_number,task_revision);
  if result is null or result->>'status'<>'decided' or result->>'decision'<>'approve'
    or result->>'delivery_status'<>'blocked' or (result->>'revision')::int<>2 then
    raise exception 'Decision was not blocked and versioned'; end if;
  retry:=public.work_confirmation_decide(task_uuid,owner_id,review_uuid,1,request_uuid,'approve',
    generation_number,task_revision);
  if (retry->>'id')::uuid is distinct from review_uuid or (retry->>'revision')::int<>2
    or public.work_confirmation_decide(task_uuid,owner_id,review_uuid,1,gen_random_uuid(),'reject',
      generation_number,task_revision) is not null then raise exception 'Decision retry or conflict handling failed'; end if;

  result:=public.work_confirmation_review(task_uuid,owner_id,generation_number,task_revision,
    connection_uuid,remote_uuid,grant_uuid,repeat('b',64),array['terminal']);
  if result is null or result->>'status'<>'pending' then raise exception 'Changed pending action was not captured'; end if;
  next_review_uuid:=(result->>'id')::uuid;
  if not exists(select 1 from public.work_runtime_confirmations where id=review_uuid and status='invalidated')
    or public.work_confirmation_decide(task_uuid,owner_id,review_uuid,2,gen_random_uuid(),'approve',
      generation_number,task_revision) is not null then raise exception 'Changed action did not invalidate prior review'; end if;
  update public.work_runtime_confirmations set expires_at=now()-interval '1 second' where id=next_review_uuid;
  if public.work_confirmation_decide(task_uuid,owner_id,next_review_uuid,1,gen_random_uuid(),'reject',
    generation_number,task_revision) is not null then raise exception 'Expired review accepted'; end if;
  update public.work_runtime_confirmations set expires_at=now()+interval '1 minute' where id=next_review_uuid;

  -- Rotating a model grant must make an already captured review unusable.
  grant_uuid:=gen_random_uuid();
  update public.work_runtime_bindings set gateway_grant_id=grant_uuid where task_id=task_uuid;
  if not exists(select 1 from public.work_runtime_confirmations where id=next_review_uuid and status='invalidated')
    or public.work_confirmation_decide(task_uuid,owner_id,next_review_uuid,2,gen_random_uuid(),'approve',
      generation_number,task_revision) is not null then raise exception 'Grant rotation retained a confirmation'; end if;
  result:=public.work_confirmation_review(task_uuid,owner_id,generation_number,task_revision,
    connection_uuid,remote_uuid,grant_uuid,repeat('c',64),array['terminal']);
  if result is null or result->>'status'<>'pending' then raise exception 'Fresh grant could not capture review'; end if;
  next_review_uuid:=(result->>'id')::uuid;

  -- Connection attestation revocation also clears the model grant.
  update public.work_service_connections set scope_verified_at=null where id=connection_uuid;
  if not exists(select 1 from public.work_runtime_confirmations where id=next_review_uuid and status='invalidated')
    or not exists(select 1 from public.work_runtime_bindings where task_id=task_uuid
      and not execution_enabled and gateway_grant_id is null) then
    raise exception 'Connection revocation retained a confirmation or grant'; end if;
  update public.work_service_connections set scope_verified_at=now() where id=connection_uuid;
  grant_uuid:=gen_random_uuid();
  update public.work_runtime_bindings set execution_enabled=true,execution_verified_at=now(),gateway_grant_id=grant_uuid,
    gateway_expires_at=now()+interval '2 minutes',gateway_generation=generation_number where task_id=task_uuid;
  result:=public.work_confirmation_review(task_uuid,owner_id,generation_number,task_revision,
    connection_uuid,remote_uuid,grant_uuid,repeat('d',64),array['terminal']);
  if result is null or result->>'status'<>'pending' then raise exception 'Reattested connection could not capture review'; end if;
  next_review_uuid:=(result->>'id')::uuid;

  update public.work_entitlements set enabled=false where user_id=owner_id;
  if not exists(select 1 from public.work_runtime_confirmations where id=next_review_uuid and status='invalidated')
    or public.work_confirmation_decide(task_uuid,owner_id,next_review_uuid,2,gen_random_uuid(),'approve',
      generation_number,task_revision) is not null then raise exception 'Entitlement revocation retained a confirmation'; end if;
  update public.work_entitlements set enabled=true where user_id=owner_id;
  result:=public.work_confirmation_review(task_uuid,owner_id,generation_number,task_revision,
    connection_uuid,remote_uuid,grant_uuid,repeat('e',64),array['terminal']);
  if result is null or result->>'status'<>'pending' then raise exception 'Restored entitlement could not capture review'; end if;
  next_review_uuid:=(result->>'id')::uuid;

  if public.work_runtime_cancel(task_uuid,owner_id,generation_number,'openhands:'||remote_uuid::text) is null
    or not exists(select 1 from public.work_runtime_confirmations where id=next_review_uuid and status='invalidated')
    or public.work_confirmation_decide(task_uuid,owner_id,next_review_uuid,1,gen_random_uuid(),'reject',
      generation_number,task_revision) is not null then raise exception 'Stop did not revoke pending confirmation'; end if;

  foreach role_name in array array['anon','authenticated'] loop
    foreach item in array array['public.work_confirmation_authority(uuid,uuid,integer,integer)',
      'public.work_confirmation_review(uuid,uuid,integer,integer,uuid,uuid,uuid,text,text[])',
      'public.work_confirmation_decide(uuid,uuid,uuid,integer,uuid,text,integer,integer)'] loop
      if has_function_privilege(role_name,item,'EXECUTE') then raise exception 'Browser can call private confirmation function'; end if;
    end loop;
    if has_table_privilege(role_name,'public.work_runtime_confirmations','SELECT')
      or has_table_privilege(role_name,'public.work_runtime_confirmations','INSERT') then
      raise exception 'Browser can access private confirmation ledger'; end if;
  end loop;
end $$;
rollback;
