# Agent task prompts

Copy one block below into a fresh Claude Code session. One task per session — don't batch.

---

## The template

Replace `<TASK-ID>` and paste:

```
Work on task <TASK-ID> in production-check.md.

First read CLAUDE.md, then read that task's full section in production-check.md.
Do that task only. If you spot something else broken, note it at the end — don't fix it.

Before you start, re-verify the problem yourself. The task descriptions include
evidence (line numbers, curl output, reproductions). Confirm it still holds — if
the code has moved or the diagnosis is wrong, say so and stop rather than
implementing a fix for a problem that isn't there.

When done:
1. Run `npx tsc --noEmit` and `npm run lint`. Report the before/after counts
   honestly — if your change made either worse, say so.
2. Run `npm run dev` and verify the change in the actual app, not just in theory.
3. Satisfy every bullet in that task's "Done when" section. Show the evidence.
4. Mark the task done in production-check.md with a one-line note on what changed.

Don't commit or push. Don't touch files the task doesn't name.

Report at the end: what you changed, what you verified, what you couldn't verify
and why, and anything you found that should become a new task.
```

---

## Ready to paste — start here

Step 1 of the execution order. This is the highest-priority work in the repo.

```
Work on tasks 0.1 and 0.2 in production-check.md — authenticating the AI proxy
and fixing the memory IDOR. They're one change: both are caused by /api/ai-proxy
trusting `userId` from the request body instead of the Authorization header it
already receives.

First read CLAUDE.md, then read sections 0.1 and 0.2 in production-check.md.

Verify the bug yourself before fixing it. Start the dev server and run:

  curl -s -i -X POST http://localhost:5173/api/ai-proxy \
    -H 'Content-Type: application/json' \
    -d '{"messages":[{"content":"hi","isAI":false}],"persona":"default","userId":"00000000-0000-0000-0000-000000000001"}'

That currently returns 200 with a full completion and no auth. Confirm it.

Then implement the fix described in 0.1: use getAuthenticatedRequestUser(req)
from api/_lib/auth.ts, derive userId from the verified token, and remove userId
from the destructured request body entirely. Keep anonymous users working via a
trial path — don't require auth to send a first message.

Constraint that matters: src/services/ai/aiProxyService.ts already sends
`Authorization: Bearer <token>`. Don't change the client contract; the server
just needs to read what's already there.

Note on testing: .env has DUMMY Supabase credentials, so token verification
can't be tested end-to-end locally — getAuthenticatedRequestUser will return
null for any token. Test what you can (unauthenticated requests are rejected or
routed to the anonymous path; body-supplied userId is ignored), and state
clearly which parts need real Supabase credentials to verify. Do not fake a
passing test.

When done:
1. Run `npx tsc --noEmit` and `npm run lint`. Report before/after counts.
2. Verify in the browser that anonymous chat still works.
3. Satisfy every "Done when" bullet in both 0.1 and 0.2. Show the evidence.
4. Mark both tasks done in production-check.md.

Don't commit or push.

Report: what you changed, what you verified, what needs real Supabase creds to
confirm, and anything new you found.
```

---

## Order

From `production-check.md` → *Suggested execution order*. Two hard rules:

- **1.12 → 1.9 → 1.10** is a strict sequence. Retry identifies turns by message ID, so UUIDs must land first, and Retry needs 1.9 to know a stream actually failed.
- **LS.2 before LS.3.** Get IndexedDB working while Supabase is still there as a fallback.

Everything else in a given step can run in parallel sessions.
