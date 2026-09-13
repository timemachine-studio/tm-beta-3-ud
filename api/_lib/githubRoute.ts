/**
 * The GitHub side of /api/mcp-servers?github=<action>.
 *
 * Folded into the connected-services route rather than given its own file:
 * Vercel deploys one Function per file under api/, and this project is at
 * the limit (tests/api/deployableSurface.test.ts). The user is already
 * verified by the time this runs.
 *
 * Actions: status · connect · exchange · disconnect · repos · branches ·
 * clone · push. Clone streams NDJSON — a repository can be far bigger than a
 * buffered response — and push is bounded by the request size limit, which
 * is fine for the deltas it carries.
 */

import { z } from 'zod';
import type { VercelRequest, VercelResponse } from './vercelTypes.js';
import type { AuthenticatedRequestUser } from './auth.js';
import { apiErrorBody } from './errors.js';
import { parseOrReject } from './validation.js';
import { credentialsAvailable } from './mcpCredentials.js';
import {
  GithubError,
  accessTokenFor,
  authorizeUrl,
  cloneBranch,
  completeConnection,
  deleteConnection,
  githubAppConfig,
  installUrl,
  listBranches,
  listRepositories,
  loadConnection,
  mintState,
  pushChanges,
  verifyState,
} from './github.js';

const repoName = z.string().min(1).max(100).regex(/^[A-Za-z0-9_.-]+$/);
const branchName = z.string().min(1).max(200).regex(/^[^\s~^:?*[\\]+$/).refine(value => !value.includes('..') && !value.endsWith('.lock') && !value.startsWith('/'), 'not a valid branch name');

const exchangeSchema = z.object({ code: z.string().min(1).max(200), state: z.string().min(1).max(2000) });
const branchesSchema = z.object({ owner: repoName, name: repoName });
const cloneSchema = z.object({ owner: repoName, name: repoName, branch: branchName });
const pushSchema = z.object({
  owner: repoName,
  name: repoName,
  base: branchName,
  expectedHead: z.string().regex(/^[a-f0-9]{40}$/i),
  branch: branchName,
  title: z.string().min(1).max(256),
  body: z.string().max(20_000).default(''),
  changes: z.array(z.object({
    path: z.string().min(1).max(512),
    content: z.string().max(600_000).nullable(),
    base64: z.string().max(800_000).optional(),
  })).min(1).max(1_000),
});

/** Where GitHub sends the user back. The SPA route posts the code here. */
function callbackUri(req: VercelRequest): string {
  const proto = (req.headers['x-forwarded-proto'] as string | undefined)?.split(',')[0] || 'https';
  const host = (req.headers['x-forwarded-host'] as string | undefined) || req.headers.host || '';
  return `${proto}://${host}/github/callback`;
}

function fail(res: VercelResponse, error: unknown) {
  if (error instanceof GithubError) return res.status(error.status).json(apiErrorBody(error.code, error.message));
  console.error('GitHub route failed:', error instanceof Error ? error.message : error);
  return res.status(500).json(apiErrorBody('UNKNOWN', 'GitHub request failed'));
}

export async function handleGithubRequest(req: VercelRequest, res: VercelResponse, user: AuthenticatedRequestUser, action: string) {
  const config = githubAppConfig();
  const configured = !!config && credentialsAvailable();

  if (action === 'status') {
    if (!configured) return res.status(200).json({ configured: false, connected: false });
    try {
      const row = await loadConnection(user.id);
      return res.status(200).json({ configured: true, connected: !!row, login: row?.github_login, installUrl: installUrl(config!) });
    } catch (error) {
      return fail(res, error);
    }
  }

  if (!configured) {
    return res.status(503).json(apiErrorBody('UNAVAILABLE', 'GitHub is not configured on this deployment: set GITHUB_APP_SLUG, GITHUB_APP_CLIENT_ID, GITHUB_APP_CLIENT_SECRET and MCP_CREDENTIAL_KEY.'));
  }

  try {
    switch (action) {
      case 'connect': {
        const returnTo = typeof req.query?.returnTo === 'string' ? req.query.returnTo : '/max';
        const state = mintState(config!, user.id, returnTo);
        return res.status(200).json({ url: authorizeUrl(config!, callbackUri(req), state) });
      }
      case 'exchange': {
        if (req.method !== 'POST') return res.status(405).json(apiErrorBody('BAD_REQUEST', 'POST required'));
        const body = parseOrReject(res, exchangeSchema, req.body || {});
        if (!body) return;
        const state = verifyState(config!, body.state);
        if (!state || state.userId !== user.id) {
          return res.status(400).json(apiErrorBody('BAD_REQUEST', 'This GitHub sign-in did not start from this account, or it expired. Start again.'));
        }
        const { login } = await completeConnection(config!, user.id, body.code, callbackUri(req));
        return res.status(200).json({ connected: true, login, returnTo: state.returnTo });
      }
      case 'disconnect': {
        if (req.method !== 'POST') return res.status(405).json(apiErrorBody('BAD_REQUEST', 'POST required'));
        await deleteConnection(user.id);
        return res.status(200).json({ connected: false });
      }
      case 'repos': {
        const { token } = await accessTokenFor(config!, user.id);
        return res.status(200).json({ repos: await listRepositories(token) });
      }
      case 'branches': {
        const query = parseOrReject(res, branchesSchema, req.query || {});
        if (!query) return;
        const { token } = await accessTokenFor(config!, user.id);
        return res.status(200).json({ branches: await listBranches(token, query.owner, query.name) });
      }
      case 'clone': {
        if (req.method !== 'POST') return res.status(405).json(apiErrorBody('BAD_REQUEST', 'POST required'));
        const body = parseOrReject(res, cloneSchema, req.body || {});
        if (!body) return;
        const { token } = await accessTokenFor(config!, user.id);
        // Headers go out before the first file, so a failure after that is
        // an `error` line, not a status code. The client treats a stream
        // without a `done` line as failed.
        res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
        res.setHeader('Cache-Control', 'no-cache');
        try {
          const summary = await cloneBranch(token, body.owner, body.name, body.branch, (file) => {
            res.write(`${JSON.stringify({ type: 'file', ...file })}\n`);
          });
          res.write(`${JSON.stringify({ type: 'done', ...summary })}\n`);
        } catch (error) {
          const message = error instanceof GithubError ? error.message : 'Clone failed';
          console.error('Clone failed:', error instanceof Error ? error.message : error);
          res.write(`${JSON.stringify({ type: 'error', message })}\n`);
        }
        return res.end();
      }
      case 'push': {
        if (req.method !== 'POST') return res.status(405).json(apiErrorBody('BAD_REQUEST', 'POST required'));
        const body = parseOrReject(res, pushSchema, req.body || {});
        if (!body) return;
        const { token } = await accessTokenFor(config!, user.id);
        return res.status(200).json(await pushChanges(token, body));
      }
      default:
        return res.status(400).json(apiErrorBody('BAD_REQUEST', `Unknown GitHub action "${action}"`));
    }
  } catch (error) {
    if (res.headersSent) return res.end();
    return fail(res, error);
  }
}
