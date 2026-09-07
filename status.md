# Current status

Updated 2026-09-07. Assigned work: resume TM-02 and clear the existing lint findings.

**Lint cleanup is complete: 0 errors, 0 warnings, with rules unchanged. TM-02 remains incomplete and unchecked.** TM-00/TM-01 dependencies are verified; local retention controls, cleanup hooks and corrected legal/auth copy are implemented.

Verification: 90 tests pass in 10 files, typecheck passes, lint passes, build passes. Six new history-boundary tests supplement the 23 mocked retention tests. Browser signup/privacy at default/mobile sizes and synthetic guest-history import/reopen/persistence were checked. These are not live deletion tests. See `docs/agent/evidence/tm-02` and the implementation log in `superplan.md`.

Correction: the configured Trigger secret successfully called the live runs-list API without a project reference. Missing `TRIGGER_PROJECT_REF` is not a runtime blocker. Both Supabase Auth and REST reject the locally configured public key with HTTP 401 / `Invalid API key`, before RLS or any table query. Its legacy `anon` JWT is unexpired, has no whitespace, and matches the project URL, so Supabase does not recognize that exact key as active; replace it with the project's current publishable (`sb_publishable_...`) or current legacy `anon` key and rerun both probes. A rotated JWT secret or superseded legacy key is the likely cause, but the dashboard's key history is required to distinguish them. Local environment variables do not establish Vercel's deployed configuration. Administrative cleanup requires privileged access or an equivalent scoped mechanism; ordinary app access does not universally require a service-role key.

Remaining TM-02 checks: actual schema/RLS and two-user isolation; observed transient cleanup/deletion; Trigger payload/stream/output/checkpoint removal; Supabase backups/CDN; Vercel logs/drains; enabled-provider controls; a monitored cleanup schedule; disposable-account deletion and signed-in UI verification. Keep durable PRO blocked until verified. No scheduler, deployment or real account deletion was performed.

Rough edges: baseline CSS import-order and large-bundle build warnings remain. Reloading an open guest chat returns home, although saved history reopens correctly. A synthetic local browser chat named “TM lint import verification” (id `tm-lint-browser-20260907`) may remain because the native delete confirmation did not complete through automation. No existing chat was removed.

Next agent: read `codex.md`, `superplan.md` and `docs/agent/data-lifecycle.md`; resume only the outstanding TM-02 checks. Preserve TM-01/TM-02 work, the lint fixes and the user's untracked `.gitignore`. Do not reintroduce the project-reference claim or mark mocks as service verification. Do not start another roadmap task, commit, push or deploy.
