# CLAUDE.md

Guidance for Claude Code when working in this repository.

## What this is

**TimeMachine Chat** — a React + TypeScript AI chat application with multiple personas, a command palette, notes, group chat, healthcare RAG, image/music generation, and a PWA shell. Deployed on Vercel; Supabase for auth, database, and storage.

Currently pre-launch (soft launch in preparation). **Read `production-check.md` before making changes** — it is the authoritative list of known issues and the plan to fix them. If you're fixing something, check whether it's already a numbered task there and reference the task ID in your commit.

## Commands

```bash
npm install          # install dependencies
npm run dev          # Vite dev server on :5173 (also serves api/*.ts via middleware)
npm run build        # vite build — NOTE: does not typecheck (see production-check.md 1.1)
npx tsc --noEmit     # the real typecheck — currently 155 errors
npm run lint         # eslint — currently 299 problems
npm test             # vitest run — currently one suite (notes renderInline)
npm run preview      # preview the production build
```

Test coverage is one file so far (`src/components/notes/renderInline.test.ts`); broadening it is `production-check.md` 2.4.

## Architecture

```
src/
  App.tsx                  ~1200 lines. All routing. Imports every route eagerly.
  main.tsx                 Entry: BrowserRouter + HelmetProvider + App
  hooks/useChat.ts         ~1300 lines. Core chat state machine.
  services/                Client-side API wrappers
    ai/aiProxyService.ts   Talks to /api/ai-proxy; contains the stream parser
  context/                 AuthContext (Supabase session), ThemeContext
  components/
    chat/                  Message rendering, input, code blocks, previews
    contour/               Command palette — 25 modules + 25 views
    notes/                 Block-based Notion-like editor
    <feature>/             One directory per feature area
  types/database.ts        Supabase generated types (STALE — 10 of 18 tables)
  config/constants.ts      Client config, persona display data, feature flags

api/                       Vercel serverless functions
  ai-proxy.ts              2900 lines. THE main endpoint. Personas, prompts,
                           provider routing, rate limiting, memory, tools.
  _lib/
    auth.ts                getAuthenticatedRequestUser — verifies Supabase JWT
    tools.ts               Tool definitions, selection, policy, execution
    agentLoop.ts           Agentic tool-calling loop
    mcpClient.ts           MCP server discovery and tool execution
    specialModePrompts.js  Special-mode system prompts (plain JS)
  pro-generation.ts        Trigger.dev-backed long-running PRO jobs
  pro-stream.ts            Streaming for PRO jobs

supabase/migrations/       INCOMPLETE — only 4 of 18 tables
trigger/                   Trigger.dev task definitions
```

### Request flow for a chat message

```
ChatInput → useChat → aiProxyService → POST /api/ai-proxy
  → rate limit check (Supabase)
  → resolve persona + special mode → system prompt
  → fetch user memories → inject into prompt
  → select tools → shape images for the hop (native parts, or OCR fallback)
  → provider fetch (NVIDIA / Groq / Cerebras / Pollinations / Eaon)
  → optional agent loop for tool calls
  → stream back over a custom wire protocol
  → createStreamChunkParser in aiProxyService decodes it
```

### The streaming wire protocol

`/api/ai-proxy` streams `text/plain`, not SSE. The stream mixes:
- plain text tokens
- `[STATUS:...]` and `[IMAGE_ANALYZING]` inline markers
- ``-prefixed JSON control frames terminated by `\n` (used for MCP approval requests)

`createStreamChunkParser` in `src/services/ai/aiProxyService.ts` is the only decoder. It is intricate and untested — **change it carefully** and add tests if you touch it.

### Providers

Six are wired: `nvidia` (default), `groq`, `cerebras`, `pollinations`, `eaon`, `secretstoai`. Each has its own near-duplicate `fetch` block in `ai-proxy.ts` — around six of them. Adding a provider currently means touching all the call sites. Collapsing these into one adapter is a known refactor (`production-check.md` 3.5).

How images reach the model is decided per hop, in `api/_lib/vision.ts`. A model
that takes image parts gets the image itself (`vision: 'native'`); the OCR
transcriber is the fallback for models that cannot see (`vision: 'ocr'`). The
capability is a property of the (provider, model) pair, not the persona —
special modes, Flow State and fallback hops all swap the model — so it is
resolved for each hop at the moment that hop runs, and the transcription only
happens if a text-only hop actually serves the turn. To change it for a model,
write `vision:` next to that model in `AI_PERSONAS`, or add it to `MODEL_VISION`
in `vision.ts`. Unlisted models default to OCR: an unverified `native` guess is
a hard 400, an unnecessary OCR is only a worse answer.

Which provider a run uses is decided in exactly one place: `resolveRunProvider(persona, personaConfig, flowState)` in `ai-proxy.ts`. The spend-ceiling check and the actual dispatch both read from it — don't reintroduce a second derivation, or the ceiling will bill a provider the run never touched.

**There are three personas: `default` (TimeMachine Air), `girlie`, and `pro`.** The `chatgpt` / `gemini` / `claude` / `grok` / `deepseek` personas were removed in full — see `production-check.md` 0.9. They routed to Pollinations while presenting other companies' marks, and their system prompts told the model to claim it *was* that company's product. Do not add them back.

## Environment variables

Client (`VITE_`-prefixed — **these are compiled into the public bundle**):
- `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` — required; `vite.config.ts` throws without them
- `VITE_MAINTENANCE_MODE`, `VITE_ACCESS_TOKEN_REQUIRED`, `VITE_BETA_ACCESS_TOKEN`

Server (never `VITE_`-prefixed):
- `NVIDIA_API_KEY` (or `NIM_API_KEY`), `GROQ_API_KEY`, `CEREBRAS_API_KEY`, `POLLINATIONS_API_KEY`, `EAON_API_KEY`, `SECRETSTOAI_API_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` — **required.** `rate_limits` is RLS-locked to the service role and `checkRateLimit` fails closed, so without this key every request 503s. `ai-proxy.ts` logs a loud error at boot when it is missing.
- `ALLOWED_ORIGINS` — comma-separated CORS allowlist. Same-origin requests are allowed implicitly, so an unset value warns rather than breaking the app.
- `ANON_TRIAL_SECRET` — HMACs the anonymous-trial device cookie. Unset means IP-only trial counting.
- `ANON_DEFAULT_PERSONA_LIMIT` (default 3) and `PROVIDER_DAILY_CEILING` (0 disables the ceiling)

**Never add a secret behind a `VITE_` prefix.** `src/config/constants.ts:7-9` currently exports `VITE_GROQ_API_KEY` / `VITE_CEREBRAS_API_KEY` / `VITE_NVIDIA_API_KEY` — these are unused and slated for deletion. Do not start using them.

`.env` is gitignored. `.env.example` documents the full set.

## Conventions

- **TypeScript strict mode** is on. Don't add `any` to silence an error — the codebase already has too many.
- **Tailwind** for styling. Glass-morphism aesthetic; theme tokens live in `src/themes/`.
- **Framer Motion** for animation, GSAP for a few loading effects.
- Components are function components with hooks. No class components except (soon) the error boundary.
- Comments in this codebase explain *why*, not *what*. Match that — several existing comments document non-obvious decisions and are worth reading.
- Import with the `@/` alias where it's already used; relative paths elsewhere. Both are in play.

## Things that will bite you

1. **`npm run build` does not typecheck.** It passes while `tsc --noEmit` reports 155 errors. Always run `npx tsc --noEmit` yourself — and note that `incremental: true` caches results in `tsconfig.tsbuildinfo`, and that a *parse* error in one file makes tsc bail out and report only that file. A sudden drop in the error count means a syntax error, not progress. `rm -f tsconfig.tsbuildinfo` before trusting a count.
2. **`src/types/database.ts` is stale.** Nine tables the code queries aren't declared, so those query results are typed `never` and every field access on them is unchecked. Regenerate before trusting DB types.
3. **The dev API middleware is hand-rolled.** `vite.config.ts` reimplements Vercel's request/response shim to run `api/*.ts` locally. It is not a faithful reproduction — no body limits, different error handling, different streaming behaviour. If something works in dev but not on Vercel, suspect this first.
4. **`api/ai-proxy.ts` is ~3100 lines**, roughly half of it inline prompt strings. Use `grep -n` to navigate; don't read it top to bottom.
5. **Identity comes from the verified JWT, and only from there.** Fixed in 0.1/0.2: `userId` is no longer read from `req.body` anywhere, and user-scoped reads go through `createUserScopedClient(accessToken)` so RLS applies instead of the service-role bypass. Never reintroduce a body-supplied id — `assertOwnUserId()` exists to make that fail loudly if you do.
6. **Rate limiting fails CLOSED.** A limiter backend error returns `503`, not a free generation (0.4). Quota is charged only after a generation succeeds, so don't add an optimistic increment — the client reads its remaining count from `GET /api/ai-proxy?quota=<persona>`, and `useAnonymousRateLimit`'s localStorage counter is display-only.
7. **There is no error boundary.** An uncaught render error blanks the entire app.
8. **No 404 route.** Unknown URLs render a blank black page.
9. **Two `ChatInput.tsx` files exist** — `src/components/ChatInput.tsx` and `src/components/chat/ChatInput.tsx`. The `chat/` one is the live one.
10. **A truncated stream reads as success.** `aiProxyService.ts` breaks its read loop on `done` and calls `onComplete` without ever checking that the `[STATUS_END]` sentinel arrived. A provider that dies mid-stream produces an empty AI bubble and no error. Fixing this is `production-check.md` 1.9 — until then, don't trust "it completed" to mean "it worked."
11. **`res.status(500)` after streaming has started is a no-op.** the streaming error path has no `res.headersSent` guard, so the error text gets appended to the AI's message instead. Guard every post-header write.
12. **Message IDs are `Date.now()`** (and `Date.now() + 1` for AI placeholders). They collide. `key={message.id}` means colliding IDs make messages merge or vanish. Being replaced with `crypto.randomUUID()` in 1.12.
13. **`useChat.ts` has 8 `exhaustive-deps` violations.** The send handler captures a stale `currentSessionId`, so a completion can save into the previously-open session. There's a comment in `completeStreamingMessage` patching the symptom — don't add more of those, fix the closure.
14. **The whole app blocks on auth.** `App.tsx` returns a bare spinner until `getSession()` *and* `fetchProfile()` both resolve (the latter with an 8s timeout). Being made progressive in 1.14 — don't add anything else to that gate.
15. **The Trigger.dev task deploys separately from Vercel.** Merging to `main` redeploys `api/` and `src/` only. `trigger/proGeneration.ts` — where PRO's model call actually happens — stays on whatever was last shipped with `npm run trigger:deploy` (or the Trigger.dev GitHub integration, if it has been connected). A change to the task that looks live because the PR merged is not live. The task also runs on Trigger's own infrastructure with its own environment variables: a provider key set in Vercel is not visible to it. And `trigger.config.ts` pins `runtime: "node-22"` — the default `"node"` is Node 21, which has no global `WebSocket`, and the Supabase client the task imports fails the build without one.
16. **`saveLocalSession` swallows `QuotaExceededError`.** All sessions are one `localStorage` JSON blob, and messages carry base64 images and full PDF text. It silently stops saving at ~5 MB. Moving to IndexedDB in LS.2.

## Storage direction (important)

**Chat messages are moving to on-device storage only.** No cloud sync, no migration path — privacy is the product's headline feature. See `production-check.md` Gate LS.

What this means for new code:
- **Do not add new writes of conversation content to Supabase.** `chat_sessions` and `chat_messages` are being removed.
- Route all storage through `ChatService`. Several components currently bypass it and import the Supabase functions directly (`ChatHistoryPage`, `ChatHistoryModal`, `App.tsx`) — don't add more.
- The store is becoming IndexedDB, not `localStorage`. Don't build on the `chatSessions` blob.
- **A local-only store makes silent write failures unrecoverable.** There is no cloud copy. Never `catch` a storage error and only `console.error` it.

**Today, signed-in chats still go to Supabase.** `ChatService.saveSession` routes signed-in users to `saveSupabaseSession` and only anonymous users to `localStorage`. The device-only store is the *destination*, not the current state — verify before writing anything that depends on it.

Two things to keep straight when writing user-facing copy:
- Local storage of *history* does not make a conversation private — every turn is still sent to a third-party provider to generate the reply. "We don't store your chats" is true; "your messages never leave your device" is not. See LS.1.
- **The signup form currently promises "Your chats are stored safely in your device only."** That claim is not true until Gate LS ships. It is tracked as a launch blocker in LS.3 — do not ship to production before it is true.

## Security rules for this codebase

Non-negotiable when writing code here:

- Identity comes from the verified JWT (`getAuthenticatedRequestUser`), **never** from the request body.
- The service-role Supabase client bypasses RLS. Use it only for genuinely system-level operations, never for reading user-scoped data.
- No new `dangerouslySetInnerHTML` without a reviewed sanitizer. `renderInline` (now `src/components/notes/renderInline.ts`) was the known XSS vector; it is fixed and covered by tests — read it before writing anything similar, and escape quotes, not just angle brackets, whenever output lands in an HTML attribute.
- Never combine `allow-scripts` with `allow-same-origin` in an iframe `sandbox` (0.6). All three iframes in the app now omit `allow-same-origin`; external sites still render fine without it.
- Any URL that reaches an iframe `src` must be an absolute `http(s)` URL — use `toSafeExternalUrl()`. A prefix test like `startsWith('http')` is not a scheme check: it also matches `httpfoo.com`, which resolves *relative to our own origin*.
- `rate_limits` is RLS-locked to the service role. Don't query it from the browser; use `GET /api/ai-proxy?quota=<persona>`.
- Validate and bound every API input with zod. `zod` is already a dependency.
- Don't log prompt content, tokens, or request bodies.

## Working agreement

- Prefer small, reviewable changes tied to a `production-check.md` task ID.
- If you fix an issue listed there, update its status in that file.
- Run `npx tsc --noEmit` and `npm run lint` before declaring a change done, and say honestly whether the counts went up or down.
- Don't commit or push unless asked.
