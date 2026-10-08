# Work upstream adapter: first verified slice

All changes remain local. No hosted service, database migration, entitlement grant, commit or push was performed. This is monitoring and optional telemetry integration, not full OpenHands/Agenta parity.

## Source contracts

- OpenHands local source: `D:/TM-Odysseus/upstream-work/OpenHands`, shallow revision `47a1080`. UI/Agent Canvas is distinct from the SDK/Agent Server execution layer. The pinned official TypeScript client is `@openhands/typescript-client@1.49.6`; the upstream package marks it alpha. TM subclasses its client base with a bounded server transport, not the default unrestricted transport. Its verified conversation, runtime and event search paths are used without a browser-visible session key.
- Agenta local source: `D:/TM-Odysseus/upstream-work/agenta`, shallow revision `257d415`. A minimal sparse checkout succeeded after the initial larger transfer failed. The checked-out tracing DTOs, routers and auth middleware define `POST /simple/traces/`, `POST /simple/traces/query`, and `Authorization: ApiKey …`. This is not a complete installed Agenta app.
- Neither checkout is a GitHub organization fork. The authenticated account's organization fork requests returned 403. Upstream repositories and licenses are preserved.

## Implemented

`GET /api/work?taskId=<uuid>&integration=openhands|agenta` requires verified TM authentication, a server-owned premium entitlement and an owned task before connection lookup. Unknown services or malformed task IDs are rejected. Caller-supplied URLs, credentials, projects and conversation IDs are not used.

`GET /api/work?connections=1` requires the same premium authentication and returns only account configuration booleans and safe status messages. It is not a remote health check. The sidebar's Connections page uses this route; Activity → Upstream connections uses the task-specific route above. Both checks are explicit, read-only, and abort on unmount. Their results cannot enable execution or reveal service keys, backend URLs or project IDs.

OpenHands monitoring uses a service-only binding from the owned task to an assigned conversation. The response contains execution/runtime status and at most 30 event metadata entries. Agent configuration, LLM API keys, raw actions, workspace paths, runtime errors and private reasoning are never returned. There are no run/resume/confirmation/terminal/file-write endpoints in this adapter. A connected monitor still reports `executionEnabled: false`.

Agenta reads at most 20 traces tagged with the owned TM task and `tm_source=work_model_call`. Every returned trace must match these tags. Only the exported model-call metadata fields are returned; arbitrary input/output, system prompts and source files are not forwarded.

The trace wire payload uses `data.internals.tm`, one of Agenta's canonical data containers. Its normalizer moves unknown top-level fields such as `data.tm` into `unsupported`, outside the SimpleTrace query projection. Fixtures follow that normalized shape; the `internals` name here means call metadata, never private model reasoning.

With both upstream and export flags enabled, each native model attempt first saves its authoritative local trace, then attempts one metadata-only Agenta export. The exact TM prompt version is included; its immutable prompt snapshot stays in TM's existing configuration table. Unknown token counts/costs remain null, not zero. Telemetry failures produce a redacted warning and never cause a successful model attempt to retry. This first export is best-effort, without durable retry or delivery guarantees.

TM Air/Girlie/PRO routing, fallback quotas and worker-generation authority remain unchanged. Global capability flags for full upstream execution/administration remain false. No service is simulated or connected merely because its npm client is installed.

## Administrator setup (not performed)

1. Review `work_harness.sql`, then `work_upstream_connections.sql`, and apply only to an explicitly approved staging database first. The new tables are service-role only, with no browser read or write grants. Run `supabase/tests/work_upstream_canary.sql` explicitly in staging to exercise both composite ownership keys, disabled/unverified connection checks and browser privilege denial in a rolled-back transaction. This SQL canary has not been run against a migrated database.
2. Provision a dedicated OpenHands Agent Server per owner with verified tenant isolation, or a dedicated Agenta project and project-bound API key. Keep server/project ownership independent of client input. Never expose a Docker socket or host workspace.
3. Create disabled connection rows using a canonical trusted `base_url` and a unique `credential_ref`. For Agenta, `scope_id` is its project UUID. Store the actual secret only in `TM_WORK_UPSTREAM_SECRET_<credential_ref>` on the server/worker. Keys must never use the `VITE_` prefix.
4. Attest to the verified connection scope with `scope_verified_at`, then enable the row. Agenta's API-key-bound project is the actual authority: a `project_id` query parameter does **not** override a mismatched API key. The timestamp is an administrator attestation, not automatic remote identity verification. Database uniqueness checks guard accidental reuse but are not proof of sandbox isolation or key identity.
5. Add exact origins to `TM_WORK_UPSTREAM_ORIGINS`, including ports when relevant. HTTPS is required. Loopback HTTP additionally requires `TM_WORK_ALLOW_LOOPBACK=true`, a non-production process and no Vercel environment. A deployment's Agenta `/api` prefix belongs in `base_url` and is preserved.
6. Enable `TM_WORK_UPSTREAM_ENABLED=true` only after scope checks. Opt into `TM_WORK_AGENTA_EXPORT=true` separately. Bind an existing isolated OpenHands conversation to an owned task in `work_runtime_bindings`; the composite foreign keys reject cross-owner task/connection assignments.

Requests reject redirects, have a 10-second timeout, and limit JSON responses to 512 KiB. No upstream raw error body, URL or credential is returned to the browser or printed in error logs.

## Remaining work

The UI now exposes account configuration under Connections and assigned remote monitoring under Activity. Hosted end-to-end tests still need provisioned services and staging schema. Source contract/mocked transport tests cannot establish runtime isolation or live protocol compatibility. See the [capability inventory](work-harness-parity.md) for the full gap list.

OpenHands sandbox provisioning, a scoped TM tool-capable model gateway, execution approvals, streamed action results, remote file/terminal/browser tools and cleanup remain incomplete. Agenta configuration administration, datasets, experiments/evaluations, schedules, team features and full trace management remain incomplete. Local Work remains the existing PRO browser workspace, not a host agent.

## Verification record · 2026-09-27

The final local run passed 806 tests across 105 files, TypeScript checks, scoped ESLint and the production frontend build. The 53 focused adapter/API/model tests exercise owner-before-upstream ordering, credential-reference validation, allowed origins, loopback restrictions, no-redirect transport, byte/time bounds, redaction, conversation identity, normalized trace payloads, telemetry failure handling and unchanged TM routing.

The actual local page returned HTTP 200 at `127.0.0.1:5174`. Its guest capability response reported both integrations and cloud execution disabled, and an unauthenticated integration read returned HTTP 401. No live Agenta exports, provider completions, remote OpenHands conversations or migrated-database tests were run. Existing build warnings about chunk size and overlapping static/dynamic imports remain. The current commit remained `6a2b3de`; nothing was committed or pushed.
