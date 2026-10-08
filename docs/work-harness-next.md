# TM Work: upstream integration and workspace revision

Latest local continuation · 2026-09-29: The service-only confirmation ledger has a [rollback-only staging canary](../supabase/tests/work_runtime_confirmations_canary.sql), covering binding, idempotent decisions, expiry, grant/connection/entitlement revocation, Stop and private privileges. The SQL has not run against PostgreSQL and the ledger cannot deliver authorization. The next implementation gate is complete active-branch capture plus atomic exact-action acceptance in a compatible isolated runtime; event-history pages and the current conversation-wide confirmation endpoint do not provide it.

Latest continuation · 2026-09-28: [bounded event history and confirmation gate](work-harness-runtime-events.md). Read-only paging now uses encrypted owner/task/generation/revision-bound cursors and rechecks authority after remote reads. Activity reports incomplete history and unavailable tool authorization honestly; task changes abort/clear stale monitor reads. Next implement the durable confirmation review/decision ledger locally, then resolve reviewed-action binding and Stop ordering before remote acceptance. The inspected upstream confirmation request is conversation-wide; historical metadata is not authorization. Latest checks: 1,029 tests / 117 files, TypeScript, scoped lint and production build passed. Execution remains off. No external run, deployment, migration, entitlement grant, schedule, commit or push; HEAD unchanged. Older verification counts below are historical.

The user's supplied sidebar workspace reference and existing superprompt are the approved direction. Continue without new design questions. All changes stay local: no commits, pushes, migrations to live databases, or hosted deployment.

## Implementation order

1. Recompose Work as a toggleable glass sidebar plus workspace, not a marketing-like centered hero. Keep Chat intact. Match the main chat's Montserrat bold wordmark and persona/season glow across the entire `TimeMachine Work` name. The sidebar defaults open on desktop and closed on mobile. A persistent header toggle and sidebar close control work at every size; Escape inside navigation closes it and restores focus to the toggle. Navigation keeps it open on desktop and closes it on mobile. Collapsing expands the workspace without unmounting task, draft or artifact panes.
2. Pin and inspect actual upstream source. GitHub organization forks require permissions currently denied to the authenticated account. Source checkouts are not remote forks. Preserve upstream licenses. OpenHands Canvas owns UI, while its SDK/Agent Server owns execution; use the official typed client rather than invented endpoints.
3. Add authenticated, owner-scoped adapters for OpenHands and Agenta. TM remains the identity, entitlement and model-routing authority. Never expose a service key or accept an arbitrary backend URL from a client. An unavailable service stays explicitly disconnected, not simulated.
4. Verify adapter wire contracts, denied ownership, input bounds, cancellation and outputs. Connect execution only to a tenant-isolated provisioned runtime; do not run an agent with access to this host filesystem. Native draft tools and the explicit PRO local workspace remain distinguishable from OpenHands.
5. Capture desktop/mobile and dark/light appearances, test navigation and draft retention, run typecheck/lint/tests/build, finish-review the exact supplied reference, and record only the built surface.

## Design contract

THESIS: a working control center, with sessions findable through toggleable navigation and a compact task entry, rather than an oversized empty hero.

OWN-WORLD: TM's inherited seasonal canvas, neon persona accents, Montserrat brand and frosted materials; heavier sidebar glass separates navigation and lighter composer glass retains the seasonal field.

STORY: choose a mind, start a goal, review the plan, steer the task and inspect real files or activity. Agent, skill and automation areas explain their actual availability without fake data.

FIRST VIEWPORT: existing brand and Chat/Work control remain at the top; below, a 240px desktop sidebar contains Home, Agents, Automations, Skills and Sessions; a left-aligned heading and composer occupy a modest central column. Access status is secondary, not a large blocking card above the task.

FORM: precisely specified incumbent extension based on the user's sidebar reference, code-led. No new global visual identity or image generation is needed.

## External gates

- Organization forks: GitHub returned HTTP 403 for `timemachine-studio` fork requests. Do not silently move ownership to another account.
- Runtime: Docker's Linux engine was unavailable on the last check. Installing a client is not proof of a running sandbox.
- Cloud: persistent hosting, tenant isolation and service/project credentials must be established before real hosted execution can be claimed. Full upstream feature parity remains unverified until these gates and end-to-end acceptance runs are complete.

## Completed local slice · 2026-09-27

The toggleable sidebar is implemented and browser-reviewed, with its visual/behavioral evidence in the UI record. OpenHands has a full shallow source checkout and Agenta has a working minimal sparse API-contract checkout. The first server adapters now support owner-assigned conversation monitoring and optional metadata-only model-call export/query, without enabling upstream execution or full platform administration. See [exact contracts, setup and remaining work](work-harness-upstream.md). Local verification passed 806 tests across 105 files, TypeScript checks, scoped lint and the production build. No commits or pushes.

## Runtime confirmation continuation · 2026-09-28

The new [private intent ledger](work-harness-runtime-confirmations.md) binds reviews to the exact action fingerprint, task revision and runtime grant. Remote delivery is always blocked. The sixth migration is a local proposal, unapplied and untested against PostgreSQL. A trusted complete active-branch snapshot adapter and conditional remote acceptance remain gates; bounded event history cannot serve as an approval snapshot. No execution capability has been enabled.

## Current continuation

The user has reiterated the full-harness target and Agenta layout. Keep the approved sidebar, compact Home composer and active split workspace in the inherited TM glass system. Add Connections in the sidebar footer and task-specific upstream monitoring under Activity. Both use real authenticated adapters, with loading, unavailable and error states; no automatic execution or raw upstream credentials. Account configuration is distinct from a checked remote connection. Preserve drafts when entering or leaving these views. Inventory the actual pinned upstream capability groups and mark native implementation, optional adapter, unavailable integration and external deployment gates separately. Verify desktop/mobile, dark/light and async cancellation before recording this slice. No commits, pushes or live setup.

This continuation is implemented locally. Connections and Activity use the authenticated server routes; leaving a check aborts it and suppresses late results. The [capability inventory](work-harness-parity.md) lists what remains, without treating these read-only adapters as an execution harness. Verification: 819 tests across 107 files, TypeScript, scoped ESLint and production build passed. Existing large-chunk/dynamic-import warnings remain. Synthetic browser checks covered dark/light desktop/mobile, no horizontal overflow, retained task directions and unsaved artifact edits, and abort on navigation. The independent finish reviewer returned `ship` for the Connections/Activity extension only; this does not approve hosted operation or full upstream parity. No database migration, hosted/provider run, commit or push.

## Runtime model bridge continuation

The user requested continued development. The next approved-superprompt backend slice implements the [task-scoped model gateway](work-harness-model-gateway.md): text/function-tool completions through existing TM routes, revocable HMAC grants, owner/generation/mind/worker checks, serialized database leases, protected prompt provenance and local metadata before optional Agenta export. It is disabled by default and shares the existing Vercel function budget. The UI is unchanged. No sandbox launcher or general OpenAI endpoint is implied. Handoff, isolated provisioning, human tool approvals, grant renewal, runtime stop and durable event/artifact integration remain separate work. No commits or pushes.

## Runtime lifecycle continuation · 2026-09-27

The next user-approved backend slice is implemented locally: [runtime lifecycle contract](work-harness-runtime-lifecycle.md). OpenHands Stop never sends a remote worker ID to Trigger. Service-only cancellation atomically revokes the model grant and saves a frozen remote pause target; leased delivery reads state first and confirms non-running status before recording acknowledgment. Network/audit failure preserves the pending stop. Authenticated owners can Stop after premium expires; remote steering/native approval are explicitly blocked until their real synchronization is built. A recovery task exists without an attached schedule. A server-only launch-payload helper uses the assigned TM mind, explicit Chat Completions transport, bounded sequential tools and `AlwaysConfirm`; it does not allocate or start a sandbox.

Verification: 78 focused tests and 949 tests across the full 114-file suite, TypeScript, scoped ESLint and production build passed. Existing build-size/dynamic-import warnings remain. The new lifecycle migration and rollback canary have not been applied or run against PostgreSQL. No live OpenHands/Agenta run, model/provider call, entitlement grant, recovery schedule, deployment, commit or push. Transactional approved-plan handoff, isolated provisioning, human tool approval/event synchronization, grant renewal, remote files and process/sandbox termination remain required before enabling hosted execution. UI and browser fixture are unchanged by this backend slice.

## Approved-plan handoff continuation · 2026-09-27

The [approved-plan OpenHands handoff](work-harness-runtime-handoff.md) is implemented locally: explicit remote approval, administrator-attested connection, atomic conversation reservation/generation change, once-claimed worker, real Agent Server create → send → run endpoints, TM model/profile and `AlwaysConfirm` validation, and cancellation on uncertain outcomes. Abandoned reservations/leases are cancelled, not replayed. A proven never-dispatched reservation is distinguished from a pending remote pause; revoked connection authority clears grants. Uploaded/generated TM files block remote reservation until transfer exists.

Verification: 978 tests across 115 files, TypeScript, scoped lint and production build passed. External services are mocked; the fifth migration and rollback canary are not applied/run. No live/provider request, schedule, deployment, entitlement grant, commit or push. Normal UI remains unchanged and execution is disabled. Next release gates: actual isolated runtime provisioning, human tool confirmation and remote steering, grant renewal, durable event/file synchronization, termination/cleanup, authenticated staging acceptance, then Agenta administration/evaluations and durable telemetry. Full upstream parity is not complete; the rough full-target estimate is 65–75% remaining.

