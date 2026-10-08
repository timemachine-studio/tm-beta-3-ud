# Work harness setup and current limits

Optional read-only OpenHands event paging uses server-only `TM_WORK_EVENT_CURSOR_SECRET` (independent random secret, 32–256 characters). Empty preserves latest-page monitoring and reports truncated history. Rotation invalidates encrypted cursors. Browsing expires after ten minutes and caps at twenty older pages; task/authority changes require a fresh check. This requires no additional migration, does not grant tool authorization and does not change execution flags. See [event/confirmation release gate](work-harness-runtime-events.md).

The UI is available locally. Hosted task execution is **not enabled merely by building the frontend**. No live migration, entitlement grant or worker deployment was performed by this change.

## Native cloud worker

1. Review and explicitly apply `supabase/migrations/work_harness.sql` to staging first. The existing `chat_sessions.id` was verified read-only as UUID in the configured Supabase API schema. Back up production before any later application.
2. Run `supabase/tests/work_harness_canary.sql` explicitly in staging. It verifies ownership, service-only writes, entitlement protection, cancellation and worker-ownership checks inside a rolled-back transaction. This canary has not been run against a migrated database yet.
3. Configure existing server-only Supabase and provider/search credentials on **both** the Vercel API and Trigger worker. Do not prefix secrets with `VITE_`. Only the existing public Supabase URL/anon key are client settings.
4. Configure `TRIGGER_PROJECT_REF`, `TRIGGER_SECRET_KEY` and `TM_WORK_ENABLED=true`. Deploy `trigger/workGeneration.ts` through the existing Trigger deployment workflow. Enable the API flag only after worker readiness is confirmed. Trigger payloads contain an opaque task ID and generation counter, not source files or user instructions.
5. Grant approved premium accounts access using the server/admin-owned `work_entitlements` table (`enabled`, optional `expires_at`). Subscription checkout is deferred. Never trust or copy a client-editable profile flag as payment authority.
6. Verify a real authenticated run: plan → review → approval → files → complete; test Stop mid-call, reconnect after closing the tab, expired entitlement, lost responses and another account's task ID. No paid/provider execution was started during local UI checks.

The public `/api/work` route rewrites to the existing `pro-generation` function with a dedicated Work dispatcher, retaining the repository's 12-function Vercel budget. The dispatcher enforces Work-specific verified auth and ownership. Premium entitlement gates reads and all mutations except Stop: authenticated owners can stop their own task even after access expires. Vite mirrors the rewrite locally.

Native tools: public web search/fetch, read-only uploaded text/code/CSV/TSV, deterministic table statistics, and bounded writes to generated Markdown/text/CSV/code files. Downloads are real files; CSV downloads neutralize spreadsheet formulas. Markdown can also be exported as a real DOCX using TM's existing converter. Binary input, terminal execution, browser control, mail, publication and external destructive changes are unsupported by this worker.

Tasks, original files and events are protected by owner-only RLS. Clients cannot directly write state, approvals, entitlement or model usage. File edits use revision checks. A task lock makes cancellation and subsequent file writes mutually exclusive. A generation plus worker-identity check rejects stale/duplicate workers after revision/restart. One active task per account limits concurrency.

Prompt snapshots contain application-authored system and format instructions. Model-call records contain route, model, outcome, latency and version—not user prompts, source contents or chain-of-thought. Tokens/cost are null when upstream reporting is unavailable. Calls and tool iterations have hard ceilings; no fabricated usage numbers are shown.

## Local option

Local Work is an explicit entry into the existing PRO browser `/max/:sessionId` workspace. It is not OpenHands running on the user's computer, does not grant unrestricted device access, and does not copy cloud files automatically. A verified Work entitlement is checked before entry. Switching environments does not silently select PRO or start execution. The browser/device must stay open.

## Upstream integration status

OpenHands SDK/Agent Server and Agenta were researched; their full services are **not yet integrated or deployed**. The current capability response deliberately reports both unavailable. Native TM traces and plans are not a claim of full Agenta/OpenHands parity.

The first optional server adapter supports assigned OpenHands conversation monitoring and metadata-only Agenta trace export/query. It is disabled by default. Connections checks account configuration; Activity checks a task's assigned remote data. Neither panel enables upstream execution. See [upstream adapter setup and exact limits](work-harness-upstream.md) and the [capability inventory](work-harness-parity.md). No staging migrations or live upstream acceptance runs have been performed.

The local [runtime model gateway](work-harness-model-gateway.md) lets isolated OpenHands conversations use TM's routes. It requires a reviewed migration, server signing secret, attested binding and short-lived scoped credential. The subsequent [approved-plan handoff](work-harness-runtime-handoff.md) supplies that credential to the real Agent Server; neither slice provisions an isolated runtime, enables the normal UI execution capability or deploys services. Stage and validate the full lifecycle before enabling it.

The next execution phase needs a real tenant-isolated sandbox provisioner, scoped TM model gateway, pinned SDK/server protocol and remote workspace ownership/cleanup. Never expose a shared Agent Server directory, Docker socket, service credential or arbitrary user-provided backend URL. Sandboxed commands and external protected actions need execution-layer authorization, not a prompt-only instruction.

Agenta configuration administration, experiments/evaluations, MCP/integration connections, teams, schedules, remote previews and cloud terminals remain follow-on work. Do not render pretend controls for them. A deployment target, service credentials and security configuration must be established before those paths can be end-to-end verified.

## Runtime Stop and launch contract (local, not enabled)

Review [the lifecycle design](work-harness-runtime-lifecycle.md), then explicitly stage `work_runtime_lifecycle.sql` after the other three Work migrations. Run `supabase/tests/work_runtime_lifecycle_canary.sql` only against a quiescent staging account/session. It rolls back all its changes and makes no remote requests. Neither file has been executed locally against PostgreSQL.

The API sends native worker IDs only to Trigger. An owned `openhands:<UUID>` worker uses atomic grant revocation and a saved pause outbox. Delivery reads the frozen conversation state first, so a lost prior acknowledgment can recover without repeating a mutation. A pause is acknowledged only after the response identifies the assigned conversation in a non-running state. It is not a guarantee of subprocess termination or sandbox shutdown. Binding/connection mismatches remain unconfirmed; inspect redacted activity and the service-only outbox rather than assuming success.

The `tm-work-runtime-stop-recovery` Trigger task is defined without a cron or attached schedule. Configure its server-only Supabase/upstream credentials, verify the staging canary, attach an explicitly approved schedule using [Trigger's scheduled-task setup](https://trigger.dev/docs/tasks/scheduled), and enable `TM_WORK_RUNTIME_STOP_RECOVERY_ENABLED=true` only after readiness is verified. No schedule was registered or worker deployed during development. Until configured, retries occur only through an owner Stop request or trusted manual invocation. Blocked rows with a missing binding require administrator recovery; the worker never substitutes another connection. Preserve these targets through account/runtime cleanup until termination is confirmed.

The server-only `prepareOpenHandsLaunch` helper constructs an idle conversation payload with the assigned UUID, an explicit TM Chat Completions profile, sequential Terminal/FileEditor/TaskTracker tools, `AlwaysConfirm`, no initial message, no title-model call and no arbitrary hooks/plugins/MCP. Configure `TM_WORK_MODEL_GATEWAY_BASE_URL` as the trusted TM HTTPS `/api/work-model/v1` endpoint. Its output contains a task-scoped grant and must never be logged or returned to the browser. `/workspace/tm/<task UUID>` is a path inside an administrator-attested dedicated container/VM, not proof of isolation. The helper does not allocate a sandbox; the separate launcher below performs handoff. SDK compatibility, durable event/file transport, human confirmation controls, grant renewal and cleanup must be implemented and accepted before any launch action is exposed.

## Approved-plan OpenHands handoff (local, disabled)

Review `supabase/migrations/work_runtime_handoff.sql` as the fifth migration, after `work_harness.sql`, `work_upstream_connections.sql`, `work_model_gateway.sql` and `work_runtime_lifecycle.sql`, in that order. The new `supabase/tests/work_runtime_handoff_canary.sql` is staging-only and rolls back; it checks approval scope, one-time dispatch, generation invalidation, revoked connection authority, expired launch recovery and browser privilege denial. It has not been run against PostgreSQL.

`execution_verified_at` on the owner-bound OpenHands connection is a separate administrator attestation of a dedicated isolated runtime. Existing read-only connections are not silently promoted. Revoking execution/scope attestation or disabling the connection also revokes existing binding model grants. Restoring the connection does not automatically re-enable an old binding.

The existing `approve` API accepts the optional explicit `runtime: "openhands"`; omission preserves native behavior. Neither the browser nor Trigger payload supplies a remote address, key, model provider or working directory. The transaction reserves one UUID, increments generation, binds the runtime and creates a private launch ledger. Tasks with files are rejected until real transfer exists; do not manually delete user files to evade that safeguard.

The `tm-work-openhands-launch` worker receives only a launch ID. It claims once, creates idle, verifies the TM model profile and `AlwaysConfirm`, sends the approved plan with `run:false`, rechecks authority/policy and starts with `/run`. Duplicate deliveries do not replay these mutations. Uncertain outcomes cancel model access and preserve a remote pause requirement. Recovery rechecks expiry under lock: a never-claimed reservation resolves explicitly as `never_dispatched`, whereas an expired dispatched lease still needs real pause confirmation. A successful `/run` acknowledgment is not task completion or proof of tool execution.

Keep `TM_WORK_OPENHANDS_EXECUTION_ENABLED=false`. An explicit staging enablement additionally needs the upstream/gateway flags, trusted HTTPS gateway base, strong signing secret, worker credentials and attested connection. Do not enable it before human tool-approval controls, grant renewal, durable runtime events/files and real sandbox/SDK acceptance exist. `AlwaysConfirm` intentionally prevents unattended tool execution; no silent auto-approval is implemented. Normal capabilities still report OpenHands unavailable. No Trigger deployment, recovery schedule, cloud allocation or live run occurred during development.
