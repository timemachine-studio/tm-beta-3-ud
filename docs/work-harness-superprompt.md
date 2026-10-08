# TimeMachine Chat / Work harness — adapted superprompt

Status: native TM design approved. Cloud is the default; local work is an explicit option. The user has authorized independent research and implementation without further questions. No subscription checkout is in scope now.

## Binding cloud-first scope

Users access hosted Work through TimeMachine in their browser without installing a runtime. Cloud files, agent state, configuration versions, traces and background jobs live on TM-controlled infrastructure. Offer local work separately, explain its device-online and filesystem constraints, and never silently fall back from cloud to local. Local is optional, not a prerequisite for the web product.

Integrate the actual OpenHands and Agenta services behind TM adapters rather than approximating their platforms with the existing local Max Mode. TM owns identity, premium entitlement, model routes, permissions and the user-facing design. Never expose a public backend URL or service credential to grant access.

Full feature parity is a staged program: inventory the supported features of pinned upstream versions, map overlapping capabilities to one TM control, and mark each feature as implemented, configured, unavailable or upstream-roadmap. Do not promise every upstream feature merely because its name appears in a README. Preserve applicable licenses and distinguish open-source capabilities from commercial-only features.

Capability groups to verify and integrate:

- OpenHands: agent conversations, remote workspaces, files/editor, isolated command execution, live previews, browser tools where supported, tool/activity events, stop/resume, GitHub workflows, approval/security controls, backend/agent adapters and automations.
- Agenta: agent configurations and version history, shared workspaces, interactive and background agents, schedules/event triggers, tool permissions and approvals, MCP/integration connections, team roles, traces, usage and cost. Verify any evaluation, dataset or experiment capability against the pinned version before including it.
- TM: Chat/Work switch, shared session history, Air/Girlie/PRO routing, themes, premium access checks and account-level control.

Premium-only Work access is enforced on every backend operation. Billing, checkout and subscription management remain deferred. Existing client-visible is_pro alone is not trusted: verify server-owned entitlement and prevent users from editing that field.

## Role and objective

You are the full-stack engineer extending the existing TimeMachine application. Build a native Chat / Work interface switch in the main chat, using the attached reference for placement and simplicity, while retaining TimeMachine's own identity, models, security rules and conversation history.

Chat is conversational assistance. Work is goal-directed execution with visible progress, artifacts and user control: research, writing, planning, file work and coding. Work is not just a second model name or a new empty IDE.

## Repository decisions

1. Keep React, Vite, TypeScript, React Router and the existing Vercel API structure. Do not introduce Next.js solely for this feature.
2. Keep Supabase/PostgreSQL, existing authentication, chat_sessions and chat_messages. Do not add a parallel Prisma identity or conversation database.
3. Treat interfaceMode ('chat' | 'work'), persona ('default' | 'girlie' | 'pro'), execution policy ('plan' | 'edit' | 'auto'), and hosted runtime/backend selection as separate concepts.
4. Route all model requests through TM's server-side routing, including api/_lib/personaRoutes.ts, existing provider adapters, fallbacks, rate limits and authentication. Never hardcode the example GPT/Claude models from the original prompt or expose provider keys.
5. Preserve Air, Girlie and PRO selection. Prefer PRO for capable Work execution, but show any proposed persona change and let the user choose it. A mode toggle alone does not silently change the model or start work.
6. Extend shared/agent contracts and events instead of inventing an incompatible event protocol. Adapt external OpenHands events at a bounded server-side boundary.
7. Cloud Work never invokes Max Mode's IndexedDB workspace or WebContainer runtime. Local work may explicitly open the existing PRO browser workspace, clearly labelled as a browser workspace rather than unrestricted access to the user's computer. Keep existing /max behavior intact.
8. Integrate the actual hosted OpenHands SDK/Agent Server. Use authenticated TM adapters for execution, events and workspace access, with a model gateway that preserves TM's routing.
9. Integrate the actual hosted Agenta service for its supported platform capabilities. Use a unified orchestrator to avoid running two agents independently for the same user task.

## Interface

Place an accessible segmented Chat / Work switch near the top center of the main chat. Preserve the model menu, seasonal colors, bright persona accents, Legacy default, Current interface option and Cadelle thinking default.

Chat keeps the current conversation layout. Work keeps steering messages and the composer on the left, with a resizable workspace on the right. Workspace tabs cover Files, Preview, Terminal and Activity. A run summary shows status, selected model, pending approval, outputs and usage when available.

For non-coding tasks, emphasize plan, activity and artifacts; do not force an empty terminal into the primary view. On mobile, switch between Conversation and Workspace rather than compressing desktop panels.

Switching harnesses retains the session ID, messages, draft, attachments and workspace. It never sends a prompt. An active run remains identifiable in either view, with Stop and approval controls accessible. When saving fails, do not navigate away and discard unsaved work.

Model switch, mode switch and permission switch are visibly distinct. Explain authentication requirements without losing the draft. Keep guest chat and existing limits working.

## Proposed persistence schema

Retain auth.users, chat_sessions and chat_messages. Extend rather than replace.

- chat_sessions: add interface_mode with a chat default, retaining existing ownership and history.
- workspaces: id, user_id, session_id, runtime, backend_reference, working_directory, status, created_at, updated_at. Files are persisted remotely with authorized object storage/sandbox volumes; a metadata row is not a filesystem backup.
- agent_runs: id, user_id, session_id, workspace_id, assistant_message_id, persona, execution_policy, runtime, status, config_version_id, created_at, updated_at, ended_at. Allow one active run per workspace and preserve stopped/failed runs.
- agent_events: run_id, sequence, event_type, bounded redacted payload, timestamp. Enforce unique (run_id, sequence), append-only ownership checks, deterministic replay and gap detection.
- agent_tool_calls: id, run_id, invocation_id, tool_id, status, approval_reference, started_at, completed_at, artifact_references. Enforce invocation idempotency; avoid duplicating full tool output already held by events/artifacts.
- agent_config_versions: id, immutable version/hash, system prompt version, tool-policy version, route-policy version, created_at. Keep canonical application-authored prompt snapshots restricted server-side, not public or duplicated per run.
- agent_model_calls: id, run_id, attempt, provider, model, route/fallback outcome, latency, token counts, estimated_cost, currency and pricing_version. Unknown usage or prices remain null, not fabricated zero.

Use additive Supabase migrations, foreign keys compatible with the existing tables, bounded enums/checks, ownership indexes and RLS. Validate child ownership against the session/run, not merely a client-submitted user_id. Clients must not forge usage, approval results or backend credentials. Keep guest Chat working, but require authenticated premium membership for Work. Include deletion and retention handling for all new tables. Extend the schema for team roles, automation schedules, integration credentials and agent configurations as those feature groups are implemented.

Do not store API keys, access tokens, raw user prompts, file contents or unrestricted tool arguments in operational telemetry. Prompt-version telemetry identifies the immutable application configuration; conversation content remains in its existing protected storage.

## Execution architecture

Use a runtime interface with create/resume, read/list/write files, execute, stream events, stop and dispose. Cloud execution is server-hosted; browser-local execution remains a separate explicit option. OpenHands supplies a separately hosted, authenticated Agent Server backend through an adapter compatible with TM's model gateway; Agenta adds its supported platform capabilities through a second adapter. These are target integrations, not claims that the native first-release worker implements either upstream service.

An OpenHands service is not a Vercel serverless function. Require isolated per-user/per-workspace sandboxes with resource/time limits, allowed network egress, ownership authorization, reconnect cursors, cancellation and cleanup. Never give agents the host filesystem, Docker socket, privileged Docker-in-Docker or application secrets. Docker alone is not proof of adequate public multi-tenant isolation; confirm the hosting/isolation design before deployment.

Treat read/write/execute events as tool execution facts, not permission grants. Plan cannot write or execute; Edit cannot execute; Auto still requires approval for destructive operations, external publication and other protected actions. Enforce permissions at execution time, not just in the UI or system prompt.

Continue using TM's working streaming path. Persist sequence-numbered work events and allow replay/reconnection. Add WebSockets only where the selected backend or terminal requires them; do not add a second conversational stream without need.

ACP is an optional external-agent adapter, not a label for TM's internal event schema. Verify the actual supported OpenHands API/client version before integrating.

## Telemetry and reliability

Record prompt/config versions, provider/model attempts, reliable token usage, latency, tool transitions and explicit estimated cost. Count fallback attempts separately. Version pricing and distinguish provider-reported tokens from estimates. Expose a clear unavailable state for missing usage.

Support resume after reconnect, stop during tool execution, expired workspaces, failed tools, denied approvals, rate limits and partial artifacts. Treat model output, repository files and tool responses as untrusted. Do not expose hidden chain-of-thought; show user-facing plans and execution facts.

## Delivery gates

Before infrastructure deployment, confirm the persistent backend hosting target and tenant-isolated sandbox service. TM's existing Vercel web deployment remains the frontend/API entry point; it does not replace persistent agent services or background workers.

Stage 1: propose and implement additive schema/contracts with RLS and migration tests; do not apply migrations to a live database without separate approval. Continue independently through safe implementation and verification as authorized.

Stage 2: implement the Chat / Work shell using TM's current design and remote workspace adapters. Verify desktop/mobile, keyboard behavior, theme variants, draft retention and switch-without-send. Keep disconnected services honest; do not fall back to a user's local runtime. All Work surfaces and the mode switch use the normal site's liquid-glass material, seasonal tint, blur and soft highlights, not opaque black cards.

Stage 3: integrate real runtime execution and the OpenHands adapter. Require an approved sandbox hosting/security configuration before deployment. Unsupported runtimes display an honest unavailable state.

Stage 4: integrate Agenta's supported platform features with TM model routing, followed by teams, integrations and background automation in separately tested stages. Verify cancellation, usage, redaction, role isolation and execution permissions. Do not fabricate feature parity or treat external infrastructure setup as completed by frontend work.

Each stage reports what actually works, what was tested, and what remains unconfigured. No fake terminals, fabricated AI runs or decorative execution traces. Do not commit, push, deploy, install a hosted service or publish user artifacts unless asked.

## Research and incumbent evidence

- OpenHands Agent Canvas: https://github.com/OpenHands/OpenHands — frontend/control center; backend ownership is separate.
- OpenHands Software Agent SDK: https://github.com/OpenHands/software-agent-sdk — agents, workspaces, conversations, tools and Agent Server.
- OpenHands TypeScript client: https://github.com/OpenHands/typescript-client — browser API client.
- Agenta: https://github.com/agenta-ai/agenta — configuration versions, traces, permissions, usage and cost.
- TM: src/App.tsx, api/_lib/personaRoutes.ts, shared/maxMode.ts, shared/agent/events.ts, src/services/agent/runLedger.ts, src/types/database.ts and src/components/maxmode/WorkspacePanel.tsx.

Sources inspected 2026-09-27. Recheck dependency/API versions at the integration stage.
