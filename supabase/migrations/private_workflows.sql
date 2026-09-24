-- Reusable workflows belong to an account, not to one browser profile.
-- They are never part of the public generated-tool registry.
create table if not exists public.private_workflows (
  id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  slug text not null check (slug ~ '^[a-z][a-z0-9]*(?:_[a-z0-9]+)*$'),
  title text not null check (char_length(title) between 2 and 120),
  description text not null check (char_length(description) between 8 and 500),
  instructions text not null check (char_length(instructions) between 20 and 20000),
  tool_dependencies text[] not null default '{}',
  steps jsonb not null default '[]'::jsonb,
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id),
  unique (user_id, slug),
  check (cardinality(tool_dependencies) <= 32),
  constraint private_workflows_steps_bound check (jsonb_typeof(steps) = 'array' and jsonb_array_length(steps) <= 16)
);

alter table public.private_workflows add column if not exists steps jsonb not null default '[]'::jsonb;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'private_workflows_steps_bound') then
    alter table public.private_workflows add constraint private_workflows_steps_bound
      check (jsonb_typeof(steps) = 'array' and jsonb_array_length(steps) <= 16);
  end if;
end $$;

create index if not exists private_workflows_recent_idx
on public.private_workflows(user_id, updated_at desc);

alter table public.private_workflows enable row level security;

drop policy if exists "private_workflows_owner_read" on public.private_workflows;
create policy "private_workflows_owner_read" on public.private_workflows
for select to authenticated using (user_id = auth.uid());

drop policy if exists "private_workflows_owner_insert" on public.private_workflows;
create policy "private_workflows_owner_insert" on public.private_workflows
for insert to authenticated with check (user_id = auth.uid());

drop policy if exists "private_workflows_owner_update" on public.private_workflows;
create policy "private_workflows_owner_update" on public.private_workflows
for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "private_workflows_owner_delete" on public.private_workflows;
create policy "private_workflows_owner_delete" on public.private_workflows
for delete to authenticated using (user_id = auth.uid());

revoke all on public.private_workflows from anon;
grant select, insert, update, delete on public.private_workflows to authenticated;
