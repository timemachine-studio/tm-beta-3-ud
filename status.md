# Current status

Updated 2026-09-14. Rewritten from scratch; the previous rounds (tool catalogue, providers, MCP, generated tools, light mode) are shipped and described in git history and `production-check.md`. This file is the state of things now and what is still owed.

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

### 3. Launch blockers unchanged
See `production-check.md`: Gate LS (device-only chat history; the signup copy promises it today), migrations that cannot recreate the schema, the provider-adapter refactor (3.5).
