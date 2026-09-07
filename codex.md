# Codex handoff

Read this file with `CLAUDE.md`, `status.md`, the assigned task in `superplan.md`, and relevant `production-check.md` sections. The task checklist and implementation log in superplan are authoritative; status.md is a short handoff, not a second roadmap.

## Working rules

- Work on one assigned task. Verify every required dependency before edits; stop if it is incomplete rather than implementing another task.
- Preserve TM's existing UI and stack. Use shared runtime, provider, storage and permission contracts from the plan; do not invent parallel implementations.
- Follow the current owner's D1 decision: free device-only personal history; paid device-only by default; optional cloud sync requires verified entitlement and explicit opt-in. Persona selection is not a subscription grant.
- Verify source before trusting historical issue counts. Record deterministic fixtures separately from real service checks. Never mark an external acceptance criterion verified from mocks.
- Finish the task's acceptance checks before checking it off. Record commands, failures, environment prerequisites, rough edges, and next eligible task in the implementation log. Update status.md to match.
- No commit, push, deploy, purchases, or destructive production changes under the current authorization. Git metadata is present in this checkout as verified during TM-01; inspect status and preserve unrelated user changes.
- Keep credentials out of source, logs, screenshots, and VITE-prefixed configuration. Do not query production merely because an example references it.

## Baseline and verification

`docs/agent/baseline.md` is the TM-00 source of evidence, including command logs, static schema fixture, storage data-flow map and reference screenshots. Start there rather than repeating its audit or treating its missing live checks as passed.

Use Node 22.x and `npm ci`. Run typecheck, lint, tests and build for product changes, then appropriate browser checks. Latest verification (2026-09-07): 0 TypeScript errors, 0 lint errors/warnings after the owner-requested cleanup, and 90 tests passing. TM-02 remains unchecked pending real retention/deletion evidence; see status.md and docs/agent/data-lifecycle.md. TM-01 historical evidence remains in docs/agent/contracts.md. Vite requires public Supabase variables for tests/build; the baseline documents explicit placeholder commands for local-only checks. Shared contracts are explicitly included in TypeScript and exposed through client/server compatibility entry points.

`src/types/database.ts` is handwritten. Existing migrations cannot reconstruct the full database. Before cloud schema work, obtain a named authorized staging/development environment and verify schema/RLS; do not overwrite types with guesses.

No new runtime code was introduced by TM-00. Do not treat docs/agent evidence fixtures as application data, a database migration, or new executable contracts.
