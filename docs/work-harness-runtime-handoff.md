# TM → OpenHands approved-plan handoff

Latest local continuation · 2026-09-29: A [rollback-only staging canary](../supabase/tests/work_runtime_confirmations_canary.sql) now covers the private confirmation ledger's owner/revision/grant binding, blocked decisions, retries, expiry, grant/connection/entitlement revocation, Stop invalidation and browser-role denial. It is authored but unexecuted: the local Docker engine did not respond and no staging migration was applied. The ledger remains disconnected from UI and OpenHands acceptance. Next: a trusted complete active-branch snapshot and a runtime-side atomic reviewed-action condition; a conversation-wide boolean confirmation cannot satisfy that gate.

Latest continuation · 2026-09-28: [bounded event history and confirmation gate](work-harness-runtime-events.md). Read-only paging now uses encrypted owner/task/generation/revision-bound cursors and rechecks authority after remote reads. Activity reports incomplete history and unavailable tool authorization honestly; task changes abort/clear stale monitor reads. Next implement the durable confirmation review/decision ledger locally, then resolve reviewed-action binding and Stop ordering before remote acceptance. The inspected upstream confirmation request is conversation-wide; historical metadata is not authorization. Latest checks: 1,029 tests / 117 files, TypeScript, scoped lint and production build passed. Execution remains off. No external run, deployment, migration, entitlement grant, schedule, commit or push; HEAD unchanged. Older verification counts below are historical.

Continuation of the approved Work superprompt. Reuse the real Agent Server conversation API, rather than write a second coding-agent loop. Agenta remains TM's connected trace/management service, not a second agent running the same task.

## Design and implementation order

1. Extend plan approval with an explicit `runtime: openhands` choice; existing requests remain native. Require verified premium ownership, reviewed revision, server flags, worker configuration and an administrator-attested dedicated runtime connection. The browser cannot supply a remote URL, API key, workspace path or conversation ID.
2. Reserve a conversation UUID and hand off the task in one database transaction. Increment generation so the original native worker cannot resume it. Store a private launch job and an attested binding; never turn a queue failure into a native fallback.
3. Queue a bounded worker carrying only an opaque launch ID. Claim the launch once; duplicate/retried deliveries must not create or start another conversation. Create idle using the existing TM-model payload, verify `AlwaysConfirm`, send the approved task with `run: false`, and explicitly start through the official `/run` endpoint.
4. Revalidate current entitlement, owner, generation, worker and launch lease before every mutation and after acknowledgment. Stop revokes the model grant and wins over launch. Any uncertain remote outcome cancels TM access and saves a pause request; do not replay create/message/run blindly.
5. Recover abandoned launch leases by cancelling the assigned task, not rerunning a potentially successful mutation. Keep runtime provisioning, tool-approval UI, grant renewal, durable events/files and sandbox termination as separate release gates.

## Constraints

The execution flag stays false, and the normal capability response still reports OpenHands unavailable. The worker uses an already provisioned owner-dedicated Agent Server; it does not install Docker, mount the development machine, expose a socket, or allocate paid cloud resources. Connection execution attestation is administrator-owned and is not automatic isolation verification. No real runtime or provider request is authorized during local tests.

The queue and SDK operations are distributed. Exactly-once execution cannot be claimed from an in-process flag. The durable claim prevents automatic replays, while failures/crashes enter cancellation and stop recovery. Completed/uncertain jobs remain available to administrators; credentials and user content are not copied into the launch ledger or Trigger payload.

## Research contracts

The installed `@openhands/typescript-client@1.49.6` and upstream [conversation router](https://github.com/OpenHands/software-agent-sdk/blob/main/openhands-agent-server/openhands/agent_server/conversation_router.py) / [event router](https://github.com/OpenHands/software-agent-sdk/blob/main/openhands-agent-server/openhands/agent_server/event_router.py) define conversation creation, message submission with `run: false`, and explicit background `/run`. Creation and message/run responses must be validated rather than returning raw upstream objects to the client.

The rough 65–75% remaining estimate concerns the user's full hosted OpenHands + Agenta target. It is a planning estimate, not a measured completion score. Making the core hosted task path functional is the priority; a styled sidebar alone does not count as integrated upstream execution.

## Implementation and verification

Implemented locally: explicit remote approval, administrator execution attestation, transactional launch ledger/binding, generation handoff, once-only Trigger claim, actual create → message → run calls, TM model-profile and policy checks, failure cancellation, and bounded abandonment recovery. Connection/scope revocation removes active model grants. A never-claimed reservation is resolved as `never_dispatched` under the same lock that prevents a claim; a dispatched lease never receives a fabricated pause acknowledgment. Tasks with files fail closed until transfer exists.

Verification: 978 tests across 115 files, TypeScript, scoped lint and production build passed. Tests mock the external runtime/database/provider boundaries; they do not prove real sandbox behavior. The five migrations and staging SQL canaries are unexecuted. No hosted service, paid model, entitlement grant, deployment, schedule, commit or push was performed. The execution flag and public OpenHands capability remain off.

The [brainstorming skill](C:/Users/Shafin/.agents/skills/brainstorming/SKILL.md) scoped this continuation against the already-approved superprompt; the user's no-questions and no-commit instructions took precedence over its approval/commit ceremony. UI styling was not changed in this backend slice.
