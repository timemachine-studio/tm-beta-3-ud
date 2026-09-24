-- Installed, version-pinned capabilities and anonymous aggregate health.
-- No prompts, arguments, results, tokens or credentials enter these tables.

alter table public.tool_registry
  add column if not exists capability_id text generated always as ('tm.generated.' || slug) stored,
  add column if not exists visibility text not null default 'public'
    check (visibility in ('public')),
  add column if not exists success_count bigint not null default 0 check (success_count >= 0),
  add column if not exists failure_count bigint not null default 0 check (failure_count >= 0),
  add column if not exists last_failure_at timestamptz;

create table if not exists public.user_tool_installations (
  user_id uuid not null references auth.users(id) on delete cascade,
  tool_id uuid not null references public.tool_registry(id) on delete cascade,
  slug text not null,
  version integer not null check (version >= 1),
  digest text not null check (digest ~ '^sha256:[a-f0-9]{64}$'),
  installed_at timestamptz not null default now(),
  primary key (user_id, slug)
);

alter table public.user_tool_installations enable row level security;

drop policy if exists "user_tool_installations_read_own" on public.user_tool_installations;
create policy "user_tool_installations_read_own" on public.user_tool_installations
for select to authenticated using (user_id = auth.uid());

drop policy if exists "user_tool_installations_write_own" on public.user_tool_installations;
create policy "user_tool_installations_write_own" on public.user_tool_installations
for insert to authenticated with check (
  user_id = auth.uid() and exists (
    select 1 from public.tool_registry registry
    where registry.id = tool_id and registry.slug = slug and registry.version = version
      and registry.digest = digest and registry.status = 'published'
  )
);

drop policy if exists "user_tool_installations_update_own" on public.user_tool_installations;
create policy "user_tool_installations_update_own" on public.user_tool_installations
for update to authenticated using (user_id = auth.uid()) with check (
  user_id = auth.uid() and exists (
    select 1 from public.tool_registry registry
    where registry.id = tool_id and registry.slug = slug and registry.version = version
      and registry.digest = digest and registry.status = 'published'
  )
);

drop policy if exists "user_tool_installations_delete_own" on public.user_tool_installations;
create policy "user_tool_installations_delete_own" on public.user_tool_installations
for delete to authenticated using (user_id = auth.uid());

create or replace function public.record_tool_execution(tool_id uuid, succeeded boolean)
returns void
language sql
security definer
set search_path = public
as $$
  update public.tool_registry
  set success_count = success_count + case when succeeded then 1 else 0 end,
      failure_count = failure_count + case when succeeded then 0 else 1 end,
      last_failure_at = case when succeeded then last_failure_at else now() end
  where id = tool_id and status = 'published';
$$;

revoke all on function public.record_tool_execution(uuid, boolean) from public;
grant execute on function public.record_tool_execution(uuid, boolean) to authenticated;
