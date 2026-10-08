# TM Work capability inventory

Status: 2026-09-29. This is an implementation inventory, not a claim of full OpenHands, Agenta, Claude Cowork or ChatGPT agent parity. Changes are local and uncommitted. No hosted execution, live migration or entitlement grant has been performed.

## Source baseline

- [OpenHands](https://github.com/OpenHands/OpenHands): local shallow checkout `47a10808d78561546a02555d0d2c7fa96fa96300`, at `D:/TM-Odysseus/upstream-work/OpenHands`. Agent Canvas and the Agent Server/SDK are separate layers. TM pins the official TypeScript client to `1.49.6`; this does not establish compatibility with every Canvas backend.
- [Agenta](https://github.com/agenta-ai/agenta): local sparse API-contract checkout `257d41543b63eb9062c152c1deb21117d2823951`, at `D:/TM-Odysseus/upstream-work/agenta`. Its current workspace platform includes agents, permissions, sessions, integrations, schedules and tracing. Features marked as roadmap upstream are not treated as delivered capabilities here.
- Neither checkout is a remote organization fork. The authenticated GitHub account received HTTP 403 when attempting the `timemachine-studio` forks. No upstream source has been modified or pushed.

## What TM implements

“Implemented locally” means code and bounded automated/UI checks exist. It does not mean the required database, worker or upstream services have been deployed.

| Capability | TM implementation | Remaining work |
| --- | --- | --- |
| Chat / Work switch | Implemented locally; Chat remains separate and retains its state. | Production acceptance testing. |
| Agenta-like workspace layout | Toggleable sidebar, compact Home composer, Agents / Automations / Skills / Sessions, recent sessions, Connections, and split conversation / workspace panels. TM glass, seasonal colors and glowing Montserrat brand are retained. | This is a TM shell, not an embedded or forked Agenta frontend. |
| Cloud task lifecycle | Native background worker: plan, human review, approval, bounded steps, steering, stop, saved status and reconnect. | Apply staging schema, configure worker and premium entitlement; exercise authenticated end-to-end runs. |
| Research / document / CSV tasks | Native bounded search, public-page fetch, source reading, CSV analysis and draft writing. | Not a general computer-use or coding agent. |
| Workspace files | Read-only uploads; generated text, Markdown, CSV and code drafts; version-checked editing, preview, copy and download; Markdown-to-Word export. | No OpenHands filesystem, executable project preview or hosted artifact storage integration. |
| Deliverables archive | Files pane exports saved generated files as a ZIP with original nested paths and revision metadata. CSV formula cells receive the same neutralization as single downloads. Original uploads are excluded; unsaved edits must be saved first. | This bundles native TM files only; it does not transfer or export a remote OpenHands sandbox. |
| TM model routing | Existing Air, Girlie and PRO route/fallback authority, quota checks and worker-generation checks. The disabled-by-default gateway accepts scoped text/function-tool completions; the local launcher supplies TM aliases to OpenHands and verifies its returned profile before running. | Provisioning and grant renewal, installed SDK compatibility acceptance, durable request idempotency and actual provider usage capture. No bypass to an upstream default model. |
| Prompt provenance | Immutable native prompt snapshot/version stored in TM and referenced by local model calls. | Agenta prompt playground, revision promotion and experiment UI. |
| Native traces | Persisted events, model/provider, phase, outcome, latency and prompt version. Unknown tokens and cost remain null. | Actual provider usage capture, verified pricing, trace hierarchy and cost aggregation. |
| OpenHands monitoring | Owner-assigned conversation/runtime/event metadata via official client. After a manual connection check, a running conversation refreshes while its Activity panel is open. Bounded event paging has encrypted owner/task/generation/revision-bound cursors and post-read authority checks. | No deployed creation, execution or provisioning; no durable remote event mirror. Paging needs an optional server secret. |
| OpenHands human tool confirmation | Waiting status explains unavailable authorization and existing Stop. A private, disabled-by-default review/decision ledger and rollback-only staging canary exist locally. Inspected upstream acceptance is conversation-wide. | Trusted active-branch capture, meaningful safe previews, atomic exact-action acceptance, duplicate/lost response recovery and Stop ordering remain required. The ledger is unexecuted against PostgreSQL and no working approve/reject controls exist; see [gate](work-harness-runtime-confirmations.md). |
| OpenHands Stop / launch contract | Local cancellation revokes grants and saves a frozen pause outbox. Explicit remote approval now reserves one conversation/generation; a once-claimed worker creates idle, submits the approved plan with `run:false`, verifies TM routing/`AlwaysConfirm`, and calls the real `/run` endpoint. Uncertain/abandoned launches cancel rather than replay. Recovery has no attached schedule. | SQL canaries and real SDK acceptance are unexecuted. No deployed launcher, sandbox termination, human confirmation UI, grant renewal, remote file transfer or unattended recovery schedule. Execution stays disabled/unavailable. |
| Agenta trace integration | Optional metadata-only export/query, scoped to an administrator-attested project and owned TM task; Activity explicitly checks returned traces. | No durable export queue, full spans, evaluations or platform administration. |
| Connection status | Premium authenticated server configuration check; no credentials or backend URLs returned. Configured and remotely checked are distinct. | Automatic remote scope verification and deployment health checks. |
| Local execution option | Explicit entry into existing PRO browser WebContainer editor / terminal / preview. | Not a local OpenHands runtime, host filesystem agent or automatically synchronized cloud workspace. |

## Not implemented

These must not be represented as working features by enabling a visual control alone:

- OpenHands tenant-isolated sandbox provisioning, operational tool-capable agent loop/shell execution, browser control, remote file explorer, human execution confirmations, deployed pause/resume and checkpoint recovery, Git operations and pull-request workflows. Local launcher/Stop code is not a deployed runtime lifecycle. Tasks with any TM files are rejected by remote reservation until real file transfer exists.
- Agent Canvas ACP/multi-backend management and live execution event integration.
- Agenta custom agent CRUD, tool permissions, skills distribution, integrations/connectors, MCP server management, credential vault, project/team roles and workspace administration.
- Scheduled automations, integration-event triggers, notification channels and connected workflow management.
- Prompt experiments, datasets, batch evaluations, evaluator administration, comparison/playground UI and production monitoring analytics. Availability varies by pinned upstream version; inspect its actual API before adding an adapter.
- Full usage/cost accounting and durable telemetry export.
- Full cross-harness conversation synchronization, cloud/local workspace synchronization and authenticated end-to-end recovery testing.

Automations and unsupported management areas explain their limits. They do not fabricate records or expose nonfunctional launch controls. The UI fixture is explicitly synthetic and does not count as backend execution evidence.

## Execution release gates

1. Obtain organization fork permissions if remote forks are still required. A local checkout is not a substitute claim.
2. Provision and verify isolated Agent Server runtimes and Agenta projects. A Docker CLI installation is not a running or isolated sandbox; never give an agent unrestricted access to the development host or Docker socket.
3. Stage the [scoped, revocable TM model gateway](work-harness-model-gateway.md) and [approved-plan handoff](work-harness-runtime-handoff.md), implement provisioning and renewal, and verify installed SDK compatibility before allowing an upstream agent to execute. Neither code path allocates a sandbox. Keep upstream keys server-side.
4. Implement authorized tool actions and approval boundaries, durable event delivery, stop propagation, workspace persistence and recovery. Preserve task ownership through every binding.
5. Deploy explicitly approved staging schema/worker/services and run cross-account denial, command safety, reconnect, cancellation, entitlement-expiry, trace and artifact acceptance tests.

See [adapter setup and security constraints](work-harness-upstream.md) and [native worker setup](work-harness-setup.md). No billing system, live deployment, commit or push is included in this work.

## Latest local verification

The 2026-09-29 continuation passed 80 focused Work tests and TypeScript typecheck. The confirmation migration and canary parse as SQL, and the canary's procedural body parses as PL/pgSQL; neither has been executed against PostgreSQL. The earlier approved-plan handoff passed 978 tests across 115 files, scoped ESLint and a production build. No actual OpenHands/Agenta service or paid provider was called. Rough full-target progress remains approximately 25–35% complete (65–75% left), not a measured score or feature-parity certification.
