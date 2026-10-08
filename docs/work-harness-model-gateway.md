# TM Work runtime model gateway

This backend slice follows the approved Work superprompt. It is local, disabled by default, and does not launch an agent or provision a sandbox. No commits, pushes, live migrations or paid calls are part of its implementation.

## Decision and implementation order

An isolated OpenHands Agent Server needs a tool-capable model endpoint. Using provider credentials directly would bypass TM's identity, premium gate, routes, quotas and traces. Embedding an entire upstream frontend would not solve that boundary. Implement a narrow OpenAI-compatible server-to-server endpoint backed by TM's existing adapters instead.

1. Add service-only execution attestations, revocable runtime grants and serialized request leases to the existing owned runtime binding. Keep execution disabled until an administrator verifies isolation.
2. Sign a short-lived credential for an already approved/running, assigned OpenHands conversation. It names its owner, task, connection, conversation, generation and mind. No browser issuance endpoint or provider key is exposed.
3. Authenticate and revalidate the credential, premium entitlement, owned task, current execution worker, connection and lease before every provider hop and before returning an answer. Cancellation, revocation, expiry, worker takeover or a changed mind/generation must fail closed.
4. Validate bounded text/function-tool transcripts and translate TM NDJSON into OpenAI completion/tool-call responses. Ignore private reasoning. Support JSON and buffered SSE; no partial tool calls escape validation or get replayed during fallback.
5. Preserve existing Air/Girlie/PRO routes and ceilings. Count opened completions including partial/invalid output, record local metadata before optional Agenta export, and leave unknown token/cost values null. Do not retry a successful model because telemetry failed. This uses the existing TM counters; it is not a new atomic quota reservation system across all Chat/Work endpoints.
6. Verify tampering, ownership, lease races, cancellation, malformed/partial tool calls, input bounds, redaction and routing using mocks. Live SDK compatibility and sandbox isolation require an explicitly provisioned staging runtime.

## Scope

The API is `POST /api/work-model/v1/chat/completions`, sharing the existing Vercel function budget. It accepts only the bound aliases `tm-air`, `tm-girlie` and `tm-pro`, text messages and function tools. Unsupported modalities, forced/named tool choices and extra request fields are rejected instead of silently changing their meaning. Usage is omitted when unavailable, not fabricated.

For safe fallback, `stream: true` returns buffered, validated SSE completion chunks, not token-by-token progress. No provider names, internal exceptions, grant material or raw service configuration enter the response. The exact TM root prompt is versioned; upstream system prompts/tool schemas contribute hashes rather than raw private content to the protected configuration record.

A grant is valid for at most 15 minutes and is revocable through its service-only binding. A database lease permits one request per binding. Lease expiry is five minutes; the request's model deadline is two minutes, with late provider openings rejected after cancellation. This is not a full upstream runtime stop mechanism. Agent Server pause/stop, tool approval enforcement, filesystem integration and durable execution-event synchronization remain separate release gates.

## Verification boundaries

The issuer is a trusted server helper for a future provisioner, not a browser-accessible launch function. It requires an administrator-attested execution binding and a task already handed to `openhands:<conversation UUID>`. Native worker tasks cannot use it. Remote execution remains unavailable in the current UI even when this model endpoint is configured.

## Built contracts and setup boundaries

- `api/_lib/work/runtimeGrant.ts` verifies HMAC-SHA256 credentials, revalidates owned execution bindings, issues grants through a compare-and-swap, and claims/releases database leases. Set a strong random `TM_WORK_MODEL_GATEWAY_SECRET` only on trusted servers. It is distinct from every provider or Agent Server key. Rotating it invalidates outstanding credentials.
- `runtimeProtocol.ts` validates text and function-tool transcripts, buffers fragmented tool calls, strips private reasoning markup and rejects unknown/partial tools. Tool schemas are bounded by total bytes, count and nesting depth. Supported choices are `auto` and `none`; strict structured-output tools, vision/audio and forced tool choices are not yet supported.
- `runtimeModel.ts` uses existing TM persona routes and provider ceilings. It rechecks authorization after quota lookup and generation, saves local attempt metadata, then optionally exports safe metadata to Agenta. An audit failure is terminal, not a fallback reason. Gateway call counts inherit the existing TM quota-counter behavior; they are not a new atomic billing ledger.
- `runtimeGateway.ts` accepts only server-to-server Bearer requests. Browser Origin headers are denied; browser-facing connection monitors cannot mint a credential. The endpoint uses the existing PRO-generation function via Vercel rewrite and the matching Vite development mapping.
- `supabase/migrations/work_model_gateway.sql` extends the service-only binding and adds serialized lease RPCs. Both RPCs deny browser execution. `supabase/tests/work_gateway_canary.sql` is an explicit rollback-only staging check for incomplete grants, attestations, forged scope, concurrent leases, wrong-lease release and revocation. Neither SQL file has been applied or executed against a database.

The [OpenHands LLM contract](https://github.com/OpenHands/software-agent-sdk/blob/main/openhands-sdk/openhands/sdk/llm/llm.py) accepts a custom `base_url` and API key. A future isolated-runtime provisioner must choose OpenAI Chat Completions transport with the task's bound alias and the gateway's `/api/work-model/v1` base. LiteLLM's provider prefix belongs in the SDK profile (`openai/tm-air`, for example); the gateway request itself uses `tm-air`. Set compatible context/output bounds and disable automatic client retries for an initial acceptance run. The live installed SDK's exact options and transmitted request fields must be validated before enabling it; this narrow endpoint is not a claim of universal OpenAI/SDK compatibility.

Do not manually enable a production task to bypass plan approval. This gateway slice alone did not build handoff, isolated conversation creation, renewal of 15-minute credentials, human tool approvals or event/file synchronization. Subsequent [lifecycle](work-harness-runtime-lifecycle.md) and [approved-plan handoff](work-harness-runtime-handoff.md) continuations add local Stop propagation/outbox code and a once-claimed real Agent Server launcher. Neither has been deployed or exercised with a real runtime. Provisioning, renewal, human confirmations and event/file synchronization remain required. SQL model-request leases are not durable request idempotency across disconnect/retry. Keep execution disabled until the full lifecycle is accepted.

Verification performed locally: 64 focused gateway tests, 883 tests across the full 111-file suite, TypeScript and scoped ESLint passed. The localhost disabled-endpoint probe returned HTTP 503 with `WORK_GATEWAY_DISABLED`; the root page returned HTTP 200 and guest capabilities continued to deny cloud/upstream execution. No real provider call, grant issuance for a live task, runtime launch, migration, staging SQL canary, commit or push was performed.
