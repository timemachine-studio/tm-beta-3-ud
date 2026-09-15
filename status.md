# Current status

Updated 2026-09-15. Rewritten from scratch on 2026-09-14; the previous rounds (tool catalogue, providers, MCP, generated tools, light mode) are shipped and described in git history and `production-check.md`. This file is the state of things now and what is still owed.

**The open-issues tracker is now `pre-launch-audit.md`.** It carries every still-open item from `production-check.md` (Gate E) plus the 2026-09-14 audit's new findings (Gates A–D), and a handoff note at the top for each fix pass. The tracker table at the top of `production-check.md` is stale in places and is no longer maintained.

## Done on 2026-09-15 — pre-launch audit, first fix pass

Full detail and file-by-file notes: handoff block at the top of `pre-launch-audit.md`. Gates after the pass: typecheck clean, lint 0/0, 64 files / 561 tests.

- **A.1** ImgBB removed. The client-bundled key and the anonymous-photo upload to a public host are gone; anonymous images travel inline as data URLs. **Owner: revoke the key at imgbb.com — it is in public git history.**
- **A.2** Media endpoints (`/api/image`, `/api/music`, `/api/musicCover`) no longer trust `Sec-Fetch-Site`/`Referer` (curl could forge both). Access is a server-signed URL or a bearer token, each rate limited (`api/_lib/mediaGate.ts`). Verified live: forged → 401, tampered → 401, valid → passes.
- **A.3** `new Function` is gone from `src/`. Graph blocks (Notes and Contour) use a real expression parser, `src/utils/mathExpression.ts`. The Notes co-pilot can no longer set a block to `graph`/`table`/`image`/`doodle`. Verified live with the audit's payload.
- **A.4** Signed-in chat save is upsert-by-id then prune, not delete-all then insert. A refused save (cloud or local quota) now shows a banner in the transcript.
- **A.5** Limiter extracted to `api/_lib/rateLimit.ts`; duplicate rows no longer 503 a user; increments go through `bump_rate_limit()` when the DB has it. **Owner: run `supabase/migrations/rate_limits_atomic.sql`.** Parallel-request bypass still open pending a decision on reserve-then-refund.
- **A.8** Every generated-image URL carries a seed and is privately cacheable; the music card fetches once and reuses the bytes. One generation per image instead of three or four.
- Smaller: markdown images load only from our hosts (A.12 part); `safeUrl` refuses IPv4-mapped IPv6 and 100.64/10; group share ids are crypto-random; upload filenames are UUIDs; 8-character passwords; dead `SesamePanel` deleted; `/about` and `/help` privacy copy corrected (B.1 part); zoom lock removed (D.3 part).
- Also committed: Air's Eaon route serves images via OCR (the route drops image parts).

## Where the product is

TimeMachine Chat, pre-launch. Three personas — Air (`default`), Girlie, PRO. Chains as of `dafc09e`: Air on Gemini 3.8 Flash via Eaon (native vision), a Flash Lite hop ahead of NVIDIA, Flow State on Cerebras gpt-oss-120b; PRO on MiniMax M3. Storage direction is device-only chat history (Gate LS in `production-check.md`); signed-in chats still go to Supabase today.

**Max Mode** replaced Heat Levels on 2026-09-12: PRO as a coding harness with a device-side workspace (IndexedDB), a WebContainer runtime on `/max/:sessionId`, and GitHub clone/push. The 2026-09-14 pass below is the first round of use on it.

## Done on 2026-09-14

### Max Mode UI
- Header button is a one-click toggle: in (Auto) / out. Icon is the dashed code window (`MaxModeIcon.tsx`).
- Mode picker (Plan / Edit / Auto) is a glass pill above the composer, left side, expanding upward. Contract unchanged (`shared/maxMode.ts`).
- Workspace is one rounded glass card. No "Workspace" title; all controls are glass pills; tab labels drop to icons when the card is narrow (container query). Card width and the tree/editor split are drag-resizable and remembered (`useResizable.ts`). Collapse pill on the card; a "Workspace" pill next to the mode pill brings it back. On phones the card and the chat take turns.
- The stray home button (`MusicPlayer`) no longer renders on `/max`.
- Preview: console closed by default (log is the controller's, so it accumulates regardless); no command/URL label; full screen (portalled overlay, Escape leaves) replaces "open in new tab", which cannot work — the runtime's preview origin only exists inside the isolated page.

### Max Mode behaviour
- Preview survives a reload: the target is written to workspace meta (`previewTarget`). HTML re-renders; a dev server comes back as a "Start it again" card that runs `npm install` first when the fresh container has no `node_modules`.
- All three tabs stay mounted. The terminal keeps its shell and scrollback across tab switches, boots lazily on first open, and replays what the runtime printed before it existed (`outputHistory`).
- A dev server the user starts from the shell opens the preview (labelled with the typed command); its runtime errors are forwarded too.
- **Safety:** a sync back that finds the container empty while the baseline is not refuses to mirror that as deletions. A session switch clears the baseline before wiping the container. Added after a test workspace was emptied during this session — the store is the only copy of a project.

### GitHub (MVP)
Server: `create` action (new repo under the user, auto-added to the App installation), `push` with `mode: 'direct' | 'pull_request'`, first commit into an empty repository via the Contents API. Connect goes through the App's install page with our state, so install + authorize is one screen.
Client/panel: Clone (confirm when files exist) · Link empty repository · Create a repository (and push) · Commit to branch · Open a pull request · Pull latest (baseline merge: remote-only taken, local-only kept, both-sided kept and reported) · Unlink (keeps files) · "Connect again" on expired tokens. No operator text in the UI.
Details and what is still open: `docs/agent/max-mode-harness.md`, "GitHub pass".

### Light mode
- One accent token, `--tm-accent-rgb`, defined only in `light.css`; inline glows write `rgb(var(--tm-accent-rgb, <dark hue>))`. Max Mode and Flow State active text no longer sky-blue on paper.
- Warmth default is 40; storage key versioned to `lightWarmth.v2` because the old default was written for everyone.

### Gates
Typecheck, lint clean. 547 tests in 61 files. Verified in the in-app browser: one-click Max Mode, mode pill, resize, collapse, preview restore and restart, shell-started server → preview, terminal scrollback, full screen, light-mode accent.

## Owed

### 1. GitHub App registration — **blocked on the app's name**
Everything GitHub in Max Mode is built and tested against mocked GitHub responses, but nothing has run live: `GITHUB_APP_SLUG`, `GITHUB_APP_CLIENT_ID`, `GITHUB_APP_CLIENT_SECRET` are unset locally and on Vercel, so the panel shows "GitHub isn't available here yet."

The owner is **deliberately not registering the App yet** because the whole product may be renamed; the App's name and slug are user-facing on GitHub, and renaming later means a new slug and re-connecting every user. Do it once the name is final:

1. github.com/settings/apps → New GitHub App. Callback URLs: `https://<domain>/github/callback` **and** `http://localhost:5173/github/callback`. Turn on "Expire user authorization tokens" and "Request user authorization (OAuth) during installation". Webhook: off.
2. Repository permissions: Administration R/W, Contents R/W, Pull requests R/W, Metadata read. Installable on any account.
3. Client ID, a generated client secret, the slug from the public link → `.env` and Vercel, plus `MCP_CREDENTIAL_KEY` (`openssl rand -base64 32`; reuse the existing one if MCP already has it).
4. Run `supabase/migrations/github_connections.sql` in the Supabase SQL editor.
5. First live run against a throwaway repo: connect, create-and-push, commit, PR, pull latest.

Full notes in `.env.example`.

### 2. Max Mode, next
- Real content merge for both-sided changes in Pull latest (today: kept local, listed).
- File modes and symlinks in clone/push; idempotent publication receipts.
- The terminal's fixed-delay sync after Enter is not a completion protocol (harness doc, item 3).
- Measure real tasks before touching the 12/24/40 round budgets (item 2).

### 3. Launch blockers
See `pre-launch-audit.md`, in the order it suggests: A.5's remaining race (decision), A.7 (Vercel Pro), A.9 + D.4 (Sentry, `/api/health`, CI — this repo has no `.github/`), A.10 (schema pull) then A.6/A.11/A.15, A.13, A.14, rest of A.12, B.2, B.4, C.1 (Trigger deploy). Gate LS (device-only chat history) unchanged; the signup copy no longer promises it, but `/about` did until this pass.
