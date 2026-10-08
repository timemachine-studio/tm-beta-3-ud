# TM Work: implementation contract

Latest continuation · 2026-09-28: [bounded event history and confirmation gate](work-harness-runtime-events.md). Read-only paging now uses encrypted owner/task/generation/revision-bound cursors and rechecks authority after remote reads. Activity reports incomplete history and unavailable tool authorization honestly; task changes abort/clear stale monitor reads. Next implement the durable confirmation review/decision ledger locally, then resolve reviewed-action binding and Stop ordering before remote acceptance. The inspected upstream confirmation request is conversation-wide; historical metadata is not authorization. Latest checks: 1,029 tests / 117 files, TypeScript, scoped lint and production build passed. Execution remains off. No external run, deployment, migration, entitlement grant, schedule, commit or push; HEAD unchanged. Older verification counts below are historical.

Research date: 2026-09-27. Billing deferred. No deployment or upstream feature-parity claim is implied by source code.

## Research and decisions

[ChatGPT Work](https://learn.chatgpt.com/docs/get-started-with-work) is outcome-oriented: reviewable files, visible progress, steering and important-action approvals. Cloud work is independent of a powered-on device; local work is explicit. TM inherits that workflow, not OpenAI's models or identity.

[Claude Cowork](https://support.claude.com/en/articles/13345190-get-started-with-claude-cowork) separates task planning, execution and finished outputs, with persistent projects and scoped access. TM should serve research, writing, analysis and coding rather than present an empty IDE for every task.

[OpenHands SDK](https://github.com/OpenHands/software-agent-sdk) provides agent execution and its canonical REST/event API. [Agenta's documentation](https://agenta.ai/docs/reference/agents/traces-and-usage) covers agent configuration, traces, usage, evaluations and automations. Neither platform is equivalent to a CSS layout; integrations must be real and version-checked.

The selected architecture extends React/Vite, Supabase, Trigger.dev and TM persona routes. A native TM task worker handles bounded planning, research and text/CSV/code artifacts. Remote execution is a separate adapter capability, never shell execution on Vercel. Shared credentials and arbitrary user-provided backend URLs are not accepted.

## Surface contract

Operate, not a marketing redesign. Keep TM's seasonal atmosphere, persona colors, existing typography and both theme appearances. The user explicitly requires translucent liquid-glass surfaces in Work and the mode switch: seasonal background must visibly pass through a blurred composer/control material, with soft edge highlights, not opaque black cards. Thicker glass separates task panes/history; small controls are lighter. Respect reduced transparency and contrast settings. A top-center Chat / Work segmented control changes the view without navigating, sending, resetting a model or unmounting the chat composer. Mobile places it below the brand to avoid collisions.

Work starts with “What should we work on?” and one compact task composer. A toggleable sidebar provides Home, Agents, Automations, Skills and Sessions; it starts open on desktop and closed on mobile. A persistent header control reopens it, and hiding navigation expands the workspace without resetting drafts or file editors. A compact Cloud / Local control names where execution happens. A model selector retains Air, Girlie and PRO. Outcome suggestions are text actions, not a grid of decorative cards. Once a task starts, the left column shows the steering thread; the right shows Overview, Files and Activity. Developer execution tabs are shown only when supported. The complete `TimeMachine Work` wordmark inherits the main chat's Montserrat bold persona styling and dark-mode glow.

The signature interaction is the reviewable plan: inspect steps and output expectations, approve to execute, stop an active task, then preview/copy/download the actual saved deliverable. A progress step is complete only after a stored result exists. No fabricated statistics, tool calls, costs or background completion.

## Delivery sequence

1. Bounded shared contracts, owner-only Supabase schema, server-owned Work entitlement and immutable configuration versions.
2. Same-origin Work API: auth, entitlement, ownership, input bounds, concurrency, idempotent actions, capability reporting and redacted errors.
3. Trigger.dev worker: TM routing/fallbacks, plan approval, bounded tools and outputs, persistent status/activity, cancellation checks, reconnectable progress.
4. Native themed Work interface and non-destructive main-chat switch. Explicit local PRO workspace entry, never an automatic fallback.
5. Upstream adapter boundaries and honest capability inventory. OpenHands sandbox provisioning and Agenta full administration are independently deployable follow-on integrations, not unimplemented controls masquerading as functionality.
6. Contract/security tests, typecheck, lint, production build and desktop/mobile browser checks. Do not deploy migrations, allocate cloud infrastructure, commit or push without authorization.

## Feature ledger

| Capability | This implementation | Deployment dependency |
| --- | --- | --- |
| Chat / Work switching, themes, persona selection | Native TM UI | None |
| Plans, approval, steering, cancellation, task history | Native TM API/worker | Supabase migration + Trigger worker |
| Files, editable text artifacts, preview, download | Owner-scoped hosted storage | Supabase migration |
| Research and text/code/CSV drafts | TM model routes and server tools | Existing provider/search credentials |
| Local coding workspace | Explicit existing PRO /max workspace | Browser runtime support; device must remain online |
| OpenHands terminal, browser execution and sandbox files | Researched architecture; not integrated yet | Isolated per-user sandbox provisioner; not a shared host directory |
| Agenta traces/configuration/evaluations/automations | Native TM run ledger; full Agenta integration pending | Hosted Agenta/project credentials and tested version |
| Team sharing, schedules, integrations, full upstream parity | Follow-on inventory | RLS/team roles, secrets and durable scheduling policies |

Premium is enforced by a server-owned `work_entitlements` table. Do not copy potentially client-editable `profiles.is_pro` into authority. An administrator can grant Work access while subscriptions are deferred. Guests can see the interface but cannot start, read or change private Work tasks.

## Failure and security rules

Never lose a draft on view switching or a failed request. Poll durable state rather than rely on an open tab. A worker receives only the task ID, not source documents in a retained job payload. Stop prevents later step/file writes using status-conditional transactions. Keep unknown token usage/cost null. Plan approval is not permission to publish, purchase, send messages, delete external data or access unconnected files.

Treat file content, web pages and tool results as untrusted data, not instructions. Bound task count, steps, iterations, output bytes, file paths and calls. All model requests use TM's existing providers and fallbacks with quota checks. Prefer genuine Markdown/CSV output to pretending a text blob is a PDF, spreadsheet workbook or slide deck.
