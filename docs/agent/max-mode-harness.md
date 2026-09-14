# Max Mode harness review

Local engineering pass, 2026-09-12. Supports both existing repositories and new web projects. The owner confirmed browser-only execution for now. Auto may execute workspace commands without confirmation. Agent-initiated GitHub publication requires explicit approval.

The existing device-first design is a useful starting point: the server runs the model, the browser owns project files and executes tools, and each model leg is stateless. This pass keeps that design and repairs failures that could make the model's transcript disagree with the actual project.

## Changes made

| Area | Failure found | New behavior |
|---|---|---|
| Tool permissions | Hiding a schema was treated as enforcement. A provider could still emit a forbidden call. | Server dispatch accepts only tools offered on that iteration. The browser separately checks the mode, including Python, and refuses work after Stop. |
| Streaming | Splitting each network chunk on newlines discarded partial JSON frames. | The loop buffers incomplete frames and decodes UTF-8 across chunk boundaries, including a final frame without a newline. |
| Continuation | Server-only iterations disappeared when a later iteration suspended for device tools. | The suspension carries those prior call/result groups to the next leg. |
| Context cost | Tool outputs were trimmed only on the server. The browser kept sending growing argument/result histories and could exceed the 200-message schema limit. | Transport compaction measures serialized call/result groups, preserves complete groups, and summarizes earlier activity. It aims below the existing 160k-character budget. |
| Recovery | Checkpoints were saved only after handled failures and matched solely by prompt text. | The prompt is saved before the first request; every tool has a receipt saved before and after execution. Resume restores missing chat turns, checks a stable turn key, preserves uncertain outcomes, and rejects late checkpoint writes from older tasks. |
| Search and imports | Arbitrary regexes and ZIP inflation ran on the UI thread. | Search and ZIP extraction run in terminable workers with 10/15-second deadlines. Imports filter oversized/ignored files before decompression and cap compressed and expanded archive contents at 64 MB. |
| Preview | An empty console was treated as successful rendering even if no frame loaded. | Reports require a frame load, accept HTML messages only from the bound frame, and include WebContainer-forwarded browser errors. Plain HTML previews remain available without Node. |
| Runtime persistence | Sync examined only 400 files, silently skipped failures, and ignored deletions. | It scans the supported workspace, applies additions/edits/deletions in an IndexedDB transaction, and reports unsupported or oversized output. |
| Concurrent editing | A command could overwrite edits made in the editor while it ran. | Reconciliation compares actual baseline contents, preserves concurrent edits, and reports conflicts. The next command remounts the user version. |
| Runtime lifecycle | Commands could overlap; already-cancelled commands could start; output truncation hid the final error. | Commands and server startup are serialized. Cancellation is checked before execution, waits clean up listeners, switching projects stops the preview server, and output retains the tail. A process that fails to acknowledge termination blocks later commands rather than hanging indefinitely. |
| Editor | A delayed save could be cancelled on unmount or pick up another file's contents. | Each edit queues its captured path and content immediately. File components are keyed by session and path; stale reads are ignored. |
| Batch imports | Updates to existing files were counted as new files, while collisions within a batch were allowed. | Capacity counts unique paths and rejects file/directory conflicts. |
| Cloning | An incomplete clone cleared the existing project first. The recorded SHA could differ from the branch archive fetched later. | Files stage separately and replace the live project atomically after a complete stream. Archive downloads use the resolved commit. |
| Publication | A prompt sentence was the only PR approval boundary. Later pushes could overwrite unseen remote changes. | A dialog reviews the exact snapshot before it is sent. Approval applies once, cancellation denies it, and the server checks the expected remote commit before creating blobs/commits. Direct publication onto the base branch is refused. |
| Agent instructions | Auto was told to run every check and treat preview console output as verification. | It inspects scripts, starts with relevant checks, avoids repeated unchanged failures and unnecessary installs, and distinguishes preview availability from visual verification. |

Publication sends the reviewed snapshot even if the editor changes while the dialog is open. Those newer local edits remain local for the next push. Old clients without an expected commit must refresh before publishing. Workspaces pushed by an older client may need reconciliation because their stored baseline commit did not advance after a push.

No commit, deployment, or real GitHub publication was made.

## GitHub pass, 2026-09-14

The first version handled one shape only: clone an existing branch, push back as a pull request. That left no way in for a project started in the workspace, no way out of a stale baseline, and an "unlink" that did nothing. What changed:

| Gap | New behavior |
|---|---|
| No repository for a project started here | `create` action: a new repository under the user's account (needs the App's *Administration: write*), linked with an empty baseline, then a direct first commit of the workspace. A push that fails because the App is not installed on the new repository leaves the link in place with a message. |
| Empty repositories | A repository with no branches can be linked as-is. The first commit goes in through the Contents API (the Git Data API refuses refs in an empty repository), the rest of the files as an ordinary commit on top. |
| Pull-request-only publication | `mode: 'direct'` commits straight onto the tracked branch and opens nothing. The reviewed-snapshot approval and the stale-head check apply to both modes. |
| Stale baseline after the remote advanced (a merged PR, a deleted branch) | "Pull latest" fetches the branch into a staging area and merges by baseline: remote-only changes are taken, local-only kept, both-sided kept locally and reported. The baseline moves to the remote head; a tracked pull request is forgotten. Not a content merge. |
| Unlink | Removes the repository link and keeps the files. Previously the control only reset picker state. |
| Expired or revoked token | Errors with `AUTH_REQUIRED` show a "Connect GitHub again" control instead of dead text. |
| Clone over existing files | Confirmed first, with the file count. |

Still open: file modes and symlinks (5 above), idempotent publication receipts, and a real content merge for both-sided changes — today the user resolves those by hand in the editor and commits.

Separately, a runtime sync back that finds the container empty while the baseline is not now refuses to mirror that as deletions. The store is the only copy of the project; a torn-down or mid-wipe container must not empty it.

## Verification

- Full Vitest suite: 531 tests in 61 files passed.
- TypeScript and production build passed. Existing bundle-size and mixed static/dynamic import warnings remain.
- ESLint passed.
- Regression coverage includes byte-by-byte provider frames, forbidden tools, retained server iterations, 40-round transcript compaction, a 450-file runtime, command deletions, output tail retention, cancellation, command serialization, concurrent editor conflicts, import limits, failed clone recovery, approval cancellation, reviewed snapshot publication, and stale remote heads.
- A local browser fixture exercised the real approval component: repository/branch/title/body review, expandable file contents, Cancel, fresh approval on the next request, and the approved result. It performed no GitHub request.
- The same fixture verified editing file A and immediately switching to file B: A retained the edit and B retained its original contents.
- A second browser fixture ran a pathological regex against real IndexedDB content. The page remained responsive and the worker stopped at its deadline. An actual sandboxed HTML preview reported its intentional JavaScript error with `loaded: true`.

The Node lifecycle tests use a mocked WebContainer with real IndexedDB-compatible transactions through `fake-indexeddb`. The browser UI checks do not replace a live WebContainer/npm/model run. MX.5 and MX.6 remain open.

## Remaining work, in order

1. **Recovery receipts and undo.** Local receipts now survive a handled failure or tab close, including a prompt missing from chat history. A crash can still happen between an external side effect and its completion receipt. Those outcomes are recorded as uncertain; do not claim exactly-once execution. Add publication operation IDs and remote receipts before enabling automatic recovery of uncertain publications. File version history and per-change undo are separate work.
2. **Measure real tasks before increasing autonomy budgets.** Keep the current 12/24/40 round ceilings until MX.6 has evidence. Run both repo repair tasks and new-app tasks; record task completion, regressions, tool/model latency, input/output/cached tokens, retry counts and total cost. Store operational metrics without source contents. Compare prompt/tool changes against the same fixture tasks.
3. **Runtime ownership and compatibility.** An interactive shell and a background dev server can still mutate files outside a bounded command. The terminal's fixed-delay sync is not a command-completion protocol. Introduce a single runtime session controller with process IDs, background status/log polling, explicit completion, and a workspace lease across tabs. Test actual WebContainers on the supported browsers; isolation checks alone do not prove a runtime will boot.
4. **Workspace scale.** The existing 2,000-file and 512-KB-per-file limits still apply. Listing currently reads file records to derive metadata. A separate metadata index would reduce copying on large workspaces. Search and archive decompression now have worker deadlines, but overall workspace storage still needs a quota-aware product limit.
5. **Git fidelity and recovery.** Clone/push currently treats tracked files as regular files and does not preserve executable modes or symlinks. A network failure after creating a commit/ref but before returning a PR result is not idempotently recoverable. Preserve file modes and use a publication operation ID with a receipt/reconciliation route. Partial clones must continue tracking only files actually imported so skipped files are never inferred as deletions.
6. **Better context and review tools.** Add a structured task plan, persistent decision/checkpoint summary, current workspace diff, and verification records. The current activity compaction is deterministic and bounded; it is not semantic memory. Prefer these explicit records to a second model summarizer until task evaluations show a benefit. A loaded preview is not a screenshot or browser interaction trace; real visual checks need browser instrumentation.

The owner chose browser-only execution. Closing the tab stops active work; reopening Max Mode exposes the saved task for explicit resumption. There is no background server execution or new cloud project storage in this change.
