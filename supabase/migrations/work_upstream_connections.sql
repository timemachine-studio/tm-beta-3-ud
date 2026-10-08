-- Apply after work_harness.sql. Administrator provisioning only; never applied
-- automatically by the browser or the native worker.
begin;
create table if not exists public.work_service_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  service text not null check (service in ('openhands', 'agenta')),
  base_url text not null check (length(base_url) between 8 and 2048),
  credential_ref text not null unique check (credential_ref ~ '^[A-Z][A-Z0-9_]{2,79}$'),
  scope_id uuid,
  enabled boolean not null default false,
  scope_verified_at timestamptz,
  created_at timestamptz not null default now(),
  unique (id, user_id), unique (user_id, service),
  check ((service = 'agenta' and scope_id is not null) or (service = 'openhands' and scope_id is null)),
  check (not enabled or scope_verified_at is not null)
);
-- OpenHands Agent Server must be dedicated to this owner. Agenta API keys must
-- be project-bound. URL uniqueness does not replace runtime isolation checks.
create unique index if not exists work_openhands_dedicated_server
  on public.work_service_connections(base_url) where service = 'openhands';
create unique index if not exists work_agenta_dedicated_project
  on public.work_service_connections(base_url, scope_id) where service = 'agenta';
create table if not exists public.work_runtime_bindings (
  task_id uuid primary key,
  user_id uuid not null,
  connection_id uuid not null,
  remote_conversation_id uuid not null,
  created_at timestamptz not null default now(),
  foreign key (task_id, user_id) references public.work_tasks(id, user_id) on delete cascade,
  foreign key (connection_id, user_id) references public.work_service_connections(id, user_id) on delete cascade,
  unique (connection_id, remote_conversation_id)
);
alter table public.work_service_connections enable row level security;
alter table public.work_runtime_bindings enable row level security;
revoke all on public.work_service_connections, public.work_runtime_bindings from anon, authenticated;
grant all on public.work_service_connections, public.work_runtime_bindings to service_role;
comment on column public.work_service_connections.credential_ref is
  'Suffix of TM_WORK_UPSTREAM_SECRET_<ref>. Credentials never stored in this table.';
comment on column public.work_service_connections.scope_verified_at is
  'Administrator attestation of dedicated runtime or matching project-bound API key, not automatic verification.';
commit;
