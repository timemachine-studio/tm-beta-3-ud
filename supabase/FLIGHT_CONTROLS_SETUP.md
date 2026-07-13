# Flight Controls setup

1. Open Supabase Dashboard -> SQL Editor -> New query.
2. Paste and run `supabase/migrations/flight_controls.sql`.
3. In Vercel, set `SUPABASE_SERVICE_ROLE_KEY` to the service-role key for the same Supabase project. This is required for server-side skill loading, MCP policy enforcement, approvals, and audit cleanup; never expose it as a `VITE_` variable.
4. Open Table Editor -> `flight_control_catalog`. The three bundled skills should be present.
5. Add MCP servers with the commented `INSERT` template at the bottom of the migration. Keep a server unpublished until its URL and tool policies have been reviewed.
6. For shared authentication, create a Vercel environment variable beginning with `MCP_` and put only that variable's name in `mcp_auth_env_var`. Never put the token itself in Supabase.
7. Put every usable MCP tool in `mcp_allowed_tools`. Put only vetted read-only tools in `mcp_auto_approve_tools`; every other allowed tool asks the user for one-time approval.
8. Set `is_published` to `true`, deploy, sign in, and enable the server under Brand menu -> Flight Controls.

MCP servers must expose a remote HTTPS endpoint using Streamable HTTP or legacy HTTP/SSE. Local `stdio` servers cannot run from the hosted web app.

Flight Controls are intentionally available only to signed-in, private TimeMachine PRO chats. Public/shared and group chats do not receive enabled skills or MCP tools. Pending approvals expire after ten minutes, and audit rows are retained for thirty days.
