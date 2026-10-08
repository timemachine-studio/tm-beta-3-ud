-- Run explicitly after the migration in a staging database. Always rolls back.
begin;
do $$
declare owner_id uuid; session_uuid uuid; task_uuid uuid := gen_random_uuid();
  other_id uuid := gen_random_uuid(); original_role text := current_user; n int; result jsonb;
begin
  select s.user_id, s.id into owner_id, session_uuid from public.chat_sessions s
    join auth.users u on u.id = s.user_id
    where not exists (select 1 from public.work_tasks w where w.user_id=s.user_id and w.status in ('queued','planning','review','running')) limit 1;
  if owner_id is null then raise exception 'Canary needs an existing chat owner with no active Work task'; end if;
  insert into public.work_tasks(id,user_id,session_id,title,goal,persona,status,worker_id)
    values(task_uuid,owner_id,session_uuid,'Work canary','Verify transactional safeguards','pro','running','worker-a');
  insert into public.work_files(task_id,path,kind,content,source) values(task_uuid,'original.md','markdown','Original',true);
  result := public.work_checkpoint(task_uuid,owner_id,array['running'],'{}','canary','Wrong worker',jsonb_build_object('path','stale.md','kind','markdown','content','Forbidden'),null,'worker-b');
  if result is not null then raise exception 'Wrong worker was allowed to write'; end if;
  result := public.work_checkpoint(task_uuid,owner_id,array['running'],'{"status":"cancelled"}','run.cancelled','Stop');
  result := public.work_checkpoint(task_uuid,owner_id,array['running'],'{"status":"completed"}','run.completed','Late write',jsonb_build_object('path','late.md','kind','markdown','content','Forbidden'),null,'worker-a');
  if result is not null then raise exception 'Cancelled task accepted a late file/completion'; end if;
  select count(*) into n from public.work_files where task_id=task_uuid;
  if n <> 1 then raise exception 'Cancellation/worker check leaked a write'; end if;
  begin
    perform public.work_checkpoint(task_uuid,owner_id,array['cancelled'],'{}','artifact.updated','Overwrite',jsonb_build_object('path','original.md','kind','markdown','content','Changed'));
    raise exception 'Original upload was overwritten';
  exception when raise_exception then
    if SQLERRM <> 'work_source_read_only' then raise; end if;
  end;
  perform set_config('request.jwt.claim.sub',owner_id::text,true);
  perform set_config('role','authenticated',true);
  select count(*) into n from public.work_tasks where id=task_uuid;
  if n <> 1 then raise exception 'Owner cannot read task'; end if;
  begin
    update public.work_tasks set status='completed' where id=task_uuid;
    raise exception 'Client could forge execution state';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.work_entitlements(user_id,enabled) values(owner_id,true) on conflict(user_id) do update set enabled=true;
    raise exception 'Client could forge entitlement';
  exception when insufficient_privilege then null; end;
  begin
    perform public.work_checkpoint(task_uuid,owner_id,array['cancelled'],'{}','approval','Forged');
    raise exception 'Client could invoke the service-only checkpoint';
  exception when insufficient_privilege then null; end;
  perform set_config('request.jwt.claim.sub',other_id::text,true);
  select count(*) into n from public.work_tasks where id=task_uuid;
  if n <> 0 then raise exception 'Cross-account task read'; end if;
  select count(*) into n from public.work_files where task_id=task_uuid;
  if n <> 0 then raise exception 'Cross-account file read'; end if;
  perform set_config('role',original_role,true);
end $$;
rollback;
