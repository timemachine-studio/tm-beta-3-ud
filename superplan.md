# TimeMachine: the everything AI implementation plan

Status: TM-00 local/source baseline and TM-01 shared contracts complete (2026-09-06); runtime/storage rollout has not started. Live schema/service checks remain environment prerequisites. Product decisions include the owner's follow-up on free and paid history storage.

Prepared: 2026-09-06. Audience: Codex agents implementing this repository, and the TM team reviewing releases.

## 1. Product contract

TimeMachine should complete ordinary people's tasks from the main chat UI. Air and PRO can discover capabilities, read the information needed, act across TM apps and connected services, inspect the result, and continue until the requested outcome is complete or a real limit requires user input.

The owner confirmed these requirements:

1. Both Air and PRO have an agent loop. Here, “every model” means these two TM products, not arbitrary user-supplied models.
2. Main chat can use TM Notes, TM Healthcare, and future TM apps. Users should not have to open a specialist mode before those capabilities are reachable.
3. TM can list past chats with titles, find relevant conversations, and read their actual contents. Saved memory alone does not satisfy this requirement.
4. TM can create and edit real app objects from chat. A saved note appears inline with an “Open in Notes” action that opens that exact note.
5. Execution starts with the web app, connected services, and isolated cloud execution. Control of the user's own computer is outside the initial scope.
6. TM can assemble workflows, instantiate API integrations from templates, and write and execute custom code when existing tools do not cover a task.
7. TM acts within permissions the user has already granted. It should not ask for the same permission on each tool call.
8. TM has a built-in catalog. A generated tool is usable privately after validation; a reusable submission is uploaded to TM for review. Only TM-approved versions appear in the public marketplace.
9. Preserve the current UI, design, and brand language. Add capabilities to existing surfaces rather than redesigning the product.
10. Put as much useful functionality in Air as costs allow. Initially restrict the heaviest work to PRO, with server-side configuration that the team can change later.
11. Free users keep personal chat history on-device only. Paid users also use device storage by default and may explicitly enable cloud sync. Paid tier support is part of the roadmap. Air/PRO persona selection and subscription entitlement are separate concepts.

### First end-to-end acceptance story

User, in Air or PRO: “Remember we talked about Steve Jobs and Elon Musk last month? Write me an assignment about them for my school.”

Expected sequence:

1. Interpret “last month” in the user's time zone, relative to the request date. Search message dates as well as session metadata: an old session may contain last month's discussion.
2. Search/list a bounded set of past chat titles and dates. Search content when titles alone do not identify the conversation.
3. Read relevant message ranges, expand neighboring ranges when necessary, and retain references to the actual source messages.
4. Use a writing skill if helpful. Treat past statements as records of a conversation; they are not automatically verified facts about Jobs or Musk.
5. Draft an age-appropriate assignment. If grade or length is missing, use a stated reasonable default unless it would materially change the result. Search the web if factual verification is needed and authorized.
6. Create one note, persist its blocks, and receive a confirmed object ID and version.
7. Show a readable note preview in the main chat with title, saved status, source-chat links, and “Open in Notes.” Do not navigate the user away automatically.
8. “Make the introduction shorter” edits the same note. Refreshing the page preserves the result. A retry does not create a second note.
9. When history cannot be found or accessed, say so precisely. Offer to continue from available information without pretending to remember a discussion.

This story is the first release milestone. Do not postpone it until the marketplace or general code runner exists.

## 2. Decisions and planning defaults

| ID | Decision | Status and implementation consequence |
| --- | --- | --- |
| D1 | Where personal chat history lives | Owner confirmed: device-only for free users; optional cloud sync for paid users. Default off for everyone. A verified paid entitlement plus explicit sync opt-in is required for cloud history reads/writes. Existing automatic signed-in cloud persistence must be replaced. |
| D2 | Notes storage | Planning default: preserve local ownership, move existing local Notes into a shared IndexedDB repository, and expose it through a trusted app bridge. A cloud Notes store is not required for the first milestone. |
| D3 | Background work | Planning default: long cloud tasks may continue after the tab closes, within the requested task and granted budget. They must pause when they need unavailable device data or a device write. Recurring autonomous schedules are a later extension, not part of the first release. |
| D4 | Tool submissions | Automatically upload a sanitized, reusable package for internal review. Never upload source conversations, notes, files, credentials, or real customer test data as marketplace material. A failed sanitization blocks submission, not otherwise safe private use. |
| D5 | Private skills and tools | Save validated reusable versions privately for the creator. Loading a saved capability later still checks current permissions, entitlements, and revocations. |
| D6 | Marketplace ownership | TM reviewers decide publication. Versions are immutable. Every changed version needs review; publication of one version does not approve all future changes. No creator payouts, billing marketplace, or public ratings in the initial release. |
| D7 | Heavy infrastructure | Select a managed isolated execution service through a provider adapter after a small proof of concept. Do not use the Vercel process or a Trigger task process as the sandbox for untrusted code. No vendor purchase is authorized by this document. |
| D8 | Existing personas | Air maps to `default`, PRO to `pro`. Preserve `girlie` behavior during migration; it uses the shared infrastructure without becoming a separate launch requirement. |
| D9 | First external connectors | Planning default: Google Drive for files, then Google Calendar; add Gmail after external mutation handling is proven. Provider credentials and test accounts are implementation prerequisites, not presumed available. |
| D10 | Permission experience | Persist grants scoped to capability, account/resource, effect, optional destination, duration, and cost. Ask only when the requested operation falls outside those grants. A grant does not make an unrelated action part of the user's task. |

These defaults make the plan executable without another broad product interview. D1 supersedes the older blanket prohibition on cloud history in `CLAUDE.md` and Gate LS of `production-check.md`, only for explicitly opted-in paid users. The remaining device-storage protections still apply. Record changed decisions here before implementing dependent work.

## 3. What exists in this checkout

Evidence comes from source inspection, not a live deployment audit. Paths are relative to the repository root. Recheck symbols before editing; line numbers will move.

| Area | Current evidence | Consequence |
| --- | --- | --- |
| Stack | `package.json`, `vercel.json`, `trigger.config.ts`: React 18, TypeScript, Vite, Tailwind, Supabase, Vercel API routes, Trigger.dev | Extend the current stack. No framework rewrite. |
| Shared loop | `api/_lib/agentLoop.ts`: `runAgentLoop`, default five iterations, sequential execution, last iteration hides tools | There is a reusable starting point, but no complete run lifecycle, dynamic discovery, or reliable checkpoint model. |
| Loop framing | `runAgentLoop` splits individual received chunks by newline and ignores parse errors | Partial JSON frames can be lost across transport boundaries. Fix before adding more control events. |
| Providers | `api/ai-proxy.ts`: provider dispatch, persona selection, prompts, quota, duplicated streaming/non-streaming branches | Extract a common model interface without losing persona routing or fallback behavior. |
| Tools | `api/_lib/tools.ts`: fixed tool map, web/image intent gates, optional `list_skills`/`read_skill`, string results | Replace the fixed surface incrementally with typed catalog and execution contracts. |
| Execution identity | `ToolExecutionContext` currently carries persona, image inputs, and policy | Add trusted actor, run, grant, cancellation, and budget context before private-data tools. Never let the model supply identity. |
| Skills | `api/skills.ts` holds embedded skill text; special-mode prompts also contain frontend instructions | Consolidate into versioned skill packages; keep old tool aliases temporarily. |
| MCP | `api/_lib/mcpClient.ts` contains discovery/execution helpers; five enabled servers and 32 discovered tools are hard caps; discovery reads one list page | Build indexed discovery with pagination and on-demand loading, rather than increasing prompt size. |
| MCP wiring | Repository search found `loadEnabledFlightControls`/`discoverMcpTools` invoked by `api/mcp-approval.ts`, but not by the main proxy or Trigger worker | Treat these as partial infrastructure. Prove a main-chat discovery → call → result path; do not call MCP fully integrated merely because the helper exists. |
| Approvals | `api/mcp-approval.ts` claims pending rows and checks an argument hash, then calls a separate one-shot completion helper | Resume the common loop after approvals instead of a separate provider path that cannot continue discovering tools. |
| Background work | `api/pro-generation.ts`, `api/pro-stream.ts`, `api/_lib/proJobs.ts`, `trigger/proGeneration.ts`, `trigger/streams.ts` | Reuse the durable execution integration, but remove persona-specific orchestration assumptions. |
| Persisted cloud content | PRO job rows hold final content; Trigger payloads contain messages and streams contain output | A device-history decision must also cover temporary processing data and provider retention. Renaming history tables does not solve this. |
| Chat history | `src/services/chat/chatService.ts`: signed-in Supabase path, anonymous `localStorage`, `getSupabaseSessions` eagerly loads messages for every session | Add bounded metadata listing and targeted message reads. Do not feed the entire archive to a model. |
| Notes | `src/components/notes/NotesPage.tsx`: types, `loadNotes`, `saveNotes`, component state, `tm-notes` key, `tm-notes-draft` handoff | Extract a repository and shared block schema before agent editing. Existing note types must round-trip without loss. |
| Healthcare | `src/services/healthcare/healthcareService.ts`: `searchDrugs`, `search_drugs` RPC, category search and fallbacks; healthcare prompt/RAG logic in proxy routes | Expose actual lookup capabilities in normal chat. Existing code does not prove a personal medical-record system exists. |
| Chat rendering | `src/hooks/useChat.ts`, `src/services/ai/aiProxyService.ts`, `src/types/chat.ts`, `src/components/chat/*` | Add structured activities and app-object cards, keeping the current chat presentation. `ResponseCards.tsx` is prose pagination, not an app artifact system. |
| Routing | `src/App.tsx`: `/notes`, `/healthcare`, `/chat/:id`, `/history` | Add stable object/message targeting within those routes. Do not assume `/chat/:id` already opens every personal history format correctly. |
| Existing quality work | `production-check.md` marks many Gate 0/1 tasks complete; `CLAUDE.md` still lists older error counts and missing features | Verify current behavior. `npm run build` now includes `tsc --noEmit`; do not copy stale claims into new reports. |
| Database | `src/types/database.ts` explicitly says types were handwritten; migrations cover only part of queried schema | Capture and verify a schema baseline in staging before new cloud tables. Types are not proof of deployed RLS. |
| Repository | `git status` reports this directory is not a Git repository | Do not invent branch/commit state. Changes in this planning task are files only. |

Read `CLAUDE.md` and the relevant `production-check.md` tasks before implementation. This plan extends that work; it does not mark earlier launch gates complete or authorize dropping any tables.

## 4. Target architecture

Use one agent runtime with typed boundaries. Air and PRO choose model and budget policy; they share discovery, authorization, execution, recovery, and app integration.

```text
Main chat / existing TM app UI
  ├─ chat activities, saved-object cards, permission requests
  └─ trusted device bridge → local chat / notes repositories
               ↕ typed events and correlated tool results
Authenticated run API
  → shared run coordinator → provider adapter → model turn
            ↓ tool request                         ↑ result
       catalog/discovery → policy + budget → executor
                                             ├─ built-in TM tool
                                             ├─ device operation
                                             ├─ connected API / MCP
                                             ├─ workflow interpreter
                                             └─ isolated cloud sandbox
            ↓
       run state + invocation ledger + artifact references

Missing capability → template / code builder → tests → private version
                                                   ↓ sanitized package
                                         review queue → TM approval
                                                   ↓
                                            public marketplace
```

### 4.1 Shared runtime

The run coordinator owns conversation state, active tool definitions, loaded skills, step count, budget reservations, waiting operations, cancellation, and final status. A model adapter translates typed model messages/events to a provider's wire format. An executor does actual work and returns structured evidence.

Suggested modules, created only when their task is reached:

| Path | Responsibility |
| --- | --- |
| `shared/agent/` | Run, message, event, result, reference, and schema types usable by client and server |
| `shared/apps/` | Notes block schemas, app descriptors, object-reference contracts |
| `api/_lib/agent/` | Coordinator, budget accounting, context handling, run persistence abstraction |
| `api/_lib/providers/` | Provider adapters and normalized streaming parser |
| `api/_lib/catalog/` | Search, version resolution, tool definition loading, visibility |
| `api/_lib/permissions/` | Grant checks, pending permission requests, revocation |
| `api/_lib/executors/` | Built-in, device, MCP, API, workflow, sandbox adapters |
| `api/_lib/apps/` | Server-capable TM app handlers with injected data dependencies |
| `api/_lib/skills/` | Skill discovery, loading, packaging, validation |
| `api/_lib/toolBuilder/` | Template instantiation, code generation pipeline, test reports |
| `src/services/agent/` | Run/event client and allowlisted device bridge |
| `src/services/storage/` | IndexedDB, migrations, transactional operations, export/import |
| `src/services/notes/` | Notes repository used by page and agent |
| `src/components/chat/artifacts/` | Typed note, chat-source, healthcare, and file cards |
| `src/components/tools/` | Built-in catalog, private tools, marketplace, connections |
| `src/components/admin/` | Authenticated internal review UI |
| `trigger/agentRun.ts` | Durable host for the same coordinator |

Keep compatibility wrappers in current files until callers migrate. Avoid combining provider extraction, storage replacement, and UI redesign in one change.

### 4.2 Run and event contracts

Run status is one of `queued`, `running`, `waiting_permission`, `waiting_device`, `waiting_external`, `completed`, `partial`, `failed`, or `cancelled`. `partial` means useful work exists but the requested task did not finish, including budget exhaustion. An infrastructure disconnect is not completion.

Every event has `schemaVersion`, `runId`, monotonic `sequence`, `timestamp`, `type`, and a validated payload. Event types include:

- `run.started`, `run.status`, `assistant.delta`, `assistant.completed`.
- `tool.discovered`, `tool.started`, `tool.completed`, `tool.failed`.
- `permission.required`, `device.requested`, `artifact.updated`, `usage.updated`.
- `run.completed`, `run.partial`, `run.failed`, `run.cancelled`.

Terminal events carry the final status and committed artifact references. Progress events say what TM is doing; they do not expose hidden model reasoning, credentials, or raw internal diagnostics. Keep sequence deduplication and incremental decoding across arbitrary byte boundaries.

`ToolResult` contains a discriminated `status` (`success`, `error`, `pending`, `denied`, `unknown_outcome`), bounded model-visible data, optional artifact/source references, usage, and a typed error. A pending device operation or permission request is not an ordinary successful tool response; the coordinator suspends and later resumes that invocation.

`ArtifactRef` contains type, stable object ID, storage location, version, title, and allowed app actions. URLs are constructed by trusted UI code. The model cannot turn arbitrary strings into privileged app actions.

### 4.3 Discovery that scales

Keep a small bootstrap tool set available to both Air and PRO: `tools_search`, `tools_load`, `skills_search`, and `skills_read`. Other tools are loaded when selected. Catalog identifiers may use dots; provider-facing aliases must obey that provider's limits and have collision-resistant mappings.

1. Search authorized catalog metadata by task text, app, category, and execution type. Include relevant locked capabilities with an honest reason, but never expose another user's private packages.
2. Return a short result list: ID/version, description, required permissions, connection state, execution location, and indicative cost class.
3. `tools_load` validates exact immutable versions and adds selected definitions to the run's active set before the next model call.
4. Cap active schema tokens, not the total number of tools in the product. Evict unused definitions while retaining invocation records needed for context.
5. Check authorization again at execution. A tool previously loaded can later be disabled, revoked, or changed in entitlement.
6. Prefer a usable existing tool, then a private saved tool, then an approved marketplace tool, then a template, then custom code. This is a default search strategy, not a requirement to make five searches for an obvious local note edit.
7. Cache public metadata separately from private metadata and connection state. Never share user-scoped query results across tenants.
8. On tool failure, return actionable structured information; allow bounded repair or an alternative. Detect repeated identical failed calls.

MCP already defines paginated tool listing and optional change notifications. TM should consume those capabilities and validate structured results where provided. TM's searchable catalog and active-tool budget are application design choices. [MCP tools specification](https://modelcontextprotocol.io/specification/2025-11-25/server/tools).

### 4.4 Tool and skill packages

Each tool version records: package ID, version, content hash, author/owner, visibility, source kind, description, input/output schemas, executable entry point or template specification, required grants, network destinations, resource effects, runtime limits, dependency lockfile, test fixtures, test report, and license/provenance.

Trusted server policy derives execution privileges. A package's self-declared “read-only” annotation never grants authority. Store account-specific credentials and configuration separately from the reusable package. Outputs are data and may contain hostile instructions.

A skill is a versioned instruction package with a short discovery description, applicability guidance, `SKILL.md` content, optional bounded references, and declared tool dependencies. Loading a skill does not grant tool access. Executable skill assets enter through the same tool validation/execution path as other code.

Starter skills: skill finder, skill creator, tool finder, tool creator, TM Notes writing/editing, past-chat research, frontend design, document writing, structured data analysis, source verification, and TM Healthcare lookup. Adapt existing frontend/human-writing material after checking redistribution rights; do not silently copy another product's private skill library.

## 5. App data, history, and the device bridge

### 5.1 Past-chat retrieval

Define storage-independent methods:

- `chats_list({cursor, limit, from, to, dateField})` → titles, IDs, dates, counts, next cursor; no message bodies.
- `chats_search({query, from, to, limit, cursor})` → chat IDs/titles, dates, matching message IDs and bounded excerpts, query semantics, next cursor.
- `chats_read({chatId, beforeMessageId?, afterMessageId?, limit})` → ordered actual messages with source IDs and an explicit continuation cursor.

Use a stable `(timestamp, id)` order. Support content matches even when titles are unhelpful. Handle multilingual queries and separately search “Steve Jobs” and “Elon Musk” when a combined query misses relevant chats. Search metadata and a local lexical index first; add semantic indexing only after a benchmark proves the need and accounts for privacy/cost.

Do not return internal reasoning fields, hidden credentials, pending approval payloads, or every attachment by default. Attachments are separately permission-checked resources. Include known upload names and references; read their contents only when needed.

Search and reading respect deletion, account/device workspace, excluded chats, and current grants. Exclude group conversations from the first personal-history feature; later add membership-aware support explicitly. A revoked or deleted source must no longer be readable through an old search hit or source link.

For device storage, search runs in the app. Only the bounded selected results go to the model through the server. Do not add a central vector database containing all local chats. Clearing a conversation also removes its search index entries and references to stored attachment blobs.

For an opted-in paid account, the same tools can use the cloud history adapter under owner-scoped authorization, including while the device is closed. Search/read output schemas stay identical. Unsynced local conversations are still device-only and must be labeled as unavailable when that device is absent. An enabled cloud history store does not automatically cloud-sync Notes.

### 5.1a Optional paid cloud sync

Use an explicit storage mode: `device_only` or `cloud_sync`. A server-verified paid entitlement is necessary but not sufficient to enable `cloud_sync`. Require an explicit setting and record its version/time. Selecting PRO, signing in, restoring a purchase, or visiting another device must not silently upload old history.

On opt-in, explain what will sync and let the user choose existing history or new chats only. Keep the local store usable while a transactional outbox uploads records. Preserve stable message IDs, revisions, and deletion tombstones. Use idempotent upserts; a stale device must not resurrect deleted chats. Append messages by ID; do not replace entire message arrays. Conflict rules for titles and edited messages must preserve conflicting edits for recovery.

Cloud search uses indexed, paginated owner-scoped queries over titles and message contents, with the same date semantics as local search. Start with Postgres lexical search; do not require paid embeddings to complete the first story. Cloud content remains readable only to its owner and explicitly authorized run workers.

On disable or subscription expiry, stop new sync immediately and switch to `device_only`. Planning default: retain existing cloud history read-only for a disclosed 30-day export/download grace period, with no new agent cloud-history processing; then purge it and its indexes. Offer immediate cloud deletion on explicit request. Make the grace period configurable and record the chosen launch policy. Do not destroy the user's only copy without the disclosed recovery path, and do not keep a hidden archive forever. Sync workers must recheck the current mode and entitlement before every batch.

Implement a verified subscription/entitlement adapter, not client-controlled `is_pro` flags. The billing provider is a deployment choice for task TM-03; test lifecycle behavior with signed fixtures before choosing checkout details. Handle duplicate/out-of-order payment webhooks, cancellations, expiry, refunds, and restoration. No payment collection is part of this planning task.

### 5.2 Shared Notes repository

Extract `Note`, `Block`, `BlockType`, and theme metadata from `NotesPage.tsx`. Preserve all existing block types, checked values, dimensions, drawings, tables, ordering, emoji, stars, and theme. Store large binary content separately with references.

Expose `notes_list`, `notes_read`, `notes_create`, and `notes_update`. Start with transactional create and typed patch operations; an update includes `expectedVersion` and stable block IDs. Return a conflict when the user changed the note while the model was drafting. Read the newer version and merge only non-conflicting changes; never silently replace user edits.

Use one repository for NotesPage, main-chat actions, and the existing Notes AI panel. The UI subscribes to repository changes rather than maintaining a competing array that overwrites agent saves. Store note versions or reversible patches so users can undo an agent edit. Do not introduce note deletion as a default model capability in the first release.

“Saved” requires a committed repository transaction and a result receipt. After a model finishes drafting but before a device commit, show “Waiting to save on this device,” not “Created your note.”

Add stable `/notes?noteId=<id>` navigation. Deep links must work on reload, preserve back navigation, and handle missing or deleted notes. Existing `/notes` remains valid.

### 5.3 Trusted device operation protocol

Only allowlisted, shipped TM handlers execute in the main app. Generated JavaScript never executes in the authenticated app origin.

1. The server creates a pending invocation bound to run ID, actor/session, target device workspace, exact tool version, canonical argument digest, grant version, nonce, and expiry.
2. The connected app receives the request through the run event stream. It validates the envelope and rechecks the local resource permissions before dispatch.
3. The handler searches/reads/writes the local repository. Writes use a durable idempotency receipt in the same transaction as the mutation.
4. The app posts a bounded result to the authenticated continuation endpoint. The server verifies ownership, pending state, binding, and argument digest; it accepts a single result with compare-and-swap semantics.
5. Replayed requests return the existing receipt. A duplicate tab cannot repeat the write. A result from another run, user, or device workspace is rejected.
6. If the app closes or is suspended, the run becomes `waiting_device`. On return it resumes or expires according to policy. Do not rely on service workers to run indefinitely.

A browser can be modified by its user, so its results are not authoritative evidence of cloud billing, admin status, or permission grants. The bridge may return user-controlled content; it cannot mint server privileges.

Anonymous Air can use local app tools with a bounded, server-issued session/run capability and existing trial limits. It cannot start unrestricted cloud generation, submit public packages, or bind another account's tools. Signing in must not silently assign shared-device notes to the next account.

### 5.4 Healthcare and future TM apps

Launch `healthcare_search_drugs` and `healthcare_read_drug` as factual catalog lookups. Reuse the existing RPC/query logic through injected clients rather than importing browser Supabase code into server handlers. Return explicit brand/generic IDs, source/provider information where available, retrieval time, and missing-data fields. Do not manufacture a source update date.

Normal chat can return a medicine information card and an “Open in Healthcare” action targeting the selected record. Add the record-targeting route behavior; it is not assumed to exist. Treat catalog dosage fields as reference data, not as authorization to prescribe or infer a safe personalized dose. Clinical decision-making and medication changes are outside this implementation milestone.

Define an `AppDescriptor` containing app ID, tools, resource schemas, grants, cards, and deep-link resolvers. A future app should register a descriptor and its repository handlers without changing the core loop. Audit Contour modules and lifestyle pages before wrapping them: navigation-only or placeholder features must not be advertised as working data tools.

## 6. Permissions, effects, and cost

### Permission rules

The current user request establishes the task. Saved grants establish which operations TM may perform while completing it. Authenticate APIs with `api/_lib/auth.ts`; model arguments never contain trusted `userId`, admin claims, billing tier, or raw credentials.

Suggested scopes: `chats.search`, `chats.read`, `notes.read`, `notes.write`, `healthcare.read`, `connections.<id>.read`, `connections.<id>.write`, `sandbox.compute`, `sandbox.network.<destination>`, and `artifacts.publish`. Grants can be narrowed by object/account/destination and expire or be revoked.

An allowed action runs immediately. A missing grant produces one understandable permission card showing the concrete operation and scope. Do not add an extra confirmation merely because an action writes: creating the requested note should work under `notes.write`. External sending or publishing works under a sufficiently specific grant and task instruction; unrelated sends never follow from a general integration connection.

Every executor, including children of workflows and generated tools, passes through the same authorization and budget broker. Context read from old chats, websites, tool descriptions, or files cannot widen grants. A skill's instructions cannot bypass policy. Recheck grants at resume and at each effectful step.

Use user-scoped database access for user resources. Supabase service roles can bypass RLS; worker/admin system operations need a narrow internal interface with explicit verified ownership, not a general service client exposed to executors. [Supabase RLS documentation](https://supabase.com/docs/guides/database/postgres/row-level-security).

### Air and PRO configuration

Separate model/persona selection from entitlements. Selecting the PRO persona must not itself grant paid execution privileges. Resolve the authenticated user's entitlements on the server, including the actual subscription mechanism found during implementation.

| Capability | Air launch default | PRO launch default |
| --- | --- | --- |
| Discovery, built-in skills, chat search/read | Enabled with bounded results | Enabled with larger context allowance |
| Notes read/create/update, Healthcare lookup | Enabled | Enabled |
| Existing web/image tools | Preserve available functionality; meter provider cost | Higher configurable budgets |
| Low-cost connected app operations | Enabled within connection/grant limits | Higher configurable limits |
| Existing approved workflows/API templates | Enabled when estimated cost fits | Enabled |
| Creating simple declarative tools/skills | Small creation budget | Larger creation budget |
| Small pure transforms in a sandbox | Small metered allowance after cost pilot | Enabled |
| New arbitrary code tool synthesis, builds, cloud browser sessions | Initially PRO unless the team enables a low-cost allowance | Metered and bounded |
| Durable execution | Available where necessary; bounded | Longer runs and larger concurrency allowance |
| Public marketplace browsing/use | Enabled subject to each tool's cost | Enabled subject to each tool's cost |

Store policy in server-side versioned configuration: model-turn limits, tool calls, elapsed active time, waiting expiry, input/output tokens, search calls, sandbox seconds, memory/CPU, artifact bytes, external API charges, concurrent runs, and per-day/per-user/platform ceilings. Show simple estimates and limit messages to users, not these implementation controls.

Initial experiment values, not pricing commitments: Air 12 model turns / 20 tool invocations / 120 active seconds / 1 active run; PRO 40 turns / 80 invocations / 900 active seconds / 2 active runs. Configure sandbox and paid API allowances separately, defaulting to disabled until rates and maximum per-call charges are populated. Tune against the first story; do not retain five turns if discovery consumes most of them.

Reserve expected usage atomically before chargeable work, reconcile actual usage afterward, and release unused reservations. Count failed attempts and model fallback costs internally. Preserve existing user-facing message quota behavior until migrated deliberately. An unknown price must not make a paid tool “free.” Child workflows share the parent's ledger; generating a tool does not reset a budget.

Stop loops that repeat identical failures. On limits, retain committed work and report `partial` with what remains. Never hide tools on the final iteration and infer completion merely from the absence of tool calls.

## 7. Connected services, workflows, and tool creation

### Connected services

Build connection records per user/account with encrypted server-side token references, granted scopes, expiry, and revocation state. Use OAuth where supported and managed secret storage; never put tokens in `VITE_` variables, model messages, submission bundles, or browser logs. Configure redirect/state/PKCE and token refresh according to the selected provider's current official docs.

Treat third-party MCP metadata as untrusted. Validate URL destinations, redirects, all relevant IP families, DNS changes, response size, content type, and timeouts through a network boundary. Preserve the existing HTTPS/private-address protections while addressing gaps; do not assume a preflight DNS lookup alone prevents rebinding. Follow current MCP authorization guidance when binding tokens to resources; do not forward arbitrary TM bearer tokens to connectors. [MCP security guidance](https://modelcontextprotocol.io/docs/2025-11-25/tutorials/security/security_best_practices).

Connector disconnect invalidates cached access and future invocations. A token refresh requires a concurrency lock to prevent races. A connection failure should not prevent unrelated Notes or history tools from working.

### Workflow interpreter

A workflow is a versioned, schema-validated graph of existing tool calls, typed inputs/outputs, conditions, and bounded loops. Steps refer to immutable tool versions; dependencies and variable bindings are explicit. Begin with sequential flows, then add concurrent independent reads after correctness tests.

Each child step has its own invocation ID and the parent's grant/budget context. Checkpoints resume from the last confirmed step. External writes need provider idempotency or reconciliation; a transport timeout after dispatch can have an unknown outcome. Do not retry such writes blindly.

Trigger.dev supports task idempotency keys; use them for dispatch deduplication while maintaining TM's own per-operation effect ledger. A task-level key does not prove an external service committed exactly one write. [Trigger.dev idempotency](https://trigger.dev/docs/idempotency).

### Template catalog

Ship reviewed templates for: bounded REST JSON reads, scoped REST writes, paginated fetches, CSV/JSON transforms, HTML table extraction in a sandbox, file conversions, document generation, and compositions of TM app tools. Template inputs declare auth binding, allowed destination, HTTP method, schemas, limits, and test fixtures.

An API template is not unrestricted `fetch`. Resolve credentials through connection IDs; bind hosts and methods outside model-generated strings; reject internal network targets and unauthorized destinations. Credentials remain in the network broker where possible. Support OpenAPI-based generation only after sanitizing and validating imported specifications and testing generated requests against mocks.

### Custom code lifecycle

Use these states: `draft → validating → testing → private_ready` or `failed`. Submission states are separate: `queued → scanning → needs_changes / review_ready → approved / rejected / withdrawn`; an approved version can later be `revoked`.

For a missing capability:

1. Describe the desired input/output and check for existing capabilities.
2. Select a template or generate source against a restricted execution SDK.
3. Parameterize all task-specific values. Private records are runtime inputs, not constants in source code or examples.
4. Resolve locked dependencies from allowed registries/packages. Bound installation/build work.
5. Validate schema, syntax, permissions, destinations, dependency provenance, and resource limits.
6. Run isolated tests with synthetic inputs, output assertions, failure cases, and forbidden-operation probes. Limit autonomous repair attempts and charge them to the same run.
7. If tests pass, pin a private immutable version and invoke it through the standard broker under existing grants.
8. Confirm the requested result using tool receipts or generated artifact inspection. A process exit code alone is insufficient for a document or web page.
9. Produce a sanitized reusable submission and upload it for internal review, using a retryable outbox separate from the user's task completion.

The sandbox is disposable and isolated per execution or tightly scoped run. Bound CPU, RAM, disk, process count, runtime, and network. Mount only authorized input artifacts; expose no host filesystem, Docker socket, production environment variables, or service-role credentials. Block network by default; grant destination-specific access through a broker. Route privileged connector actions back through the tool broker so code cannot bypass permission or cost checks.

Store artifacts behind authorized access, verify MIME/size/path, and preview active HTML on an isolated origin with a restrictive sandbox/CSP. Preserve the existing rule against combining scripts and same-origin privileges on the app origin. Separate preview from publication; publishing needs the appropriate user grant and task intent.

### Marketplace review and reuse

Automatic submission sends a reusable package, dependency manifest, synthetic tests, scan report, permissions, source provenance, and creator attribution policy. Scan source, strings, filenames, fixtures, screenshots, and documentation for credentials/private data before upload. Prefer generating a clean package from a declarative spec over attempting to redact an arbitrary transcript. Ambiguous packages stay private and report why submission was withheld.

Internal reviewers can inspect the immutable hash, code changes, tests, network permissions, license, and independent sandbox results. Approval binds that exact version and hash. The submitting model and package creator cannot grant themselves reviewer authority.

Public listings show what the tool does, publisher, version, required connections/permissions, cost category, and verified review state. Installation creates a user binding with fresh account configuration; it does not share the creator's credentials or datasets. Dependency versions must also be approved/pinned. Later versions require review and new permission consent only if the permission scope expands.

Deduplicate semantically similar submissions through canonical manifest hashes plus reviewer suggestions; do not let one user's private usage data appear in another user's search. Support abuse reports, rejection reasons, review rate limits, package quarantine, and emergency version revocation. A revoked version is removed from discovery and blocked at invocation, including nested workflows and queued runs.

## 8. Data and retention design

D1 is settled: use device storage for free users and default-off optional cloud history for paid users. This table describes logical records, not authorization to put all data in Supabase.

| Record | Suggested home | Important constraints |
| --- | --- | --- |
| Personal chats, messages, search index, attachment references | IndexedDB; optional owner-scoped Supabase history for opted-in paid accounts | Per-workspace ownership, stable pagination, deletion propagation; no free-user cloud history/index |
| Storage settings and sync state | `user_storage_preferences`; local sync outbox and server sync cursors/tombstones | Explicit opt-in, verified entitlement, revisioned policy, cursor expiry and deletion handling |
| Subscription entitlements | Verified billing adapter plus `user_entitlements` / processed webhook receipts | Server-write-only, replay-safe events, expiration; persona is not subscription authority |
| Notes, blocks, versions, write receipts | IndexedDB by default | Atomic mutation + receipt; versions; large blobs separated |
| Run metadata | `agent_runs` in Supabase for authenticated cloud runs | Actor, persona, state, sequence, policy version, timestamps; avoid content in metadata |
| Run events/checkpoints | Device for personal history; bounded transient server processing only where needed | Explicit retention, per-user authorization, encrypted storage when persisted, no secrets or hidden reasoning |
| Tool invocations | `agent_tool_invocations` plus local write receipts | Unique `(run_id, invocation_id)`, arguments digest, effect state, receipt, attempts; content minimized |
| Usage/reservations | `agent_usage_ledger` | Atomic reservations and reconciliation; system writes only |
| Grants | `user_capability_grants`, plus scoped anonymous/local grants | Scope, resource/account, version, expiry, revocation; no client privilege escalation |
| Connections | `user_connections` with encrypted secret references | Owner-scoped, separate credentials from catalog |
| Tool packages/versions | `tool_packages`, `tool_versions`, private artifact storage | Visibility and owner; immutable content hashes; execution policy |
| Skill packages/versions | `skill_packages`, `skill_versions` | Same visibility/version principles; bounded text and references |
| User installations | `user_tool_installations` | Exact package version, owner/account configuration, grant bindings |
| Submissions/reviews | `tool_submissions`, `tool_reviews` | Private queue; immutable submitted version; reviewer role enforced server-side |
| Generated artifacts | Local blobs or authorized cloud object storage | Owner, run, media type, size, version, expiry; private by default |
| App descriptors and built-in templates | Source-controlled manifests, optionally indexed in DB | Reviewed releases, schema compatibility tests |

Specify indexes, foreign keys, uniqueness, RLS, cleanup policy, and rollback for each migration. Use a fresh-database migration test. Public users can read only approved public catalog versions. Private package content, run events, grants, connections, and submissions need two-user isolation tests. Admin access is a separate authenticated role, never an email string accepted from the browser.

Transient processing needs a retention contract distinct from history sync. Inventory Vercel logs, provider requests, Trigger inputs/outputs/streams, Supabase run/checkpoint fields, and sandbox artifacts. Store only bounded references in the scheduler payload where possible. Configure and verify retention for each service; do not claim that deleting a Supabase row erases a provider's retained run payload. If a service cannot meet the selected policy, change the data path or disable that execution mode until the policy is resolved.

Provisional operational target: purge temporary content after device delivery plus a short recovery window, with a configured maximum expiry for abandoned runs; retain only redacted usage and execution metadata longer. Exact durations and processor behavior must be recorded and tested in task TM-02. No hidden permanent chat archive is permitted under the device-only path.

Account deletion, local delete, connection removal, package withdrawal, and public version revocation have different scopes. Implement each explicitly. Existing approved public packages may need a tombstone/provenance record; do not promise removal of copies already installed elsewhere. Explain the actual behavior in product copy when shipping marketplace submissions.

## 9. Implementation tasks

All tasks start unchecked. Each task should normally be one small change set, split further if its verification would be hard to review. “Done when” is a release requirement, not a suggested test. Dependencies refer to completed and verified tasks, not merely files that exist.

### Foundation and the first useful release

#### TM-00 — Record the actual baseline

- [x] Complete. Depends on: none. Verified 2026-09-06 using the step 3 credential-unavailable fallback; see [baseline](docs/agent/baseline.md). Live schema/RLS and service checks remain explicitly unverified; no product code changed.
- Files: `CLAUDE.md`, `production-check.md`, `package.json`, `src/types/database.ts`, migrations; new `docs/agent/baseline.md`.

Steps:

1. Re-read this plan and inspect current routing, tool execution, Notes persistence, and history. Record any changes since this audit.
2. Run `npm run typecheck`, `npm run lint`, `npm test`, and `npm run build`. Save concise results without secrets. Distinguish existing failures from new regressions.
3. Capture the database schema in an authorized staging/development environment and compare it with checked-in migrations and types. If credentials are unavailable, document the missing prerequisite; use fixtures without claiming a live schema audit passed.
4. Capture reference screenshots of main chat, Notes, Healthcare, Settings/Flight Controls, and the mobile layouts. Record current routes and persistence behavior.
5. Update stale architecture notes that directly affect this plan. Map overlapping production-check tasks instead of doing them twice. Record the new paid opt-in exception to Gate LS.

Done when: there is a verified baseline with commands/results, a storage data-flow map, and an explicit list of environment-only prerequisites. No product code is changed in this task.

#### TM-01 — Introduce shared contracts

- [x] Complete. Depends on: TM-00. Verified 2026-09-06; see [contract decisions and evidence](docs/agent/contracts.md).
- Files: new `shared/agent/*`, `shared/apps/*`; relevant TypeScript configs; `src/types/chat.ts` compatibility types.

Steps:

1. Define schemas for runs, model messages/events, tool definitions/results, permissions, usage, source references, artifacts, app descriptors, and package manifests.
2. Separate trusted execution context from model-supplied arguments. Define stable IDs, versioning, typed pending/error states, and canonical argument hashing.
3. Define storage and executor interfaces that support both local and cloud history without changing the model-visible tools.
4. Add validation fixtures for malformed frames, excessive payloads, unknown fields where disallowed, pending operations, and schema upgrades.

Done when: client/server import the same validated contracts; no general `any` transport is added; an unknown event version fails explicitly or uses a documented compatibility path.

#### TM-02 — Set processing retention and storage lifecycle

- [ ] Complete. Depends on: TM-00, TM-01. Local implementation verified 2026-09-07; blocked on actual service retention/deletion verification. See [lifecycle inventory and exact remaining checks](docs/agent/data-lifecycle.md).
- Files: `docs/agent/data-lifecycle.md`, `api/_lib/proJobs.ts`, Trigger configuration/payload boundaries, legal/auth copy only where facts are settled.

Steps:

1. Record device-only/free and paid opt-in history behavior, local Notes behavior, group-chat exceptions, and existing cloud beta data.
2. Inventory every durable copy of prompts/results in scheduler payloads, streams, checkpoints, logs, artifacts, and providers. Verify actual service retention/configuration from official documentation and the deployment settings.
3. Specify enforceable expirations for transient execution content, waiting runs, recovery output, metadata, and account deletion. Implement cleanup hooks or scheduled cleanup jobs where the data layer exists.
4. Define existing-beta migration: download/export legacy history, verify local import, stop automatic cloud writes, and permit retained cloud history only after eligible opt-in. Do not drop legacy tables before migration and the optional paid adapter are settled.
5. Update contradictory signup/privacy copy to describe actual deployed behavior. Do not claim messages never leave the device.

Done when: every content store has an owner, purpose, retention value, deletion mechanism, and verification evidence. Any unsupported retention promise blocks the affected execution mode rather than becoming a footnote.

#### TM-03 — Establish paid entitlements and opt-in settings

- [ ] Complete. Depends on: TM-01, TM-02.
- Files: new entitlement service and migrations; `src/context/AuthContext.tsx`, account/settings UI, relevant API auth checks.

Steps:

1. Implement server-authoritative entitlement resolution, separating `persona`, subscription state, and enabled capability policy.
2. Add versioned storage preferences with `device_only` default and explicit `cloud_sync` consent. Reject cloud opt-in without an eligible entitlement.
3. Implement a billing-provider adapter and an idempotent verified event handler. Choose the provider only after checking supported launch payment methods, fees, and webhook semantics; document configuration and test credentials separately.
4. Add duplicate/out-of-order event handling, expiry/revocation, refund policy mapping, and scheduled reconciliation. Verify webhook signatures; do not trust a checkout-return URL to activate payment.
5. Add an account/settings surface for subscription state and cloud history choice, using existing components. Until live billing is configured, permit a documented server-side development entitlement fixture only in non-production environments.

Done when: a browser cannot grant itself paid access; free users cannot enable cloud history; becoming paid uploads nothing without opt-in; downgrade behavior matches section 5.1a. Live paid launch stays disabled until checkout/webhook verification is complete.

#### TM-04 — Build the permission and usage broker

- [ ] Complete. Depends on: TM-01; integrates TM-03 entitlements when available.
- Files: new `api/_lib/permissions/*`, `api/_lib/agent/budget*`, grants/usage migrations; compatibility with existing rate limits.

Steps:

1. Resolve actors from verified auth or bounded anonymous session capabilities. Define grant lookup and exact resource/account/destination matching.
2. Implement persistent grants, revocation, expiry, and one-shot permission records bound to operation hash and version.
3. Add atomic budget reservations, reconciliation, concurrency limits, and a platform ceiling. Provide explicit prices/estimates and reject unpriced paid execution.
4. Route nested execution through the same broker and ledger. Keep legacy message quota semantics visible during transition.
5. Add isolation, replay, revocation-during-run, exhausted-budget, and concurrent-reservation tests.

Done when: allowed note writes do not prompt repeatedly, missing grants pause once, forged identities fail, and concurrent runs cannot spend the same allowance twice.

#### TM-05 — Move device history to a transactional repository

- [ ] Complete. Depends on: TM-01, TM-02. Coordinate with production-check LS.2, LS.3, LS.4, LS.6.
- Files: `src/services/chat/chatService.ts`, history pages/modals, `src/App.tsx`, new `src/services/storage/*`.

Steps:

1. Introduce IndexedDB object stores for chat metadata, messages, attachment blobs, local search records, operation receipts, and migration state. Use a small maintained wrapper only after verifying compatibility.
2. Route all history consumers through a single repository; remove eager loading of all message bodies for list views.
3. Migrate `chatSessions` idempotently with count/checksum verification. Preserve the original data until verified. Surface quota, corruption, and denied-persistence errors.
4. Implement device workspace/account isolation and an explicit guest-data import flow. Do not expose the prior account's local history after account switching.
5. Replace automatic signed-in cloud writes with the selected storage mode; preserve legacy cloud data through the migration/export path rather than silent deletion.
6. Add export/import/delete, blob cleanup, and cross-tab transactional updates. Browser persistence requests are best-effort; handle refusal honestly.

Done when: 500 representative sessions load incrementally and survive migration/reload; export/import round-trips attachments and IDs; free-user new history produces no cloud history writes; storage failure is visible and recoverable.

#### TM-06 — Extract Notes data and transactional edits

- [ ] Complete. Depends on: TM-01, TM-05.
- Files: `src/components/notes/NotesPage.tsx`, `src/services/ai/notesAiService.ts`, new Notes schemas/repository.

Steps:

1. Extract all note/block types and persistence from the component. Migrate `tm-notes` into the device repository with preserved IDs and content.
2. Add create/read/list/patch methods, stable versions, expected-version checks, reversible revisions, and atomic idempotency receipts.
3. Make NotesPage subscribe to the repository. Existing manual editing and its AI panel use the same write path.
4. Replace the `tm-notes-draft` content handoff with a repository operation while retaining a one-time legacy import shim.
5. Implement `/notes?noteId=` targeting and missing-note behavior without changing the editor's design.

Done when: all current block types round-trip; two-tab/manual-versus-agent edits detect conflicts; a duplicate create invocation yields one note; legacy notes remain readable after upgrade.

#### TM-07 — Add real local history search and targeted reading

- [ ] Complete. Depends on: TM-05.
- Files: chat repository/search implementation, new history fixtures, source link helpers.

Steps:

1. Implement the list/search/read contracts in section 5.1 with cursors and result/byte caps.
2. Build an incremental local lexical index over message content and titles. Keep source IDs and timestamps; invalidate on edits/deletes/imports.
3. Resolve date intervals in the user's supplied time zone, validated server-side where used. Distinguish session creation dates from message dates.
4. Implement message-targeting links for personal chats; test existing `/chat/:id` behavior before reusing it.
5. Add fixtures for untitled chats, multiple conversations, multilingual text, old sessions with recent messages, excluded/deleted chats, and missing-device storage.

Done when: the Jobs/Musk query finds actual relevant messages without loading every chat into model context; stable pagination has no duplicates or omissions; source links open the cited messages.

#### TM-08 — Normalize provider calls and streaming

- [ ] Complete. Depends on: TM-01.
- Files: `api/ai-proxy.ts`, `api/_lib/providerResilience.ts`, new provider adapters/parsers, `api/mcp-approval.ts` compatibility path.

Steps:

1. Extract model/provider dispatch while preserving current persona, heat, Flow State, special-mode, token, and fallback settings.
2. Normalize content deltas, complete tool calls, usage, stop reasons, errors, and cancellation. Record provider capabilities and reject unsupported tool schemas explicitly.
3. Buffer incomplete provider frames and tool argument fragments across reads. Test every split point, multi-byte text, multiple calls, and errors after content starts.
4. Bring streaming, non-streaming, and approval continuation onto the same adapter contract. Keep only bounded pre-output retries; account for actual fallback providers.

Done when: Air and PRO fixtures complete a model → tool → model turn with correct call IDs; truncated/malformed streams cannot silently become success; existing plain chat/provider fallback behavior is preserved.

#### TM-09 — Implement the common run coordinator

- [ ] Complete. Depends on: TM-01, TM-04, TM-08.
- Files: `api/_lib/agentLoop.ts`, new coordinator/state modules, proxy entry points.

Steps:

1. Replace implicit five-step completion with the explicit run states, configurable budgets, active definitions, loaded skills, and typed executor interface.
2. Persist invocation intent before dispatch where effects require recovery; record confirmed receipt/unknown outcome afterward.
3. Handle pending permission/device/external results as waits. Resume the same model conversation with the correlated result.
4. Add cancellation, repeated-failure detection, bounded argument repair, context truncation/compaction, and partial completion. Preserve source references and pending call/result pairs when compacting.
5. Start with sequential tools. Add parallel independent reads only if budget reservations and deterministic result ordering are covered.

Done when: the same coordinator passes multi-step fixtures for both personas; approvals can be followed by further tools; budget stops preserve useful work; a retry never repeats a confirmed effect.

#### TM-10 — Connect run events and the device bridge

- [ ] Complete. Depends on: TM-04, TM-05, TM-09.
- Files: new run API/continuation handlers; `src/services/agent/*`; `src/services/ai/aiProxyService.ts`; `src/hooks/useChat.ts`; API validation.

Steps:

1. Define create/status/events/continue/cancel API operations with schema validation, CORS, auth, ownership, rate limits, and bounded bodies. Use routes compatible with Vite's API shim and Vercel routing.
2. Implement sequence-based event replay and client deduplication. Keep an adapter for existing marker streams during migration.
3. Implement the allowlisted device protocol from section 5.3, with local permission checks, expiry, argument bindings, and single-claim result handling.
4. Add cross-tab ownership/lease handling; the local write receipt remains the source of truth if a lease moves after a crash.
5. Make account change, tab closure, network failure, and stale continuation predictable states. Cancellation stops future work but does not claim to undo already committed actions.

Done when: duplicate/reordered frames render once, a wrong-user result is rejected, a tab can close after a local commit and later reconcile its receipt, and an unavailable device pauses rather than fabricating a result.

#### TM-11 — Replace fixed tool exposure with searchable discovery

- [ ] Complete. Depends on: TM-01, TM-04, TM-09.
- Files: `api/_lib/tools.ts`, catalog services/manifests, bootstrap tools, catalog migrations.

Steps:

1. Wrap current web/image/skill tools in the new manifest and executor contracts. Preserve safeguards against accidental paid image generation while removing UI-mode dependence from general tool availability.
2. Implement metadata search and exact-version loading, connection/entitlement states, active-schema token limits, and provider aliases.
3. Rebuild active definitions after discovery results; prove a newly loaded tool becomes callable on the next turn.
4. Add visibility-aware caches and deny private/disabled/revoked tools at execution even if named directly by the model.
5. Seed a realistic catalog and a 1,000-manifest synthetic scale fixture. Do not put the full catalog into prompts.

Done when: Air and PRO discover and call the right tool from a large catalog with bounded schema size; unauthorized private tools never appear in results; an unavailable capability has a truthful status.

#### TM-12 — Expose Notes, history, and Healthcare in normal chat

- [ ] Complete. Depends on: TM-06, TM-07, TM-10, TM-11.
- Files: app manifests/handlers; Notes/history repositories; healthcare service and server query adapter; `src/App.tsx` link resolution.

Steps:

1. Register the history and Notes tools specified above. Dispatch device-owned operations through the bridge; do not import localStorage access into server code.
2. Register Healthcare search/read using existing database logic with explicit data-source boundaries and bounded results.
3. Return artifact/source references and saved object versions. Validate all note block patches and source IDs.
4. Add truthful handling for missing history, note conflicts, revoked permissions, Healthcare no-result/error, and account switching.
5. Register these through app descriptors so another TM app follows the same pattern.

Done when: a normal Air/PRO chat can read past messages and save a note without entering Notes mode; Healthcare lookup returns real records from normal chat; tools report errors instead of claiming work happened.

#### TM-13 — Show app objects and activity in the current UI

- [ ] Complete. Depends on: TM-10, TM-12.
- Files: chat message renderers, new typed artifact cards, `src/types/chat.ts`, persistence serializer, Notes/Healthcare route handlers.

Steps:

1. Add compact progress such as “Searching past chats,” “Reading 2 conversations,” and “Saving your note,” with expandable activity details.
2. Add note preview/save state, chat-source links, Healthcare records, permission requests, and partial-result cards. Keep current type, glass surfaces, theme colors, spacing, and animation conventions.
3. Add “Open in Notes” and “Open in Healthcare” to the exact objects. Add follow-up reference binding so “shorten it” targets the same artifact.
4. Persist structured message parts and stable references; do not parse raw model prose into privileged cards. Update serializers so artifact-only messages are not dropped by `isPersistable`.
5. Verify keyboard access, screen reader labels, reduced motion, long titles, mobile width, and theme contrast against TM-00 screenshots.

Done when: a saved note remains an actionable card after reload, pending saves never show as committed, links resolve the intended object, and the main chat retains TM's visual identity.

#### TM-14 — Ship the first end-to-end milestone behind a flag

- [ ] Complete. Depends on: TM-12, TM-13.
- Files: end-to-end fixtures, evaluation harness, rollout configuration, `docs/agent/milestone-1.md`.

Steps:

1. Run the exact Jobs/Musk story in Air and PRO against seeded real-message fixtures and verify the resulting note content and source references.
2. Run follow-up editing, browser reload, retry-after-commit, missing history, cross-account, and exhausted-budget cases.
3. Verify no new cloud history persistence for free/device-only users. Temporary model processing must match TM-02's declared data path.
4. Test existing plain chat, image generation/editing, Notes manual editing, and current PRO generation for regressions.
5. Enable the feature for an internal cohort with independent kill switches for history access and note writes.

Done when: both Air and PRO complete the acceptance story with one persisted note, accurate source reads, and measured usage. A mocked model run alone is not release evidence; include a small real-provider evaluation with disclosed test accounts.

### Paid storage, durable work, and catalog breadth

#### TM-15 — Implement optional paid cloud history

- [ ] Complete. Depends on: TM-02, TM-03, TM-05, TM-07, TM-10. First device milestone does not depend on this task.
- Files: chat cloud adapter; sync outbox/reconciler; preferences UI; migrations/RLS; delete-account flow.

Steps:

1. Reuse or evolve the existing chat tables only after schema/RLS verification. Add revisions, tombstones, ownership indexes, bounded search indexes, and opt-in checks.
2. Implement explicit opt-in and scope selection (existing history or new chats only), resumable upload/download, and server-side entitlement rechecks.
3. Add the cloud implementation of list/search/read with identical results and source semantics to the local adapter.
4. Reconcile offline messages, renamed chats, concurrent edits, deletions, and stale devices without duplicate messages or resurrection.
5. Implement disable/expiry/refund/export/grace/purge behavior; handle subscription changes during sync. Do not turn all paid users' local Notes into cloud objects.
6. Make legacy beta cloud history migration explicit and recoverable, including for free accounts that already have server history.

Done when: a paid opt-in user can search synced history on a second device; free and paid opt-out users have no ongoing cloud history writes; stale devices cannot restore deletions; downgrade retains a documented export path and then purges.

#### TM-16 — Generalize durable execution and recovery

- [ ] Complete. Depends on: TM-02, TM-09, TM-10, TM-13. Integrate cloud history when TM-15 is available.
- Files: `api/pro-generation.ts`, `api/pro-stream.ts`, `api/_lib/proJobs.ts`, `trigger/proGeneration.ts`, new shared worker host and run migrations.

Steps:

1. Replace the PRO-specific orchestration payload with bounded run references and the common coordinator, preserving existing job reattachment during migration.
2. Implement checkpointing, worker leases/fencing, cursor replay, cancellation, waiting expirations, and cleanup using the selected scheduler's documented primitives.
3. Recheck entitlements, grants, tool revocation, and budget at resume. Do not persist an expiring browser JWT as the worker's long-term authority.
4. Persist confirmed effect receipts separately from generated prose; reconcile unknown outcomes before retries.
5. Let cloud-only work finish with the tab closed. Device history/new note commits pause when that device is unavailable. Paid synced history is accessible only while its mode and entitlement allow it.
6. Replace approval's one-shot completion with a resume operation on this coordinator.

Done when: worker interruption after a write never duplicates it, reconnect resumes at the correct event, closed-device Notes work is honestly pending, and completed cloud output remains available under the retention policy.

#### TM-17 — Make skills discoverable, reusable, and creatable

- [ ] Complete. Depends on: TM-11; executable assets also depend on TM-22.
- Files: `api/skills.ts`, `api/_lib/specialModePrompts.js`, skill manifests/storage, private skill settings.

Steps:

1. Move existing reusable skill instructions into versioned packages with short discovery metadata and preserve compatibility aliases.
2. Implement `skills_search`, `skills_read`, and private `skills_create`/`skills_update` tools. Keep instructions and references bounded and load them only when relevant.
3. Add the starter skills in section 4.4, including skill finder, skill creator, frontend design, past-chat research, and Notes editing.
4. Validate generated skills for schema, dependencies, references, scope, and attempted permission overrides. Store provenance and immutable versions.
5. Evaluate automatic skill selection and a “turn this process into a reusable skill” flow. Personalize privately without copying private examples into public packages.

Done when: both personas can discover a relevant skill, apply it, create a private reusable skill, and reuse it in a new chat without expanded authority.

#### TM-18 — Complete MCP integration through the shared executor

- [ ] Complete. Depends on: TM-04, TM-11, TM-16.
- Files: `api/_lib/mcpClient.ts`, Flight Controls services/types/UI, new MCP catalog/executor adapter.

Steps:

1. Connect MCP discovery and calls to the actual common runtime; prove the path with a controlled test server.
2. Page through remote tools and index metadata. Refresh on supported change notifications/TTL without opening every server for every user turn.
3. Bind exact tool versions/schemas to run definitions and support normalized structured results/artifacts. Keep hard per-call byte/time/schema limits.
4. Replace static auto-approve names with the grant broker, preserving existing trusted settings through an explicit migration.
5. Strengthen URL/network restrictions, transport cancellation, error isolation, and collision-safe provider aliases.

Done when: an Air and PRO request discovers a remote tool, calls it, consumes its result, and performs a subsequent action; pending permission resumes that sequence; a failing server does not disable local tools.

#### TM-19 — Add reusable connection management and first connectors

- [ ] Complete. Depends on: TM-04, TM-18.
- Files: connections API, token vault adapter, Settings/Flight Controls, selected provider manifests/handlers.

Steps:

1. Implement connect/reconnect/disconnect, connection ownership, scoped token references, refresh locking, and revocation.
2. Add Google Drive file discovery/read with a test account and the narrowest practical scopes; then Calendar read/create/update under explicit grants.
3. Add read/draft/send Gmail capabilities only after mutation idempotency/reconciliation tests and intended-recipient handling are proven.
4. Test missing scopes, revoked tokens, multiple accounts, quota errors, and grant reuse without repeated prompts.
5. Document setup and real-credential prerequisites. Keep unconfigured connectors visibly unavailable rather than showing successful mock results in production.

Done when: TM can use an authorized connected resource within main chat, another user cannot access its connection, revocation stops future access, and external action uncertainty is surfaced accurately.

#### TM-20 — Expand built-ins using the app descriptor pattern

- [ ] Complete. Depends on: TM-12, TM-13.
- Files: Contour modules, lifestyle repositories/pages where real data exists, app/tool manifests and cards.

Steps:

1. Audit each candidate's real storage and execution. Classify pure calculations, device operations, server calls, and UI-only placeholders.
2. Wrap useful pure tools first: calculator, date/time zones, unit conversion, structured JSON/CSV transforms, text counts, and encoding. Reuse tested logic outside React modules.
3. Add real shopping-list/calendar/recipe operations only after a shared repository, mutation receipts, and deep-link/card contract exist for each app.
4. Maintain a catalog inventory with task examples, supported personas, execution cost, and verification status. Start with roughly 30–50 useful reviewed operations rather than inflating counts with aliases.
5. Verify adding one new app requires its descriptor/handlers/cards and no new special-case branch in the core agent loop.

Done when: the catalog contains working capabilities with representative end-to-end tests; placeholder pages are not advertised as tools; inexpensive built-ins work in Air.

### Workflows, generated tools, and marketplace

#### TM-21 — Implement versioned workflow composition

- [ ] Complete. Depends on: TM-11, TM-16.
- Files: workflow schemas, interpreter, catalog packaging, invocation ledger.

Steps:

1. Define typed step bindings, tool-version dependencies, conditions, bounded iteration, and workflow inputs/outputs. Reject cycles without explicit bounds and undeclared variable access.
2. Implement sequential execution with checkpoints and per-step policy/budget checks. Give each child invocation a stable retry identity.
3. Expose workflow creation/validation/run tools and save successful workflows privately. A workflow cannot grant its steps capabilities the caller lacks.
4. Implement stop/partial/failure output with confirmed receipts and recovery instructions. Reconcile unknown external writes before continuation.
5. Test “find relevant chats → summarize → create note,” including failure after note commit and revocation between steps.

Done when: TM can assemble and reuse a workflow of existing tools; interruption resumes at the correct step without duplicate notes or external writes; nested execution uses the parent's budget.

#### TM-22 — Establish isolated cloud execution

- [ ] Complete. Depends on: TM-02, TM-04, TM-16.
- Files: sandbox provider interface/adapter, execution broker, private artifact store, infrastructure configuration and setup guide.

Steps:

1. Compare a small set of managed execution options using current official docs and a proof of concept. Record isolation, network control, language support, region, retention, startup latency, quotas, and measured cost. Select one behind an adapter; do not make multiple backends a first-release requirement.
2. Provision a disposable sandbox with pinned runtime images, resource limits, restricted egress, scoped input/output mounts, and cancellation. Production secrets stay outside it.
3. Define a narrow SDK for file input/output and brokered tool/network requests. Enforce the same grant and cost checks on every broker request.
4. Implement path traversal/zip expansion/file-size defenses, clean teardown, private artifact authorization, and execution receipts.
5. Add escape/egress tests, runaway process/resource tests, network timeout cases, and cross-user artifact isolation checks. Test actual infrastructure controls, not only application mocks.
6. Meter a bounded transform in Air and a heavier job in PRO. Keep the feature disabled until maximum charges and platform ceilings are verified.

Done when: a generated transform can run and return a valid artifact while attempts to reach internal hosts, other users' files, or production secrets fail at the execution boundary.

#### TM-23 — Ship the reviewed tool-template library

- [ ] Complete. Depends on: TM-11, TM-19 for authenticated external APIs, TM-21, TM-22.
- Files: template manifests, validators, restricted API executor, template builder and fixtures.

Steps:

1. Create the initial templates described in section 7; aim for 8–12 useful families with real tests, not arbitrary catalog counts.
2. Define typed template parameters, connection bindings, destinations/methods, response parsing, pagination, error mapping, and resource ceilings.
3. Add `templates_search` and `tools_create_from_template`, followed by validation and synthetic dry runs. Tool creation does not make a new connection or grant automatically.
4. Save passing private versions with content hashes and synthetic test reports. Remove task-specific secrets/records from reusable definitions.
5. Add a bounded OpenAPI import prototype behind a separate flag; reject hostile schemas, unbounded references, internal URLs, and unknown auth requirements.

Done when: TM recognizes a missing integration, creates a working parameterized tool from a template, tests it, and uses it for the current task without deploying arbitrary code into TM's server process.

#### TM-24 — Generate, validate, and repair custom code tools

- [ ] Complete. Depends on: TM-17, TM-22, TM-23.
- Files: `api/_lib/toolBuilder/*`, package artifact storage, private tool management, evaluation fixtures.

Steps:

1. Implement the draft/validation/testing/private-ready lifecycle, generation prompts, structured package outputs, and immutable versions.
2. Generate source against the restricted SDK and lock dependencies. Extract private task values into runtime inputs before storing a reusable tool.
3. Add static validation, synthetic tests, output-schema assertions, forbidden-operation probes, and bounded automatic repair. Record failed attempts and usage.
4. Register passing versions privately and invoke them through the same tool broker. A successful build cannot skip effect permissions or output verification.
5. Add failure cases where a tool cannot be made within budget or cannot safely access the needed service. Return partial work or the missing connection request instead of fabricated success.
6. Test reuse on a second synthetic user's input without retaining the original creator's values. The tool itself remains private until marketplace publication.

Done when: a missing capability is implemented, tested, executed, and privately reusable; failed tests block execution; generated code cannot mutate the trusted TM application or escalate its permissions.

#### TM-25 — Produce and inspect useful cloud artifacts

- [ ] Complete. Depends on: TM-13, TM-17, TM-22. Use generated tools from TM-24 when available.
- Files: artifact renderers/store, document/data/frontend templates and skills, isolated preview integration.

Steps:

1. Add downloadable structured files and documents with validated MIME, filenames, sizes, owner access, and stable artifact references. Add format-specific output checks.
2. Implement the frontend skill's real build → render → inspect → fix loop in an isolated environment. A code block in chat is not a completed website.
3. Add a metered cloud browser capability through the same executor for preview/verification and later authorized web tasks. Keep browser session credentials isolated; route effectful actions through the grant boundary.
4. Embed safe previews using TM's visual language and an isolated origin. Add download/open actions; publication is a separate tool with explicit destination grants.
5. Verify broken builds, malformed files, expired artifacts, unauthorized access, rendering failures, and mobile preview behavior.

Done when: TM can return a file or a functioning preview, inspect it before reporting completion, and distinguish “preview ready” from “published.” Heavy build/browser work is policy-configurable and initially PRO by default.

#### TM-26 — Automatically submit reusable tools to TM

- [ ] Complete. Depends on: TM-23, TM-24.
- Files: submission outbox/API, package sanitizer/scanners, private submission storage and migrations.

Steps:

1. Build a submission from the parameterized reusable specification, immutable source, dependency metadata, license/provenance, and synthetic tests. Never attach the originating chat/run transcript.
2. Scan every bundle file and report for credentials, private URLs, identifiers, personal data, embedded assets, and task-specific literals. Regenerate clean fixtures; quarantine ambiguous packages before upload.
3. Upload a sanitized candidate automatically under the disclosed product behavior. Use content-addressed deduplication, rate limits, and retryable outbox delivery.
4. Separate private use from submission status. A submission outage cannot erase a successful tool result or repeatedly rerun the user's work.
5. Show private tool and submission status in existing settings/catalog UI. Permit withdrawal before publication and record provenance.

Done when: creating a reusable tool yields a private working version and a sanitized review candidate; canary secrets and private chat text never reach the review endpoint; offline submission retries do not duplicate packages.

#### TM-27 — Build internal review and public marketplace

- [ ] Complete. Depends on: TM-26, TM-11, TM-04.
- Files: reviewer API/UI, review/publication migrations, catalog marketplace views, installation bindings.

Steps:

1. Implement server-verified reviewer roles, queue pagination, scan results, source/dependency diff, immutable hash display, and independent test reruns.
2. Implement approve/reject/request-changes/withdraw/revoke transitions with an audit record. Approval publishes only the reviewed hash and approved dependencies.
3. Add searchable public listings and private installation/configuration. Reuse current settings/shop styling where appropriate; do not imply existing physical-goods Shop data is a software marketplace.
4. Resolve each user's connections and grants at install/run time. New versions cannot silently add privileges or replace the pinned executable.
5. Add abuse reports, review throttling, duplicate handling, emergency quarantine, and dependency-aware revocation. Block revoked versions even when nested or already queued.

Done when: user A's generated tool can be approved by TM and used by user B with B's own configuration; B cannot access A's data; creators cannot self-approve; a revoked version stops everywhere.

### Verification and launch

#### TM-28 — Close migration, deletion, and recovery gaps

- [ ] Complete. Depends on: TM-15, TM-16, TM-27. Run partial checks earlier for each milestone.
- Files: schema/retention cleanup jobs, account deletion, import/export, recovery UI, launch documentation.

Steps:

1. Test all data lifecycles across device history, optional cloud sync, Notes, temporary run data, connection tokens, private tools, submissions, and artifacts.
2. Verify free-user cloud legacy migration and paid disable/expiry behavior with recoverable exports, failed downloads, and multiple devices. Do not drop tables used by the paid adapter.
3. Test workspace/account changes, browser storage pressure/eviction recovery, scheduler restarts, permission revocation, and package revocation during execution.
4. Audit logs/events/analytics with canary private data. Verify cleanup against actual services and note provider-side limits precisely.
5. Reconcile `CLAUDE.md`, `production-check.md`, privacy/account copy, and this plan with what shipped. Carry unresolved older launch gates into the release checklist.

Done when: each deletion/expiry path has verified results, no contradictory device-only/cloud claims remain, and recovery never silently loses or re-uploads a user's data.

#### TM-29 — Run quality, cost, and reliability gates

- [ ] Complete. Depends on: TM-14 for first release; all enabled later capabilities for subsequent releases.
- Files: evaluation corpus/harness, CI configuration, cost reports, release dashboards.

Steps:

1. Build the evaluation cases in section 11 and run them for both personas, including model/provider fallback variants actually enabled in production.
2. Add deterministic tests for security/data invariants and repeated real-provider trials for task completion/selection quality. Label mocks separately from paid API evidence.
3. Measure per-success and per-attempt cost, tool latency, discovery overhead, context size, sandbox startup, queue wait, and cancellation spend. Include failed repair attempts.
4. Exercise expected launch concurrency and a burst above it. Verify reservations, queue limits, cooldowns, platform ceilings, and partial-result recovery.
5. Tune Air budgets/capability availability first where low-cost tasks fail; raise complexity restrictions only from measured data. Populate actual maximum charges before enabling paid operations.

Done when: deterministic isolation/idempotency gates pass, completion targets are measured for each persona, and every enabled capability has an enforced cost ceiling. No “all tests pass” claim may include unexecuted infrastructure tests.

#### TM-30 — Release in stages with operational controls

- [ ] Complete. Depends on: the tasks for the selected milestone, TM-29, and relevant `production-check.md` launch gates.
- Files: feature flags, deployment configuration, `docs/agent/runbook.md`, capability release inventory.

Steps:

1. Deploy additive migrations before dependent code, with compatible client/server event versions. Test a fresh install and an existing account upgrade in staging.
2. Start with an internal cohort, then a small opt-in beta, then wider availability after measured gates pass. Review failed traces using redacted metadata and authorized test data.
3. Provide independent switches for device writes, cloud sync, connectors, sandbox/code generation, submissions, and marketplace execution. A catalog problem must not take plain chat offline.
4. Document revoke/disable/rollback procedures, budget spikes, provider outage, bad package publication, unknown external writes, retention cleanup failures, and sync incidents.
5. Use forward-compatible rollback: stop new runs, preserve receipts and local data, drain/cancel safely, then roll back code. Do not delete newly created user notes or replay completed writes.

Done when: release owners can disable a faulty capability quickly, affected users receive an accurate task state, and a rehearsal demonstrates recovery without duplicate actions or data loss.

## 10. Execution order and release boundaries

This is an incremental program, not one large PR. No fixed calendar estimate is asserted before the baseline, provider access, and sandbox choice are known. Keep tasks small enough that an agent can demonstrate their acceptance criteria in one handoff.

| Milestone | Required work | User-visible result |
| --- | --- | --- |
| M0: foundation | TM-00 → TM-01; TM-02 and TM-04; baseline storage work | Verified contracts, data policy, execution controls |
| M1: TM acts across its apps | TM-05 → TM-06/TM-07; TM-08 → TM-09 → TM-10/TM-11 → TM-12 → TM-13 → TM-14; relevant TM-29/TM-30 gates | Air and PRO find past conversations and create/edit a real note in chat; Healthcare tools work in normal chat |
| M2: paid sync and durable work | TM-03 → TM-15; TM-16; relevant recovery/cost gates | Optional paid cross-device history and resumable cloud tasks with honest device waits |
| M3: broad useful catalog | TM-17, TM-18 → TM-19, TM-20, TM-21 | Skills, connected accounts, more TM app tools, reusable workflows |
| M4: TM makes missing tools | TM-22 → TM-23 → TM-24; TM-25 | Isolated custom execution, tested private tools, files and working frontend previews |
| M5: shared tooling ecosystem | TM-26 → TM-27 → TM-28; final TM-29/TM-30 gates | Automatically submitted reusable tools, TM review, marketplace reuse |

TM-04 needs an entitlement interface, not live paid checkout, to ship the device-only milestone. Keep paid features disabled until TM-03 is verified. TM-16 can initially use device waits without requiring TM-15; cloud history support is added when eligible sync is ready. M1 does not require an external connector or a code sandbox.

For independently assigned future agents, contracts must land before dependent work. Notes extraction and history indexing can proceed independently once storage contracts are stable; provider adapters and local repositories can also be separate tasks. Do not have two agents edit `api/ai-proxy.ts`, `useChat.ts`, or the same migration sequence simultaneously without explicit file ownership. This document does not require automatic subagent spawning.

Use separate feature flags, default off until their milestone passes:

```text
agent_runtime_v2
agent_history_tools
agent_notes_tools
agent_healthcare_tools
paid_cloud_history
agent_durable_runs
agent_skills_v2
agent_connectors
agent_workflows
agent_sandbox
agent_tool_generation
agent_tool_submissions
agent_marketplace
```

Flags control rollout; authorization still runs server-side. Store resolved policy/version with run metadata so incidents can be reproduced without retaining private prompts.

## 11. Acceptance and evaluation matrix

| Case | Required observation |
| --- | --- |
| Jobs/Musk assignment, Air | Relevant actual chats read, one note committed, correct “Open in Notes,” cost recorded |
| Same request, PRO | Same tool capabilities and result semantics, larger budget only where configured |
| Generic titles | Message-content search finds discussion despite unhelpful titles |
| Date ambiguity | Last-month interval uses user time zone and message timestamps; no silent search widening |
| Missing history | TM reports no accessible matching discussion; it does not invent recollection |
| Large archive | Metadata listing stays bounded; only selected message windows reach the model |
| Excluded/deleted chat | Not discoverable/readable via query, stale ID, index, or prior source link |
| Follow-up edit | Same note updated; stable ID and reversible version retained |
| Manual edit during generation | Conflict detected; user changes not silently overwritten |
| Retry after local commit | One note/version effect; receipt replayed, no duplicate write |
| Browser closes before save | `waiting_device`; no “Saved” until the device commits |
| Free signed-in user | Device history only; no automatic Supabase history upload |
| Paid but opted out | Same device-only behavior despite payment or PRO selection |
| Paid opt-in | Selected history syncs, second-device search works, source references resolve |
| Downgrade during sync | New sync stops, pending batches recheck entitlement, export/grace/purge policy works |
| Offline stale device | Deleted chats remain deleted after reconnection |
| Account switch on shared device | Previous account's chats/notes are not visible to the new run |
| Main-chat Healthcare | Actual catalog lookup and exact record link; no fabricated medical-record operations |
| Dynamic discovery | A selected tool becomes callable next turn without sending the entire catalog |
| Fragmented transport | Every byte split and multi-byte boundary decodes correctly; terminal state explicit |
| Tool-call denial/expiry | Same run handles the result and may use a permitted alternative |
| Revoked grant/version | Loaded, queued, resumed, and nested invocations all stop correctly |
| Wrong-user resource ID | Rejected by storage/executor boundary for chat, note, run, connection, artifact, package |
| Malicious old chat/tool output | Cannot grant permissions, publish tools, send unrelated data, or override task scope |
| Remote write timeout | Unknown outcome recorded; reconcile before any retry |
| Concurrent spend | Atomic reservations prevent overspend; cancelled/failed work reconciles accurately |
| Missing template capability | TM builds/tests/uses a parameterized private tool or reports the exact blocker |
| Bad generated tool | Validation/test failure prevents execution; repair is bounded and metered |
| Sandbox escape/egress | Infrastructure blocks forbidden destinations/files/process behavior |
| Submission canary data | Private values never appear in uploaded source/tests/reports/metadata |
| Private tool without review | Usable by creator under policy; never public or visible to another user |
| Marketplace approval | Only immutable approved hash discoverable publicly; reviewer authorization enforced |
| Marketplace reuse | Recipient supplies their own connection/configuration; creator data is absent |
| Package revocation | Direct and dependent workflow execution stop; existing receipts remain readable |
| Frontend/file creation | Artifact exists, renders/validates, is privately accessible, and has truthful status |
| UI compatibility | Existing themes/mobile/keyboard flows preserved; no raw tool JSON in the main user flow |

Proposed initial quality targets:

- All deterministic ownership, authorization, save-receipt, deletion, stream-framing, and budget invariants must pass.
- At least 90% successful completion on a versioned ordinary-task corpus for each launch persona, measured across at least 30 seeded scenarios with repeated real-provider trials. Publish per-scenario failures; do not hide weak Air performance in a combined average.
- The first story must have a verified real-provider success in each persona plus deterministic failure/recovery coverage before M1 release.
- In a representative 500-chat device fixture, metadata listing and lexical search should normally return within 500 ms on the agreed test device; record p50/p95 and a realistic lower-powered mobile result. Adjust index implementation from measurements.
- Catalog search should stay below 500 ms p95 in a warmed 1,000-manifest fixture, excluding external connection discovery. Keep active tool definitions under a configurable schema-token cap; begin experiments at 4,000 tokens for Air and 8,000 for PRO.
- Measure user cost targets before selecting final pricing. Report full attempts and repair costs as well as cost per successful task. No fixed dollar target is invented without provider rates and expected launch volume.

Targets are planning choices and can be changed with recorded evidence. Security/data integrity invariants are release gates, not averages.

## 12. Instructions for the next Codex agent

TM-00 is complete as a local/source baseline and TM-01 shared contracts are verified; TM-02 now has local controls but remains incomplete pending service verification. Resume TM-02 before its dependent tasks. Read `codex.md`, `status.md`, and `docs/agent/baseline.md` first. Do not implement the entire document at once, and do not substitute a planning-only change for an implementation task assigned later.

For each task:

1. Read `superplan.md`, relevant repository instructions, and overlapping `production-check.md` sections. Verify the cited behavior in the current checkout.
2. Check dependencies and claim one bounded task. Update its checkbox only after its “Done when” conditions are verified.
3. Prefer existing UI, data, and provider implementations. Introduce adapters and shared contracts before replacing callers. Keep unrelated changes out of the task.
4. Write migrations with explicit ownership/RLS/indexes and a tested deployment order. Do not run destructive production migrations or vendor purchases because they appear in this plan.
5. Run `npm run typecheck`, `npm run lint`, `npm test`, and `npm run build` as applicable. Add targeted tests for new execution/data invariants; verify user-visible changes in the browser. Report baseline failures separately.
6. Use actual provider/infrastructure tests for claims that depend on those services. If access is missing, finish local work and mark the exact external acceptance check pending; do not mark the whole task complete.
7. Record the implementation summary, verification evidence, remaining issues, and next eligible task in the log below. No commit, push, or deployment unless the active user request authorizes it.

Suggested task prompt:

```text
Implement TM-<number> from superplan.md in this repository.
Read its dependencies, architecture contracts, and acceptance criteria first.
Verify the current code and relevant production-check.md tasks before editing.
Preserve TM's UI and follow the shared runtime/data/permission boundaries.
Complete the task, run the appropriate checks, and update its status/evidence.
If an external prerequisite blocks an acceptance check, state exactly what
remains unverified and leave the task unchecked. Do not implement unrelated tasks.
Do not commit, push, purchase infrastructure, or deploy without authorization.
```

### Implementation log

| Task | Status | Evidence / remaining checks | Next eligible task |
| --- | --- | --- | --- |
| Planning | Complete | Owner requirements and paid opt-in history decision captured; repository inspected; architecture references checked. No application code, schema, billing, or deployment changed. | TM-00 |
| TM-00 | Complete: local/source baseline, 2026-09-06 | [Baseline and evidence](docs/agent/baseline.md): no dependencies; locked install; typecheck 0 errors; lint 136 existing errors + 5 warnings; 24 unit tests and build pass with public fixture env (unconfigured test/build fail). Storage map, static schema fixture, 10 desktop/mobile references plus failure/history captures, Notes/history reload observations, corrected architecture and Gate LS D1 exception; `codex.md` / `status.md` added. No product files changed. Step 3 fallback used: no authorized staging credentials, so live schema/RLS, auth, provider, Trigger and MCP verification remain prerequisites, not passing tests. No next-task implementation. | TM-01 |
| TM-01 | Complete: shared contracts, 2026-09-06 | [Contracts and verification](docs/agent/contracts.md): TM-00 dependency checked; shared strict schemas, version rejection, canonical SHA-256 arguments, opaque execution context, local/cloud repository and executor interfaces, client/server compatibility exports and explicit TS inclusion. 61 tests pass (37 new deterministic contract cases); typecheck/build pass; lint unchanged at 136 errors + 5 warnings. Browser chat/Notes navigation and baseline note reload verified. No live runtime migration or service-integration claim. | TM-02; TM-04/TM-08 also dependency-eligible, not started |
| TM-02 | Incomplete: local controls implemented, live verification blocked (2026-09-07) | [Lifecycle inventory, migration protocol and evidence](docs/agent/data-lifecycle.md). TM-00/TM-01 dependencies verified. Durable PRO dispatch/worker gates, recovery expiry, protected disabled-by-default processing cleanup, account-deletion failure handling, media no-store/content-log removal and truthful privacy/signup copy. 90 tests pass (23 retention + 6 history-validation additions since TM-01), typecheck/build pass; separately authorized lint cleanup reaches 0 errors and 0 warnings. Live Trigger read-only authentication works without a project reference. The duplicated local Supabase key was corrected and public Auth/table probes return 200; actual settings, deployed RLS/cleanup, processor/backups/log deletion and staging account UI remain unverified. No cloud purge or direct deployment performed. | Resume TM-02; no next task started |
| Owner-requested lint cleanup | Complete: 2026-09-07 | Removed 136 errors and 5 warnings without weakening rules. Typed provider messages/tools/requests, database joins/JSON boundaries, YouTube/browser APIs and caught errors; split React context and icon/menu exports into refresh-safe modules. Six synthetic history validation tests cover retry/attachment preservation, legacy IDs and malformed input. 90 total tests, typecheck, lint and build pass. Browser signup/privacy and guest import/reopen checks pass; [verification and remaining rough edges](docs/agent/data-lifecycle.md#verification-and-exact-blockers). | Resume TM-02 external verification; no next roadmap task started |

### Architecture choices to keep explicit during implementation

- Do not recreate the agent loop separately for Air, PRO, MCP approvals, templates, and background work.
- Do not turn “many tools” into thousands of schemas added to every prompt.
- Do not use memory summaries as a substitute for actual past-chat reads.
- Do not create notes only inside a chat bubble or use navigation state as the sole saved-object identity.
- Do not equate a selected persona, installed tool, loaded skill, or package annotation with permission to execute.
- Do not run generated code in TM's trusted application process or authenticated browser origin.
- Do not publish generated packages before TM review or upload private task records as reusable tooling.
- Do not let optional paid cloud history silently change free users' storage or opt paid users in automatically.
- Do not make useful low-cost Air actions depend on paid code execution or marketplace availability.
- Do not mark the whole program complete when only the first milestone works; each later capability has its own release gate.
