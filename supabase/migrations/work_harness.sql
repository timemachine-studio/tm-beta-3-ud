-- Additive Work schema. Apply explicitly; this file is not a deployment.
begin;

-- Entitlements are server-owned. Existing profiles.is_pro is not authority.
create table if not exists public.work_entitlements (
  user_id uuid primary key references auth.users(id) on delete cascade,
  enabled boolean not null default false,
  expires_at timestamptz,
  updated_at timestamptz not null default now()
);
alter table public.work_entitlements enable row level security;
drop policy if exists work_entitlements_read on public.work_entitlements;
create policy work_entitlements_read on public.work_entitlements for select to authenticated using (auth.uid() = user_id);
revoke all on public.work_entitlements from anon, authenticated;
grant select on public.work_entitlements to authenticated;
grant all on public.work_entitlements to service_role;

create table if not exists public.work_tasks (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id uuid not null references public.chat_sessions(id) on delete cascade,
  title text not null default 'New task' check (length(title) <= 120),
  goal text not null check (length(goal) between 1 and 12000),
  instructions text not null default '' check (length(instructions) <= 4000),
  persona text not null check (persona in ('default','girlie','pro')),
  status text not null default 'queued' check (status in ('queued','planning','review','running','completed','failed','cancelled')),
  plan jsonb, thread jsonb not null default '[]' check (jsonb_typeof(thread) = 'array' and jsonb_array_length(thread) <= 80),
  step_index int not null default 0 check (step_index between 0 and 6),
  revision int not null default 0 check (revision >= 0),
  generation int not null default 0 check (generation >= 0),
  summary text check (length(summary) <= 12000), error text check (length(error) <= 1000),
  worker_id text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (id, user_id)
);
create unique index if not exists work_one_active_task on public.work_tasks(session_id)
  where status in ('queued','planning','review','running');
create unique index if not exists work_one_active_per_owner on public.work_tasks(user_id)
  where status in ('queued','planning','review','running');
create index if not exists work_tasks_owner_recent on public.work_tasks(user_id, updated_at desc);

create table if not exists public.work_files (
  id uuid primary key default gen_random_uuid(), task_id uuid not null references public.work_tasks(id) on delete cascade,
  path text not null check (length(path) between 1 and 160),
  kind text not null check (kind in ('markdown','text','csv','code')),
  content text not null check (octet_length(content) <= 320000),
  revision int not null default 1 check (revision > 0), source boolean not null default false,
  updated_at timestamptz not null default now(), unique(task_id, path)
);
create table if not exists public.work_events (
  task_id uuid not null references public.work_tasks(id) on delete cascade,
  sequence int not null, type text not null check (length(type) <= 80), title text not null check (length(title) <= 300),
  created_at timestamptz not null default now(), primary key (task_id, sequence)
);
create table if not exists public.work_model_calls (
  id uuid primary key default gen_random_uuid(), task_id uuid not null references public.work_tasks(id) on delete cascade,
  phase text not null, provider text not null, model text not null,
  config_version text not null, outcome text not null check (outcome in ('failed','invalid_output','completed')), latency_ms int,
  input_tokens int, output_tokens int, estimated_cost numeric,
  created_at timestamptz not null default now()
);
create table if not exists public.work_config_versions (
  version text primary key, prompt text not null, created_at timestamptz not null default now()
);

alter table public.work_tasks enable row level security;
alter table public.work_files enable row level security;
alter table public.work_events enable row level security;
alter table public.work_model_calls enable row level security;
alter table public.work_config_versions enable row level security;
drop policy if exists work_tasks_owner on public.work_tasks;
drop policy if exists work_files_owner on public.work_files;
drop policy if exists work_events_owner on public.work_events;
drop policy if exists work_calls_owner on public.work_model_calls;
create policy work_tasks_owner on public.work_tasks for select to authenticated using (auth.uid() = user_id);
create policy work_files_owner on public.work_files for select to authenticated using (exists (select 1 from public.work_tasks t where t.id = task_id and t.user_id = auth.uid()));
create policy work_events_owner on public.work_events for select to authenticated using (exists (select 1 from public.work_tasks t where t.id = task_id and t.user_id = auth.uid()));
create policy work_calls_owner on public.work_model_calls for select to authenticated using (exists (select 1 from public.work_tasks t where t.id = task_id and t.user_id = auth.uid()));
revoke all on public.work_tasks, public.work_files, public.work_events, public.work_model_calls, public.work_config_versions from anon, authenticated;
grant select on public.work_tasks, public.work_files, public.work_events, public.work_model_calls to authenticated;
grant all on public.work_tasks, public.work_files, public.work_events, public.work_model_calls, public.work_config_versions to service_role;

-- Every checkpoint and file write shares the cancellation lock. A late worker
-- cannot write a deliverable or mark a cancelled task completed.
create or replace function public.work_checkpoint(
  p_id uuid, p_user uuid, p_statuses text[], p_patch jsonb,
  p_type text, p_title text, p_file jsonb default null, p_revision int default null, p_worker text default null, p_generation int default null
) returns jsonb language plpgsql security definer set search_path = public as $$
declare t public.work_tasks; file_revision int;
begin
  select * into t from public.work_tasks where id = p_id and user_id = p_user for update;
  if not found or not (t.status = any(p_statuses)) or (p_revision is not null and t.revision <> p_revision)
    or (p_worker is not null and t.worker_id is distinct from p_worker)
    or (p_generation is not null and t.generation <> p_generation) then return null; end if;
  if p_file is not null then
    select revision into file_revision from public.work_files where task_id = p_id and path = p_file->>'path';
    if p_file ? 'expected_revision' and (file_revision is null or file_revision <> (p_file->>'expected_revision')::int) then return null; end if;
    if (select count(*) from public.work_files where task_id = p_id) >= 24 and file_revision is null then raise exception 'work_file_limit'; end if;
    -- Original uploads cannot be overwritten by the agent or artifact editor.
    if exists (select 1 from public.work_files where task_id = p_id and path = p_file->>'path' and source) then raise exception 'work_source_read_only'; end if;
    insert into public.work_files(task_id,path,kind,content) values(p_id,p_file->>'path',p_file->>'kind',p_file->>'content')
      on conflict(task_id,path) do update set content=excluded.content, kind=excluded.kind, revision=work_files.revision+1, updated_at=now();
  end if;
  update public.work_tasks set
    title = coalesce(p_patch->>'title',title), status = coalesce(p_patch->>'status',status),
    plan = case when p_patch ? 'plan' then p_patch->'plan' else plan end,
    thread = case when p_patch ? 'append_turn' then thread || jsonb_build_array(p_patch->'append_turn') else coalesce(p_patch->'thread',thread) end,
    step_index = coalesce((p_patch->>'step_index')::int,step_index),
    summary = case when p_patch ? 'summary' then p_patch->>'summary' else summary end,
    error = case when p_patch ? 'error' then p_patch->>'error' else error end,
    worker_id = case when p_patch ? 'worker_id' then p_patch->>'worker_id' else worker_id end,
    generation = coalesce((p_patch->>'generation')::int,generation),
    revision = revision+1, updated_at=now()
  where id=p_id returning * into t;
  insert into public.work_events(task_id,sequence,type,title) values(p_id,t.revision,p_type,left(p_title,300));
  return to_jsonb(t);
end $$;
revoke all on function public.work_checkpoint(uuid,uuid,text[],jsonb,text,text,jsonb,int,text,int) from public, anon, authenticated;
grant execute on function public.work_checkpoint(uuid,uuid,text[],jsonb,text,text,jsonb,int,text,int) to service_role;
commit;
