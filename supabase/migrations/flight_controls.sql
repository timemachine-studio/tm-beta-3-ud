-- TimeMachine Flight Controls: curated skills, MCP servers, user preferences,
-- and short-lived approval/continuation state.
-- Run this entire file in the Supabase SQL editor before deploying the app.

create extension if not exists pgcrypto;

create or replace function public.set_flight_controls_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.flight_control_catalog (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('skill', 'mcp')),
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9_-]{1,62}$'),
  name text not null check (char_length(name) between 1 and 80),
  description text not null default '',
  icon_name text not null default 'sparkles',
  is_published boolean not null default false,
  default_enabled boolean not null default false,
  sort_order integer not null default 100,
  skill_content text,
  mcp_server_url text,
  mcp_auth_mode text check (mcp_auth_mode is null or mcp_auth_mode in ('none', 'bearer_env')),
  mcp_auth_env_var text,
  mcp_allowed_tools text[] not null default '{}',
  mcp_auto_approve_tools text[] not null default '{}',
  mcp_connect_timeout_ms integer not null default 8000 check (mcp_connect_timeout_ms between 1000 and 30000),
  mcp_call_timeout_ms integer not null default 30000 check (mcp_call_timeout_ms between 1000 and 120000),
  mcp_result_char_limit integer not null default 12000 check (mcp_result_char_limit between 1000 and 50000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint flight_control_kind_config check (
    (kind = 'skill' and skill_content is not null and mcp_server_url is null)
    or
    (kind = 'mcp' and skill_content is null and mcp_server_url is not null and mcp_server_url ~ '^https://' and mcp_auth_mode is not null)
  ),
  constraint flight_control_mcp_auth check (
    kind <> 'mcp'
    or mcp_auth_mode = 'none'
    or (mcp_auth_mode = 'bearer_env' and mcp_auth_env_var is not null and mcp_auth_env_var ~ '^MCP_[A-Z0-9_]+$')
  ),
  constraint flight_control_auto_approve_subset check (mcp_auto_approve_tools <@ mcp_allowed_tools),
  constraint flight_control_published_mcp_allowlist check (
    not is_published or kind <> 'mcp' or cardinality(mcp_allowed_tools) > 0
  )
);

drop trigger if exists flight_control_catalog_updated_at on public.flight_control_catalog;
create trigger flight_control_catalog_updated_at
before update on public.flight_control_catalog
for each row execute function public.set_flight_controls_updated_at();

alter table public.flight_control_catalog enable row level security;
drop policy if exists "Published flight controls are readable" on public.flight_control_catalog;
create policy "Published flight controls are readable"
on public.flight_control_catalog for select
to anon, authenticated
using (is_published = true);

-- The browser only receives display metadata and policy counts. Skill bodies,
-- server URLs, and credential-variable names stay backend-only.
revoke select on public.flight_control_catalog from anon, authenticated;
grant select (
  id, kind, slug, name, description, icon_name, is_published,
  default_enabled, sort_order, mcp_allowed_tools, mcp_auto_approve_tools
) on public.flight_control_catalog to anon, authenticated;
revoke insert, update, delete on public.flight_control_catalog from anon, authenticated;

create table if not exists public.user_flight_control_settings (
  user_id uuid not null references auth.users(id) on delete cascade,
  catalog_id uuid not null references public.flight_control_catalog(id) on delete cascade,
  enabled boolean not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, catalog_id)
);

drop trigger if exists user_flight_control_settings_updated_at on public.user_flight_control_settings;
create trigger user_flight_control_settings_updated_at
before update on public.user_flight_control_settings
for each row execute function public.set_flight_controls_updated_at();

alter table public.user_flight_control_settings enable row level security;
drop policy if exists "Users read own flight control settings" on public.user_flight_control_settings;
create policy "Users read own flight control settings"
on public.user_flight_control_settings for select
to authenticated using (auth.uid() = user_id);
drop policy if exists "Users insert own flight control settings" on public.user_flight_control_settings;
create policy "Users insert own flight control settings"
on public.user_flight_control_settings for insert
to authenticated with check (auth.uid() = user_id);
drop policy if exists "Users update own flight control settings" on public.user_flight_control_settings;
create policy "Users update own flight control settings"
on public.user_flight_control_settings for update
to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "Users delete own flight control settings" on public.user_flight_control_settings;
create policy "Users delete own flight control settings"
on public.user_flight_control_settings for delete
to authenticated using (auth.uid() = user_id);

grant select, insert, update, delete on public.user_flight_control_settings to authenticated;
revoke all on public.user_flight_control_settings from anon;

create table if not exists public.mcp_tool_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  catalog_id uuid not null references public.flight_control_catalog(id) on delete cascade,
  chat_session_id uuid,
  tool_name text not null,
  argument_preview jsonb not null default '{}'::jsonb,
  argument_hash text not null,
  status text not null default 'pending' check (
    status in ('pending', 'approved', 'denied', 'executing', 'succeeded', 'failed', 'expired')
  ),
  continuation_state jsonb,
  error_code text,
  duration_ms integer,
  expires_at timestamptz not null default (now() + interval '10 minutes'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists mcp_tool_runs_user_status_idx
on public.mcp_tool_runs(user_id, status, expires_at);

drop trigger if exists mcp_tool_runs_updated_at on public.mcp_tool_runs;
create trigger mcp_tool_runs_updated_at
before update on public.mcp_tool_runs
for each row execute function public.set_flight_controls_updated_at();

alter table public.mcp_tool_runs enable row level security;
-- Deliberately no browser policies. Only the service-role backend may access
-- continuation state and exact MCP arguments.
revoke all on public.mcp_tool_runs from anon, authenticated;

-- Existing bundled skills. Edit these rows from Supabase Table Editor later.
insert into public.flight_control_catalog
  (kind, slug, name, description, icon_name, is_published, default_enabled, sort_order, skill_content)
values
  (
    'skill', 'frontend_design', 'Frontend design',
    'Helps PRO create distinctive, production-ready interfaces with deliberate visual choices.',
    'palette', true, true, 10,
    $skill$Act as a thoughtful design lead. Ground every interface in a concrete subject, audience, and job. Choose a deliberate palette, typography system, layout idea, and one memorable signature element before coding. Avoid generic AI-dashboard aesthetics, gratuitous gradients, decorative metrics, and interchangeable copy. Match implementation complexity to the visual direction. Build responsive, accessible UI with visible focus states and reduced-motion support. Critique the result after implementation and remove decoration that does not help the user.$skill$
  ),
  (
    'skill', 'human_writing_style', 'Human writing',
    'Makes prose sound natural, specific, and recognizably human.',
    'pen-line', true, true, 20,
    $skill$Rewrite text so it sounds like a person wrote it. Preserve meaning and match the intended audience. Remove promotional filler, inflated significance, vague attribution, forced lists of three, synonym cycling, excessive headings, boldface, em dashes, conjunctive transitions, and stock AI phrases. Prefer concrete facts, plain verbs, varied sentence rhythm, and a real point of view where appropriate. Do not add claims that are not supported by the source text.$skill$
  ),
  (
    'skill', 'latex_formatting', 'LaTeX formatting',
    'Formats equations, formulas, and scientific notation consistently.',
    'sigma', true, true, 30,
    $skill$Use LaTeX for mathematical variables, formulas, and scientific symbols. Use \( ... \) for inline math and \[ ... \] for display math. Keep prose outside math delimiters. Use standard commands such as \frac, \sum, \int, \partial, \alpha, and \pi, and ensure delimiters are balanced.$skill$
  )
on conflict (slug) do update set
  name = excluded.name,
  description = excluded.description,
  icon_name = excluded.icon_name,
  is_published = excluded.is_published,
  default_enabled = excluded.default_enabled,
  sort_order = excluded.sort_order,
  skill_content = excluded.skill_content,
  updated_at = now();

-- SKILL INSERT TEMPLATE:
-- insert into public.flight_control_catalog (
--   kind, slug, name, description, icon_name, is_published,
--   default_enabled, sort_order, skill_content
-- ) values (
--   'skill', 'my_skill', 'My skill', 'When PRO should use this skill.',
--   'sparkles', true, false, 100,
--   $skill$Paste the complete skill instructions here.$skill$
-- );

-- MCP INSERT TEMPLATE (leave unpublished until the allowlists are reviewed):
-- insert into public.flight_control_catalog (
--   kind, slug, name, description, icon_name, is_published, default_enabled,
--   mcp_server_url, mcp_auth_mode, mcp_auth_env_var,
--   mcp_allowed_tools, mcp_auto_approve_tools
-- ) values (
--   'mcp', 'example_server', 'Example server', 'What this server lets PRO do.',
--   'server', false, false, 'https://example.com/mcp', 'bearer_env',
--   'MCP_EXAMPLE_TOKEN', array['read_item', 'create_item'], array['read_item']
-- );
