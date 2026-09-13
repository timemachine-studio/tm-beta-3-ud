/**
 * GitHub for Max Mode: the App's user-to-server tokens, and the two things a
 * workspace does with a repository — take a checkout, and push one back.
 *
 * A GitHub App rather than an OAuth app or a pasted token, because the App
 * is what lets the user choose *which repositories* TimeMachine can see,
 * repository by repository, and revoke that from GitHub's own settings. The
 * token we hold is the user's authorization of the App: it can only reach
 * the repositories the App is installed on, with the App's permissions
 * (contents and pull requests), and it expires.
 *
 * The token is encrypted at rest with the same key and cipher as MCP
 * credentials (mcpCredentials.ts) and is decrypted only to build one
 * outbound Authorization header. It never reaches a browser.
 *
 * Cloning uses the repository tarball — one request, however many files —
 * and unpacks it here. Pushing uses the Git Data API: blobs, a tree on top
 * of the base tree, a commit, a ref, a pull request. No git binary anywhere.
 */

import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import { decryptCredential, encryptCredential } from './mcpCredentials.js';
import { flightControlsAdmin } from './flightControls.js';
import {
  MAX_WORKSPACE_FILES,
  MAX_WORKSPACE_FILE_BYTES,
  isIgnoredWorkspacePath,
  normalizeWorkspacePath,
} from '../../shared/maxMode.js';

const GITHUB_API = 'https://api.github.com';
const USER_AGENT = 'TimeMachine-MaxMode';

export class GithubError extends Error {
  constructor(message: string, readonly status = 400, readonly code: 'BAD_REQUEST' | 'UNAVAILABLE' | 'AUTH_REQUIRED' | 'UNKNOWN' = 'BAD_REQUEST') {
    super(message);
    this.name = 'GithubError';
  }
}

// ─── Configuration ──────────────────────────────────────────────────────────

export interface GithubAppConfig {
  slug: string;
  clientId: string;
  clientSecret: string;
}

export function githubAppConfig(): GithubAppConfig | null {
  const slug = (process.env.GITHUB_APP_SLUG || '').trim();
  const clientId = (process.env.GITHUB_APP_CLIENT_ID || '').trim();
  const clientSecret = (process.env.GITHUB_APP_CLIENT_SECRET || '').trim();
  if (!slug || !clientId || !clientSecret) return null;
  return { slug, clientId, clientSecret };
}

export function installUrl(config: GithubAppConfig): string {
  return `https://github.com/apps/${encodeURIComponent(config.slug)}/installations/new`;
}

// ─── OAuth state ────────────────────────────────────────────────────────────
//
// GitHub sends the user back to /github/callback in the app, which posts the
// code and state here with the user's JWT. The state is signed with the
// client secret, names the user who started the flow, and expires, so a code
// cannot be attached to a different account than the one that asked for it —
// the JWT on the exchange must match the user in the state. The return path
// is constrained to our own origin.

const STATE_TTL_MS = 10 * 60 * 1000;

interface OAuthState {
  userId: string;
  returnTo: string;
  exp: number;
  nonce: string;
}

function sign(config: GithubAppConfig, payload: string): string {
  return createHmac('sha256', config.clientSecret).update(payload).digest('base64url');
}

export function safeReturnPath(raw: string | undefined): string {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//') || raw.includes('\\')) return '/max';
  return raw.length > 300 ? '/max' : raw;
}

export function mintState(config: GithubAppConfig, userId: string, returnTo: string): string {
  const state: OAuthState = { userId, returnTo: safeReturnPath(returnTo), exp: Date.now() + STATE_TTL_MS, nonce: randomBytes(12).toString('base64url') };
  const payload = Buffer.from(JSON.stringify(state)).toString('base64url');
  return `${payload}.${sign(config, payload)}`;
}

export function verifyState(config: GithubAppConfig, raw: string | undefined): OAuthState | null {
  if (!raw || raw.length > 2000) return null;
  const [payload, signature] = raw.split('.');
  if (!payload || !signature) return null;
  const expected = sign(config, payload);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const state = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as OAuthState;
    if (typeof state.userId !== 'string' || typeof state.exp !== 'number' || state.exp < Date.now()) return null;
    return { ...state, returnTo: safeReturnPath(state.returnTo) };
  } catch {
    return null;
  }
}

export function authorizeUrl(config: GithubAppConfig, redirectUri: string, state: string): string {
  const params = new URLSearchParams({ client_id: config.clientId, redirect_uri: redirectUri, state });
  return `https://github.com/login/oauth/authorize?${params.toString()}`;
}

// ─── Tokens ─────────────────────────────────────────────────────────────────

interface TokenResponse {
  access_token?: string;
  expires_in?: number;
  refresh_token?: string;
  refresh_token_expires_in?: number;
  error?: string;
  error_description?: string;
}

async function tokenRequest(config: GithubAppConfig, params: Record<string, string>): Promise<TokenResponse> {
  const response = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'User-Agent': USER_AGENT },
    body: JSON.stringify({ client_id: config.clientId, client_secret: config.clientSecret, ...params }),
  });
  if (!response.ok) throw new GithubError(`GitHub token endpoint answered ${response.status}`, 502, 'UNAVAILABLE');
  const body = await response.json() as TokenResponse;
  if (body.error || !body.access_token) throw new GithubError(body.error_description || body.error || 'GitHub did not issue a token', 502, 'UNAVAILABLE');
  return body;
}

export interface GithubConnectionRow {
  user_id: string;
  github_login: string;
  github_user_id: number;
  access_ciphertext: string;
  refresh_ciphertext: string | null;
  access_expires_at: string | null;
  refresh_expires_at: string | null;
}

async function saveConnection(userId: string, token: TokenResponse, login: string, githubUserId: number): Promise<void> {
  const now = Date.now();
  const row: GithubConnectionRow & { updated_at: string } = {
    user_id: userId,
    github_login: login,
    github_user_id: githubUserId,
    access_ciphertext: encryptCredential(token.access_token!),
    refresh_ciphertext: token.refresh_token ? encryptCredential(token.refresh_token) : null,
    access_expires_at: token.expires_in ? new Date(now + token.expires_in * 1000).toISOString() : null,
    refresh_expires_at: token.refresh_token_expires_in ? new Date(now + token.refresh_token_expires_in * 1000).toISOString() : null,
    updated_at: new Date(now).toISOString(),
  };
  const { error } = await flightControlsAdmin.from('github_connections').upsert(row, { onConflict: 'user_id' });
  if (error) throw new GithubError('Could not store the GitHub connection', 500, 'UNKNOWN');
}

/** Exchange the callback code, look up who it is, and store the connection. */
export async function completeConnection(config: GithubAppConfig, userId: string, code: string, redirectUri: string): Promise<{ login: string }> {
  const token = await tokenRequest(config, { code, redirect_uri: redirectUri });
  const me = await githubJson<{ login: string; id: number }>(token.access_token!, '/user');
  await saveConnection(userId, token, me.login, me.id);
  return { login: me.login };
}

export async function loadConnection(userId: string): Promise<GithubConnectionRow | null> {
  const { data, error } = await flightControlsAdmin
    .from('github_connections')
    .select('user_id, github_login, github_user_id, access_ciphertext, refresh_ciphertext, access_expires_at, refresh_expires_at')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw new GithubError('Could not read the GitHub connection', 500, 'UNKNOWN');
  return (data as GithubConnectionRow | null) ?? null;
}

export async function deleteConnection(userId: string): Promise<void> {
  const { error } = await flightControlsAdmin.from('github_connections').delete().eq('user_id', userId);
  if (error) throw new GithubError('Could not remove the GitHub connection', 500, 'UNKNOWN');
}

/**
 * A usable access token for this user, refreshed if it has expired.
 *
 * Expiring tokens are a setting on the App. With them off there is no
 * refresh token and no expiry, and this just decrypts. With them on, an
 * access token lasts eight hours and the refresh token six months; past the
 * second the user has to connect again, and this says so.
 */
export async function accessTokenFor(config: GithubAppConfig, userId: string): Promise<{ token: string; login: string }> {
  const row = await loadConnection(userId);
  if (!row) throw new GithubError('GitHub is not connected', 401, 'AUTH_REQUIRED');
  const expired = row.access_expires_at ? Date.parse(row.access_expires_at) - 60_000 < Date.now() : false;
  if (!expired) return { token: decryptCredential(row.access_ciphertext), login: row.github_login };
  if (!row.refresh_ciphertext || (row.refresh_expires_at && Date.parse(row.refresh_expires_at) < Date.now())) {
    throw new GithubError('The GitHub connection has expired; connect it again', 401, 'AUTH_REQUIRED');
  }
  const refreshed = await tokenRequest(config, { grant_type: 'refresh_token', refresh_token: decryptCredential(row.refresh_ciphertext) });
  await saveConnection(userId, refreshed, row.github_login, row.github_user_id);
  return { token: refreshed.access_token!, login: row.github_login };
}

// ─── API calls ──────────────────────────────────────────────────────────────

async function githubFetch(token: string, path: string, init: RequestInit = {}): Promise<Response> {
  const response = await fetch(path.startsWith('https://') ? path : `${GITHUB_API}${path}`, {
    ...init,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': USER_AGENT,
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...(init.headers ?? {}),
    },
  });
  return response;
}

async function githubJson<T>(token: string, path: string, init: RequestInit = {}): Promise<T> {
  const response = await githubFetch(token, path, init);
  if (!response.ok) {
    let message = `GitHub answered ${response.status}`;
    try {
      const body = await response.json() as { message?: string };
      if (body.message) message = body.message;
    } catch { /* not JSON */ }
    if (response.status === 401) throw new GithubError('GitHub rejected the connection; connect it again', 401, 'AUTH_REQUIRED');
    if (response.status === 404) throw new GithubError(`${message}. Check that the app is installed on this repository`, 404, 'BAD_REQUEST');
    throw new GithubError(message, response.status >= 500 ? 502 : 400, response.status >= 500 ? 'UNAVAILABLE' : 'BAD_REQUEST');
  }
  return response.json() as Promise<T>;
}

export interface RepoSummary {
  owner: string;
  name: string;
  fullName: string;
  defaultBranch: string;
  private: boolean;
  pushedAt?: string;
}

/** Repositories the user has granted the App, across every installation they can reach. */
export async function listRepositories(token: string): Promise<RepoSummary[]> {
  const installations = await githubJson<{ installations: Array<{ id: number }> }>(token, '/user/installations?per_page=100');
  const repos: RepoSummary[] = [];
  for (const installation of installations.installations ?? []) {
    for (let page = 1; page <= 5; page++) {
      const result = await githubJson<{ repositories: Array<{ name: string; full_name: string; default_branch: string; private: boolean; pushed_at?: string; owner: { login: string } }> }>(
        token, `/user/installations/${installation.id}/repositories?per_page=100&page=${page}`,
      );
      for (const repo of result.repositories ?? []) {
        repos.push({ owner: repo.owner.login, name: repo.name, fullName: repo.full_name, defaultBranch: repo.default_branch, private: repo.private, pushedAt: repo.pushed_at });
      }
      if ((result.repositories ?? []).length < 100) break;
    }
  }
  return repos.sort((a, b) => (b.pushedAt ?? '').localeCompare(a.pushedAt ?? ''));
}

export async function listBranches(token: string, owner: string, name: string): Promise<string[]> {
  const branches = await githubJson<Array<{ name: string }>>(token, `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}/branches?per_page=100`);
  return branches.map(branch => branch.name);
}

// ─── Clone: tarball → files ─────────────────────────────────────────────────

export interface ClonedFile {
  path: string;
  sha: string;
  /** Text, or null when `base64` carries the bytes. */
  content: string | null;
  base64?: string;
}

/** git's blob id, so the browser can tell later what changed. */
export function gitBlobSha(bytes: Buffer): string {
  return createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
}

function looksLikeText(bytes: Buffer): boolean {
  const head = bytes.subarray(0, 8192);
  if (head.includes(0)) return false;
  try {
    new TextDecoder('utf-8', { fatal: true }).decode(head);
    return true;
  } catch {
    return false;
  }
}

/**
 * Walk a tar archive. Handles the ustar prefix field, GNU long names and pax
 * `path` headers — git archive uses the last for any path over 100 bytes,
 * which real repositories have plenty of.
 */
export function* tarEntries(tar: Buffer): Generator<{ path: string; bytes: Buffer }> {
  let offset = 0;
  let longName: string | null = null;
  let paxPath: string | null = null;
  const field = (start: number, length: number) => tar.subarray(offset + start, offset + start + length).toString('utf8').replace(/\0.*$/s, '');
  while (offset + 512 <= tar.length) {
    const header = tar.subarray(offset, offset + 512);
    if (header.every(byte => byte === 0)) break;
    const size = parseInt(field(124, 12).trim() || '0', 8);
    const type = String.fromCharCode(header[156]);
    let name = field(0, 100);
    const prefix = field(345, 155);
    if (prefix) name = `${prefix}/${name}`;
    const dataStart = offset + 512;
    const data = tar.subarray(dataStart, dataStart + size);
    offset = dataStart + Math.ceil(size / 512) * 512;

    if (type === 'L') { longName = data.toString('utf8').replace(/\0.*$/s, ''); continue; }
    if (type === 'x') {
      // pax: "<len> key=value\n" records.
      const text = data.toString('utf8');
      let cursor = 0;
      while (cursor < text.length) {
        const space = text.indexOf(' ', cursor);
        if (space === -1) break;
        const length = parseInt(text.slice(cursor, space), 10);
        if (!Number.isFinite(length) || length <= 0) break;
        const record = text.slice(space + 1, cursor + length - 1);
        const eq = record.indexOf('=');
        if (eq !== -1 && record.slice(0, eq) === 'path') paxPath = record.slice(eq + 1);
        cursor += length;
      }
      continue;
    }
    if (type === 'g') continue;
    const fullName = paxPath ?? longName ?? name;
    longName = null;
    paxPath = null;
    if (type === '0' || type === '\0') yield { path: fullName, bytes: Buffer.from(data) };
  }
}

const MAX_CLONE_BYTES = 60 * 1024 * 1024;

/**
 * The branch's files, streamed to `emit` one at a time.
 *
 * The tarball's top directory (`owner-repo-sha/`) is stripped. Files the
 * workspace would refuse — ignored directories, oversize — are skipped and
 * counted, so the caller can say so rather than the user wondering where
 * node_modules went.
 */
export async function cloneBranch(
  token: string,
  owner: string,
  name: string,
  branch: string,
  emit: (file: ClonedFile) => Promise<void> | void,
): Promise<{ commit: string; written: number; skipped: number; truncated: boolean }> {
  const repoPath = `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}`;
  const head = await githubJson<{ commit: { sha: string } }>(token, `${repoPath}/branches/${encodeURIComponent(branch)}`);
  const response = await githubFetch(token, `${repoPath}/tarball/${encodeURIComponent(head.commit.sha)}`, { redirect: 'follow' });
  if (!response.ok) throw new GithubError(`Could not download the repository (${response.status})`, 502, 'UNAVAILABLE');
  const gz = Buffer.from(await response.arrayBuffer());
  if (gz.length > MAX_CLONE_BYTES) throw new GithubError('This repository is too large to clone into a workspace', 400, 'BAD_REQUEST');
  const tar = gunzipSync(gz, { maxOutputLength: MAX_CLONE_BYTES });

  let written = 0;
  let skipped = 0;
  let truncated = false;
  for (const entry of tarEntries(tar)) {
    const slash = entry.path.indexOf('/');
    const relative = slash === -1 ? '' : entry.path.slice(slash + 1);
    const path = normalizeWorkspacePath(relative);
    if (!path) continue;
    if (isIgnoredWorkspacePath(path) || entry.bytes.length > MAX_WORKSPACE_FILE_BYTES) { skipped++; continue; }
    if (written >= MAX_WORKSPACE_FILES) { truncated = true; skipped++; continue; }
    const sha = gitBlobSha(entry.bytes);
    await emit(looksLikeText(entry.bytes)
      ? { path, sha, content: entry.bytes.toString('utf8') }
      : { path, sha, content: null, base64: entry.bytes.toString('base64') });
    written++;
  }
  return { commit: head.commit.sha, written, skipped, truncated };
}

// ─── Push: workspace → branch → pull request ────────────────────────────────

export interface PushChange {
  path: string;
  /** Text, base64 bytes, or null for a deletion. */
  content: string | null;
  base64?: string;
}

export interface PushOptions {
  owner: string;
  name: string;
  base: string;
  branch: string;
  title: string;
  body: string;
  changes: PushChange[];
  expectedHead: string;
}

export interface PushResult {
  number: number;
  url: string;
  branch: string;
  commit: string;
}

const PUSH_CONCURRENCY = 6;

export async function pushChanges(token: string, options: PushOptions): Promise<PushResult> {
  const { owner, name, base, branch, title, body, changes, expectedHead } = options;
  if (branch === base) throw new GithubError('Publish to a separate branch, not the base branch.');
  const repoPath = `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}`;
  const refPath = (ref: string) => `${repoPath}/git/ref/heads/${ref.split('/').map(encodeURIComponent).join('/')}`;

  // Commit on top of the branch if it exists (a second push), else on base.
  let parentSha: string;
  let branchExists = false;
  const existing = await githubFetch(token, refPath(branch));
  if (existing.ok) {
    parentSha = ((await existing.json()) as { object: { sha: string } }).object.sha;
    branchExists = true;
  } else if (existing.status === 404) {
    const baseRef = await githubJson<{ object: { sha: string } }>(token, refPath(base));
    parentSha = baseRef.object.sha;
  } else {
    throw new GithubError(`Could not check the target branch (${existing.status}). Nothing was pushed.`, 502, 'UNAVAILABLE');
  }
  if (parentSha !== expectedHead) {
    throw new GithubError('The remote branch changed since this workspace was cloned or last pushed. Reconcile those changes before publishing. Your local files are unchanged.', 409);
  }
  const parent = await githubJson<{ tree: { sha: string } }>(token, `${repoPath}/git/commits/${parentSha}`);

  // Blobs, a few at a time. Deletions need no blob: sha null in the tree.
  const tree: Array<{ path: string; mode: '100644'; type: 'blob'; sha: string | null }> = [];
  const queue = [...changes];
  const worker = async () => {
    for (;;) {
      const change = queue.shift();
      if (!change) return;
      if (change.content === null && !change.base64) {
        tree.push({ path: change.path, mode: '100644', type: 'blob', sha: null });
        continue;
      }
      const blob = await githubJson<{ sha: string }>(token, `${repoPath}/git/blobs`, {
        method: 'POST',
        body: JSON.stringify(change.base64
          ? { content: change.base64, encoding: 'base64' }
          : { content: change.content, encoding: 'utf-8' }),
      });
      tree.push({ path: change.path, mode: '100644', type: 'blob', sha: blob.sha });
    }
  };
  await Promise.all(Array.from({ length: Math.min(PUSH_CONCURRENCY, queue.length) }, worker));

  const newTree = await githubJson<{ sha: string }>(token, `${repoPath}/git/trees`, {
    method: 'POST',
    body: JSON.stringify({ base_tree: parent.tree.sha, tree }),
  });
  const commit = await githubJson<{ sha: string }>(token, `${repoPath}/git/commits`, {
    method: 'POST',
    body: JSON.stringify({ message: title, tree: newTree.sha, parents: [parentSha] }),
  });

  if (branchExists) {
    await githubJson(token, `${repoPath}/git/refs/heads/${branch.split('/').map(encodeURIComponent).join('/')}`, {
      method: 'PATCH',
      body: JSON.stringify({ sha: commit.sha, force: false }),
    });
  } else {
    await githubJson(token, `${repoPath}/git/refs`, {
      method: 'POST',
      body: JSON.stringify({ ref: `refs/heads/${branch}`, sha: commit.sha }),
    });
  }

  // One pull request per branch. If one is already open, this push just
  // added a commit to it.
  const open = await githubJson<Array<{ number: number; html_url: string }>>(
    token, `${repoPath}/pulls?state=open&head=${encodeURIComponent(`${owner}:${branch}`)}&per_page=1`,
  );
  if (open.length > 0) return { number: open[0].number, url: open[0].html_url, branch, commit: commit.sha };

  const pull = await githubJson<{ number: number; html_url: string }>(token, `${repoPath}/pulls`, {
    method: 'POST',
    body: JSON.stringify({ title, body, head: branch, base }),
  });
  return { number: pull.number, url: pull.html_url, branch, commit: commit.sha };
}
