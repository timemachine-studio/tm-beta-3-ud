-- TimeMachine PRO: background generation jobs (Trigger.dev)
-- Tracks long-running PRO generations so they survive Vercel's 5-minute
-- serverless limit and so clients can reattach after a page refresh.
-- Run this entire file in the Supabase SQL editor before deploying the app.

create table if not exists public.pro_generation_jobs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Null for anonymous users. Writes happen via the service role key.
  user_id uuid references auth.users(id) on delete cascade,
  -- Client-generated chat session UUID. Null for group chats.
  chat_session_id text,
  -- Trigger.dev run id, attached right after the run is triggered.
  run_id text unique,
  persona text not null default 'pro',
  status text not null default 'running' check (status in ('running', 'completed', 'failed')),
  error text,
  final_content text
);

create index if not exists pro_generation_jobs_chat_session_id_idx
  on public.pro_generation_jobs (chat_session_id);

create index if not exists pro_generation_jobs_user_id_idx
  on public.pro_generation_jobs (user_id);

create or replace function public.set_pro_generation_jobs_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists pro_generation_jobs_updated_at on public.pro_generation_jobs;
create trigger pro_generation_jobs_updated_at
  before update on public.pro_generation_jobs
  for each row execute function public.set_pro_generation_jobs_updated_at();

alter table public.pro_generation_jobs enable row level security;

-- All reads in the app go through our API routes (service role), so direct
-- table access only needs to let owners see their own rows.
drop policy if exists "pro_generation_jobs_select_own" on public.pro_generation_jobs;
create policy "pro_generation_jobs_select_own"
  on public.pro_generation_jobs
  for select
  using (auth.uid() = user_id);
