# TimeMachine capability network

## Product contract

TimeMachine answers directly when no capability is needed. When an action is
needed, it selects a bounded capability manifest, asks for consent where the
manifest requires it, executes through the declared runtime, records a receipt,
and resumes the same model turn with the result.

The first production vertical slice now includes normal Air/PRO chat, bounded
tool discovery, device-owned Notes/history/timers/Python, a shared generated
tool registry, and account-private cloud workflows. Browser actions suspend the
model turn, commit on the device, return a bounded receipt, and resume the same
turn. Raw provider tool/thinking syntax is filtered before it reaches chat.

Generated tools follow a stricter lifecycle:

1. `create_tool` writes a bounded Python function and tests it in the browser
   sandbox.
2. A publication screen rejects common secrets and private literals. The tool
   is then saved automatically to the shared registry. `publish_tool` remains
   as a retry path if that save failed.
3. The registry stores a public immutable version plus its SHA-256 digest.
4. Another signed-in instance can discover the published descriptor, run the
   code in its own browser sandbox, and pin the exact successful version.
5. A revoked, missing, or digest-mismatched pin is withheld. It is never
   silently upgraded to different executable code.

Private skills use a different boundary:

1. `private_skills_create` saves a reusable workflow when asked or when TM has
   built a repeatable process; ordinary one-off tasks are not saved.
2. Signed-in workflows use an owner-only Supabase table with optimistic
   concurrency. Earlier device copies are imported once and retained as
   recovery copies. Guests still use an isolated device workspace.
3. Later chats search metadata, then read one chosen skill. Instructions never
   grant tools, credentials, permissions, or authority.
4. A workflow can name bounded steps across built-ins, MCP, and public tools.
   These are guidance for the model, not a durable executor. Workflow content
   is never uploaded to the public tool registry.

## What syncs

The central network stores capability metadata, generated source, bounded test
cases, immutable version/digest, aggregate success/failure counts, and a user's
installed version pin. It does not store prompts, tool arguments, tool results,
chat content, provider credentials, or tokens.

Personal chat history stays in account-isolated IndexedDB. Signed-in private
workflows are cloud-backed and account-only; guest workflows stay on-device.
Existing signed-in cloud chat history is imported once as a recovery migration;
new personal chats do not write to the legacy cloud tables. The paid opt-in
cloud-sync adapter is not implemented yet.

PRO dispatch stores the full prepared request in a transient Supabase column.
Trigger receives only an opaque job id; the worker destructively claims and
nulls the request before model processing, and terminal cleanup also scrubs it.
Trigger's output stream still carries generated response text, so processor
output retention remains an explicit TM-02 blocker rather than a solved claim.

## Trust boundaries

- Registry rows are untrusted data and are schema-validated on publish, load,
  suspension, and device execution.
- Generated source cannot import browser, network, installer, process, or
  dynamic-code escape modules.
- The browser recomputes the digest before executing registry code.
- Session-local tools shadow registry tools with the same slug.
- SQL revocation removes a version from public search and installed pins. The
  browser also checks current published status before executing either a
  shared payload or a published copy kept in its originating chat. An
  unavailable status check fails closed.
- Published tools are gated by intent until a successful run pins them for the
  signed-in user; pinned tools are core capabilities at their exact version.
- Aggregate execution health is diagnostic metadata, not an authorization or
  ranking signal.

## Operational checks

- Apply `supabase/migrations/tool_registry.sql` before
  `supabase/migrations/tool_registry_network.sql`.
- Keep `SUPABASE_SERVICE_ROLE_KEY` server-only.
- Public-tool discovery uses the indexed `search_tool_registry` function and
  loads a small relevant shortlist. `find_tools` searches the registry again
  on demand alongside built-ins and already-discovered MCP tools.
- Validate the golden path with two chats: create and auto-publish,
  start a new chat, invoke it, then confirm the installed row pins the exact
  registry id/version/digest.
- Validate private workflows with two devices on one account: save in one,
  search, read and apply it in the other without public publication.
- Validate PRO privacy with a synthetic signed-in canary and confirm the newest
  `pro_generation_jobs` row is completed, claimed, and has a null
  `request_payload`.
