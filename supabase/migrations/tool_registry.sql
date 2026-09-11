-- The shared tool registry: tools TimeMachine wrote for one user, made
-- callable for every user.
--
-- A row is a Python function plus the descriptor that puts it on the tool
-- catalogue (shared/toolRegistry.ts). The browser that wrote it also tested
-- it, and publishes it here directly with the user's own JWT; the server
-- reads the table with the service role and validates every row again
-- before offering it to a model. The check constraints below mirror
-- TOOL_SPEC_LIMITS so a row that fits the table also fits the schema.
--
-- What a row is NOT: reviewed. The owner's decision for this round is
-- sandbox-only, auto-published, revoked by hand — `status` is the only
-- lever, and an operator sets it to 'revoked' in the SQL editor. A revoked
-- version is never loaded again.
--
-- Run this file in the Supabase SQL editor.

create table if not exists public.tool_registry (
  id uuid primary key default gen_random_uuid(),
  slug text not null check (slug ~ '^[a-z][a-z0-9_]{2,39}$'),
  version integer not null default 1 check (version >= 1),
  -- Over slug, parameters and source — what the tool does. Unique, so the
  -- same tool published twice is one row and the second publisher reuses it.
  digest text not null check (digest ~ '^sha256:[a-f0-9]{64}$'),
  title text not null check (char_length(title) between 1 and 60),
  description text not null check (char_length(description) between 20 and 600),
  summary text not null check (char_length(summary) between 10 and 140),
  parameters jsonb not null,
  source text not null check (char_length(source) between 1 and 16000),
  terms text[] not null check (cardinality(terms) between 2 and 16),
  tests jsonb not null default '[]'::jsonb,
  -- Provenance. Kept when the account goes: the tool stays published and
  -- the row records that its author is gone rather than pretending it had
  -- none.
  author_id uuid references auth.users(id) on delete set null,
  status text not null default 'published' check (status in ('published', 'revoked')),
  revoked_reason text,
  revoked_at timestamptz,
  -- Bumped by the server each time a model calls the tool. Orders the
  -- registry: which tools are loaded when there are more than fit.
  use_count integer not null default 0 check (use_count >= 0),
  created_at timestamptz not null default now(),

  constraint tool_registry_slug_version_unique unique (slug, version),
  constraint tool_registry_digest_unique unique (digest)
);

create index if not exists tool_registry_published_idx
on public.tool_registry(status, use_count desc, created_at desc);

create index if not exists tool_registry_author_idx
on public.tool_registry(author_id, created_at desc);

-- A slug belongs to whoever published it first. Anyone else publishing a
-- "new version" of it would be replacing code every user runs, which is a
-- hijack, not a contribution — they get a different slug. Security definer,
-- because the caller's own select policy hides revoked rows and an owner
-- check must see all of them.
create or replace function public.tool_slug_owned_by_other(check_slug text, caller uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.tool_registry
    where slug = check_slug and (author_id is distinct from caller)
  );
$$;

revoke all on function public.tool_slug_owned_by_other(text, uuid) from public;
grant execute on function public.tool_slug_owned_by_other(text, uuid) to authenticated;

-- Cheap spam brake. Auto-publish with no review needs at least this: one
-- account cannot fill the table in an afternoon.
create or replace function public.tool_registry_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (
    select count(*) from public.tool_registry
    where author_id = new.author_id and created_at > now() - interval '1 hour'
  ) >= 30 then
    raise exception 'tool_registry: too many tools published in the last hour';
  end if;
  return new;
end;
$$;

drop trigger if exists tool_registry_rate_limit on public.tool_registry;
create trigger tool_registry_rate_limit
before insert on public.tool_registry
for each row execute function public.tool_registry_rate_limit();

-- Use counting, for the service role only. `update ... set use_count =
-- use_count + 1` cannot be expressed atomically through PostgREST without
-- this, and a browser must not be able to promote a tool by calling it.
create or replace function public.increment_tool_use(tool_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.tool_registry set use_count = use_count + 1 where id = tool_id;
$$;

revoke all on function public.increment_tool_use(uuid) from public;
revoke execute on function public.increment_tool_use(uuid) from anon, authenticated;

alter table public.tool_registry enable row level security;

-- Anyone may read what is published. There is nothing private in a row:
-- the code is meant to run on every user's device, and the author id is
-- provenance, not a secret. Revoked rows disappear from the browser too.
drop policy if exists "tool_registry_read_published" on public.tool_registry;
create policy "tool_registry_read_published"
on public.tool_registry for select
to anon, authenticated
using (status = 'published');

-- Publishing: signed in, as yourself, a fresh published row, and never over
-- someone else's slug. Anonymous sessions can create tools for their own
-- conversation but nothing of theirs reaches the table.
drop policy if exists "tool_registry_publish_own" on public.tool_registry;
create policy "tool_registry_publish_own"
on public.tool_registry for insert
to authenticated
with check (
  author_id = auth.uid()
  and status = 'published'
  and use_count = 0
  and revoked_at is null
  and revoked_reason is null
  and not public.tool_slug_owned_by_other(slug, auth.uid())
);

-- No update or delete from a browser. Revocation is an operator's action in
-- the SQL editor; a published version is otherwise immutable, which is what
-- lets a digest mean anything.
