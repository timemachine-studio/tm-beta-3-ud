/**
 * Managing the MCP servers a user added for themselves.
 *
 * `user_mcp_servers` has no browser policies at all, deliberately — a policy
 * granting row access would grant access to the credential column with it. So
 * every read and write comes through here, where the JWT is verified, the
 * service-role client is scoped to that user's id by hand, and the ciphertext
 * is stripped from every response.
 *
 * Two things this route is responsible for that nothing downstream can undo:
 *
 *  - **Validating the URL before it is stored.** `mcpClient` revalidates at
 *    dial time, but refusing a private address here means the row never exists
 *    to be dialled, and the user finds out immediately rather than silently.
 *  - **Discovering the tool list before the server is usable.** An MCP server
 *    is only allowed to offer tools that are on its allow-list, and asking the
 *    user to type tool names would be absurd. So adding a server connects to
 *    it once, and what it advertises then becomes the allow-list.
 */

import type { VercelRequest, VercelResponse } from './_lib/vercelTypes.js';
import { z } from 'zod';
import { getAuthenticatedRequestUser } from './_lib/auth.js';
import { applyCors, hasAcceptableOrigin } from './_lib/cors.js';
import { apiErrorBody } from './_lib/errors.js';
import { parseOrReject } from './_lib/validation.js';
import { flightControlsAdmin, MAX_USER_MCP_SERVERS, type ServerFlightControl } from './_lib/flightControls.js';
import { discoverMcpTools } from './_lib/mcpClient.js';
import { credentialsAvailable, encryptCredential, McpCredentialError } from './_lib/mcpCredentials.js';
import { assertPublicUrl } from './_lib/safeUrl.js';
import { searchMcpRegistry } from './_lib/mcpRegistry.js';

const createSchema = z.object({
  name: z.string().min(1).max(80),
  description: z.string().max(400).default(''),
  serverUrl: z.string().url().max(2000),
  /** Sent once, encrypted here, and never returned. */
  bearerToken: z.string().min(1).max(4000).optional(),
  /** Tools to auto-approve. Anything else asks the user each time it is called. */
  autoApproveTools: z.array(z.string().max(120)).max(64).default([]),
});

const updateSchema = z.object({
  id: z.string().uuid(),
  enabled: z.boolean().optional(),
  autoApproveTools: z.array(z.string().max(120)).max(64).optional(),
});

const deleteSchema = z.object({ id: z.string().uuid() });

const discoverSchema = z.object({
  discover: z.string().max(120).optional(),
  limit: z.coerce.number().int().min(1).max(30).default(15),
});

/** A row as the browser is allowed to see it. The ciphertext never appears. */
function sanitize(row: Record<string, unknown>) {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    serverUrl: row.server_url,
    // Whether a credential exists, never what it is.
    hasCredential: row.auth_mode === 'bearer',
    allowedTools: row.mcp_allowed_tools ?? [],
    autoApproveTools: row.mcp_auto_approve_tools ?? [],
    enabled: row.enabled,
    createdAt: row.created_at,
  };
}

/** `Weather Tools!` → `weather-tools`, made unique against what the user has. */
function slugify(name: string, taken: Set<string>): string {
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 50)
    || 'server';
  if (!taken.has(base)) return base;
  for (let suffix = 2; suffix < 100; suffix++) {
    const candidate = `${base}-${suffix}`.slice(0, 62);
    if (!taken.has(candidate)) return candidate;
  }
  throw new Error('Could not find a free name for this server');
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  applyCors(req, res, 'GET, POST, PATCH, DELETE, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (!hasAcceptableOrigin(req)) return res.status(403).json(apiErrorBody('FORBIDDEN', 'Origin not allowed'));

  const user = await getAuthenticatedRequestUser(req);
  if (!user) return res.status(401).json(apiErrorBody('AUTH_REQUIRED', 'Sign in is required'));

  // ─── Registry search ────────────────────────────────────────────────────
  // Folded into this route rather than given its own file: Vercel deploys one
  // Function per file under api/, and this project has already failed a
  // production deploy by going over the limit. See
  // tests/api/deployableSurface.test.ts.
  if (req.method === 'GET' && req.query?.discover !== undefined) {
    const search = parseOrReject(res, discoverSchema, req.query);
    if (!search) return;

    const outcome = await searchMcpRegistry({ query: search.discover, limit: search.limit });
    return outcome.ok
      ? res.status(200).json({ servers: outcome.servers })
      : res.status(outcome.status).json(apiErrorBody(outcome.code, outcome.message));
  }

  // ─── List ───────────────────────────────────────────────────────────────
  if (req.method === 'GET') {
    const { data, error } = await flightControlsAdmin
      .from('user_mcp_servers')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true });
    if (error) return res.status(500).json(apiErrorBody('UNKNOWN', 'Could not load your servers'));
    return res.status(200).json({
      servers: (data || []).map(sanitize),
      // The UI needs to know before offering a token field, rather than
      // letting someone type a secret and then be told it cannot be stored.
      credentialsSupported: credentialsAvailable(),
    });
  }

  // ─── Add ────────────────────────────────────────────────────────────────
  if (req.method === 'POST') {
    const body = parseOrReject(res, createSchema, req.body || {});
    if (!body) return;

    if (body.bearerToken && !credentialsAvailable()) {
      return res.status(503).json(apiErrorBody(
        'UNAVAILABLE',
        'This deployment cannot store credentials yet. Servers that need a token are unavailable until MCP_CREDENTIAL_KEY is configured.',
      ));
    }

    const { count } = await flightControlsAdmin
      .from('user_mcp_servers')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id);
    if ((count ?? 0) >= MAX_USER_MCP_SERVERS) {
      return res.status(400).json(apiErrorBody('BAD_REQUEST', `You can add up to ${MAX_USER_MCP_SERVERS} servers`));
    }

    // Validated here as well as at dial time: the row should never exist.
    try {
      await assertPublicUrl(body.serverUrl, { protocols: ['https:'] });
    } catch (error: unknown) {
      return res.status(400).json(apiErrorBody(
        'BAD_REQUEST',
        `That server URL was refused: ${error instanceof Error ? error.message : 'invalid URL'}`,
      ));
    }

    let ciphertext: string | null = null;
    if (body.bearerToken) {
      try {
        ciphertext = encryptCredential(body.bearerToken);
      } catch (error: unknown) {
        const message = error instanceof McpCredentialError ? error.message : 'Could not secure that credential';
        return res.status(500).json(apiErrorBody('UNKNOWN', message));
      }
    }

    const { data: existing } = await flightControlsAdmin
      .from('user_mcp_servers').select('slug').eq('user_id', user.id);
    const slug = slugify(body.name, new Set((existing || []).map(row => row.slug as string)));

    // Connect once to find out what it offers. A server whose tools we cannot
    // list is one we could never call anything on, so this is also the check
    // that it works at all — better here than silently on a future chat turn.
    const probe: ServerFlightControl = {
      id: `probe-${slug}`, kind: 'mcp', owner: 'user', slug,
      name: body.name, description: body.description, skill_content: null,
      mcp_server_url: body.serverUrl,
      mcp_auth_mode: body.bearerToken ? 'bearer_user' : 'none',
      mcp_auth_env_var: null,
      ...(body.bearerToken ? { bearer_token: body.bearerToken } : {}),
      mcp_allowed_tools: [],
      mcp_auto_approve_tools: [],
      mcp_connect_timeout_ms: 15_000, mcp_call_timeout_ms: 30_000, mcp_result_char_limit: 12_000,
      sort_order: 1000, default_enabled: true,
    };

    // allowAllTools, because the allow-list is built *from* this probe.
    const discovered = await discoverMcpTools([probe], { allowAllTools: true });
    if (discovered.length === 0) {
      return res.status(400).json(apiErrorBody(
        'BAD_REQUEST',
        'That server did not answer with any tools. Check the URL and the token, then try again.',
      ));
    }

    const allowedTools = discovered.map(tool => tool.originalName).slice(0, 64);
    const allowed = new Set(allowedTools);
    // Auto-approval may only narrow, never widen, what the server offers.
    const autoApprove = body.autoApproveTools.filter(name => allowed.has(name));

    const { data, error } = await flightControlsAdmin
      .from('user_mcp_servers')
      .insert({
        user_id: user.id, slug, name: body.name, description: body.description,
        server_url: body.serverUrl,
        auth_mode: body.bearerToken ? 'bearer' : 'none',
        credential_ciphertext: ciphertext,
        mcp_allowed_tools: allowedTools,
        mcp_auto_approve_tools: autoApprove,
      })
      .select('*')
      .single();

    if (error || !data) {
      return res.status(500).json(apiErrorBody('UNKNOWN', 'Could not save that server'));
    }
    return res.status(201).json({ server: sanitize(data) });
  }

  // ─── Enable, disable, change auto-approval ──────────────────────────────
  if (req.method === 'PATCH') {
    const body = parseOrReject(res, updateSchema, req.body || {});
    if (!body) return;

    const { data: current } = await flightControlsAdmin
      .from('user_mcp_servers').select('mcp_allowed_tools')
      .eq('id', body.id).eq('user_id', user.id).maybeSingle();
    if (!current) return res.status(404).json(apiErrorBody('BAD_REQUEST', 'Server not found'));

    const update: Record<string, unknown> = {};
    if (body.enabled !== undefined) update.enabled = body.enabled;
    if (body.autoApproveTools) {
      const allowed = new Set((current.mcp_allowed_tools || []) as string[]);
      update.mcp_auto_approve_tools = body.autoApproveTools.filter(name => allowed.has(name));
    }
    if (Object.keys(update).length === 0) {
      return res.status(400).json(apiErrorBody('BAD_REQUEST', 'Nothing to change'));
    }

    const { data, error } = await flightControlsAdmin
      .from('user_mcp_servers').update(update)
      .eq('id', body.id).eq('user_id', user.id)
      .select('*').single();
    if (error || !data) return res.status(500).json(apiErrorBody('UNKNOWN', 'Could not update that server'));
    return res.status(200).json({ server: sanitize(data) });
  }

  // ─── Remove ─────────────────────────────────────────────────────────────
  if (req.method === 'DELETE') {
    const body = parseOrReject(res, deleteSchema, { ...(req.body || {}), ...(req.query || {}) });
    if (!body) return;

    const { error } = await flightControlsAdmin
      .from('user_mcp_servers').delete()
      .eq('id', body.id).eq('user_id', user.id);
    if (error) return res.status(500).json(apiErrorBody('UNKNOWN', 'Could not remove that server'));
    return res.status(200).json({ removed: true });
  }

  return res.status(405).json(apiErrorBody('BAD_REQUEST', 'Method not allowed'));
}
