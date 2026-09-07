# TM-01 shared contracts

Implemented 2026-09-06. TM-00 was checked against its baseline, evidence files and explicit live-access fallback before implementation. Its outstanding service checks do not block this contract-only task. No cloud schema or provider behavior changed.

The contracts live in `shared/agent` and `shared/apps/contracts.ts`. Browser and server entry points (`src/services/agent/contracts.ts` and `api/_lib/agent/contracts.ts`) re-export the same runtime validator. `src/types/chat.ts` exposes additive compatibility types. The TypeScript project now includes `shared` explicitly.

## Version and validation rules

All run envelopes, app/package/skill manifests and agent event envelopes use `schemaVersion: 1`. The event parser accepts one complete JSON frame. Unknown versions throw `ContractFrameError` with code `unsupported_version`; missing versions and invalid shapes produce `invalid_event`. Malformed JSON produces `malformed_frame`, and oversized UTF-8 frames produce `payload_too_large`. Error messages do not echo payloads.

There is no implicit upgrade, field stripping, or downgrade to the legacy protocol. A future version needs an explicit adapter and fixtures. The existing mixed text/control stream remains unchanged until TM-08. The current schemas are available through compatibility entry points; they are not yet wired into live requests. Incremental UTF-8 decoding belongs to TM-08; sequence allocation, deduplication, state transitions and terminal-event enforcement belong to TM-09. A schema alone cannot prove ordering across events.

Frames and generic JSON values are limited to 65,536 UTF-8 bytes. JSON preflight also limits depth to 20 and nodes to 10,000, rejecting cycles, getters, exotic objects, sparse arrays, hidden/symbol keys, nonfinite numbers and prototype-manipulation keys. Other fields have explicit string/array limits. Repository adapters must bound total responses and selected message windows before transport; pagination limits are maxima, not a promise that 100 maximum-length messages fit one frame.

Tool and resource schema definitions use a strict JSON Schema subset: object, array, string, number, integer, boolean and null; descriptions, enums and bounds; nested properties/items; declared required keys; and closed objects. External `$ref` and arbitrary extension keywords are rejected. This validates definitions, not arbitrary tool arguments against a selected definition. The catalog/executor must compile the approved schema and validate invocation arguments in its later task.

## Identity, permissions and results

`ToolCall` carries invocation/tool IDs, an exact version and bounded JSON arguments. `TrustedExecutionContext` is a separate opaque, non-serializable interface containing actor/session, run, workspace, grants, policy, cancellation and budget operations. There is intentionally no exported context factory. TM-04 must construct it only after authentication and server policy checks. The compile-time fixture rejects assigning a parsed model call to that interface. Type branding is not runtime authentication and cannot protect against an explicit TypeScript cast.

A model may put a string called `userId` inside arguments; it remains untrusted data. No actor, grant, credential or entitlement is derived from it. The strict call envelope rejects additional authority fields. Permission manifests declare requested scopes; they do not authorize execution. Package visibility and test-report claims likewise do not constitute approval.

Pending results carry kind, invocation/run/actor/workspace, tool version, argument digest, grant version, nonce and expiry. The event parser checks run and call correlation. TM-04/TM-10 must verify current ownership, digest, expiry, replay state and grant validity at execution/resume. `pending` cannot appear as `tool.completed`; `unknown_outcome` requires a reconciliation ID. Success, error, pending, denied and unknown outcome have separate payload shapes.

Artifacts expose stable object/workspace IDs, storage, revision, title and named actions. App descriptors select shipped deep-link resolver IDs; they cannot supply arbitrary privileged URLs. TM-13 must resolve those IDs through an allowlist and recheck access. References do not prove a write committed: executors must issue artifacts only from actual receipts.

## Argument digests

`canonicalArguments` defines TM canonical JSON v1: recursively sort object keys by JavaScript UTF-16 order, preserve array order, and use JSON number/string encoding. It normalizes negative zero to zero and does not normalize Unicode. `hashArguments` computes SHA-256 through Web Crypto over its UTF-8 bytes, returning `sha256:<64 lowercase hex digits>`.

This is a documented TM format, not an RFC 8785 claim. Persist the tool version and operation identity beside the digest. Do not switch the canonicalization rules without a versioned migration. Fixtures cover a known SHA-256 vector, nested key reordering, multilingual text, array-order differences and invalid JSON values.

## Repository and executor boundaries

`ChatRepository` gives local and cloud adapters the same list/search/read inputs and output shapes. Lists are metadata-only; searches return bounded excerpts and actual message IDs; reads return ordered messages and a boundary cursor. IDs are stable opaque strings (1–128 characters) rather than mandatory UUIDs so legacy IDs can migrate. Object revisions are nonnegative safe integers; immutable executable versions are exact numeric `major.minor.patch`, never `latest`.

Date ranges are inclusive from/exclusive to and must be ordered. Adapters use stable `(timestamp,id)` ordering and resolve cursors in the current workspace. Neither input accepts a user ID. Every adapter must enforce ownership, exclusions, deletion and grants; the cloud adapter must additionally check paid entitlement and opt-in. These are interfaces for TM-05/TM-07/TM-15, not implemented storage adapters.

`ToolExecutor`, `ModelAdapter` and `RunRepository` define execution, reconciliation, normalized provider events and compare-and-swap persistence. TM-01 introduces no broker, repository, provider adapter, storage migration or new agent loop. Notes block extraction remains TM-06 so its full existing format is preserved during the actual repository migration.

## Verification

Checks used Node 22.19.0 and the existing locked installation. Tests/build loaded the supplied environment through Vite; no secrets were printed or added to evidence. No login, provider generation, database mutation, deployment, purchase, commit or push was performed.

| Check | Before | After |
| --- | --- | --- |
| `npm run typecheck` | Pass | Pass |
| `npm test` | 24 tests / 3 files | 61 tests / 4 files |
| `npm run lint` | 136 errors, 5 warnings | Same 136 errors, 5 warnings |
| `npm run build` | Pass | Pass; existing CSS import-order and large-chunk warnings |

The 37 new deterministic cases exercise the real Zod validators and Web Crypto implementation in Node. Fixtures are synthetic; no mocked service or real-provider integration is claimed. They cover client/server validator identity, malformed and oversized frames, unknown versions, strict fields, pending/call correlation, result states, canonical hashes, invalid JSON, trusted-context separation, history bounds, schema definitions, app resolver restrictions and package validation. Existing production-check 2.4 remains open: this does not complete its CI/auth/stream/rate-limit integration coverage.

Browser smoke check: Codex in-app browser at local Vite `http://127.0.0.1:5173`, default 696×851 viewport. Chat rendered the Air heading, quota, composer and Notes/Healthcare actions with the existing purple appearance. Clicking Notes opened `/notes`; reloading retained the TM-00 synthetic note title and body. Both screens were visually inspected. No user-visible implementation changes required a new mobile/theme matrix. The local server initially hit sandbox `EPERM`; an approved local bind succeeded. No backend interception was used. This observation proves shell/navigation compatibility, not live model, auth or database integration.

Command logs are in [evidence/tm-01](evidence/tm-01/). All TM-01 acceptance criteria are verified within this contract-only boundary. Existing live-service prerequisites and application debt remain assigned to later tasks. Next sequential task: TM-02; TM-04 and TM-08 are also dependency-eligible but were not started.
