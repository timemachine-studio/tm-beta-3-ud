# TimeMachine continuation superprompt

Latest Work continuation · 2026-09-29: The private OpenHands confirmation ledger now has a [rollback-only staging canary](../supabase/tests/work_runtime_confirmations_canary.sql) covering authority binding, blocked decision retries, expiry, grant/connection/entitlement revocation, Stop invalidation and role denial. The canary is local and unexecuted because no PostgreSQL staging session was available; no migration or remote agent action occurred. Confirmation remains unavailable until a trusted complete active-branch snapshot and runtime-side atomic exact-action acceptance exist. Preserve the existing dirty worktree and disabled execution flags.

Latest local continuation · 2026-09-28: Work's Files pane can download a ZIP of saved deliverables with nested paths, a revision manifest and spreadsheet-safe CSV encoding; original uploads and unsaved edits are excluded. The remote task composer no longer suggests steering that the server rejects. OpenHands activity now refreshes while a connected running conversation's Activity panel is open, retaining the last snapshot during refresh and stopping on collapse/navigation/error. This is read-only monitoring, not execution or tool approval. 1,066 tests across 120 files, TypeScript, scoped lint and production build passed. All work local and uncommitted. The critical runtime gates remain isolated provisioning, exact-action confirmation, grant renewal, durable file transfer and authenticated staging acceptance. Latest user steering requests five generated mobile header concepts only; no mobile header code change is authorized in that design request.

Latest sidebar refinement · 2026-09-28: Work now has one persistent, accessible sidebar button instead of separate X and panel icons. It is X/open at the sidebar top right and rotates/crossfades to the panel icon at the work area top left when closed; focus is retained, Escape closes the same way. Mobile open moves the Chat/Work switch below the title and navigation below the switch. Browser interaction checked desktop/mobile open and closed, one control, no overlap or horizontal overflow. See [Work layout notes](work-harness-hermes.md). Local only; preserve dirty tree.

Latest UI refinement · 2026-09-28: Work's internal controls are now rounder and more glass-like: pill navigation/New task/search/starters/badges, 28px composer, 24px library and Hermes cards, 26px separated task panes, and rounded connection cards. The full-screen shell stays flush. In dark mode the Work shell is transparent so the existing Chat shell and `AppAtmosphere` render the exact same seasonal gradient behind Work; light mode retains the Work paper/glass wash. Solid high-contrast/reduced-transparency/no-backdrop fallbacks remain. Scoped [Work DESIGN.md](work-harness/DESIGN.md) and sidecar updated. Browser reviewed dark Chat vs Work at 1440×900, light Work and mobile 390 with no horizontal overflow. Production build/typecheck passed. See [Work layout and Hermes notes](work-harness-hermes.md). Preserve the dirty tree; no deployment or commit.

Latest local continuation · 2026-09-28: [Hermes discovery and Agenta layout](work-harness-hermes.md). User selected the Agenta interface direction, superseding the five-concept selection gate, then explicitly requested full-screen Work and seasonal glass materials. The outer screen box and duplicate header controls are removed; title moves into sidebar top and New task follows Sessions. The full-screen surface, sidebar and composer now carry translucent Auto/manual theme tints, blur and reflective edges; solid fallbacks respect reduced transparency. Work has searchable sessions grouped by mind, a wider composer and compact setup footer. Hermes source is checked out at `04ea129bbf84a7b8905eaab9ee575ff345a8f464`; organization fork failed HTTP 403 (admin rights required). Opt-in premium/account-scoped capability and skill metadata discovery is implemented, with proposed seventh private migration. Execution, installs, memory writes and schedules remain disconnected. All migrations remain unapplied; no paid calls, deployment, commit or push. Current unit checks: 1,064 tests / 119 files, TypeScript and production build passed. Browser checks: desktop1912 and mobile390 fill the viewport without horizontal overflow; drafts persist Home/Skills navigation. Auto PRO produced cyan, while pinned Winter stayed blue across model switching. Preserve all dirty work.

Latest local continuation · 2026-09-28: [private confirmation ledger](work-harness-runtime-confirmations.md) now adds keyed action-set fingerprints, service-only intent persistence and a proposed sixth migration. No API/UI/remote delivery is wired; delivery is always blocked. SQL remains unapplied and PostgreSQL privilege/concurrency acceptance remains unverified. Trusted active-branch capture and conditional remote acceptance are still required. Verification: 1,052 tests / 118 files, TypeScript, scoped lint and build passed locally. Preserve all dirty work. No commit/push/deployment/live migration or paid run.

Final verification for the full-screen/Hermes discovery slice: 1,064 tests / 119 files, TypeScript, scoped lint, production build and diff whitespace checks passed. The fresh design reviewer scored the sole brand-glow correction resolved. The browser preview remains available on port 5174; owned review browser sessions are closed.

Latest UI steering: Current header pills share a visible theme lens; Group Chat is now liquid glass. White-mode model menu and Chat/Work tint were reduced approximately one quarter per user request. Auto/manual behavior and dark intensity are preserved; see `current-liquid-glass.md` and local header CSS fixture evidence. The earlier request to implement the ledger is now partially fulfilled by the private slice above, not by working tool authorization.

Latest continuation · 2026-09-28: [bounded event history and confirmation gate](work-harness-runtime-events.md). Read-only paging now uses encrypted owner/task/generation/revision-bound cursors and rechecks authority after remote reads. Activity reports incomplete history and unavailable tool authorization honestly; task changes abort/clear stale monitor reads. Next implement the durable confirmation review/decision ledger locally, then resolve reviewed-action binding and Stop ordering before remote acceptance. The inspected upstream confirmation request is conversation-wide; historical metadata is not authorization. Latest checks: 1,029 tests / 117 files, TypeScript, scoped lint and production build passed. Execution remains off. No external run, deployment, migration, entitlement grant, schedule, commit or push; HEAD unchanged. Older verification counts below are historical.

Copy this document into a new coding chat with access to the same workspace. Resume the existing implementation; do not rebuild it from scratch.

## Your task

Continue building TimeMachine Work into a real cloud-first, browser-accessible agent workspace using the actual OpenHands and Agenta services. The interaction target is Claude Cowork / ChatGPT agent-style goal-directed work: review a plan, authorize actions, steer execution, inspect progress and usable artifacts, stop safely, and reconnect later. Research current behavior from official sources before making product-specific claims. Do not claim feature parity from a styled shell, mocked tests, installed client, or source checkout.

The user wants the full supported upstream capability set customized for TM, with an optional local environment. Prioritize a functioning, secure hosted task path before broad administration features. Keep an honest capability inventory and distinguish local code, deployed services, live verification, unavailable integrations, and upstream roadmap features.

## Workspace and non-negotiable rules

- Windows / PowerShell. Main repository: `D:/TM-Odysseus/tm-beta-3-ud`. Parent workspace: `D:/TM-Odysseus`.
- Preview: `http://localhost:5174/` or `http://127.0.0.1:5174/`. Check whether the existing Vite process is healthy before starting another. Use an isolated automation session, not the user's browser storage or authenticated session.
- All work stays local. **Do not commit, push, deploy, apply live/staging migrations, grant entitlements, attach recovery schedules, allocate cloud infrastructure, or run paid models without new explicit authorization.** The user specifically forbids commits/pushes.
- Git HEAD at handoff: `6a2b3dec357b863fabc279d9924fe6f34c200027`. The worktree is extensively dirty, with both tracked edits and untracked Work implementation. Preserve everything; do not reset, clean, stash, bulk restore, or stage unrelated work. Landing assets and screenshot replacements are also present and are outside the next Work slice.
- The user prefers independent implementation without clarifying/design questions. Make conservative in-scope decisions. Missing authority for a deployment, paid service, or external write is not permission to perform it.
- Use `apply_patch` for file edits. Never expose secrets, raw upstream credentials, user prompts/files, or private reasoning in logs or handoff material.
- No subscription checkout/billing system now. Work remains premium-only through server-owned entitlements; browser `is_pro` is not authorization.

## Architecture decisions already approved

Keep React + Vite + TypeScript + React Router, Supabase/PostgreSQL, existing TM authentication/history, Vercel API routing and Trigger background workers. Do not introduce Next.js, Prisma, or a parallel identity/history database solely because the original sample prompt mentioned them.

TM owns identity, premium checks, sessions, permissions, model routing, quotas and UI. Air, Girlie and PRO use existing server routes/fallbacks through `api/_lib/personaRoutes.ts` and provider adapters. Do not hardcode sample GPT/Claude models or bypass TM with upstream defaults. Interface mode, persona, execution policy and runtime environment are separate choices. Switching Chat/Work never silently changes the model or starts a task.

Cloud is the default and must not require user installation. Local Work is currently the explicit PRO browser `/max/:sessionId` workspace, using the existing WebContainer/editor. It is not OpenHands on the host, unrestricted device access, or a cloud substitute. Do not silently fall back to local or copy cloud files there.

Use OpenHands Agent Server/SDK for actual execution; its Canvas is a different layer. Agenta supplies its supported configuration, workspace and observability capabilities, not a second agent independently running the same task. Inspect pinned source/client contracts before choosing endpoints or schemas. Preserve licenses and distinguish open-source from commercial capabilities.

## Source checkouts, not remote forks

- OpenHands: `D:/TM-Odysseus/upstream-work/OpenHands`, shallow checkout at `47a10808d78561546a02555d0d2c7fa96fa96300`. Official TypeScript client is pinned to `@openhands/typescript-client@1.49.6` in TM.
- Agenta: `D:/TM-Odysseus/upstream-work/agenta`, minimal sparse API-contract checkout at `257d41543b63eb9062c152c1deb21117d2823951`.
- Earlier GitHub organization fork requests returned HTTP 403. These local checkouts are **not** organization forks, and upstream source has not been modified/pushed. Do not move ownership to another account or retry external mutations without authorization.
- Docker's Linux engine was unavailable at the previous check. A Docker client or npm package is not proof of a working, isolated runtime. Recheck read-only if relevant, but never expose the host filesystem or Docker socket to an agent.

## Read these records first

1. `docs/work-harness-superprompt.md`: original adapted product/architecture brief.
2. `docs/work-harness-next.md` and `docs/work-harness-parity.md`: completed slices, gaps and acceptance gates. Older counts/estimates are historical.
3. `docs/work-harness-runtime-handoff.md`: latest backend slice and the strongest starting point for continuation.
4. `docs/work-harness-model-gateway.md`, `docs/work-harness-runtime-lifecycle.md`, `docs/work-harness-upstream.md`, `docs/work-harness-setup.md`: exact gateway, Stop, upstream and deployment constraints.
5. `docs/work-harness-ui.md` and `docs/current-liquid-glass.md`: approved UI and the latest theme/material changes.

Read additional sources only as required for the chosen slice. Do not reload the entire old chat or regenerate a broad plan before inspecting existing code.

## What exists locally

- Native Chat/Work switch; an Agenta-like Work layout with a toggleable sidebar, compact Home composer, Agents, Automations, Skills, Sessions, recent tasks, Connections, and split steering/workspace panels. Sidebar state, drafts and artifact editing are preserved across navigation. Availability is explicit; no invented agents or execution data.
- Native cloud task contracts and worker: plan/review/approval, bounded research/CSV/draft tools, steering, cancellation, persistence, reconnect, owner checks, generation/worker leases and revision-checked files. Uploads are read-only; generated text/Markdown/CSV/code can be edited, copied/downloaded and exported where supported. This is not general terminal/computer-use execution.
- Optional authenticated OpenHands conversation metadata monitor and Agenta metadata-only trace export/query. Connections reports server configuration, while task Activity checks assigned remote data. Both abort late checks on navigation. No raw keys, backend URLs, raw actions or private reasoning reach the client. Agenta exports are best-effort; unknown tokens/cost remain null, not fabricated zero.
- A disabled task-scoped model gateway for text/function-tool completions via TM aliases, with HMAC grants, ownership/generation/mind checks, bounded requests, quota authority, revocation, leases and prompt provenance.
- OpenHands Stop lifecycle: revoke model grants, save a frozen remote pause target, bounded delivery, confirmation of the assigned non-running conversation, and recovery without replaying uncertain mutations. Acknowledged pause does not prove subprocess termination or sandbox shutdown. Recovery task exists with no schedule attached.
- Approved-plan remote handoff: explicit `runtime: openhands` approval, administrator execution attestation, atomic UUID reservation and generation transfer, once-claimed launch worker, real create → message (`run:false`) → `/run` calls, TM model-profile and `AlwaysConfirm` validation, cancellation on uncertainty and abandonment recovery. Uploaded/generated task files deliberately block launch until real transfer exists. The launcher does not provision a sandbox.

These are local implementation slices with mocked external boundaries. Normal OpenHands capability and execution flags remain disabled. No database migrations or rollback canaries have been applied/run against PostgreSQL; no real OpenHands/Agenta task, provider call, deployment or entitlement grant has occurred. A successful frontend build is not hosted execution.

## Where to work

- UI: `src/components/work/`, `src/hooks/useWork.ts`, `src/services/work/workService.ts`, `src/App.tsx`.
- Contracts: `shared/work.ts`, `shared/workIntegrations.ts`.
- Work API dispatcher: `api/_lib/work/handler.ts`, reached via `/api/work` through the existing `api/pro-generation.ts` function/rewrite. Keep the existing Vercel function budget.
- Backend: `api/_lib/work/store.ts`, `model.ts`, `prompt.ts`, `integrations.ts`, `upstreamTransport.ts`, `runtimeGrant.ts`, `runtimeProtocol.ts`, `runtimeGateway.ts`, `runtimeModel.ts`, `runtimeStop.ts`, `runtimeHandoff.ts`, `runtimeLaunch.ts`.
- Workers: `trigger/workGeneration.ts`, `trigger/workOpenHandsLaunch.ts`, `trigger/workRuntimeRecovery.ts`.
- Five migrations, in dependency order: `work_harness.sql`, `work_upstream_connections.sql`, `work_model_gateway.sql`, `work_runtime_lifecycle.sql`, `work_runtime_handoff.sql`, under `supabase/migrations/`. Corresponding rollback-only canaries are under `supabase/tests/`. Review locally; do not apply them without approval.
- Tests: sibling Work unit tests, `tests/api/work*.test.ts`, worker tests and explicit synthetic UI fixtures under `tests/fixtures/`. Synthetic UI success is not backend evidence.

## Design and theme contract to preserve

Use the existing TM seasonal canvas and liquid-glass materials, Montserrat glowing brand, restrained borders, soft offset shadows and clear text. Work uses a toggleable Agenta-like sidebar, not an oversized marketing hero. `TimeMachine Work` uses the main chat's brand typeface/glow across the full name.

Current glass is shared in `src/stylesheet/liquid-glass.css`, imported after existing light/Legacy styles in `src/index.css`. Its material rules are gated to `:root[data-tm-ui='current']`, including portals and media rules. Contour is an explicit shared exception: both Current and Legacy use the resolved seasonal accent for its popup lens and tool accents. Fresh visitors default to Current; saved Legacy choices remain authoritative. Cadelle (`orb:composing:64`) remains the default thinking animation.

Latest user decisions:

- Latest user correction, 2026-09-28: Current light Auto/Air returns to original Autumn purple and the existing bright persona accents used in dark mode. This supersedes the earlier Spring-red light default. Do not overwrite stored Auto/manual choices. Auto Girlie remains pink and PRO cyan.
- Manual seasons survive switching Air/Girlie/PRO, Max Mode, Healthcare, navigation and reloads. Only **Auto** allows model/mode recoloring. Theme events still remember the latest persona so returning to Auto immediately follows the current mind. Healthcare's atmosphere, brand/composer accent and document flag are gated by Auto.
- Pure keeps a black canvas while its accent follows the selected mind: Air purple, Girlie pink, PRO cyan. Other manually chosen seasons stay pinned across model changes.
- The message bar has a brighter selected-season glass tint; Auto reflects the active model/mode. The text remains readable.
- Current's composer plus uses the resolved accent and an emphasized pill lens in both appearances; Legacy keeps its original control recipe.
- Chat/Work choices are inside the TimeMachine dropdown on mobile, desktop and iOS; the separate switch pill is gone. In Work, the existing “TimeMachine Work” title opens the dropdown. Its chevron matches the same Auto/manual accent as the title.
- Main Legacy Chat and Work use the same compact name dropdown with an opaque themed panel; group/override/Max routes retain the old Legacy brand component. This supersedes the earlier oversized, translucent Work menu.
- The guest “free messages left” and “Sign Up” pills share a 44px height and theme-tinted glass lens; each width fits its content. Welcome destination pills and chat history cards/controls also use a subtle resolved accent in light and dark.
- Settings/model menus/Flight Controls share the season/model-tinted dense glass sheet (`--tm-liquid-themed-sheet`). Auto follows the chosen mind; manual seasons color all three even when models change. Their badge, selection, tab, icon and toggle accents use the resolved palette. Do not reintroduce fixed cyan/purple accents. Semantic recording/error/destructive colors remain meaningful.
- Mobile Notes AI remains near-opaque: 96% paper base, 36px blur. Do not reintroduce background text bleeding through.
- Solid reduced-transparency/high-contrast/no-backdrop fallbacks and touch-friendly blur limits remain.

Theme logic and regression tests: `src/context/ThemeProvider.tsx`, `src/themes/themeState.ts`, `src/themes/seasonPalette.ts`, `src/themes/liquidGlass.test.ts` and existing theme tests. Do not edit Legacy styles to propagate Current material changes.

## Next recommended backend slice

Inspect the pinned Agent Server event/confirmation contracts and existing gateway/launch/Stop code. Design and implement a bounded, owner-scoped remote event and human-tool-confirmation bridge, including explicit approve/reject UI, cancellation and reconnection. `AlwaysConfirm` intentionally prevents silent tool execution; keep it until actual human authorization is wired end-to-end. This is a recommendation, not permission to start a live runtime.

Follow with remote steering/resume, grant renewal, durable file/artifact transfer and events, isolated runtime provisioning, termination/cleanup, recovery and authenticated staging acceptance. Keep TM ownership/generation authority on every remote operation. Never allow client-supplied backend URLs, conversation IDs, credentials or host paths. Do not delete user task files to bypass the launch safeguard.

Then expand Agenta configuration/version administration, datasets/evaluations/experiments where the pinned version supports them, schedules, integrations/MCP permissions, team roles and durable telemetry delivery. Do not present placeholder controls as working features. Record unsupported/commercial/roadmap capabilities honestly.

Add adversarial tests for cross-owner access, stale generation, duplicate delivery, uncertain remote acknowledgments, malformed/mismatched events, expired/revoked access, Stop racing launch/approval, oversized responses, credential redaction and lost/replayed requests. Stops must remain available to authenticated owners after premium expires.

If external setup prevents live acceptance, continue safe implementation/tests for a concrete slice and document the exact release gate. Do not enable execution flags or pretend that local tests establish runtime isolation. The last broad estimate was roughly 65–75% remaining for full upstream parity; it was a planning estimate, not measured progress, and UI polish does not materially complete that target.

## Verification and context management

Latest Contour/default pass, 2026-09-28: 12 focused theme/default tests, TypeScript, full ESLint and production build passed; `git diff --check` found no whitespace errors. Isolated browser checks confirmed the seasonal Contour lens in Legacy dark Autumn, Current light manual Summer, and Current dark mobile at 390px. A fresh browser resolved to Current and Cadelle. `http://localhost:5174/` was started for local review. Earlier full-suite result: **1,066 tests across 120 files passed**. Existing chunk-size/static-dynamic-import warnings remain. No commits or pushes; HEAD unchanged.

Use `npm test -- --reporter=dot`, `npm run build`, focused tests/lint and `git diff --check` in the main repository. Verify each new slice in proportion to its risk. Check existing instructions/skills and source contracts first. Do not spawn new sub-agents unless the user or an applicable instruction explicitly authorizes delegation.

Keep brief progress updates. Work in concrete implementation slices, preserve approved UI, and state exactly what is done versus externally gated. Update this handoff plus the capability/implementation records after each material slice, before context grows too large. Include changed files, final checks, outstanding risks and the next executable task. Do not repeatedly reconstruct the full history.

Writing/material references used in the latest handoff: [Better Writing](C:/Users/Shafin/.agents/skills/better-writing/SKILL.md) for factual, action-oriented instructions; [Impeccable](C:/Users/Shafin/.agents/skills/impeccable/SKILL.md) for scoped reuse and bounded verification; [Apple Design](C:/Users/Shafin/.agents/skills/apple-design/SKILL.md) for glass hierarchy and transparency fallbacks.
