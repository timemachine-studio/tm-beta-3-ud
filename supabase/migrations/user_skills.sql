-- User-installed skills.
--
-- The curated `flight_control_catalog` is what an operator publishes for
-- everyone. This is a SKILL.md a user found on a skills directory (skills.sh,
-- skillsmp.com) and installed for themselves. It reaches the model the same
-- way a catalog skill does — through `list_skills` / `read_skill`, on request,
-- never pasted into every prompt — and only in that user's own chats.
--
-- No browser policies, like `user_mcp_servers`: every read and write goes
-- through /api/mcp-servers?skills=… where the JWT is verified and the
-- service-role client is scoped to the user by hand. The content is text a
-- stranger wrote; it is stored as text and rendered as text.
--
-- Run this file in the Supabase SQL editor (after flight_controls.sql, which
-- defines set_flight_controls_updated_at()).

create table if not exists public.user_skills (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  slug text not null check (slug ~ '^[a-z0-9][a-z0-9_-]{1,62}$'),
  name text not null check (char_length(name) between 1 and 80),
  description text not null default '' check (char_length(description) <= 600),
  -- The SKILL.md body, front matter included. Bounded so one install cannot
  -- fill a tool result on its own.
  content text not null check (char_length(content) between 1 and 80000),
  -- Where it came from: the directory, its id there, its page, and the exact
  -- file that was fetched — so a user can see what they installed and from where.
  source text not null check (source in ('skills.sh', 'skillsmp', 'github')),
  source_id text check (char_length(source_id) <= 300),
  page_url text check (page_url ~ '^https://'),
  raw_url text not null check (raw_url ~ '^https://raw\.githubusercontent\.com/'),
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- One slug per user, not globally: two people may both install "frontend-design".
  constraint user_skills_slug_unique unique (user_id, slug)
);

create index if not exists user_skills_user_enabled_idx
on public.user_skills(user_id, enabled);

alter table public.user_skills enable row level security;

drop trigger if exists user_skills_updated_at on public.user_skills;
create trigger user_skills_updated_at
before update on public.user_skills
for each row execute function public.set_flight_controls_updated_at();
