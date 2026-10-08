# Work runtime lifecycle — controlled delivery

Later continuation: [approved-plan handoff](work-harness-runtime-handoff.md) adds local transactional reservation, once-claimed dispatch and real create → message → run calls. The original slice below remains a payload/Stop foundation; execution is still disabled and no runtime has been deployed.

This continues the approved Work superprompt. The installed OpenHands TypeScript client provides conversation creation, pause, confirmation-policy and confirmation-response endpoints. Its generated union types currently intersect incompatible discriminator literals; use the public request interfaces and validate the wire contract explicitly instead of casting through `any`.

## This implementation slice

1. Route Stop by worker type. Native Trigger workers retain their existing cancellation path. An `openhands:<UUID>` worker must never be sent to Trigger.
2. Atomically cancel the owned TM task, revoke its model grant and save a remote pause request. Save the original connection/conversation/generation, not a browser-supplied target. A missing/mismatched binding is recorded as blocked for administrator recovery, not acknowledged.
3. Deliver pause through the existing bounded, allowlisted server transport. Read current state first to recover a lost acknowledgment without repeating a mutation. Verify the assigned conversation reports a non-running state before acknowledging delivery. Serialize retries with a 60-second database lease and 60-second retry delay. Returned failures and thrown transport exceptions remain redacted and retryable.
4. Permit authenticated owners to stop their own task even after premium expires. Do not relax entitlement checks for reads, creation, approval or steering. A retry must not create a second cancellation event or change the target.
5. Construct a narrow server-only OpenHands launch payload with the TM gateway alias, an explicit Chat Completions profile, zero client retries, bounded iterations, sequential tools and `AlwaysConfirm`. No initial message, automatic title model, MCP, plugins, hooks or arbitrary tool modules. Never use a provider key or the host workspace. This is a payload contract, not a deployed launcher or proof of container isolation.

## Limits and next release gates

This does not expose a sandbox-launch button. Provisioning, transactional approved-plan handoff, lease-backed launch recovery, model-grant renewal, human approval/event synchronization and file transport remain required. Until the approval UI and synchronization are implemented, never submit an upstream confirmation response or enable `NeverConfirm`.

A pause acknowledgment is not proof that a subprocess or browser action has been killed. Isolated-runtime termination and orphan cleanup need their own provisioner contract. The recovery task is defined without a declarative cron: no recurring service is created by this code. An administrator must explicitly attach a schedule after staging verification and set `TM_WORK_RUNTIME_STOP_RECOVERY_ENABLED=true` in the worker. Until then, a saved outbox and in-process attempt are not an autonomous recovery service. No live migration, remote launch, provider call, commit or push is authorized by this development slice.

## Primary contracts inspected

- Installed `@openhands/typescript-client@1.49.6`: public `ConversationClient` pause/run/confirmation endpoints and generated StartConversationRequest/LLM/tool schemas.
- [OpenHands conversation service](https://github.com/OpenHands/software-agent-sdk/blob/main/openhands-agent-server/openhands/agent_server/conversation_service.py): pause waits on the current operation; interrupt is a separate method. This implementation does not claim pause kills subprocesses.
- [OpenHands tool registry](https://github.com/OpenHands/software-agent-sdk/blob/main/openhands-sdk/openhands/sdk/tool/registry.py): fixed tool-module qualification. The launch contract uses definition modules, not browser-provided imports.
- [Trigger scheduled tasks](https://trigger.dev/docs/tasks/scheduled): defining a task without cron does not attach a schedule. No implicit deployment or schedule creation is performed here.

## Local verification

78 focused tests passed; the full suite passed 949 tests across 114 files. TypeScript, scoped ESLint and the production build passed. Tests mock database/remote transport and include wrong-account/target checks, cancellation before delivery, rejected/reassigned bindings, concurrent lease denial, expired membership, failures and lost acknowledgments, native-worker separation, safe gateway/launch configuration, idle/AlwaysConfirm response verification and bounded recovery. The PostgreSQL migration and staging rollback canary were written but not executed; JavaScript mocks are not a substitute for that canary or a real isolated SDK acceptance run. No UI, live database, account permission, remote fork, deployment, commit or push was changed by this slice.
