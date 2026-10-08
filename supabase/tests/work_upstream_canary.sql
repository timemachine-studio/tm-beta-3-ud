-- Run explicitly in approved staging after both Work migrations. Needs two
-- existing test accounts and one chat session. No remote calls; always rolls back.
begin;
do $$
declare owner_id uuid; other_id uuid; session_uuid uuid;
  task_uuid uuid := gen_random_uuid(); connection_uuid uuid := gen_random_uuid();
  other_connection_uuid uuid := gen_random_uuid(); remote_uuid uuid := gen_random_uuid();
  canary_ref text := 'CANARY_' || upper(replace(gen_random_uuid()::text, '-', ''));
  canary_url text := 'https://canary.example.invalid/' || gen_random_uuid()::text;
  table_name text;
begin
  select s.user_id, s.id into owner_id, session_uuid from public.chat_sessions s
    join auth.users u on u.id = s.user_id limit 1;
  select id into other_id from auth.users where id <> owner_id limit 1;
  if owner_id is null or other_id is null then
    raise exception 'Upstream canary needs two staging test accounts and an existing chat session';
  end if;
  insert into public.work_tasks(id,user_id,session_id,title,goal,persona,status)
    values(task_uuid,owner_id,session_uuid,'Upstream canary','Verify ownership constraints','pro','completed');
  begin
    insert into public.work_service_connections(user_id,service,base_url,credential_ref,enabled)
      values(owner_id,'openhands',canary_url,canary_ref,true);
    raise exception 'Unverified upstream connection was enabled';
  exception when check_violation then null; end;
  insert into public.work_service_connections(id,user_id,service,base_url,credential_ref)
    values(connection_uuid,owner_id,'openhands',canary_url,canary_ref),
          (other_connection_uuid,other_id,'openhands',canary_url || '/other',canary_ref || '_OTHER');
  begin
    insert into public.work_runtime_bindings(task_id,user_id,connection_id,remote_conversation_id)
      values(task_uuid,owner_id,other_connection_uuid,remote_uuid);
    raise exception 'Task could use another account connection';
  exception when foreign_key_violation then null; end;
  begin
    insert into public.work_runtime_bindings(task_id,user_id,connection_id,remote_conversation_id)
      values(task_uuid,other_id,other_connection_uuid,remote_uuid);
    raise exception 'Another account could bind this task';
  exception when foreign_key_violation then null; end;
  insert into public.work_runtime_bindings(task_id,user_id,connection_id,remote_conversation_id)
    values(task_uuid,owner_id,connection_uuid,remote_uuid);
  foreach table_name in array array['work_service_connections','work_runtime_bindings'] loop
    if has_table_privilege('authenticated','public.' || table_name,'SELECT')
      or has_table_privilege('authenticated','public.' || table_name,'INSERT')
      or has_table_privilege('authenticated','public.' || table_name,'UPDATE')
      or has_table_privilege('authenticated','public.' || table_name,'DELETE')
      or has_table_privilege('anon','public.' || table_name,'SELECT')
      or has_table_privilege('anon','public.' || table_name,'INSERT')
      or has_table_privilege('anon','public.' || table_name,'UPDATE')
      or has_table_privilege('anon','public.' || table_name,'DELETE') then
      raise exception 'Client has upstream table privileges: %', table_name;
    end if;
  end loop;
end $$;
rollback;
