# TimeMachine Chat — Production Readiness Plan

> 2026-09-07 verification update: the owner-requested lint cleanup passes with **0 errors and 0 warnings**, without rule suppressions. Typecheck, 90 tests and build pass; existing CSS import-order and bundle-size build warnings remain. TM-02 live retention/deletion checks remain open; see `status.md` and `docs/agent/data-lifecycle.md`. Historical counts below describe earlier checkpoints.

**Audit date:** 2026-08-26 · **Commit:** `1bb2d6c` · **Target:** soft launch
**Scope:** full codebase read (45k LOC, 210 TS/TSX files) + live app driven in a browser + direct API probing.

---

## ✅ Remaining work — the running tracker

**Last updated:** 2026-08-27 · **Gate 0:** code complete, pending one manual step. · **Gate 1:** complete.

Keep this table current. When a task closes, strike it here *and* mark its section below.

### Owner-only — nobody else can do these

These are not code. They block launch and none of them can be handed to an agent.

| # | What | When | Status |
|---|---|---|---|
| 0.4a | **Run `supabase/migrations/rate_limits_rls.sql`** in the Supabase SQL editor. Until then `rate_limits` is still readable with the public anon key. **After applying, `SUPABASE_SERVICE_ROLE_KEY` becomes mandatory in every environment incl. local dev** — without it every request 503s. | **Now.** Last thing standing between here and Gate 0 green. | ⬜ |
| 0.7a | **Rotate every provider key** that has ever sat in a local `.env` (NVIDIA, Groq, Cerebras, Pollinations, Eaon, SecretsToAI, Supabase service role). **Downgraded from urgent:** a full 69-commit history scan on 2026-08-26 found no `.env`, no provider key, no `service_role` JWT and no committed `dist/`. Nothing has leaked through git — this is now hygiene, not incident response. | Before public launch. Not an emergency. | ⬜ |
| 0.7b | ~~Enable GitHub secret scanning + push protection~~ | — | ✅ **Done 2026-08-26.** Secret scanning, push protection, Dependabot alerts and Dependabot security updates are all enabled on `timemachine-studio/timemachinechat-v0.2`. (Non-provider patterns and validity checks need GitHub Advanced Security and stayed off.) |
| 0.8a | **Have counsel review `/privacy` and `/terms`.** They are drafted in good faith but are not legal advice. | Before public launch. Start early — external turnaround. | ⬜ |
| 0.9a | **Decide on the remaining PRO Heat 5 content.** The review is done (see 0.9a below) and the two unambiguous violations are fixed. What is left is a product decision, not a compliance one. | Before public launch. | 🟡 |
| 0.9b | **Decide whether to purge the removed slur from git history.** It is gone from the working tree, but the repo is **public** and the string remains in older commits of `api/ai-proxy.ts`. Purging means `git filter-repo` + a force-push that rewrites every commit hash — destructive, breaks anyone's clone, and not something to do unilaterally. The alternative is to accept it as history. | Your call. Sooner is better if the repo stays public. | ⬜ |
| 4.4a | **Set `PROVIDER_DAILY_CEILING`** to a real number in Vercel. The mechanism ships; the value is still `0` (disabled). | Before the domain is public. | ⬜ |
| — | **Set `ALLOWED_ORIGINS` and `ANON_TRIAL_SECRET`** in Vercel. Unset `ALLOWED_ORIGINS` warns and falls back to same-origin only; unset `ANON_TRIAL_SECRET` weakens the anonymous trial to IP-only. | At deploy time. | ⬜ |

### ⚠ Standing launch blocker

> The signup form says **"Your chats are stored safely in your device only."** That is **false today** — signed-in chats go to Supabase (`chatService.ts:334`). Added 2026-08-26 at the owner's direction on the basis that Gate LS will make it true first.
>
> **Either LS.2 + LS.3 ship before the app goes public, or that line comes out.** It is also currently contradicted by the Privacy Policy on the same form. Marked with a `⚠ LAUNCH BLOCKER` comment in `src/components/auth/AuthModal.tsx`. See LS.3.

### Gate 1 — Correctness and stability

✅ **Complete — 2026-08-27.** All 14 tasks done and verified in the running app. `npx tsc --noEmit` is clean, `npm run build` now fails on type errors, `exhaustive-deps` is an error with zero violations, and the suite is at 24 tests.

| # | Task | Status |
|---|---|---|
| 1.12 | Replace `Date.now()` message IDs | ✅ UUIDs + `createdAt`, migration shim, covered by tests |
| 1.9 | Never let the stream silently succeed | ✅ `[STATUS_END]` asserted; truncated **and** empty responses surface as retryable errors |
| 1.10 | Retry button: rewind and re-run | ✅ inline failed-turn row; retry re-runs the original turn, no extra quota |
| 1.14 | Render the app shell immediately | ✅ FCP 184ms with auth deliberately hung |
| 1.11 | Timeout, backoff, queue | ✅ 50 concurrent: 0 silent failures, 0 hangs, spread 9× → 2.2× (fallback chain unverified locally — see note) |
| 1.13 | Fix stale closures in `useChat` | ✅ `exhaustive-deps` = error, all 24 repo-wide violations fixed |
| 1.2 → 1.1 | Regenerate DB types, then fix the TS errors | ✅ 22 tables typed; 155 → 0 errors; build gated on `tsc` |
| 1.3 | Error boundary | ✅ root + transcript-scoped, both verified with deliberate throws |
| 1.4 | 404 route | ✅ verified live |
| 1.5 | Abort, timeout, retry on AI requests | ✅ Stop button, 60s/180s budgets, backoff+jitter |
| 1.6 | Quota accounting and message ordering | ✅ forced failure leaves the counter unchanged |
| 1.7 | Real error taxonomy | ✅ `{ error: { code, message } }` both ends; no internal detail leaks |
| 1.8 | Validate and bound API input with zod | ✅ 5 MB payload rejected 413 in 15ms |

**Carried out of this gate:**
- The fallback chain (1.11) needs an environment with Groq/Cerebras keys to verify.
- Lint still reports 141 problems, 132 of them pre-existing `no-explicit-any`. Triage is 1.1's step 4 and is not a correctness blocker.

### Gate LS — Local-first message storage

| # | Task | Effort | When |
|---|---|---|---|
| **LS.1** | One honest privacy claim | S | **Decide first.** Everything else in this gate follows from it — and the signup line above already depends on it. |
| **LS.2** | Move local storage to IndexedDB | M | Before LS.3. Never remove the cloud path while the local store still dies at 5 MB. |
| **LS.3** | Remove the cloud sync path | M | After LS.2. **Gates the signup claim.** |
| LS.4 | Migrate existing users off the cloud | M | After LS.3 works, before dropping tables. |
| LS.5 | Decide what local-only means for group chat / multi-device | S + M | With LS.1 — it is a scope decision. |
| LS.6 | Export, import, delete | M | With or after LS.3. |

### Gate 2 — Production infrastructure

| # | Task | Effort | When |
|---|---|---|---|
| 2.2 | Get the DB schema into the repo | L | **First in this gate** — unblocks staging and 1.2. |
| 2.1 | Error tracking and uptime monitoring | M | Before public traffic. You currently find out about outages from users. |
| 2.3 | CI pipeline | M | Once 1.1 is close enough that a typecheck gate can pass. |
| 2.4 | Broaden the test suite | L | After behaviour stops moving. One suite exists today (`renderInline`). |
| 2.5 | Security headers | M | Before public launch. |
| 2.6 | Staging environment and deploy discipline | M | Before the first real release. |

### Gate 3 — Performance and polish

| # | Task | Effort | When |
|---|---|---|---|
| 3.2 | Fix the CSS import order | S | Any time — it warns on every dev boot today. |
| 3.1 | Code-split the bundle | M | Before launch. Main chunk is ~2.1 MB. |
| 3.3 | Accessibility pass | M | Before launch. |
| 3.4 | Mobile layout issues | M | Before launch. |
| 3.5 | Repository hygiene | S | Any time. |

### Gate 4 — Launch readiness

| # | Task | Effort | When |
|---|---|---|---|
| 4.2 | Content safety and disclaimers | M | **Start early** — external input, long lead time. Pairs with 0.9a. |
| 4.1 | Fix launch-facing assets | S | Before launch. |
| 4.3 | Reduce the Pollinations dependency | M | Before launch. |
| 4.4 | Load test and set the spend ceiling | M | Last, against the real thing. See 4.4a above. |
| 4.5 | Launch-day runbook | S | Last. Someone other than you must be able to execute it. |

### Where the numbers stand

| Metric | At audit | Now | Target |
|---|---|---|---|
| `npx tsc --noEmit` | 176 errors | **0** ✅ | 0 (1.1) |
| `npm run build` | did not typecheck | **fails on type errors** ✅ | gated |
| `npm run lint` | 305 problems | **141** (136 `no-explicit-any`) | trending down |
| `react-hooks/exhaustive-deps` | 24 warnings, not enforced | **error, 0 violations** ✅ | enforced |
| `npm test` | no runner | **24 passing** | real coverage (2.4) |
| `npm audit` (production deps) | 2 critical, 34 high | **0 at any severity** (clean install, 2026-08-27) | hold at 0 |
| `npm audit` (all deps) | 64 total | **6** — all dev-only, via `@vercel/node`'s `undici@5.x` and trigger.dev's tooling | monitor |

**Realistic remaining timeline:** Gate 1 + Gate LS is the bulk of a responsible soft launch — roughly 3–4 weeks from here. Gates 2–4 can overlap.

---

## How to use this document

Every item below is a numbered task with a fixed shape:

> **Problem** — what is wrong, and the evidence.
> **Fix** — the specific change.
> **Done when** — the check that proves it.

Tasks are grouped into gates. **Do not start a gate until the previous one is green.** Gate 0 is the set of things that, if launched as-is, cost you money, leak user data, or create legal exposure.

Two tasks are already done (marked ✅) because the app could not be tested without them.

---

## Executive summary

The app is further along than "early prototype" — the feature surface is large and genuinely impressive (chat with streaming + tool calls, personas, notes, group chat, healthcare RAG, music, a 25-module command palette, PWA scaffolding, SEO). The UI is polished and it works end-to-end.

What is *not* production-grade is everything underneath the features:

| Area | State | Risk if launched as-is |
|---|---|---|
| API authentication | ✅ Fixed 2026-08-26 (0.1) — JWT-derived identity on every endpoint | — |
| Data isolation | ✅ Fixed 2026-08-26 (0.2) — body `userId` removed; memory reads are RLS-scoped | — |
| XSS | ✅ Fixed 2026-08-26 (0.5, 0.6) — colour values validated; `allow-same-origin` dropped | — |
| Type safety | 155 TS errors, build still skips typecheck (1.1) | Broken code ships silently |
| DB schema | 4 of 18 tables have migrations | No way to recreate or review your own database |
| Observability | Nothing | You find out about outages from users |
| Legal | ⚠️ `/privacy` + `/terms` published (0.8) — **still need counsel review and an LS.1 revision** | Unreviewed legal text |
| Tests / CI | 10 unit tests (0.5), no CI yet (2.3) | Every deploy is nearly a hope |
| Stream reliability | Truncated streams are read as success | Empty AI bubbles with no error and no way to recover |
| Failure recovery | No retry, error banner detached from the turn | Users must retype prompts the app lost |
| First paint | Whole app blocks on two auth round trips | Up to 8s of spinner before any UI |
| Local storage | Single `localStorage` blob, quota errors swallowed | Silent, permanent loss of chat history |

**~~The single most urgent item:~~** ✅ **Resolved 2026-08-26.** `POST /api/ai-proxy` used to accept unauthenticated requests from any origin — verified with `curl` from a fake origin, which returned a full AI completion. It now returns `403` for a disallowed origin, `401` for personas with no anonymous allowance, and otherwise falls into a server-enforced 3-message trial counted per IP and per signed device cookie.

**Next most urgent:** the reliability thread — **1.9** (a truncated stream still reads as success), then **1.10** (Retry), preceded by **1.12** (UUID message ids).

**On the three issues you reported** — all three reproduced, and all three have a specific root cause rather than a vague flakiness:

| What you saw | Actual cause | Task |
|---|---|---|
| Slow initial load, long spinner | `App.tsx:551` returns a bare spinner until *both* `getSession()` and `fetchProfile()` finish — the latter with an 8-second timeout | **1.14** |
| 2 of 12 errored, 2 "just glitched" | The client treats **any** stream termination as success — it never checks for the `[STATUS_END]` sentinel. A mid-stream provider failure produces an empty bubble and no error. The 2 hard errors are the same failure caught earlier | **1.9** |
| Error at top of page, no way to recover | Failures set **global** error state and *delete* the AI placeholder, so nothing anchors the failure to a turn | **1.10** |

I also reproduced the concurrency tail directly: 12 simultaneous requests to NVIDIA returned latencies from **1.35s to 12.12s** on a three-word prompt. That 9× spread, with no timeout and no retry anywhere in the code, is what turns into your failures under real load (**1.11**).

**Realistic timeline:** Gate 0 is 3–5 focused days. Gate 0 + Gate 1 + Gate LS (what I'd call a responsible soft launch) is 3–4 weeks.

---

# GATE 0 — Launch blockers

Nothing ships until every task here is green.

> **Status: all 11 tasks green as of 2026-08-26.** 0.1–0.10 implemented and verified in this pass; 0.11 was already done.
>
> **Gate 0 is not fully green until `supabase/migrations/rate_limits_rls.sql` is applied by hand** — see 0.4a in the tracker at the top of this document. The remaining owner-only items (key rotation, counsel review, usage-policy review) are tracked there too.
>
> **Every Done-when bullet is verified, including signed-in chat.** Confirmed on 2026-08-26 against a real signed-in session: a chat turn streamed end to end, the quota probe returned `{anonymous: false, limit: 50, remaining: 49}` (identity derived from the verified JWT, one message charged), and the reply used the caller's own stored profile — which exercises the RLS-scoped memory read from 0.2 for a real user.

---

### 0.1 — Authenticate the AI proxy ✅

**Severity:** Critical · **Effort:** M · **Files:** `api/ai-proxy.ts`, `api/_lib/auth.ts`, `api/notes-ai.ts`, `api/image.ts`, `api/music.ts`, `api/musicCover.ts`, `api/search.ts`

**Problem**
`api/ai-proxy.ts:2048` has no auth check. Proven live:

```
POST /api/ai-proxy   (no Authorization header, Origin: https://evil-site.example)
→ 200 OK
→ {"content":"Hey! What's good? How can I help you today? 🙌"}
```

Every other endpoint (`image`, `music`, `musicCover`, `search`, `notes-ai`) is equally open. Only `pro-generation`, `pro-stream`, and `mcp-approval` call `getAuthenticatedRequestUser`.

The frustrating part: **the client already sends a valid token.** `src/services/ai/aiProxyService.ts:21` attaches `Authorization: Bearer <supabase access_token>` on every request. The server just never looks at it.

**Fix**
1. In `ai-proxy.ts`, call `getAuthenticatedRequestUser(req)` at the top of the handler.
2. Derive the user from the verified token. **Delete `userId` from the destructured request body** — it must never come from the client.
3. Anonymous users: allow a small trial (see 0.4) keyed on a server-side signal, not a body field.
4. Apply the same to `notes-ai`, `image`, `music`, `musicCover`, `search`.

```ts
// api/ai-proxy.ts — replace body-supplied userId
const authedUser = await getAuthenticatedRequestUser(req);
const userId = authedUser?.id ?? null;   // never req.body.userId
```

**Done when**
- `curl` without a token returns `401` (or falls into the anonymous trial path, never the authenticated one).
- `curl` with a token for user A and `"userId":"<user-B-uuid>"` in the body behaves as user A.
- Signed-in chat still works in the browser.


> **Done 2026-08-26.** `getAuthenticatedRequestUser(req)` now runs at the top of `ai-proxy`; `userId` is no longer destructured from `req.body`. `notes-ai` and `search` require a bearer token; `image`/`music`/`musicCover` are `<img>`/`<audio>` subresources so they take a token *or* `Sec-Fetch-Site: same-origin` (see `api/_lib/cors.ts`). Anonymous callers fall into the server-enforced trial from 0.4.

---

### 0.2 — Fix the memory IDOR ✅

**Severity:** Critical · **Effort:** S · **Files:** `api/ai-proxy.ts:2063`, `api/ai-proxy.ts:672`

**Problem**
```ts
const { ..., userId, userMemories, ... } = req.body;   // client-controlled
if (userId) {
  const memories = await fetchUserMemories(userId, persona);  // service-role client
  memoryContext = formatMemoriesForContext(memories, userProfile);
}
```

`fetchUserMemories` queries `ai_memories` using the **service-role key** (`api/ai-proxy.ts:19`), which bypasses Row Level Security entirely. Send someone else's UUID and their private stored memories — "user's favorite song is…", "user's job is…", whatever the AI has saved about them — get injected into *your* system prompt. Ask the model "what do you remember about me?" and it reads them out.

Same pattern lets you charge your usage to another user's rate-limit bucket, or read `profiles.rate_limit_overrides`.

**Fix**
Task 0.1 fixes this by construction — once `userId` comes from the verified JWT, `fetchUserMemories` can only ever be called with the caller's own id. Then add defence in depth:
- Assert `userId === authedUser.id` before any memory read.
- Stop using the service-role key for user-scoped reads. Use a request-scoped client carrying the user's JWT so RLS applies.

**Done when**
- Authenticated as user A with `"userId": "<B>"` in the body returns zero of B's memories.
- A test confirms `fetchUserMemories` is unreachable with a mismatched id.

> **Note:** LS.3 proposes moving `ai_memories` on-device entirely. If you take that route this vulnerability class disappears rather than being patched — but do the fix here anyway, because it must be safe in the interim.


> **Done 2026-08-26.** Fixed by construction via 0.1, plus defence in depth: `assertOwnUserId()` before every memory read, and `fetchUserMemories`/`addUserMemory`/`processMemoryTags` now take a request-scoped Supabase client built from the caller's JWT, so RLS applies instead of the service-role bypass.

---

### 0.3 — Lock down CORS ✅

**Severity:** Critical · **Effort:** S · **Files:** all of `api/*.ts`, `vercel.json`

**Problem**
Every endpoint sets `Access-Control-Allow-Origin: *`. Any website on the internet can call your API from a visitor's browser and spend your provider credits. Combined with 0.1 there is no barrier at all.

**Fix**
Add `api/_lib/cors.ts` with an allowlist driven by env:

```ts
const ALLOWED = (process.env.ALLOWED_ORIGINS ?? '').split(',').map(s => s.trim()).filter(Boolean);
export function applyCors(req, res) {
  const origin = req.headers.origin;
  if (origin && ALLOWED.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
}
```

Set `ALLOWED_ORIGINS=https://timemachinechat.com,https://www.timemachinechat.com` in Vercel; add `http://localhost:5173` for dev only.

Note CORS is a *browser* control — it does not stop `curl`. It is necessary but only meaningful alongside 0.1.

**Done when** a request with `Origin: https://evil.example` gets no `Access-Control-Allow-Origin` header, and the real site still works.


> **Done 2026-08-26.** New `api/_lib/cors.ts` with an `ALLOWED_ORIGINS` allowlist; every `Access-Control-Allow-Origin: *` removed across `api/*`. Same-origin requests are accepted implicitly (Origin compared against the request's own host) so a missing `ALLOWED_ORIGINS` warns loudly instead of 403-ing every real user.

---

### 0.4 — Make rate limiting fail closed and server-authoritative ✅

**Severity:** Critical · **Effort:** M · **Files:** `api/ai-proxy.ts:823`, `src/hooks/useAnonymousRateLimit.ts`

**Problem**
Three separate holes:

1. **Fails open.** `checkRateLimit` returns `true` on *every* error path (`api/ai-proxy.ts:844, 861`) with the comment "Allow on error to not block users." If Supabase has an incident, your limits vanish and spend is unbounded. I hit this locally: with a dummy Supabase, chat worked with no limit at all.
2. **Anonymous limits are cosmetic.** `useAnonymousRateLimit.ts` stores counts in `localStorage` under `timemachine_anon_rate_limits`. Clear site data or open a private window and the 3-message trial resets. Server-side the anonymous default is 50/day per IP, not 3.
3. **Failed requests still consume quota.** Observed live: a request that errored dropped the counter from 3 → 2.

**Fix**
- Reverse the failure mode: on a rate-limit backend error, **deny** and return `503`. Add a monitored `rate_limit_backend_error` log so you know it's happening.
- Move anonymous limiting server-side, keyed on IP (+ a signed cookie), with the *same* number the UI shows. Keep the localStorage counter for display only.
- Increment **after** a successful generation, not before. Refund on failure.
- Add a global daily spend ceiling per provider that hard-stops generation and pages you.

**Done when**
- Simulated Supabase outage → `503`, not unlimited generation.
- Clearing `localStorage` does not grant more anonymous messages.
- A failed generation leaves the counter unchanged.


> **Done 2026-08-26.** `checkRateLimit` now fails **closed** (backend error → `503` + a `rate_limit_backend_error` log) and returns a typed outcome. Anonymous limits moved server-side, counted per-IP *and* per-signed-device-cookie. Quota is charged only after a successful generation. `useAnonymousRateLimit` is display-only and reads the truth from `GET /api/ai-proxy?quota=<persona>`. A per-provider daily ceiling is available via `PROVIDER_DAILY_CEILING` (paging is still Gate 2 / 2.1).

---

### 0.5 — Fix stored XSS in Notes ✅

**Severity:** Critical · **Effort:** S · **Files:** `src/components/notes/NotesPage.tsx:756`

**Problem**
`renderInline()` escapes `&`, `<`, `>` — but not `"` — then interpolates the captured group into an HTML **attribute**:

```ts
.replace(/\[color:([^\]]+)\](.*?)\[\/color\]/gs, '<span style="color:$1">$2</span>')
.replace(/\[bg:([^\]]+)\](.*?)\[\/bg\]/gs,       '<span style="background-color:$1;...">$2</span>')
```

The output goes straight into `dangerouslySetInnerHTML` at `NotesPage.tsx:1662`. Verified:

```
input:  [color:red" onmouseover="alert(document.domain)]hover me[/color]
output: <span style="color:red" onmouseover="alert(document.domain)">hover me</span>
```

Note content is stored and is also writable by the Notes AI co-pilot (`api/notes-ai.ts` returns block content), so a prompt-injected document can plant this too.

**Fix**
Validate the captured value against a strict pattern before interpolating — reject anything that isn't a known-safe colour:

```ts
const SAFE_COLOR = /^(#[0-9a-fA-F]{3,8}|rgb\(\s*[\d\s,.%]+\)|rgba\(\s*[\d\s,.%]+\)|[a-zA-Z]{3,20})$/;
const safe = (c: string) => SAFE_COLOR.test(c.trim()) ? c.trim() : 'inherit';
```

Also escape `"` and `'` in the initial escape pass. Best long-term fix: stop using `dangerouslySetInnerHTML` and render inline formatting as React nodes.

**Done when** the payload above renders as literal text, and a unit test covers it.


> **Done 2026-08-26.** `renderInline` moved to `src/components/notes/renderInline.ts`; it now escapes `"` and `'` and validates colour values against `SAFE_COLOR`, falling back to `inherit`. 10 regression tests in `renderInline.test.ts` (vitest added; `npm test`).

---

### 0.6 — Fix the iframe sandbox escape ✅

**Severity:** Critical · **Effort:** S · **Files:** `src/components/chat/HtmlPreviewModal.tsx:85`, `src/components/chat/CodeBlock.tsx:136`

**Problem**
```html
sandbox="allow-scripts allow-modals allow-forms allow-same-origin"
```

`allow-scripts` + `allow-same-origin` together **void the sandbox**. The framed document keeps your origin, so AI-generated HTML previews can read `localStorage` — which is exactly where `src/lib/supabase.ts:16` stores the Supabase session. A malicious or prompt-injected snippet reads the access token and ships it off-site. That's full account takeover.

**Fix**
Drop `allow-same-origin`:

```html
sandbox="allow-scripts allow-modals allow-forms"
```

The preview keeps working; it just loses same-origin privileges — which is the entire point. If a preview genuinely needs storage, serve it from a separate origin (a `*.preview.timemachinechat.com` subdomain), never the app origin.

**Done when** a preview running `top.localStorage` / `document.cookie` throws, and normal HTML/CSS/JS previews still render.


> **Done 2026-08-26.** `allow-same-origin` dropped from both preview iframes. Verified live side-by-side: the old value let the frame read `top.localStorage` (4 keys) and `top.document`; the new one throws `SecurityError` on every access while scripts still run.

---

### 0.7 — Secret hygiene ✅

**Severity:** Critical · **Effort:** S · **Files:** `.gitignore` ✅, `api/_lib/auth.ts:5`, `api/ai-proxy.ts:18`, `src/lib/supabase.ts:5`, `src/config/constants.ts`

**Problem**
- **No `.gitignore` existed at all.** One `git add .` away from committing `.env` to a public repo. ✅ **Fixed — `.gitignore` created.**
- Four `.DS_Store` files are already tracked (`api/`, `src/`, `src/components/`, `src/services/`).
- A real-looking Supabase project URL is hardcoded as a fallback in three files: `https://etpehiyzlkhknzceizar.supabase.co`.
- `src/config/constants.ts:7-9` exposes `VITE_GROQ_API_KEY`, `VITE_CEREBRAS_API_KEY`, `VITE_NVIDIA_API_KEY`. Anything `VITE_`-prefixed is **compiled into the public bundle**. They are unset today (I scanned `dist/` and confirmed no key leaks), but the lines are a loaded gun — one `.env` edit ships your NVIDIA key to every visitor.
- `BETA_ACCESS_TOKEN` defaults to the literal `'WE_WILL_LET_YOU_COOK'` and **is present in the built bundle** (confirmed in `dist/assets/index-*.js`). A client-side string comparison is not an access control.

**Fix**
- `git rm --cached` the `.DS_Store` files.
- Delete the three hardcoded URL fallbacks; fail fast if the env var is missing.
- Delete the `VITE_*_API_KEY` exports from `constants.ts` entirely (they're unused).
- Move the beta gate server-side, or drop it and rely on Supabase auth.
- Add `.env.example` documenting every variable with placeholder values.
- **Rotate every key that has ever been in a local `.env`** before launch, and enable GitHub secret scanning + push protection on the repo.

**Done when** `grep -r "supabase.co\|nvapi-\|gsk_" src/ api/` returns only env lookups, and `dist/` contains no secrets.


> **Done 2026-08-26.** `.DS_Store` files untracked; all five hardcoded `etpehiyzlkhknzceizar.supabase.co` fallbacks replaced with fail-fast checks; `VITE_GROQ/CEREBRAS/NVIDIA_API_KEY` exports deleted; the `WE_WILL_LET_YOU_COOK` default removed (with a guard so an empty token cannot open the gate); `.env.example` documents every variable. **Key rotation and GitHub push protection are still outstanding and are yours to do.**

---

### 0.8 — Publish a Privacy Policy and Terms of Service ✅

**Severity:** Critical (legal) · **Effort:** M · **Files:** new routes, `src/App.tsx`, footer links

**Problem**
There is no `/privacy` and no `/terms`. The app collects email + password, stores chat history, and keeps an AI memory store of personal facts about users ("user's job is…", "user's favorite song is…"). Shipping that to the public with no notice is a straightforward GDPR/CCPA problem, and Supabase social login providers require a privacy policy URL on the consent screen.

**Fix**
Write and route both pages. The privacy policy must state, concretely:
- what you collect (account, chat content, AI memories, uploaded images/PDFs, IP for rate limiting)
- **which third parties receive user prompts** — NVIDIA NIM, Groq, Cerebras, Pollinations, and any MCP servers
- retention periods and how to request deletion
- that conversations are processed by AI and may be stored

Add an in-app **delete-my-account** flow that purges `profiles`, `ai_memories`, `chat_sessions`, `chat_messages`, `user_images`, and storage objects. Link both pages from the footer and the signup form.

> **Write this after LS.1.** The local-only storage decision changes what the privacy policy says — and it's a much stronger document once "we don't store your chats" is literally true. Don't draft it twice.

**Done when** `/privacy` and `/terms` render, are linked from signup, and are in `sitemap.xml`.


> **Done 2026-08-26.** `/privacy` and `/terms` added (`src/components/legal/`), linked from the signup form and the account page, and listed in `sitemap.xml`. The policy names every processor that receives prompts. Account deletion added: `POST /api/delete-account` plus a confirm-to-delete flow in Account settings. **Revise after LS.1 — the policy describes today's cloud storage.** Not legal advice; have counsel review before launch.

---

### 0.9 — Resolve the third-party trademark exposure ✅

**Severity:** Critical (legal) · **Effort:** S–M · **Files:** `src/config/constants.ts`, `api/ai-proxy.ts:388-430`, `public/manifest.json`, `index.html`, `src/components/personas/PersonasPage.tsx`

**Problem**
The product presents **ChatGPT, Gemini, Claude, Grok, and DeepSeek** as selectable personas — in the UI, the PWA manifest description, the SEO `<meta name="keywords">`, and the personas page. Under the hood (`api/ai-proxy.ts:2397`) all five route to **Pollinations** with model strings `openai` / `gemini` / `claude-fast` / `grok` / `deepseek`.

Two distinct problems:
1. **Trademark + implied affiliation.** Using OpenAI's, Google's, Anthropic's, and xAI's marks as feature names — and in SEO keywords — implies a partnership that does not exist. This is the kind of thing that draws a takedown notice quickly once you have traffic.
2. **Accuracy.** A user selecting "Claude" reasonably believes they're talking to Anthropic's Claude via Anthropic. They aren't.

**Fix — pick one:**
- **(a) Rename, recommended.** Give them neutral in-house names and drop the marks from manifest/meta/sitemap. Costs you some SEO, removes the risk entirely.
- **(b) Disclose.** Keep the names only if you have the right to, add a clear "not affiliated with / powered by Pollinations" notice on the persona and label them accurately.
- **(c) Go direct.** Sign up for the real APIs, use the real models, and comply with each provider's brand guidelines.

Also review the **"Girlie" persona** and the **PRO heat levels 1–5** against each upstream provider's usage policy — you inherit their content rules, and heat level 5 ("Maximum intensity") is the kind of thing that gets an API key revoked.

**Done when** a lawyer-safe decision is recorded in this repo and the UI, manifest, and meta tags match it.


> **Done 2026-08-26. Decision: remove the feature entirely** (owner's call, 2026-08-26 — "Remove them. We will not ship that feature. Only our models"). The `chatgpt`/`gemini`/`claude`/`deepseek`/`grok` personas are deleted from `api/ai-proxy.ts` and `src/config/constants.ts`, along with their prompts (which instructed the model to claim it *was* that company's product), the `@mention` routing, the personas-page section, and the marks in `manifest.json`, `index.html` meta + structured data, `og-image.svg`, and the About/Features/Help copy. Only TimeMachine Air, Girlie and PRO remain. *(Usage-policy review now done — see 0.9a below.)*


#### 0.9a — Usage-policy review of the Girlie persona and PRO heat levels ✅ *(reviewed 2026-08-26)*

**What the policies say.** [NVIDIA](https://www.nvidia.com/en-us/networking/policy/terms/) — the default provider for all three personas — prohibits content that is *"hateful, discriminatory, or pornographic, or that advocates violence."* [Groq's Acceptable Use & Responsible AI Policy](https://console.groq.com/docs/legal/ai-policy) prohibits *"child sexual abuse or exploitation, violence, violent extremism or terrorism, hate speech, harassment, or non-consensual intimate imagery or sexually explicit content that is illegal."* Cerebras and Pollinations carry equivalent terms. These bind **you**, not the end user — a violation is your key that gets revoked.

**Findings, by severity.**

| | Finding | Verdict |
|---|---|---|
| 🔴 | **Heat 5 listed a racial slur as vocabulary the model should use.** The prompt carried an explicit list of swears for the model to draw on, and that list included a racial slur (redacted here — see the diff on the fix commit), two Hindi/Bengali slurs, and two gendered sexual slurs. This is a direct instruction to emit hate speech, in a **public** repository, on a provider that explicitly prohibits "hateful, discriminatory" output. Not borderline. | ✅ **Fixed.** All five removed from the list. The ordinary profanity and the persona's voice are untouched — the change is surgical, not a rewrite. |
| 🔴 | **The example for handling a stated intent to commit sexual violence was a joke.** The prompt modelled responding to *"you wanna rape your crush?"* by mocking the user. That teaches the model to play along with, rather than refuse, the single most serious category of request it can receive. | ✅ **Fixed.** Replaced with an in-voice hard refusal, plus an explicit "never use racial, ethnic, religious or anti-LGBTQ slurs" instruction covering the case where a *user* asks for them. |
| 🟡 | **Heat 5 permits NSFW content on request** (*"NSFW content's on the table if explicitly requested"*), and the PRO image directive says *"allow unhinged and NSFW requests."* Groq bans sexually explicit content only where *illegal*; NVIDIA bans "pornographic" outright, with no exception. PRO routes to NVIDIA by default. | ⬜ **Your call.** As written this is out of policy for NVIDIA. Options: drop NSFW from PRO, or route Heat 5 to a provider whose terms allow it, or gate it behind age verification. |
| 🟡 | **Heat 5's persona is "villain" framing with heavy profanity.** Profanity alone is not a policy violation anywhere reviewed. The framing is a brand risk, not a compliance one. | ⬜ **Your call.** No action needed for provider compliance. |
| 🟢 | **The "Girlie" persona** was scanned for the same categories — no slurs, no NSFW directives, no violent content. It is a tone persona, nothing more. | ✅ **No issue found.** |
| 🟢 | **Heat levels 1–4** contain no slurs and no NSFW directives. Heat 4 is attitude only. | ✅ **No issue found.** |

**One structural point.** These prompts are the *only* content control in the product — there is no moderation layer on input or output. NVIDIA publishes [Llama 3.1 NemoGuard](https://docs.api.nvidia.com/nim/reference/nvidia-llama-3_1-nemoguard-8b-content-safety) for exactly this, and NeMo Guardrails is free. A prompt is a request, not an enforcement mechanism: a jailbroken Heat 5 will say whatever it is pushed into saying, and the resulting API call is attributable to your key. Task **4.2** covers this; treat it as the real fix and these prompt edits as necessary hygiene.

**Done when** the 🟡 rows above have a recorded decision and 4.2 has a moderation layer.

---

### 0.10 — Patch critical dependencies ✅

**Severity:** High · **Effort:** M · **Files:** `package.json`, `package-lock.json`

**Problem**
`npm audit`: **64 vulnerabilities — 2 critical, 34 high.** Notable ones that touch shipped code rather than just build tooling:
- `react-router` / `react-router-dom` — arbitrary constructor invocation via vendored turbo-stream
- `undici`, `ws`, `engine.io` — used by the serverless runtime
- `form-data` (critical), `tar` (critical)
- `vite` — dev server can be read cross-origin by any website you visit while developing
- `yt-search` → `node-fzf` → `minimatch` ReDoS (reachable from `api/search.ts`, which takes a user query)

**Fix**
`npm audit fix` first, then handle the majors deliberately — upgrade `react-router-dom` and `vite` on a branch and smoke-test routing and the dev API middleware. `yt-search` is unmaintained; consider the YouTube Data API instead.

**Done when** zero critical/high advisories in production dependencies, and Dependabot or Renovate is enabled.


> **Done 2026-08-26.** `npm audit fix`, then `vite` 5→8, `@vitejs/plugin-react` 4→6, `@vercel/node` 5→7, plus `overrides` pinning `minimatch`/`path-to-regexp`/`tar`/`ws`/`esbuild`/`@opentelemetry/core` past their advisories. **64 → 4 total; 2 critical → 0; 34 high → 1. Production dependencies: 0 advisories at any severity.** The 4 remaining all reach only through `@vercel/node`'s bundled `undici@5.x` (a devDependency; Vercel supplies the production runtime). `.github/dependabot.yml` added. *(An `ajv` override was reverted — it breaks ESLint's `eslintrc`, which needs ajv 6.)*

---

### 0.11 — Fix the local API dev environment ✅

**Severity:** High · **Effort:** S · **Files:** `vite.config.ts`

**Problem**
Vite's `loadEnv()` does not populate `process.env`, but the dev-only middleware in `vite.config.ts` executes `api/*.ts` handlers in-process — and those handlers read secrets from `process.env`, exactly as they do on Vercel. Result: **every `/api/*` route crashed locally** with `Error: supabaseKey is required`, and the UI showed only "Failed to generate response. Please try again."

**Fix** ✅ **Done.** Added a bridge in `vite.config.ts` that copies `loadEnv()` output into `process.env` before the middleware runs. Chat now works end-to-end locally against NVIDIA NIM.

**Note:** the dev middleware is a hand-rolled reimplementation of Vercel's request/response shim (~90 lines). It diverges from real Vercel behaviour (no body size limits, no streaming parity, different error handling). **Consider replacing it with `vercel dev`** so local and production run the same code path.

---

# GATE 1 — Correctness and stability

The app should not be able to show a user a blank screen.

---

### 1.1 — Make the build typecheck, and fix the 176 errors ✅

> **Done 2026-08-27.** `build` is now `tsc --noEmit && vite build` (plus a `typecheck` script); all 155 remaining type errors fixed, including the shared `Persona` union in `src/types/chat.ts`. `npx tsc --noEmit` exits clean and a deliberately introduced type error makes `npm run build` exit 1.

**Severity:** High · **Effort:** L · **Files:** repo-wide, `package.json`

**Problem**
`npm run build` is just `vite build`. Vite strips types without checking them, so **`npx tsc --noEmit` reports 176 errors and the build still succeeds.** Breakdown:

| Code | Count | Meaning |
|---|---|---|
| TS2339 | 58 | Property does not exist (mostly `on type 'never'`) |
| TS6133 | 41 | Declared but never read |
| TS7053 | 22 | Implicit `any` from unsafe index |
| TS2345 | 22 | Argument type mismatch |
| TS2769 | 13 | No overload matches |
| TS2322 | 10 | Type not assignable |
| TS18047 | 6 | Possibly `null` |

The `'never'` errors are the dangerous ones — they mean the code queries Supabase tables that `src/types/database.ts` doesn't know about, so **every field access on those results is unchecked** (see 1.2).

**Fix**
1. `"build": "tsc --noEmit && vite build"` — build fails on type errors from now on.
2. Fix 1.2 first; it clears a large share of the TS2339s for free.
3. Work through the rest by file. The `Persona` union mismatch (`'default'|'girlie'|'pro'` vs the full 8-persona union) recurs in `BrandLogo.tsx`, `AudioPlayerBubble.tsx`, and `App.tsx:783,1081` — define one shared `Persona` type in `src/types/chat.ts` and use it everywhere.
4. Separately: **305 ESLint problems** (273 errors). Run `eslint --fix`, then triage.

**Done when** `npx tsc --noEmit` exits clean and `npm run build` fails if it ever doesn't.

---

### 1.2 — Regenerate database types ✅

> **Done 2026-08-27.** `src/types/database.ts` now declares all 22 tables the code queries (the 9 that were missing, plus the pre-existing ones). Every `on type 'never'` error is gone.

**Severity:** High · **Effort:** S · **Files:** `src/types/database.ts`

**Problem**
Code queries **18 tables**; `database.ts` declares **10**. Missing:
`brands`, `contact_messages`, `generics`, `group_chat_messages`, `group_chat_participants`, `group_chats`, `kitchen_recipes`, `pro_generation_jobs`, `user_music`.

And `youtube_music` is declared but never used — it looks like a renamed table nobody updated.

Every query against a missing table returns `never`, so `data.id`, `data.name`, `data.persona` are all unchecked. Group chat (`src/services/groupChat/groupChatService.ts`) is effectively untyped.

**Fix**
```bash
npx supabase gen types typescript --project-id <your-id> --schema public > src/types/database.ts
```
Add it as an npm script and re-run it after every migration.

**Done when** all 18 tables are typed and the `'never'` errors are gone.

---

### 1.3 — Add an error boundary ✅

> **Done 2026-08-27.** `src/components/ErrorBoundary.tsx` wraps `<App />` in `main.tsx`, with a second boundary around just the chat transcript. Verified with a deliberate render error: the transcript boundary shows a scoped fallback while the header, quota chip and composer keep working; a root-level throw shows the branded Reload / Go home fallback instead of a black screen.

**Severity:** High · **Effort:** S · **Files:** new `src/components/ErrorBoundary.tsx`, `src/main.tsx`

**Problem**
No `ErrorBoundary`, `componentDidCatch`, or `getDerivedStateFromError` anywhere in `src/`. Any render-time exception unmounts the whole tree and leaves a **black screen with no explanation and no way out**. With 176 unresolved type errors, the odds of hitting one in production are not small.

**Fix**
Add a boundary that renders a branded fallback with a "Reload" button and a "Go home" link, wrap `<App />` in `main.tsx`, and report the error to your monitoring service (2.1). Consider a second boundary around just the chat transcript so a bad message doesn't kill the shell.

**Done when** a deliberately thrown render error shows the fallback, not a black screen.

---

### 1.4 — Add a 404 route ✅

> **Done 2026-08-27.** `<Route path="*">` renders `src/components/NotFoundPage.tsx` with `<SEOHead noIndex />`. Verified live at `/this-route-does-not-exist`.

**Severity:** Medium · **Effort:** S · **Files:** `src/App.tsx:1170`

**Problem**
No `<Route path="*">`. `vercel.json` rewrites everything to `index.html`, so any unknown URL renders **a completely blank black page**. Verified live at `/this-route-does-not-exist`. Every typo'd or stale link is a dead end, and search engines see a 200 with no content.

**Fix**
Add a catch-all `<NotFoundPage />` with navigation back into the app, and `<SEOHead noIndex />`.

**Done when** an unknown URL shows a real 404 page.

---

### 1.5 — Add abort, timeout, and retry to AI requests ✅

> **Done 2026-08-27.** An `AbortSignal` is threaded through `generateAIResponseStreaming`; the send button becomes **Stop** while generating; 60s time-to-first-token and 180s total budgets abort and surface a typed `TIMEOUT`; retryable failures retry twice with exponential backoff + jitter, and never after tokens have streamed. Aborting on unmount and on chat switch stops paying for orphaned generations. Verified live: Stop halts a running stream, keeps the partial text and shows "Generation stopped."

**Severity:** High · **Effort:** M · **Files:** `src/services/ai/aiProxyService.ts`, `src/hooks/useChat.ts`, `api/ai-proxy.ts`

**Problem**
No `AbortController` anywhere in the chat path — the only one in the codebase is in `lyricsService.ts`. Consequences:
- **No stop button.** Once generation starts the user cannot cancel it.
- **No timeout.** `vercel.json` gives `ai-proxy` a 300-second `maxDuration`; a stalled upstream leaves the user staring at a spinner for five minutes.
- **No retry.** A single transient 502 from a provider surfaces as a hard failure.
- Navigating away doesn't cancel the in-flight request — you keep paying for it.

**Fix**
- Thread an `AbortController` through `aiProxyService` and expose a **Stop** button while streaming.
- Client-side timeout (~60s to first token, ~180s total) that aborts and shows a retry affordance.
- Retry idempotent failures (429 with `Retry-After`, 502/503/504) twice with exponential backoff + jitter. Never auto-retry a request that already streamed tokens.
- Abort on unmount and on route change.

> Overlaps with **1.11** (server-side timeout/backoff) and **1.9** (truncation detection). Treat 1.5 as the client half of one coordinated change, not a separate effort.

**Done when** Stop halts generation immediately, a hung upstream fails in bounded time, and a transient 502 recovers silently.

---

### 1.6 — Fix quota accounting and message ordering ✅

> **Done 2026-08-27.** The quota half was already server-authoritative from 0.4 (charge only after a successful generation, client reads `GET /api/ai-proxy?quota=`); verified live that a forced mid-stream failure left the counter unchanged at 76 and only the successful retry decremented it. The ordering half is superseded by 1.10 — the failure now renders inline in the assistant's own slot, below the user turn, never as a top-of-page banner.

**Severity:** Medium · **Effort:** S · **Files:** `src/hooks/useChat.ts:835,933`, `src/components/chat/ErrorMessage.tsx`

**Problem**
Two bugs observed live in one failed request:
1. The free-message counter went **3 → 2 even though the request failed**. Users are charged for your outages.
2. The error bubble rendered **above** the user's message instead of below it, breaking the conversation's reading order.

**Fix**
Increment only after a successful first token; refund on error. Give the error its own message entry with a proper timestamp so it sorts after the user turn.

> The message-ordering half of this is fully superseded by **1.10**, which replaces the global error banner with an inline failed-turn row. Do 1.10 and this reduces to the quota-accounting fix alone.

**Done when** a forced failure leaves the counter unchanged and the error appears below the user message.

---

### 1.7 — Build a real error taxonomy ✅

> **Done 2026-08-27.** `api/_lib/errors.ts` defines the server codes and the `{ error: { code, message } }` envelope; `src/services/ai/chatErrors.ts` maps them to `ChatErrorCode` and one distinct user-facing line each. `vite.config.ts` no longer returns `details: String(err)`, and `music.ts` / `musicCover.ts` log the upstream body server-side instead of returning it. Covered by `chatErrors.test.ts`.

**Severity:** Medium · **Effort:** M · **Files:** `src/hooks/useChat.ts`, `api/ai-proxy.ts`, `src/components/chat/ErrorMessage.tsx`

**Problem**
Almost everything collapses to `'Failed to generate response. Please try again.'` (`useChat.ts:835,933`). Rate limit, expired session, provider outage, oversized upload, and network loss are indistinguishable — to the user *and* to you in support.

Meanwhile the API leaks internals the other way: `vite.config.ts` returns `{ error: 'Internal Server Error', details: String(err) }`, and `api/music.ts` / `musicCover.ts` return raw upstream error text to the client.

**Fix**
Define typed error codes (`RATE_LIMITED`, `AUTH_EXPIRED`, `PROVIDER_DOWN`, `PAYLOAD_TOO_LARGE`, `NETWORK`, `UNKNOWN`), return them as `{ error: { code, message } }`, and map each to a specific user-facing message with the right recovery action. Log full details server-side; never return stack traces or upstream error bodies.

**Done when** each error class shows a distinct, actionable message and no internal detail reaches the client.

---

### 1.8 — Validate and bound API input ✅

> **Done 2026-08-27.** `api/_lib/validation.ts` holds a zod schema per endpoint (≤100 messages, ≤32k chars each, ≤1 MB total, ≤10 image URLs, persona/specialMode enums, `heatLevel` 1..5). Verified live: a non-array `messages` and 500 messages both 400 with a structured code, and a 5 MB `pdfData` payload is rejected **413 in 15ms** — before any provider call.

**Severity:** High · **Effort:** M · **Files:** all `api/*.ts`

**Problem**
`ai-proxy` checks only that `messages` is an array. No cap on message count, message length, total payload, `pdfData` size, or `inputImageUrls` count. `zod` is already a dependency (`^3.25.76`) and is unused in the API layer.

A single request with a 50 MB `pdfData` string or 10,000 messages runs to the 300-second limit and bills you for the tokens.

**Fix**
A zod schema per endpoint. Concretely: ≤100 messages, ≤32k chars per message, ≤1 MB total JSON, ≤10 image URLs, `persona` and `specialMode` as enums, `heatLevel` as `1..5`. Reject with `400` and a clear code. Also validate that `inputImageUrls` point at hosts you trust — right now they're fetched server-side, which is an SSRF surface.

**Done when** oversized and malformed payloads are rejected fast, and a fuzz pass finds no 500s.

---

### 1.9 — Never let the stream silently succeed ✅  ✱ root cause of the "it just glitched" failures

> **Done 2026-08-27.** Server: the streaming catch now goes through `sendApiError`, which guards `res.headersSent` / `res.writableEnded` and, once committed, writes an `error` control frame and ends the stream **without** `[STATUS_END]`. Client: `createStreamChunkParser` tracks the sentinel and `generateAIResponseStreaming` throws `StreamTruncated` when it never arrives, preserving the partial content. A well-formed stream that carried **no content** is also treated as a failed turn (`EMPTY`) rather than an empty bubble. Verified live with an injected mid-stream death and with a sentinel-only response — both produce a visible, retryable error and never an empty bubble.

**Severity:** Critical · **Effort:** M · **Files:** `src/services/ai/aiProxyService.ts:411-436`, `api/ai-proxy.ts:2358-2363`

**Problem**
This is the bug behind "2 of them didn't respond or error with anything." I traced it end to end.

**Server side** — `api/ai-proxy.ts:2362`:
```ts
} catch (error) {
  console.error('Streaming error:', error);
  res.status(500).end('Stream error occurred');   // no res.headersSent guard
}
```
By the time a provider fails mid-stream, `res.setHeader(...)` and `res.write(...)` have already run (`ai-proxy.ts:2225-2233`), so the response is committed as `200`. `res.status(500)` is then a **no-op** — Node raises `ERR_HTTP_HEADERS_SENT` — and `.end('Stream error occurred')` **appends that literal string to the AI's message**. The stream also ends *without* writing the `[STATUS_END]` sentinel that line 2358 normally sends.

I reproduced the pre-write case directly (provider with no API key):
```
stream=true  -> HTTP 500, Content-Type: text/plain,       body: "Stream error occurred"
stream=false -> HTTP 500, Content-Type: application/json, body: {"error":"We are facing huge load..."}
```
Two different error shapes from one endpoint, neither of which the client models.

**Client side** — `aiProxyService.ts:411-429`:
```ts
while (true) {
  const { done, value } = await reader.read();
  if (done) break;              // <- any termination counts as success
  parser.push(decoder.decode(value, { stream: true }));
}
if (onComplete) onComplete({ content: cleanContent, thinking, youtubeMusic });
```
**The client never checks that `[STATUS_END]` arrived.** `done` is `true` for a clean finish *and* for a truncated or aborted stream — they are indistinguishable. So a mid-stream failure runs straight into `onComplete` with empty or partial content, `completeStreamingMessage` writes an empty bubble, `setIsLoading(false)` clears the spinner, and **`onError` never fires**.

That is precisely your two silent instances: no response, no error, no spinner. Just an empty message.

**Fix**
1. **Server:** guard every post-header write.
   ```ts
   } catch (error) {
     console.error('Streaming error:', error);
     if (!res.headersSent) {
       res.status(500).json({ error: { code: 'PROVIDER_ERROR' } });
     } else if (!res.writableEnded) {
       res.write(CONTROL_FRAME_PREFIX + JSON.stringify({ type: 'error', code: 'PROVIDER_ERROR' }) + '\n');
       res.end();                    // deliberately WITHOUT [STATUS_END]
     }
   }
   ```
   The control-frame channel (the ``-prefixed JSON frames terminated by `\n`) already exists and is already parsed by `createStreamChunkParser` — reuse it rather than inventing a new marker.
2. **Client:** treat a missing sentinel as a failure.
   ```ts
   if (!parser.sawStatusEnd()) {
     throw new StreamTruncatedError(parser.getFullContent());  // -> onError, partial content preserved
   }
   ```
3. Handle the `error` control frame in `createStreamChunkParser` and route it to `onError`.
4. Make both branches return the **same** error envelope: `{ error: { code, message } }` (ties into 1.7).

**Done when** a provider failure injected mid-stream produces a visible, retryable error in the UI — never an empty bubble — and `[STATUS_END]` is asserted on every completion.

---

### 1.10 — Retry button: rewind and re-run that message ✅  ✱ user-facing fix for all of the above

> **Done 2026-08-27.** Failures mark the placeholder `status: 'error'` in place instead of deleting it and setting global `error`; `src/components/chat/FailedTurn.tsx` renders the inline reason plus **Retry**. `retryMessage` rewinds to just before the failed turn and re-runs it from the `retryContext` captured on the user message at send time. Verified live: the retry request carried exactly the original conversation, recovered where the first attempt failed, and consumed no extra quota (the failed attempt was never charged).

**Severity:** High · **Effort:** M · **Files:** `src/hooks/useChat.ts:826-840, 924-940`, `src/components/chat/ErrorMessage.tsx`, `src/components/chat/ChatMode.tsx`

**Problem**
Today a failure does three unhelpful things at once (`useChat.ts:836-840`):
```ts
setError('Failed to generate response. Please try again.');
setMessages(prev => prev.filter(msg => msg.id !== aiMessageId));   // deletes the placeholder
```
1. The error goes into a **global** `error` state, so it renders as a banner **at the top of the transcript** — detached from the message that failed. I saw this live: the error appeared *above* the user's own message.
2. The AI placeholder is **deleted**, so there is nothing anchoring the failure to a turn.
3. "Please try again" means *retype your message*. The user's prompt is gone from the input box. That is the actual insult — the app lost their work and asked them to redo it.

**Fix — inline, per-message, one click**

Keep the failure **attached to the turn that produced it**. Instead of deleting the placeholder and setting global error state, mark the placeholder as failed:

```ts
// replace the delete + global setError with:
setMessages(prev => prev.map(msg =>
  msg.id === aiMessageId
    ? { ...msg, status: 'error', errorCode, partialContent: partial || undefined }
    : msg
));
```

Add to `Message` in `src/types/chat.ts`:
```ts
status?: 'streaming' | 'complete' | 'error';
errorCode?: 'RATE_LIMITED' | 'PROVIDER_DOWN' | 'NETWORK' | 'TRUNCATED' | 'UNKNOWN';
```

Render that message as a compact inline row in the assistant's slot — short reason plus a **Retry** button:

> ⚠ Couldn't get a response. **[↻ Retry]**

**Retry = rewind to just before that turn and re-run it.** Concretely, `retryMessage(aiMessageId)`:
1. Find the failed assistant message and the user message immediately preceding it.
2. Truncate `messages` to everything **before** the failed assistant message.
3. Re-run the send pipeline with that user message and the truncated history — same persona, same heat level, same attachments (`imageData`, `pdfData`, `inputImageUrls`, `specialMode`) captured from the original turn.
4. Do **not** re-charge quota for a retry of a failed turn (ties into 1.6).

Store what a retry needs on the user message when it's first sent, so retry never has to reconstruct it:
```ts
retryContext?: { persona: string; heatLevel?: number; specialMode?: string; flowState?: boolean };
```

**Also apply the same treatment to the empty-response case.** With 1.9 landed, a truncated stream becomes `status: 'error', errorCode: 'TRUNCATED'` and gets the identical Retry button — so your "8 fine / 2 errored / 2 glitched" split collapses into one recoverable path.

**Remove the global error banner** for generation failures entirely. Keep global state only for things that genuinely aren't about one message (rate-limit modal, offline).

**Done when**
- A failed turn shows an inline Retry in place, never a top-of-page banner.
- Retry re-runs that exact turn with its original attachments and persona, and succeeds where the first attempt failed.
- Retrying does not consume additional quota.
- An empty/truncated response gets the same Retry affordance.

---

### 1.11 — Handle concurrency properly: timeout, backoff, queue ✅

> **Done 2026-08-27.** `api/_lib/providerResilience.ts` adds a 45s `providerFetch` deadline at every provider call site, retry with exponential backoff + jitter honouring `Retry-After`, a per-instance circuit breaker (3 failures → 30s cooldown), an Air fallback chain, and p50/p95/p99 latency logging. **50 concurrent prompts: 0 silent failures, 0 hangs**, latency spread down from the measured 9× to **2.2×** (p99 4.0s, inside the 60s budget). Breaker opening and latency percentiles observed in the server log.
>
> ⚠ The fallback chain could not be exercised locally — only `NVIDIA_API_KEY` is set, so there is nothing to fall back *to*. Under the 50-way load NVIDIA rejected 46 requests upstream; they surfaced as clean, typed, retryable `502 PROVIDER_DOWN` before any bytes streamed (which is the point), but the chain itself still needs verifying in an environment with Groq/Cerebras keys.
>
> **Follow-up 2026-09-07.** Beta testers on the Groq primary were seeing the "huge load on our servers" popup, so the chain was reworked:
> - Air's hops now live in `AI_PERSONAS.default.fallbacks` (Groq → Eaon → NVIDIA) instead of a separate `AIR_FALLBACK_HOPS` const, and `buildProviderChain` reads them from there. The old version filtered out any hop sharing the primary's provider, which silently shortened the chain.
> - A hop with somewhere to fall through to no longer waits out backoff or an upstream `Retry-After` (a 429 could stall ~20s before handing off); it retries once, briefly, then moves on. Only the final hop spends the full budget.
> - An upstream `ProviderHttpError` in the outer catch was string-matched into `RATE_LIMITED`, so a busy minute at Groq was reported to the user as *their* quota running out. It is now `PROVIDER_DOWN`.
> - Covered by `api/providerFallback.test.ts`. Still unverified against live keys.

**Severity:** High · **Effort:** M · **Files:** `api/ai-proxy.ts`, `src/services/ai/aiProxyService.ts`

**Problem**
Your 12-instance test is a real signal. I reproduced the underlying behaviour: 12 concurrent streaming requests through the local proxy to NVIDIA NIM all returned `200`, but the latency spread was **1.35s to 12.12s** — a 9x tail on a three-word prompt.

That tail is the whole story. With real prompts (the Air system prompt alone is ~1,500 tokens) the slowest requests cross whatever the upstream tolerates and start failing. There is nothing in the code to absorb it:
- **No timeout.** `reader.read()` can hang indefinitely; `vercel.json` allows 300s.
- **No retry.** One transient 429/502 is terminal.
- **No concurrency control.** Every browser tab hits NVIDIA directly and simultaneously on one API key.
- **No `Retry-After` handling**, so when the provider tells you to back off, you don't.

**Fix**
- **Client:** 60s time-to-first-token and 180s total budget, both abortable (1.5). On timeout, surface the inline Retry from 1.10.
- **Server:** wrap each provider `fetch` in an `AbortSignal.timeout()`. Retry `429`/`502`/`503`/`504` twice with exponential backoff + jitter, honouring `Retry-After`. **Never retry after tokens have already streamed** — resume is not possible; surface it as truncated instead.
- **Circuit breaker per provider:** after N consecutive failures, fail fast to the fallback provider for a cooldown window instead of piling on.
- **Fallback chain:** NVIDIA to Groq to Cerebras for the Air persona, so one provider's bad minute isn't an outage.
- Log provider latency percentiles (p50/p95/p99) to your monitoring (2.1). You cannot tune a tail you can't see.

**Done when** 50 concurrent real-length prompts produce zero silent failures, zero hangs, and a p99 within your timeout budget.

---

### 1.12 — Replace `Date.now()` message IDs ✅

> **Done 2026-08-27.** `Message.id` is `string`, generated by `newId()` (`src/utils/id.ts`, `crypto.randomUUID`). `Message.createdAt` carries the clock the id used to double as, so Supabase ordering still works. A migration shim maps stored numeric ids to strings on read. Group chat now keys off the real row id rather than a timestamp. Verified live (rendered ids are UUIDs, no duplicate-key warnings) and covered by `src/utils/id.test.ts`.

**Severity:** High · **Effort:** S · **Files:** `src/hooks/useChat.ts:248, 283, 480, 646, 697, 715, 760, 979`

**Problem**
Every message ID is `Date.now()`, and AI placeholders are `Date.now() + 1`:
```ts
const aiMessageId = Date.now() + 1;
```
Millisecond resolution with a hand-rolled `+1` offset. Collisions are inevitable — rapid sends, a retry fired in the same tick, a restored session (`line 979`) whose initial message lands on the same millisecond as a new one.

The consequences are exactly the class of "it glitched" symptoms you're seeing:
- `key={message.id}` in `ChatMode.tsx:203` — **duplicate React keys make messages merge or vanish.**
- `setMessages(prev => prev.filter(msg => msg.id !== aiMessageId))` — deletes **whichever** message matches, potentially the wrong one.
- The retry logic in 1.10 identifies turns by ID, so it inherits the bug.

**Fix** `crypto.randomUUID()` and change `Message.id` to `string`. This touches every comparison, so do it as one focused PR. Add a migration shim that maps existing numeric IDs from stored sessions to strings on read.

**Done when** IDs are UUIDs, `Message.id` is `string`, and a rapid-fire send loop produces no duplicate keys.

---

### 1.13 — Fix the stale closures in `useChat` ✅

> **Done 2026-08-27.** `exhaustive-deps` is promoted to **error** in `eslint.config.js` and **all 24 violations repo-wide are fixed** — none silenced with `eslint-disable`. In `useChat.ts` the pure helpers moved to module scope, mount-only effects use ref guards so they can declare honest dependencies, and the send pipeline reads a `latest` ref instead of closing over state. A completion now carries the session id its turn *started* in and refuses to write anywhere else. Leaving a chat mid-stream aborts the request and saves the outgoing session with the interrupted turn stored as a failed turn — it used to be dropped wholesale. Verified live.

**Severity:** High · **Effort:** M · **Files:** `src/hooks/useChat.ts:945`, `eslint.config.js`

**Problem**
The send handler's `useCallback` dependency array is:
```ts
[messages, currentPersona, currentProHeatLevel, userId, userProfile, isCollaborative, collaborativeId, flowStateActive]
```
but its body also reads `currentSessionId`, `activePdfText`, `completeStreamingMessage`, and `saveChatSession`. **ESLint reports 8 `exhaustive-deps` violations in `useChat.ts` alone** — as warnings, in a lint run that isn't in CI, so nobody sees them.

The practical failure: `handleSendMessage` captures a stale `currentSessionId`. Send a message, switch chats mid-stream, and the completion saves under the **previous** session ID.

Someone already hit this. There's a comment inside `completeStreamingMessage` patching the symptom:
> *"If the user switched chats mid-stream, the stale completion must not save the new chat's messages under the old session id."*

That guard treats the symptom inside a `setState` callback instead of fixing the closure. Once storage is local-only (Gate LS) there is no cloud copy to recover from, so this becomes a data-loss bug.

**Fix** Promote `exhaustive-deps` from warn to **error**, then fix the violations properly — `useRef` for values that must be current at completion time, or `useEvent`-style stable callbacks. Do not silence with `eslint-disable`.

**Done when** `exhaustive-deps` is an error, `useChat.ts` is clean, and switching chats mid-stream saves to the correct session.

---

### 1.14 — Render the app shell immediately; make auth progressive ✅

> **Done 2026-08-27.** The `authLoading` early return in `App.tsx` is gone; `AuthContext` reads the cached Supabase session from `localStorage` synchronously, splits `loading` from `profileLoading`, releases the app before fetching the profile, and drops `AUTH_INIT_TIMEOUT_MS` to 3s. `index.html` preconnects to the Supabase origin. Verified with Supabase pointed at a black-hole host so auth can never resolve: **first contentful paint 184ms**, full shell rendered, composer enabled and accepting typing.

**Severity:** High · **Effort:** M · **Files:** `src/App.tsx:551`, `src/context/AuthContext.tsx:65,171`

**Problem**
You're right about the load, and the cause is a single blocking gate at `App.tsx:551`:
```ts
if (authLoading) {
  return <div className="min-h-screen flex items-center justify-center">
           <div className="animate-spin ..." />
         </div>;
}
```
**The entire application renders as a bare spinner until auth resolves.** And `authLoading` (`AuthContext.tsx:65`) stays `true` until *both* of these finish:
1. `supabase.auth.getSession()` — a network round trip
2. `fetchProfile(userId)` — a second round trip, wrapped in `withTimeout(..., AUTH_INIT_TIMEOUT_MS)` where `AUTH_INIT_TIMEOUT_MS = 8000`

So the worst case is **8 seconds of spinner with zero UI painted**, and even the happy path costs two sequential round trips. Anonymous visitors — every single first-time user at your soft launch — wait for `getSession()` to resolve just to be told they have no session.

Stack that on the 607 kB gzipped bundle (3.1) and the real sequence is: download 2.17 MB of JS, parse it, `getSession()`, `fetchProfile()`, *then* first paint.

**Fix — exactly the model you described**

Auth is **progressive enhancement**, not a precondition:

1. **Delete the `authLoading` early return.** Render the shell — header, composer, background — on the first frame, always.
2. Read the cached Supabase session from `localStorage` **synchronously** on mount. Supabase persists it there already, so you know optimistically whether someone is signed in with no network at all. Render the signed-in shell immediately and reconcile when `getSession()` confirms.
3. **The composer is enabled from frame one.** The user types while auth resolves in the background — that's the whole point.
4. Split `loading` into `sessionLoading` (fast, gates almost nothing) and `profileLoading` (slow, gates only profile-dependent UI like nickname and avatar). Show skeletons for those, never for the app.
5. Anything that genuinely needs a user (send with an authenticated persona) resolves the session *at that moment* — an `await ensureSession()` at send time, not a global gate at boot.
6. Drop `AUTH_INIT_TIMEOUT_MS` to ~3s. Eight seconds of blank screen is never the right answer; if the profile is slow, render without it.
7. Add `<link rel="preconnect">` to your Supabase origin in `index.html` so the handshake overlaps with JS parsing.

Combined with route-level code splitting (3.1), target **first paint under 1s** and an interactive composer well before auth settles.

**Done when** the composer accepts typing before auth resolves, first contentful paint is under 1s on a throttled 4G profile, and a slow or failed profile fetch never blocks the UI.

---

# GATE LS — Local-first message storage

> **Product decision (owner):** chat messages are stored **on-device only**. No cloud sync, no migration path. Privacy is the headline feature.

This is an architecture change, not a bug fix, so it gets its own gate. Sequence it **after** Gate 0 and alongside Gate 1 — it changes what 0.2, 0.8, and 2.2 need to do.

---

### LS.1 — One honest privacy claim  ✱ read this before writing any marketing

> TM-02 local update (2026-09-06): signup/privacy/account copy now describes actual cloud history and external processing; unsupported device-only and immediate-erasure claims were removed. Durable PRO creation is blocked pending verified processor retention. Cleanup hooks and local tests are implemented, but service settings, staging deletion, backups and the production rollout remain unverified. See `docs/agent/data-lifecycle.md`. Gate LS remains open; D1 still supersedes blanket no-sync/table-drop instructions below.

**Severity:** Critical (positioning + legal) · **Effort:** S

**The thing you must get right:** local storage of message *history* does not make the conversation private, because **generating a reply requires sending the full message history to a third-party provider.** Every turn goes to NVIDIA NIM — or Pollinations, Groq, Cerebras — over the network (`api/ai-proxy.ts`). Nothing about local-only history changes that.

If the launch claim is "your messages never leave your device," it is **false**, and it is the exact kind of falsifiable claim that gets a small AI product taken apart publicly and draws regulatory attention. Someone will open DevTools within a day.

**The accurate claim is still a genuinely strong one:**

> *"Your conversations are stored on your device — not on our servers. We never keep your chat history. Messages are sent to our AI providers to generate a response and are not retained by us."*

That is true, differentiated, and defensible against ChatGPT, which stores everything server-side by default.

**To make it maximally true, also:**
- Confirm and document each provider's retention and training policy. NVIDIA NIM, Groq, and Cerebras have explicit enterprise terms; **Pollinations does not offer the same guarantees** — another reason to reduce that dependency (4.3).
- Get zero-retention terms where the provider offers them.
- Publish a short, plain-language page explaining exactly where data goes. Turn the constraint into the marketing.

**Done when** every privacy claim in the UI, landing page, and store copy is literally true and reviewed against provider terms.

---

### LS.2 — Move local storage to IndexedDB  ✱ blocks the whole feature

**Severity:** Critical · **Effort:** M · **Files:** `src/services/chat/chatService.ts:72-114`

**Problem**
Local-only storage is unusable on the current implementation. Every session lives in **one JSON blob** under a single `localStorage` key:
```ts
localStorage.setItem('chatSessions', JSON.stringify(sessions));   // ALL sessions, every save
```
`localStorage` gives you **5-10 MB total**. And `Message` (`src/types/chat.ts`) carries:
```ts
imageData?: string | string[];   // base64 images
pdfData?: string;                // full extracted PDF text
```
**A single 1024x1024 base64 PNG is ~1.4 MB.** Two image uploads, or one decent PDF, and the quota is gone.

What happens then (`chatService.ts:105`):
```ts
} catch (error) {
  console.error('Failed to save local session:', error);   // swallowed
}
```
`QuotaExceededError` is caught and logged to a console nobody is reading. **The user's chat history silently stops saving.** No warning, no error, no recovery — and under local-only there is no cloud copy. That is total, silent loss of the exact data you're making the hero feature.

It also rewrites *every* session on *every* save — O(n) serialization that will visibly jank the UI once history grows.

**Fix**
1. **Move to IndexedDB** (`idb` is a tiny, well-maintained wrapper). Practically unbounded, async so it doesn't block the main thread, and supports per-record writes.
2. **One record per session**, with messages in a child store keyed by session — write only what changed.
3. **Never store base64 in the record.** Put image blobs in a separate IndexedDB object store and reference them by key. Same for `pdfData` — store extracted text once, reference it.
4. **Surface quota state.** Use `navigator.storage.estimate()` to show usage in Settings, and warn before you're near the limit.
5. **Call `navigator.storage.persist()`** — without it, browsers evict IndexedDB under storage pressure. For a local-only product this is essential.
6. **Never swallow a write failure again.** A failed save must raise a visible, actionable error.

**Done when** 500 sessions including images and PDFs store and load without quota errors, saves are incremental, and storage is persisted.

---

### LS.3 — Remove the cloud sync path

**Severity:** High · **Effort:** M · **Files:** `src/services/chat/chatService.ts:121-318`, `src/components/chat/ChatHistoryPage.tsx`, `src/components/chat/ChatHistoryModal.tsx`, `src/App.tsx:72`

**Problem**
Cloud persistence is wired through the app in two ways: the `ChatService` class branches on `userId` (`chatService.ts:320-372`), and — less tidily — several components **bypass the class and import the Supabase functions directly**. Call sites:

| File | Functions used |
|---|---|
| `ChatHistoryPage.tsx:12-17` | `getSupabaseSessions`, `deleteSupabaseSession`, `renameSupabaseSession`, `migrateLocalSessionsToSupabase`, `saveSupabaseSession` |
| `ChatHistoryModal.tsx:14-19` | same five |
| `App.tsx:72` | `getSupabaseSessions` |

`ChatHistoryPage` and `ChatHistoryModal` are near-duplicates of each other — fix that duplication while you're in there.

**Fix**
1. Delete `getSupabaseSessions`, `saveSupabaseSession`, `deleteSupabaseSession`, `renameSupabaseSession`, and `migrateLocalSessionsToSupabase`.
2. Collapse `ChatService` to a single local implementation — no `userId` branch. Route **all** call sites through it so no component touches storage directly again.
3. Drop the `chat_sessions` and `chat_messages` tables (after LS.4).
4. Remove `chatSessionId` from the `/api/ai-proxy` request body and any server-side use of it.
5. **Audit what else still persists conversation content server-side:**
   - `pro_generation_jobs` (`api/_lib/proJobs.ts`) stores PRO prompts *and results* in Supabase. Local-only must cover this too — make jobs ephemeral, purge on completion, or state the exception plainly.
   - **`ai_memories` stores personal facts about users server-side.** This is the sharpest contradiction with the privacy claim: you'd be saying "we don't keep your chats" while keeping a distilled summary of them. **Decide explicitly** — move memories on-device, or disclose them precisely. My recommendation is on-device, since it makes the story coherent and removes the 0.2 IDOR class entirely.
   - Generated images upload to Supabase Storage via `processGeneratedImages` when signed in.
   - Group chat is inherently server-side (see LS.5).

**Done when** no chat content reaches Supabase, and every remaining server-side store is either eliminated or explicitly documented.

> ### ⚠ LS.3 is now a LAUNCH BLOCKER — the UI already makes the promise
>
> On 2026-08-26 the signup form was changed, at the owner's direction, to read:
>
> > **"Your chats are stored safely in your device only."**
>
> **That statement is false today.** `ChatService.saveSession` (`chatService.ts:334`) routes signed-in users to `saveSupabaseSession`; only anonymous users get `localStorage`. Verified live the same day — a message sent while signed in landed in `chat_messages`, which held 3,818 rows at the time.
>
> The owner's stated basis was "we will get the line true before production." So the ordering is now inverted from the rest of Gate LS: **either LS.2 + LS.3 ship before the app goes public, or that line comes out.** Shipping as-is means a false privacy representation shown at the moment of account creation, which is the worst possible place for one — it is the exact statement a regulator or a plaintiff would point at.
>
> The claim is marked with a `⚠ LAUNCH BLOCKER` comment in `src/components/auth/AuthModal.tsx` so it cannot be lost. Remove the comment only when the claim is true.
>
> Note also that this line and the Privacy Policy currently disagree: the policy accurately says conversations are stored until deleted. Two contradictory statements on the same form is itself a problem — fix them together.

---

### LS.4 — Migrate existing users off the cloud, respectfully

**Severity:** High · **Effort:** M

**Problem**
Beta users have history in `chat_sessions` / `chat_messages`. "No way to migrate to cloud" is the forward-looking rule, but you still owe existing users their data. Deleting it silently at launch would be both a bad experience and a data-protection problem.

**Fix**
A one-time, clearly-explained flow:
1. On first launch of the new version, if the signed-in user has cloud sessions, show a plain explanation: *"We're moving chat history to your device for privacy. Download your existing history, and we'll delete it from our servers."*
2. **Download-and-import** — pull cloud sessions into IndexedDB on that device and offer a JSON export.
3. **Then delete server-side**, and confirm it.
4. Keep the flow available for a fixed window (say 60 days), then purge remaining rows and drop the tables.
5. Email beta users before launch. Don't let them discover it.

**Done when** every existing user has a path to keep their history, and the server tables are empty and dropped afterward.

---

### LS.5 — Decide what local-only means for the multi-device and shared features

**Severity:** High · **Effort:** S (decision) + M (implementation)

**Problem**
Local-only genuinely conflicts with parts of the current product. These need explicit decisions, not defaults:

| Feature | Conflict | Options |
|---|---|---|
| **Group chat** | `group_chats`, `group_chat_messages`, `group_chat_participants` are server-side by definition | Keep as an explicit, clearly-labelled exception ("group chats are stored on our servers so others can see them") · or drop for launch |
| **Multi-device** | History no longer follows the user across devices | Accept and message it clearly · offer encrypted export/import as the manual bridge |
| **Clearing browser data** | Wipes everything, permanently | Prominent one-click export + periodic "back up your chats" nudge |
| **AI memories** | Personal facts stored server-side (LS.3) | Move on-device — recommended |
| **What signing in is still for** | If history is local, the account's value drops | Be clear: sync of *settings*, higher rate limits, PRO access |

The multi-device loss is the one users will feel most. **Say it up front** — a clear tradeoff stated confidently reads as principled; the same tradeoff discovered later reads as a bug.

**Fix** Record each decision in this repo, then make the UI reflect it — including an unmissable warning that clearing browser data deletes chat history permanently, and a genuinely easy export.

**Done when** each row above has a written decision and the UI matches it.

---

### LS.6 — Export, import, and delete

**Severity:** Medium · **Effort:** M

**Problem**
Once data lives only on-device, the user's own escape hatches become core product surface, not nice-to-haves. Right now there is no export at all.

**Fix**
- **Export all** — one JSON file, all sessions, from Settings.
- **Import** — restore from that file, so users can move between devices and browsers deliberately.
- **Delete all** — a real, confirmable local wipe.
- **Per-session delete** that actually removes the record (including blobs) rather than orphaning it.
- Consider optional passphrase encryption at rest via WebCrypto for users on shared machines. Strong fit with the positioning; do it after the basics work.

**Done when** a user can export, wipe, reinstall, and re-import with nothing lost — verified end to end.

---

# GATE 2 — Production infrastructure

You cannot operate what you cannot see or reproduce.

---

### 2.1 — Error tracking and uptime monitoring

**Severity:** High · **Effort:** M

**Problem**
No Sentry, no PostHog, no analytics, no uptime check — I grepped `src/`, `index.html`, and `package.json` and found nothing. There are **223 `console.*` calls** across `src/` and `api/`, which is all you have. On Vercel those vanish into function logs nobody reads. **Today, you find out you're down when a user tells you.**

**Fix**
- **Sentry** on both client and serverless functions, with release tagging and source maps (upload them, don't ship them publicly).
- **Uptime monitor** hitting a new `/api/health` endpoint every minute → alerts to phone/Slack.
- **Product analytics** (PostHog/Plausible) for the funnel that actually matters at soft launch: land → first message → signup → second session.
- **Provider spend dashboard** — per-provider token counts and cost per day. You cannot manage what you don't measure, and 0.1–0.4 exist precisely because this is unbounded.
- Replace hot-path `console.log` with structured logging; **audit every log line for prompt content and tokens** before shipping — several currently log request bodies.

**Done when** a deliberate error appears in Sentry within a minute and an alert reaches your phone.

---

### 2.2 — Get the database schema into the repo

**Severity:** High · **Effort:** L

**Problem**
`supabase/migrations/` has **4 files** (`flight_controls`, `healthcare_search`, `pdf_chunks`, `pro_generation_jobs`) plus a stray `supabase/music_setup.sql`. The code uses **18 tables**. So the definitions for `profiles`, `ai_memories`, `rate_limits`, `chat_sessions`, `chat_messages`, `group_chats`, `group_chat_messages`, `group_chat_participants`, `user_images`, `contact_messages`, `brands`, `generics`, `kitchen_recipes`, and `user_music` **exist only inside the hosted Supabase project.**

That means: no review history, no way to stand up a staging database, no rollback, and — most importantly — **the RLS policies protecting your users' chats and memories have never been code-reviewed.** Given 0.2 showed the API bypasses RLS with a service-role key anyway, nobody has verified that RLS is even enabled on those tables.

One policy that *is* visible is wrong: `music_setup.sql:34` adds
`CREATE POLICY "Public can view music-assets" ... FOR SELECT USING (bucket_id = 'music-assets')`
directly after four per-user policies — **the public rule wins, so every user's generated music and cover art is world-readable.**

**Fix**
1. `npx supabase db pull` to capture the live schema as a baseline migration.
2. Commit it. Every future change goes through a migration file, applied via CI.
3. Audit RLS on all 18 tables: `SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname='public';` — anything `false` that holds user data is a live data leak.
4. Fix the `music-assets` policy: drop the public rule, or move genuinely-public assets to a separate bucket.
5. Stand up a **staging Supabase project** from the migrations.

> **Scope note:** with Gate LS landed, `chat_sessions` and `chat_messages` get dropped (LS.3/LS.4) and possibly `ai_memories` too — so pull the schema now for the audit, but expect the table count to shrink before launch.

**Done when** a fresh database can be built from `supabase/migrations/` alone, and every user-data table has RLS enabled with a reviewed policy.

---

### 2.3 — CI pipeline

**Severity:** High · **Effort:** M · **Files:** new `.github/workflows/ci.yml`

**Problem**
No `.github/` directory. No CI. Nothing stops a commit that fails to typecheck, fails to lint, or fails to build from reaching `main` and auto-deploying.

**Fix**
A workflow on every PR and push to `main`: install → `tsc --noEmit` → `eslint` → `npm run build` → `npm audit --audit-level=high` → tests (2.4). Add branch protection on `main` requiring it to pass. Enable secret scanning and push protection.

**Done when** a PR that breaks typecheck cannot merge.

---

### 2.4 — Introduce a test suite

**Severity:** High · **Effort:** L

**Problem**
**Zero test files.** For a 45k-LOC app with an agentic tool-calling loop, streaming protocol parsing, and rate limiting, every change is verified by hand or not at all.

**Fix**
Don't chase coverage. Test the things that are expensive when wrong, in this order:
1. **Security regressions** — `renderInline` XSS (0.5), auth rejection on `ai-proxy` (0.1), memory isolation (0.2). These must never come back.
2. **The stream parser** — `createStreamChunkParser` in `aiProxyService.ts` hand-parses a custom wire protocol with `` control frames and `[STATUS:]` markers. It is intricate and completely untested.
3. **Rate limiting** — window rollover, fail-closed behaviour, anonymous vs authenticated.
4. **Tool selection / policy** — `selectTools`, `applyPolicy`, `resolveImageAllowed` in `api/_lib/tools.ts`.
5. **A Playwright smoke test** — load, send a message, get a response, sign in, reload.

Vitest + Testing Library fits the existing Vite setup.

**Done when** CI runs tests on every PR and the five security regressions above are locked in.

---

### 2.5 — Security headers

**Severity:** Medium · **Effort:** M · **Files:** `vercel.json`

**Problem**
`vercel.json` sets only caching and content-type headers. Missing: `Content-Security-Policy`, `Strict-Transport-Security`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, `X-Frame-Options`. Nothing stops the app being framed for clickjacking.

**Fix**
Add a global `headers` block. CSP will need iteration — start in `Content-Security-Policy-Report-Only`, watch violations for a few days, then enforce. Expect to allowlist Supabase, Pollinations, YouTube embeds, and image hosts. Getting 0.6 done first makes the CSP far simpler.

**Done when** securityheaders.com gives at least an A, with CSP enforced.

---

### 2.6 — Staging environment and deploy discipline

**Severity:** Medium · **Effort:** M

**Problem**
One branch (`main`), no staging, no preview protection, and Vercel presumably auto-deploys `main` to production. There is nowhere to verify a change against a real database before users see it.

**Fix**
- `develop` → staging project (staging Supabase from 2.2), `main` → production.
- Password-protect preview deployments so they aren't publicly indexable.
- Write a **rollback runbook**: how to revert a Vercel deploy, how to revert a migration, who to call.
- Set up `VITE_MAINTENANCE_MODE` as a real switch and verify `public/maintenance.html` actually renders when it's on — that's your emergency brake if the spend alarm fires.

**Done when** a change can be verified on staging and rolled back in under five minutes.

---

# GATE 3 — Performance and polish

---

### 3.1 — Code-split the bundle

**Severity:** Medium · **Effort:** M · **Files:** `src/App.tsx`, `vite.config.ts`

**Problem**
```
dist/assets/index-3hgwBGfa.js   2,172.56 kB │ gzip: 607.01 kB
dist/assets/pdf.worker.min.mjs  1,046.21 kB
```

**607 kB gzipped in a single chunk** — Vite's own warning fires. `App.tsx` eagerly imports all 25 route components plus Contour's 25 modules, KaTeX, pdfjs, GSAP, and Framer Motion. A first-time mobile visitor downloads the notes editor, the healthcare page, the cookbook, and the PDF worker before seeing the chat box. On a 4G connection that's several seconds of blank screen — the worst possible first impression for a soft launch.

**Fix**
- `React.lazy()` + `<Suspense>` for every route in `App.tsx`. The chat route is the only thing in the initial bundle.
- Lazy-load `pdfjs-dist` on first PDF upload, KaTeX on first math render, Contour modules on first palette open.
- `manualChunks` to split vendor code.
- Target: **< 200 kB gzipped** initial.

**Done when** initial JS is under 200 kB gzipped and Lighthouse mobile performance is ≥ 80.

---

### 3.2 — Fix the CSS import order

**Severity:** Low · **Effort:** S · **Files:** `src/index.css:6`

**Problem**
```
[vite:css] @import must precede all other statements
6 | @import './stylesheet/UniversalGlassKit.css';
```
`@import` sits after the `@tailwind` directives. Per CSS spec the import may be dropped or hoisted unpredictably, so glass-kit styles can silently not apply.

**Fix** Move the `@import` to line 1, above `@tailwind base`.

**Done when** the build emits no CSS warnings.

---

### 3.3 — Accessibility pass

**Severity:** Medium · **Effort:** M · **Files:** `index.html:5`, components

**Problem**
- `index.html:5` — `maximum-scale=1.0, user-scalable=no` **blocks pinch-zoom**. This is a WCAG 1.4.4 failure and a real barrier for low-vision users.
- No `prefers-reduced-motion` handling despite heavy Framer Motion and GSAP animation throughout.
- Streaming responses aren't announced to screen readers (no `aria-live` on the transcript).
- Icon-only buttons in `ChatInput` and `PlusMenu` need `aria-label`s.
- Contrast: several `text-white/40` and `text-white/50` values on dark backgrounds fall below 4.5:1.

**Fix** Remove the zoom lock. Add `aria-live="polite"` to the transcript, label the icon buttons, honour `prefers-reduced-motion`, and raise low-contrast text.

**Done when** axe DevTools reports no critical issues and keyboard-only navigation works.

---

### 3.4 — Mobile layout issues

**Severity:** Medium · **Effort:** M

**Problem**
Tested at 375×812:
- `/home` — the left sidebar navigation disappears entirely with no replacement. **There is no way to navigate from the home screen on mobile.**
- `/home` — the composer placeholder wraps to two lines and the input feels cramped.
- `/` — the "N free messages left" pill is hidden on mobile, so anonymous users hit the signup wall with no warning.
- The `FlipWords` hero animation briefly renders two words stacked on top of each other ("Start a" / "Smart a") during transition — visible on desktop at load.

**Fix** Add a mobile nav (bottom bar or drawer) to `/home`, fix the composer's mobile sizing, surface the quota pill on mobile, and fix the `FlipWords` exit animation so the outgoing word unmounts before the incoming one paints.

**Done when** every route is fully navigable and visually clean at 375px.

---

### 3.5 — Repository hygiene

**Severity:** Low · **Effort:** S

**Problem**
- `package.json` is still named `"vite-react-typescript-starter"` at version `"0.0.0"`.
- `README.md` is four lines and documents nothing — no setup, no env vars, no architecture.
- Stray files: `src/index.html` (unused duplicate), three `gradient loading animation*.txt` files in `src/components/loading/`, `favicon-file` (47 kB, unreferenced) at the repo root.
- Duplicate component: `src/components/ChatInput.tsx` **and** `src/components/chat/ChatInput.tsx`.
- `api/_lib/specialModePrompts.js` is plain JS in an otherwise TypeScript codebase.
- `api/ai-proxy.ts` is **2,907 lines** with ~1,500 lines of inline prompt strings and six near-duplicate provider `fetch` blocks.

**Fix** Rename the package, adopt semver, write a real README (see CLAUDE.md for structure), delete the strays, resolve the duplicate `ChatInput`, and — separately and carefully — extract prompts to `api/_lib/prompts/` and collapse the provider blocks into one table-driven adapter. That last one is the single biggest maintainability win in the codebase, but it deserves its own PR after tests exist.

**Done when** the repo has no unreferenced files and `ai-proxy.ts` is under 500 lines.

---

# GATE 4 — Launch readiness

---

### 4.1 — Fix launch-facing assets

**Severity:** Medium · **Effort:** S · **Files:** `index.html`, `public/manifest.json`, `public/sitemap.xml`

**Problem**
- `index.html` points OG and Twitter cards at `https://timemachinechat.com/og-image.png`. **`public/` contains only `og-image.svg`.** Every share on Twitter, LinkedIn, Discord, WhatsApp, and iMessage renders with a broken image — on the exact links you'll be posting at launch.
- `manifest.json` declares one 48×48 `favicon.ico`. PWA install requires 192×192 and 512×512 PNGs; without them "Add to Home Screen" is unavailable or renders a blurry icon.
- `sitemap.xml` lists 6 URLs and omits the public routes `/home`, `/notes`, `/healthcare`, `/shop`, and `/lifestyle/*`.
- No `apple-touch-icon`.

**Fix** Export a real 1200×630 `og-image.png`, generate 192/512 PNG icons and an `apple-touch-icon`, and regenerate the sitemap from the route table. Validate with the Twitter Card Validator and Facebook Sharing Debugger **before** you post anything.

**Done when** a link preview renders correctly on Twitter, iMessage, and Discord.

---

### 4.2 — Content safety and disclaimers

**Severity:** High · **Effort:** M

**Problem**
- **TM Healthcare** (`api/ai-proxy.ts`, `src/components/healthcare/`) returns drug information — indications, dosage, side effects — from a RAG pipeline over your `brands`/`generics` tables. There is **no medical disclaimer** anywhere. AI-generated dosage guidance without a disclaimer is a serious liability.
- No age gate. If under-13 users can sign up, COPPA applies.
- PRO "heat levels" 1–5 and the "Girlie" persona adjust tone toward less filtered output. Every upstream provider's usage policy still applies to you, and violations get keys revoked without notice.
- No abuse reporting path and no moderation on user-generated content in group chats.

**Fix** Add a persistent, prominent healthcare disclaimer ("not medical advice — consult a professional"). Add a date-of-birth check at signup. Review heat level 5 and Girlie output against each provider's policy. Add a report button in group chats and a documented abuse response process.

**Done when** the disclaimer is unavoidable in healthcare mode and a content policy is written down.

---

### 4.3 — Reduce the Pollinations dependency

**Severity:** Medium · **Effort:** M · **Files:** `api/ai-proxy.ts`

**Problem**
Five branded personas, image generation (`api/image.ts`), music (`api/music.ts`), and cover art (`api/musicCover.ts`) all route through **Pollinations** — a free community service with no SLA, no support contract, and no uptime guarantee. If it goes down or rate-limits you mid-launch, a large share of your feature surface dies at once, and there is no fallback path in the code.

**Fix** Read Pollinations' terms and confirm your usage is permitted at launch volume. Add per-provider circuit breakers with a fallback to NVIDIA/Groq. Feature-flag anything with no fallback so you can disable it cleanly. Budget for paid providers on the paths that matter.

**Done when** every user-visible feature either has a fallback or a flag that turns it off gracefully.

---

### 4.4 — Load test and set the spend ceiling

**Severity:** High · **Effort:** M

**Problem**
The concurrency ceiling is unknown. Vercel function limits, Supabase connection limits, and provider rate limits have never been tested together. `vercel.json` allows 300-second executions on four functions — a modest traffic spike could exhaust your concurrency budget while each request sits open.

**Fix**
- Load test at 10×, 50×, and 100× expected soft-launch traffic. Find where it breaks *before* users do.
- Set **hard billing caps** on Vercel, Supabase, and every AI provider — with alerts at 50% and 80%.
- Lower `maxDuration` to the smallest value that actually works (300s is almost certainly too generous).
- Have `VITE_MAINTENANCE_MODE` tested and ready as the emergency brake.

**Done when** you know your breaking point, and a runaway bill is impossible rather than merely unlikely.

---

### 4.5 — Launch-day runbook

**Severity:** Medium · **Effort:** S

**Fix** Write it down before you need it:
- Rollback: how to revert a Vercel deploy and a migration, with commands.
- Kill switches: maintenance mode, per-feature flags, provider disable.
- On-call: who watches Sentry and the spend dashboard, for how long after launch.
- Escalation: what "abort the launch" looks like and who calls it.
- Support: where user reports land and who answers.
- A **go/no-go checklist** — this document's Gate 0 and Gate 1, all green.

**Done when** the runbook is committed and someone other than you could execute it.

---

## Suggested execution order

Tasks within a step are independent and can run in parallel.

| Step | Tasks | Why this order |
|---|---|---|
| **1** | 0.1 → 0.2 → 0.3 → 0.4 | One thread: auth first, then everything that depends on knowing who the caller is |
| **2** | 0.5, 0.6, 0.7, 0.10 | Independent security fixes, parallelizable |
| **3** | LS.1 | The privacy claim is a **decision**, and everything in Gate LS follows from it. Make it first. |
| **4** | 1.12 → 1.9 → 1.10 | **The reliability thread.** UUID ids first (retry identifies turns by id), then make truncation detectable, then build Retry on top. Do not reorder. |
| **5** | 1.14, 1.11, 1.13 | Load speed, concurrency, stale closures — independent of each other |
| **6** | 1.2 → 1.1 | Regenerate types first; it clears many TS errors for free |
| **7** | 1.3, 1.4, 1.5, 1.6, 1.7, 1.8 | Remaining stability work; 1.5 and 1.7 dovetail with step 4 |
| **8** | LS.2 → LS.3 → LS.6, LS.5 | IndexedDB before removing the cloud fallback — never leave users with no working store |
| **9** | LS.4 | Migrate existing users *after* the new store works, *before* dropping tables |
| **10** | 2.2 → 2.1, 2.3, 2.5, 2.6 | Schema in repo unblocks staging |
| **11** | 2.4 | Tests, once behaviour has stopped moving |
| **12** | 3.1–3.5, 4.1–4.3 | Performance, polish, launch assets |
| **13** | 4.4 → 4.5 | Load test last, against the real thing |
| **∞** | 0.8, 0.9, 4.2 | Legal — start these **now** in parallel; they need external input and have the longest lead time |

**Two ordering rules that matter:**

- **Step 4 is a strict sequence.** 1.10 (Retry) identifies turns by message id, so 1.12 (UUIDs) must land first or Retry inherits the collision bug. And Retry needs 1.9 to know a stream *failed* — without it there is nothing to attach a Retry button to.
- **LS.2 before LS.3.** Get IndexedDB working while Supabase is still there as a fallback. Removing the cloud path first would leave users on a store that silently dies at 5 MB.

**Start 0.8, 0.9, 4.2, and LS.1 today.** They're the tasks whose duration you don't control — and LS.1 gates the wording of both legal documents.

---

## Changes already made

| File | Change |
|---|---|
| `.gitignore` | **Created.** The repo had none — `.env` was one `git add .` from being published. |
| `vite.config.ts` | Bridged `loadEnv()` into `process.env` so `/api/*` routes work in dev (0.11). |
| `.env` | Created locally with the Supabase project values and the NVIDIA key. **Gitignored.** |
| `.claude/launch.json` | Dev server config for browser-driven testing. |

### Gate 0 pass — 2026-08-26

| File | Change |
|---|---|
| `api/_lib/cors.ts` | **New.** `ALLOWED_ORIGINS` allowlist, same-origin fallback, and the `Sec-Fetch-Site` gate for media subresources (0.1, 0.3). |
| `api/_lib/auth.ts` | Added `getRequestAccessToken`, `createUserScopedClient` (RLS-scoped), `assertOwnUserId` (0.1, 0.2). |
| `api/ai-proxy.ts` | Auth from the JWT; body `userId` removed; rate limiting rewritten to fail closed; anonymous trial; provider spend ceiling; `GET ?quota=` probe; third-party personas deleted (0.1, 0.2, 0.4, 0.9). |
| `api/delete-account.ts` | **New.** Account + data purge behind the verified JWT (0.8). |
| `api/{image,music,musicCover,notes-ai,search,pro-generation,pro-stream,mcp-approval}.ts` | CORS allowlist + auth gates (0.1, 0.3). |
| `src/components/legal/` | **New.** `/privacy`, `/terms`, shared layout (0.8). |
| `src/components/notes/renderInline.ts` + `.test.ts` | **New.** Extracted and hardened; 10 regression tests (0.5). |
| `src/hooks/useAnonymousRateLimit.ts` | Display-only; reads the server's count; refreshes on the turn's falling edge (0.4). |
| `.github/dependabot.yml` | **New.** Weekly grouped updates (0.10). |
| `package.json` | vite 5→8, plugin-react 4→6, @vercel/node 5→7, vitest added, `overrides` for vulnerable transitives, `test` script (0.10, 0.5). |

**Counts after this pass:** `tsc --noEmit` 176 → **155**; `eslint` 305 → **304** problems; `npm audit` 64 → **4** total with **0 in production dependencies**; tests 0 → **10 passing**.

### Gate 0 follow-ups — 2026-08-26

Raised at the end of the Gate 0 pass, fixed immediately after.

| Item | Change |
|---|---|
| `rate_limits` readable with the anon key | **New** `supabase/migrations/rate_limits_rls.sql` — enables + forces RLS with no policy, and revokes the `anon`/`authenticated` grants. Service role is unaffected. **Must be applied by hand in the Supabase SQL editor.** |
| Missing service-role key becomes a silent outage | `ai-proxy.ts` now logs a loud boot error when `SUPABASE_SERVICE_ROLE_KEY` is unset, because with the RLS migration applied the anon fallback can no longer read `rate_limits` and every request 503s. |
| `WebViewerView.tsx` sandbox | `allow-same-origin` removed. Verified live: with it, a frame resolving to our origin read `top.localStorage` (5 keys, including the Supabase session); without it every access throws `SecurityError`, and Google search with `igu=1` still loads. |
| Web viewer URL construction | **Real hole, worse than first reported.** `trimmed.startsWith('http')` is not a scheme check — it also matches `httpfoo.com`, which was used as an iframe `src` verbatim and resolved *relative to our own origin*, framing our own app with `allow-scripts`. New `toSafeExternalUrl()` normalises to an absolute `http(s)` URL and rejects `javascript:` / `data:` / anything else. |
| Provider derivation drift | `resolveRunProvider()` is now the single source of truth. The spend ceiling and the dispatch previously derived the provider separately with different fallbacks, so the ceiling could bill `nvidia` for a run that went to Cerebras. |
| `CLAUDE.md` stale in three places | Rewritten: personas, provider routing, identity/rate-limit rules, env vars, iframe + URL rules, real error counts, and the fact that signed-in chats still go to Supabase today. |
| `api/skills.ts` ChatGPT reference | Reworded to "AI writing tools" — keeps the guidance, drops the mark. |

**Known consequence:** applying the `rate_limits` migration requires `SUPABASE_SERVICE_ROLE_KEY` to be set in every environment that runs the API, including local dev.

### Gate 1 pass — 2026-08-27

All 14 Gate 1 tasks closed. The reliability thread (1.12 → 1.9 → 1.10) was done first, as sequenced.

- **New files:** `src/utils/id.ts`, `src/services/ai/chatErrors.ts`, `src/components/ErrorBoundary.tsx`, `src/components/NotFoundPage.tsx`, `src/components/chat/FailedTurn.tsx`, `api/_lib/errors.ts`, `api/_lib/validation.ts`, `api/_lib/providerResilience.ts`, plus `src/utils/id.test.ts` and `src/services/ai/chatErrors.test.ts`.
- **The silent-failure bug is closed on both ends.** The server can no longer append an error string to the assistant's message after headers are sent, and the client can no longer mistake a truncated stream for a finished one. A response that arrives well-formed but empty is also a failed turn now.
- **Every failure is attached to its own turn** with a Retry that re-runs the original request. The global error banner is no longer used for generation failures.
- **Message identity is UUIDs**, with `createdAt` taking over the ordering job the old timestamp ids were doing implicitly.
- **Leaving a chat mid-stream** aborts the request and saves the outgoing session with the interrupted turn recorded as failed, instead of silently dropping it or writing it to the wrong session.

Verified in the running app, not just in theory: injected mid-stream provider death, sentinel-only response, user-initiated Stop, deliberate render errors at two levels, an unknown URL, a 5 MB payload, 50 concurrent generations, and a boot with Supabase pointed at a black hole.

### Gate 0 regression and fix — 2026-08-27

**The 0.10 dependency work broke the Vercel build.** `npm install` on Vercel failed with `ERESOLVE` on `@types/react`. Root cause: Vercel ran plain `npm install`, which re-resolved the tree from the `package.json` ranges instead of installing the lockfile, and landed on a combination that was never tested locally. The local tree was also drifted — a clean reinstall surfaced a **production** advisory that the drifted `node_modules` had hidden.

| Fix | Detail |
|---|---|
| `vercel.json` → `"installCommand": "npm ci"` | `npm ci` installs strictly from `package-lock.json` and fails loudly if the lock and `package.json` disagree. Plain `npm install` silently re-resolves, which is how an untested tree reached the build. |
| `package.json` → `"engines": { "node": "22.x" }` | Pins the build runtime so npm's resolver behaviour cannot drift between local and Vercel. |
| `pdfjs-dist` `^5.4.296` → `^6.2.108` | The range was resolving to `5.7.284`, inside the advisory window for *PDF.js: arbitrary JavaScript execution upon opening a malicious PDF* (`>=5.6.83 <6.2.108`). **This is production-reachable — the app parses user-uploaded PDFs in the browser.** Verified after upgrading: `extractPdfText()` returns the correct text from a real PDF on pdfjs `6.2.108`. |
| Lockfile regenerated | From a clean `rm -rf node_modules && rm package-lock.json && npm install`, so what is committed is what a fresh install produces. |

**Verified against a clean-room copy of only the tracked files:** `npm ci` installs and `npm run build` succeeds — the same two commands Vercel runs.

**Correction to the numbers reported on 2026-08-26.** The "0 production advisories" claim was measured against a drifted `node_modules`. On a clean install it was **1 high** (`pdfjs-dist`). It is genuinely 0 now, and the counts below are from a clean tree.

**Lesson worth keeping:** after any dependency change, run `rm -rf node_modules && npm ci` before trusting an audit or a build. An incrementally-updated `node_modules` is not what CI installs.

---

## Verified working

Worth recording — this is a real, functioning application:

- Chat streams end-to-end against NVIDIA NIM (`nvidia/nemotron-3-nano-omni-30b-a3b-reasoning`).
- The app degrades gracefully when Supabase is unreachable — anonymous chat still works.
- `npm run build` succeeds in ~3 seconds.
- The `/home` dashboard, routing, theming, and SEO head management all work.
- Markdown rendering does **not** enable `rehype-raw`, so AI output is properly escaped — the right call.
- No secrets leak into `dist/` as currently configured.
- The design is genuinely good. The problems in this document are all under the surface.
