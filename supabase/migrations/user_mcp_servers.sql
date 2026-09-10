-- User-added MCP servers.
--
-- The curated `flight_control_catalog` is what an operator publishes for
-- everyone. This is what a user adds for themselves, which is a different
-- thing in one important way: it can carry their own credential.
--
-- That credential is encrypted before it ever reaches this table
-- (api/_lib/mcpCredentials.ts, AES-256-GCM) and the key lives in
-- MCP_CREDENTIAL_KEY, never here — so a dump of this table on its own does not
-- yield anyone's tokens.
--
-- Run this file in the Supabase SQL editor.

create table if not exists public.user_mcp_servers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  slug text not null check (slug ~ '^[a-z0-9][a-z0-9_-]{1,62}$'),
  name text not null check (char_length(name) between 1 and 80),
  description text not null default '',
  server_url text not null check (server_url ~ '^https://'),
  auth_mode text not null default 'none' check (auth_mode in ('none', 'bearer')),
  -- Ciphertext only. Never a token in the clear, and never returned to a
  -- browser: see api/mcp-servers.ts, which strips it from every response.
  credential_ciphertext text,
  mcp_allowed_tools text[] not null default '{}',
  mcp_auto_approve_tools text[] not null default '{}',
  mcp_connect_timeout_ms integer not null default 8000 check (mcp_connect_timeout_ms between 1000 and 30000),
  mcp_call_timeout_ms integer not null default 30000 check (mcp_call_timeout_ms between 1000 and 120000),
  mcp_result_char_limit integer not null default 12000 check (mcp_result_char_limit between 1000 and 50000),
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- One slug per user, not globally: two people may both add "weather".
  constraint user_mcp_servers_slug_unique unique (user_id, slug),

  -- Bearer auth without a credential is a server that cannot authenticate, and
  -- a credential without bearer auth is a secret stored for no reason.
  constraint user_mcp_auth_consistent check (
    (auth_mode = 'none' and credential_ciphertext is null)
    or
    (auth_mode = 'bearer' and credential_ciphertext is not null)
  ),

  -- Same rule the catalog enforces: a tool may only be auto-approved if it is
  -- allowed at all, or auto-approval would be a way to widen the allow-list.
  constraint user_mcp_auto_approve_subset check (mcp_auto_approve_tools <@ mcp_allowed_tools),

  -- An empty allow-list means every tool is refused, which is a server that
  -- does nothing. Better to reject it at write time than to puzzle over it.
  constraint user_mcp_allowlist_nonempty check (cardinality(mcp_allowed_tools) > 0)
);

create index if not exists user_mcp_servers_user_enabled_idx
on public.user_mcp_servers(user_id, enabled);

drop trigger if exists user_mcp_servers_updated_at on public.user_mcp_servers;
create trigger user_mcp_servers_updated_at
before update on public.user_mcp_servers
for each row execute function public.set_flight_controls_updated_at();

alter table public.user_mcp_servers enable row level security;

-- Deliberately no browser policies, exactly as mcp_tool_runs does it. The
-- ciphertext column must never be selectable from the client, and a policy
-- that granted row access would grant column access with it. Reads and writes
-- go through /api/mcp-servers, which verifies the JWT and strips the
-- ciphertext from every response.
revoke all on public.user_mcp_servers from anon, authenticated;
