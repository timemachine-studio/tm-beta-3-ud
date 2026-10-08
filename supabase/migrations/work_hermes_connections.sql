-- Local proposal. Apply explicitly after the existing harness migrations.
-- Does not configure a service, grant premium access or authorize execution.
begin;
create table public.work_hermes_connections (
  id uuid primary key default gen_random_uuid(), user_id uuid not null unique references auth.users(id) on delete cascade,
  base_url text not null unique check(length(base_url) between 8 and 2048),
  credential_ref text not null unique check(credential_ref ~ '^[A-Z][A-Z0-9_]{2,79}$'),
  enabled boolean not null default false, scope_verified_at timestamptz,
  revision int not null default 1 check(revision>0), created_at timestamptz not null default now(),
  check(not enabled or scope_verified_at is not null)
);
alter table public.work_hermes_connections enable row level security;
revoke all on public.work_hermes_connections from public,anon,authenticated;
grant all on public.work_hermes_connections to service_role;
create function public.work_hermes_connection_revision() returns trigger
language plpgsql set search_path=public as $$
begin
  new.revision:=old.revision+1;
  return new;
end $$;
create trigger work_hermes_connection_changed before update on public.work_hermes_connections
  for each row execute function public.work_hermes_connection_revision();
revoke all on function public.work_hermes_connection_revision() from public,anon,authenticated;
comment on column public.work_hermes_connections.scope_verified_at is
  'Administrator attestation of an owner-dedicated Hermes API server/profile and authenticated Bearer key. Not proof of sandbox isolation.';
comment on column public.work_hermes_connections.credential_ref is 'Suffix of server-only TM_WORK_UPSTREAM_SECRET_<ref>; no credential value is stored here.';
commit;
