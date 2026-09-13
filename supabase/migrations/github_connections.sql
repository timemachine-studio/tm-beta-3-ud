-- GitHub connections for Max Mode (api/_lib/github.ts).
--
-- One row per user: the user-to-server token the GitHub App issued when they
-- authorized it, plus its refresh token when the App has expiring tokens on.
-- Both are ciphertext — encrypted with MCP_CREDENTIAL_KEY before they reach
-- this table, exactly like user_mcp_servers.credential_ciphertext — so a dump
-- of this table yields nobody's GitHub access.
--
-- Run this file in the Supabase SQL editor.

create table if not exists public.github_connections (
  user_id uuid primary key references auth.users(id) on delete cascade,
  github_login text not null,
  github_user_id bigint not null,
  access_ciphertext text not null,
  refresh_ciphertext text,
  access_expires_at timestamptz,
  refresh_expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.github_connections enable row level security;

-- No browser policies, as with user_mcp_servers: a policy granting row access
-- would grant the ciphertext columns with it. Every read and write goes
-- through /api/mcp-servers?github=…, which verifies the JWT and never returns
-- the ciphertext.
revoke all on public.github_connections from anon, authenticated;
