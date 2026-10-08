# OpenHands event history and confirmation gate

Local continuation, 2026-09-28. This implements bounded, reconnectable metadata history. It does not authorize tools, mirror durable events into TM or enable hosted execution.

## Researched contracts

Inspected installed `@openhands/typescript-client@1.49.6` declarations and the pinned Canvas confirmation UI. Event search supports `page_id`, `limit` and `TIMESTAMP_DESC`. The confirmation request contains `accept` and optional `reason`, without an action ID, expected pending set, revision or idempotency key.

Current official sources checked on 2026-09-28: [event router](https://github.com/OpenHands/software-agent-sdk/blob/main/openhands-agent-server/openhands/agent_server/event_router.py), [models](https://github.com/OpenHands/software-agent-sdk/blob/main/openhands-agent-server/openhands/agent_server/models.py) and [event service](https://github.com/OpenHands/software-agent-sdk/blob/main/openhands-agent-server/openhands/agent_server/event_service.py). Acceptance calls `run()`; rejection rejects all pending actions. Current main-branch research is not proof of a deployed server version.

Inference: reading events then accepting the conversation does not itself guarantee that the reviewed action is the action authorized. Resolve stale review, duplicate/lost delivery and Stop racing acceptance before exposing working approve/reject controls. No invented endpoint, pretend approval control, remote mutation or upstream patch was added.

## Local implementation

Each read resolves the authenticated owner's task and server-assigned binding/connection. Pages contain at most 30 events in descending timestamp order. Only ID, kind and timezone-qualified timestamp survive; action, argument, prompt, observation, error and reasoning bodies are discarded. Malformed/oversized metadata, conflicting duplicates, non-progressing cursors and misordered timestamps fail closed. Identical metadata duplicates collapse.

AES-256-GCM encrypted cursors bind owner, task, generation, revision, connection and conversation. They expire after ten minutes without renewal and permit twenty older pages. Upstream pagination tokens stay private. Without the optional server secret, latest-page monitoring works and truncation is explicit. Key rotation invalidates cursors. Repeated reads are safe, not mutation idempotency.

After network I/O, entitlement, task status/revision/generation/worker, connection identity/configuration and binding are rechecked. Changed authority discards the response; this is not an atomic snapshot across TM and Agent Server. Existing manual abortable checks remain. Earlier events replace the bounded page; Check connection returns to latest events. Task version changes remount only monitors and abort/clear stale reads without resetting directions or file editors. Waiting confirmation explains unavailable tool authorization and points to existing Stop. Historical metadata never supplies pending-action authority.

Changed files: backend `runtimeEvents.ts` and tests, `integrations.ts` and tests, `handler.ts` and API tests; shared/client `workIntegrations.ts`, `workService.ts`, `WorkIntegrationPane.tsx`, `WorkTaskPanel.tsx`, connection tests; `.env.example` and implementation/capability/setup/continuation records.

## Verification and next slice

1,029 tests across 117 files, TypeScript, scoped ESLint, production build and `git diff --check` passed. Existing chunk-size/static-dynamic-import warnings remain. Existing preview answered HTTP 200; no second Vite process started. UI evidence is static component tests and existing abort-hook tests, not new interactive browser acceptance. External database/runtime boundaries are mocked. No live OpenHands/Agenta/provider call, migration, deployment, schedule, entitlement grant, commit or push. HEAD stays `6a2b3dec357b863fabc279d9924fe6f34c200027`.

Next implement a service-only durable confirmation review/decision ledger with bounded safe previews and exact pending-action fingerprints; locally test owner/generation/revision binding, replay/lost response and Stop arbitration. Before remote acceptance, establish a compatible runtime-side atomic condition or independently verified exclusive-writer protocol binding the reviewed pending set and ordering Stop against acceptance. A TM database lease alone does not make that remote mutation atomic. Keep AlwaysConfirm, capabilities and execution flags unchanged until this and authenticated isolated staging acceptance pass.

Remaining gates: remote steering/resume, grant renewal, durable event/artifact transfer, isolation provisioning, subprocess/sandbox termination and recovery scheduling. The five existing SQL migrations/canaries remain unapplied/unexecuted. This slice adds no migration.
