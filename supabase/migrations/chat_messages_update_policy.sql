-- ============================================================================
-- chat_messages: let a user update their own rows
--
-- Problem: the table has INSERT, SELECT and DELETE policies for the owner but
-- no UPDATE policy. Verified against the live project on 2026-09-16 from a
-- signed-in browser:
--
--   insert own row            → 1 row        (allowed)
--   update own row            → 0 rows       (RLS filters it out, no error)
--   upsert onto own row       → 42501 "new row violates row-level security
--                                policy (USING expression)"
--   delete own row            → 1 row        (allowed)
--
-- The client saves a chat with `upsert(rows, { onConflict: 'id' })`, which is
-- INSERT ... ON CONFLICT DO UPDATE. The first save of a chat only inserts and
-- succeeds; every save after it hits existing ids, takes the UPDATE path, and
-- is refused — so "This chat couldn't be saved" appeared after every turn even
-- though the first turn was stored. The same policy shape as INSERT/DELETE:
-- owner only, on both the row being changed and the row it becomes.
--
-- Idempotent: safe to run more than once.
-- ============================================================================

alter table public.chat_messages enable row level security;

drop policy if exists "Users can update own messages" on public.chat_messages;

create policy "Users can update own messages"
  on public.chat_messages
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- chat_sessions already updates (the session upsert succeeded in the same
-- test), but the same statement is harmless there and keeps the pair aligned.
alter table public.chat_sessions enable row level security;

drop policy if exists "Users can update own sessions" on public.chat_sessions;

create policy "Users can update own sessions"
  on public.chat_sessions
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
