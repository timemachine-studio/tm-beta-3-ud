# TimeMachine capability system: what works and what remains

Updated 2026-09-23. This replaces the September 6 implementation plan. The old plan mixed verified behavior, proposed architecture, and dated audit notes. This file separates them. `production-check.md` still tracks general launch work; this file covers the AI capability system.

## The product we are building

Someone should be able to ask TimeMachine for an outcome in ordinary chat. Air, PRO, and Girlie should answer directly when they can, find a capability when they need one, use a connected app or TM app with the right permission, and show what actually changed. A request about an earlier chat should read that chat. A request to revise a saved note should revise that note, not create a near-duplicate.

Reusable tools are shared infrastructure. When a signed-in user's TM creates and tests a generic tool, it attempts to publish it to the central registry automatically. No moderator preapproval is required. Operators can revoke a bad version. A personal workflow goes the other direction: it belongs only to its account, syncs across that account's devices, and is never made public merely because the agent used it.

The shared registry must hold reusable code and metadata, not chat transcripts, credentials, or a user's private examples. A publication screen can catch common secrets, but it cannot prove arbitrary generated code contains no private information. That is a real safety gap, not a footnote.

## Current state

| Area | State | Evidence and limit |
| --- | --- | --- |
| Main-chat actions | Working vertical slice | Air and PRO have live canaries for history to Notes, timers, tool use, and private skill reuse. Girlie follows the same normal-chat selection path but has not had a separate live canary. Max Mode and some special modes have deliberately closed tool sets. |
| Personal chat history | Device-only | Account-isolated IndexedDB, bounded search/read, and one-time legacy Supabase import. Signed-in storage fails closed if IndexedDB is unavailable. Old cloud rows remain for recovery. Attachment-complete export/import is unfinished. |
| TM Notes | Working vertical slice | Main chat can search, read, create, and edit a real note with an object card and deep link. Transactional versioning, undo, and cross-tab conflict coverage are incomplete. |
| Timers | Working vertical slice | Main chat can start and control device timers. Delivery still depends on browser/device notification conditions; this is not a server alarm service. |
| Private workflows | Cloud-backed for signed-in accounts | Owner-only `private_workflows` table with RLS. Existing device copies migrate on first use and remain as recovery copies. Guest workflows stay on that device. A workflow can list bounded steps and dependencies across built-ins, connected MCP tools, and shared tools. Reading one guides the agent; it is not a durable execution engine or a grant of access. |
| Generated tools | Python plus read-only composition | TM can test a Python function in the browser or validate a versioned plan of up to four TM Notes/chat read calls. Both use the same digest, registry, revocation check, and automatic publication. Composition does not yet include writes, MCP calls, arbitrary JavaScript, or API templates. This is a useful second runtime, not the whole proposed tool architecture. |
| Publication recovery | Device outbox added; live canary pending | An account-scoped IndexedDB outbox retries temporary registry failures on later app use and while chat is open, with backoff and digest idempotency. The card distinguishes queued, stopped, and confirmed states. Permanent refusals stop. A closed browser cannot upload in the background, and a lost device can still lose an unconfirmed package. |
| Central registry | Public, revocable versions | Published source, schemas, test cases, digest, author, and usage metadata live in Supabase. The browser rechecks a digest and current published status before running a registry tool, including a published copy in its originating chat. An operator can revoke a row through SQL, removing it from public search and installed pins; an unavailable status check fails closed. There is no moderator UI, prepublication review, private tool vault, or full content/privacy scanner. |
| Capability discovery | Indexed public search plus one catalog | The request starts with a small relevant shortlist. `find_tools` searches built-ins, already-discovered connected MCP tools, and the indexed public registry, then loads a few matching schemas. It no longer depends on fetching the first 300 popular tools. MCP pagination and semantic ranking are unfinished. |
| Connected services | Partial | Main Air-path MCP discovery and approval exist. Connection setup, coverage, grants, and PRO/Trigger parity need end-to-end audits. Do not describe this as a universal connector layer. |
| PRO execution | Working, with retention blocker | Trigger runs the shared agent loop and device bridge. Its input payload is an opaque job reference; the worker claims and scrubs the prepared request. Trigger output streams still contain generated content, and their actual retention/deletion contract is not resolved. |
| Safety and spending | Partial | Tool offers and browser execution are bounded. There is no persistent per-resource grant broker, atomic cost reservation, general run ledger, or isolated cloud runner for untrusted code. |

The two database changes are `supabase/migrations/private_workflows.sql` and `supabase/migrations/tool_registry_search.sql`. Both were applied to the production project on September 23. The indexed search returned a real published tool. A rolled-back RLS canary proved an owner could read a temporary workflow and a different account could not; a follow-up count proved no canary row remained. The current PRO worker is Trigger version `20260923.4`; the matching web/API release is Vercel deployment `dpl_BUfUZZAieXu7ByZKbimMBaa35tza`, aliased to `timemachinechat.com`. The public page returned 200 and the unauthenticated API route returned its expected 400. Signed-in cross-device workflow use and the full create-publish-discover-run-revoke path are separate release checks; do not mark them passed until observed.

## Decisions now in force

1. Creating a reusable tool means attempting central publication automatically after validation and tests. The user does not have to say "publish." A failed publication is visible and must not be described as shared.
2. Central tools are public without moderator preapproval. SQL revocation stops central discovery, installed pins, and execution of published code in the current browser. A moderator still needs an operational revoke surface and audit trail. A user can always write equivalent code outside the registry; revocation governs TM's published package, not general computation.
3. A personal workflow is private to the signed-in account and cloud-backed. It can use any capability the account actually has, but cannot grant one. Guest workflows remain on the current device until the guest signs in and explicitly imports them; silently mixing guest and account data is not acceptable.
4. Personal chat history remains on-device by default. Saving a private workflow to the cloud does not opt the user into cloud chat history or cloud Notes.
5. Shared packages never contain credentials, chat transcripts, note contents, or customer test data. Per-user connection secrets live behind the connector/grant layer, not in the package.
6. Arbitrary user-generated code never runs in the authenticated app origin or the Vercel/Trigger process. Python stays in its browser sandbox until a managed isolated execution service passes a separate proof of concept.

## What happens on a normal turn

The server resolves the account, persona, enabled connections, local capabilities declared by the browser, and a small catalog shortlist. It offers only schemas that fit the current mode and token budget. If the agent needs something else, `find_tools` searches the unified catalog and grants a bounded set of schemas for the next model step. A browser-owned operation suspends the server turn, commits on the device, returns a receipt, and resumes. PRO does this across Trigger jobs; Air does it through the streaming proxy.

This is still a turn-level loop. A closed tab, an approval pause, or a costly multi-app job does not yet have one durable coordinator that can recover every step. The UI should say "waiting" or "partial" when that happens, not "done."

## Work to complete, in dependency order

### 1. Close this release's loose ends

- Verify signed-in workflow create, read, update, and cross-device reuse against the deployed app. Database RLS passed a rolled-back owner/other-account canary, but browser-level account isolation still needs a two-account canary. Verify migration of an earlier device-only workflow and a cloud outage without pretending a save succeeded.
- Run an Air, PRO, and Girlie generated-tool canary. A tested tool should publish automatically, be found from a new chat via `find_tools`, execute at the published digest, and disappear after operator revocation. The local Air canary first hit a stale browser bundle; the server offered a device tool that bundle did not know. The client now advertises the composed executor explicitly, so old tabs will not receive it. A refreshed Air attempt timed out while its model providers returned 500/502 errors; the PRO attempt also failed to get a response. No tool was created by either attempt. Do not mark the production path passed yet.
- Exercise the outbox against a real temporary registry outage, browser restart, and account switch. Automated tests cover retry, backoff, thrown publisher errors, account isolation, and terminal refusals; they do not prove the entire network path.
- Strengthen the public-package scanner and add an operator quarantine/revoke view. Test the new execution-time status check against a live revocation. Pattern matching catches obvious keys and email addresses but is not a sufficient privacy review.

### 2. Broaden what TM can make

Python is one useful tool type, not the tool architecture. Introduce a versioned package manifest with an explicit runtime: browser Python, declarative API template, MCP adapter, or composed capability. Every package declares inputs, outputs, effects, network destinations, dependencies, tests, limits, and a content hash. A package can be public; credentials and account-specific configuration cannot.

The first declarative composition runtime is in place for read-only TM Notes and chat-history calls. Its source is a versioned JSON plan, not executable JavaScript. Input references are resolved without evaluation, the allowed tool names are checked again before execution, and the browser runs each step through the existing device executor. An older client must declare support before the server offers this runtime. Next, add output-to-step bindings and connected MCP reads only after each step rechecks the current account's connection, permission, and budget. A package cannot smuggle a write through a claimed dependency. For external HTTP APIs, use allowlisted templates and per-user secret references; do not let generated code fetch arbitrary URLs from the TM server. Add cloud code execution only after choosing and testing an isolated provider, including egress and resource limits.

Private workflows may use the same capability names and step format, but remain owner-only. Today those steps are instructions that the model follows. The next runtime must execute/checkpoint them as real operations, with outputs, retries, cancellation, and receipts.

### 3. Give actions a durable permission and budget broker

Persist grants scoped to account, capability, resource, destination, effect, expiry, and cost. Ask once when a request falls outside a grant. Recheck at execution, including inside a composed tool. Make writes and external actions idempotent; distinguish a definite failure from an unknown outcome. Reserve spend atomically across concurrent runs. A model or package description must never decide its own authority.

### 4. Finish discovery and the central network

Keep one catalog for built-ins, public versions, account installations, enabled MCP tools, and later API templates. Search metadata on demand, then load exact immutable definitions. Never download every tool into the prompt. Add MCP pagination/change refresh, better lexical ranking followed by measured semantic search if needed, account-scoped availability reasons, and health signals that do not override revocation. Build moderator revoke/quarantine controls and a package audit trail.

### 5. Make longer work recoverable

Use one run ID and event/receipt ledger across Air and PRO. Persist the active step, waiting permission/device/external state, cancellation, and committed app objects. Resume after a tab closes only when the next step needs no unavailable device data. Confirm each mutation before telling the user it happened. Preserve the same note or event ID on retries.

### 6. Settle data retention and launch operations

Verify Trigger streams, provider logs, Vercel logs, Supabase backups, generated media, and account deletion against the privacy copy. Finish the cleanup schedule and monitor it. Paid opt-in chat sync and billing remain separate product work: no subscription state should upload old history without explicit consent. Complete staging, secret rotation, spend ceilings, accessibility, and launch runbooks from `production-check.md`.

## Release tests that matter

- "Use what we discussed last month to write an assignment" finds the actual message ranges, makes one note with source links, and later edits that same note. A missing chat produces an honest limitation.
- "Set a five-minute timer" creates a timer receipt and the notification works under the documented browser conditions.
- "Build a reusable converter" tests it, publishes it without a separate publishing request, finds it in a different account through catalog search, and runs the exact version. A moderator can revoke it and the next run cannot invoke it.
- "Remember my meeting-brief process" saves a private multi-tool workflow. The same account uses it on another device; another account cannot list or read it. Its steps do not create calendar or Notes permission by themselves.
- "Connect my calendar and prepare tomorrow" uses a configured connection, asks only for missing grants, handles a denied write, and never claims an event was created without a receipt.

The system is complete when these stories pass in production and the retention, recovery, permission, and cost boundaries are observed, not merely represented by interfaces or unit tests.
