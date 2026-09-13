import type { PublicationProposal } from './publicationApproval';
/**
 * GitHub, from the workspace's side.
 *
 * The browser never holds a GitHub token. `/api/github` does — the user's
 * token from the GitHub App's authorization flow, encrypted at rest the way
 * MCP credentials are — and the browser asks it for a tree to clone and hands
 * it a list of changed files to push. What travels is file content, which is
 * the user's own project; the credential stays on the server.
 *
 * A clone records the blob sha of every file it wrote. A push compares the
 * workspace against those — git's own sha, computed here — so only what
 * actually changed is sent, and a deletion is a deletion rather than a file
 * that quietly stops being mentioned.
 */

import { supabase } from '../../lib/supabase';
import type { WorkspaceRepoRef } from '../../../shared/maxMode';
import {
  getWorkspaceMeta,
  listWorkspace,
  readWorkspaceFile,
  updateWorkspaceMeta,
  writeWorkspaceFiles,
  clearWorkspace,
  promoteWorkspaceClone,
  type WorkspaceMeta,
} from './workspaceStore';

export interface GithubStatus {
  configured: boolean;
  connected: boolean;
  login?: string;
  installUrl?: string;
}

export interface GithubRepo {
  owner: string;
  name: string;
  fullName: string;
  defaultBranch: string;
  private: boolean;
  pushedAt?: string;
}

export interface CloneResult {
  written: number;
  skipped: number;
  truncated: boolean;
  commit: string;
}

export type PushResult =
  | { ok: true; number: number; url: string; branch: string; changedFiles: number }
  | { ok: false; error: string };

export class GithubError extends Error {
  constructor(message: string, readonly code?: string) {
    super(message);
    this.name = 'GithubError';
  }
}

async function headers(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

// The GitHub actions ride on /api/mcp-servers — the connected-services
// Function — because the deployment is at Vercel's Function limit.
const ENDPOINT = '/api/mcp-servers';

async function request(action: string, query: Record<string, string> = {}, body?: Record<string, unknown>): Promise<Response> {
  const search = new URLSearchParams({ github: action, ...query }).toString();
  return fetch(`${ENDPOINT}?${search}`, {
    method: body ? 'POST' : 'GET',
    headers: await headers(),
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}

async function call<T>(action: string, query: Record<string, string> = {}, body?: Record<string, unknown>): Promise<T> {
  const response = await request(action, query, body);
  const payload = await response.json().catch(() => null) as { error?: { code?: string; message?: string } } | null;
  if (!response.ok) {
    throw new GithubError(payload?.error?.message ?? `GitHub request failed (${response.status})`, payload?.error?.code);
  }
  return payload as T;
}

export function githubStatus(): Promise<GithubStatus> {
  return call<GithubStatus>('status');
}

/** The URL to send the user to. The server signs the state; we only carry the return path. */
export async function githubConnectUrl(returnTo: string): Promise<string> {
  const { url } = await call<{ url: string }>('connect', { returnTo });
  return url;
}

/** Back from GitHub: hand the code over, get told where to go next. */
export function githubExchange(code: string, state: string): Promise<{ login: string; returnTo: string }> {
  return call<{ login: string; returnTo: string }>('exchange', {}, { code, state });
}

export function githubDisconnect(): Promise<void> {
  return call<void>('disconnect', {}, {});
}

export function listGithubRepos(): Promise<GithubRepo[]> {
  return call<{ repos: GithubRepo[] }>('repos').then(result => result.repos);
}

export function listGithubBranches(owner: string, name: string): Promise<string[]> {
  return call<{ branches: string[] }>('branches', { owner, name }).then(result => result.branches);
}

interface CloneFile {
  path: string;
  sha: string;
  /** Text content, or null when `base64` carries bytes. */
  content: string | null;
  base64?: string;
}

function fromBase64(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

type CloneLine =
  | ({ type: 'file' } & CloneFile)
  | { type: 'done'; commit: string; written: number; skipped: number; truncated: boolean }
  | { type: 'error'; message: string };

/**
 * Replace the workspace with a checkout of the branch.
 *
 * The server streams one JSON line per file; they are written to the store
 * in batches as they arrive, so a large repository neither sits in memory
 * twice nor waits for the last file before the first one appears.
 */
export async function cloneRepoIntoWorkspace(sessionId: string, repo: WorkspaceRepoRef): Promise<CloneResult> {
  const response = await request('clone', {}, { owner: repo.owner, name: repo.name, branch: repo.branch });
  if (!response.ok || !response.body) {
    const payload = await response.json().catch(() => null) as { error?: { code?: string; message?: string } } | null;
    throw new GithubError(payload?.error?.message ?? `Clone failed (${response.status})`, payload?.error?.code);
  }

  const stagingId = `clone-${crypto.randomUUID()}`;
  try {

    const baseShas: Record<string, string> = {};
    let batch: Array<{ path: string; content: string | Uint8Array; sha: string }> = [];
    let written = 0;
    let skippedHere = 0;
    const flush = async () => {
      if (batch.length === 0) return;
      const result = await writeWorkspaceFiles(stagingId, batch);
      for (const file of batch) if (result.written.includes(file.path)) baseShas[file.path] = file.sha;
      written += result.written.length;
      skippedHere += result.skipped.length;
      batch = [];
    };

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let done: Extract<CloneLine, { type: 'done' }> | null = null;
    for (;;) {
      const { done: finished, value } = await reader.read();
      buffer += finished ? decoder.decode() + '\n' : decoder.decode(value, { stream: true });
      let newline = buffer.indexOf('\n');
      while (newline !== -1) {
        const line = buffer.slice(0, newline);
        buffer = buffer.slice(newline + 1);
        newline = buffer.indexOf('\n');
        if (!line.trim()) continue;
        const parsed = JSON.parse(line) as CloneLine;
        if (parsed.type === 'file') {
          batch.push({ path: parsed.path, sha: parsed.sha, content: parsed.content ?? (parsed.base64 ? fromBase64(parsed.base64) : '') });
          if (batch.length >= 100) await flush();
        } else if (parsed.type === 'done') {
          done = parsed;
        } else if (parsed.type === 'error') {
          throw new GithubError(parsed.message);
        }
      }
      if (finished) break;
    }
    await flush();
    if (!done) throw new GithubError('The clone stopped before it finished.');

    await promoteWorkspaceClone(stagingId, sessionId, { ...repo, baseShas, baseCommit: done.commit });
    return { written, skipped: done.skipped + skippedHere, truncated: done.truncated, commit: done.commit };
  } finally {
    await clearWorkspace(stagingId);
  }
}

/** git's blob id: sha1 over "blob <size>\0<bytes>". */
export async function gitBlobSha(bytes: Uint8Array): Promise<string> {
  const header = new TextEncoder().encode(`blob ${bytes.byteLength}\0`);
  const buffer = new Uint8Array(header.byteLength + bytes.byteLength);
  buffer.set(header, 0);
  buffer.set(bytes, header.byteLength);
  const digest = await crypto.subtle.digest('SHA-1', buffer);
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
}

export interface WorkspaceChange {
  path: string;
  /** Text, base64 bytes, or null for a deletion. */
  content: string | null;
  base64?: string;
}

/** What differs between the workspace and the clone it came from. */
export async function workspaceChanges(sessionId: string): Promise<{ repo: NonNullable<WorkspaceMeta['repo']>; changes: WorkspaceChange[] } | null> {
  const meta = await getWorkspaceMeta(sessionId);
  if (!meta?.repo) return null;
  const entries = await listWorkspace(sessionId);
  const changes: WorkspaceChange[] = [];
  const present = new Set<string>();
  for (const entry of entries) {
    present.add(entry.path);
    const file = await readWorkspaceFile(sessionId, entry.path);
    if (!file) continue;
    const bytes = file.bytes ?? new TextEncoder().encode(file.text ?? '');
    const sha = await gitBlobSha(bytes);
    if (meta.repo.baseShas[entry.path] === sha) continue;
    changes.push(file.bytes ? { path: entry.path, content: null, base64: toBase64(file.bytes) } : { path: entry.path, content: file.text ?? '' });
  }
  for (const path of Object.keys(meta.repo.baseShas)) {
    if (!present.has(path)) changes.push({ path, content: null });
  }
  return { repo: meta.repo, changes };
}

function suggestBranch(title: string): string {
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'changes';
  return `tm/${slug}-${Date.now().toString(36).slice(-4)}`;
}

/** Commit every change to a branch and open (or update) the pull request. */
export async function openPullRequestFromWorkspace(
  sessionId: string,
  options: { title: string; body: string; branch?: string; approve?: (proposal: PublicationProposal) => Promise<boolean>; signal?: AbortSignal },
): Promise<PushResult> {
  const diff = await workspaceChanges(sessionId);
  if (!diff?.repo) return { ok: false, error: 'This workspace is not connected to a GitHub repository.' };
  const existing = diff.repo.pullRequest;
  if (diff.changes.length === 0) {
    return { ok: false, error: existing
      ? `Nothing has changed since the last push; the pull request is still ${existing.url}.`
      : 'Nothing has changed since the clone; there is nothing to push.' };
  }

  const branch = existing?.branch ?? options.branch ?? suggestBranch(options.title);
  if (options.approve && !await options.approve({
    repository: `${diff.repo.owner}/${diff.repo.name}`, base: diff.repo.branch, branch,
    title: options.title, body: options.body, changes: diff.changes,
  })) return { ok: false, error: 'Publication was not approved. Workspace changes remain local. Do not retry publication unless the user asks again.' };
  if (options.signal?.aborted) return { ok: false, error: 'The user stopped this turn before publication.' };
  try {
    const result = await call<{ number: number; url: string; branch: string; commit: string }>(
      'push',
      {},
      {
        owner: diff.repo.owner,
        name: diff.repo.name,
        base: diff.repo.branch,
        expectedHead: diff.repo.baseCommit,
        branch,
        title: options.title,
        body: options.body,
        changes: diff.changes,
      },
    );
    // The pushed state becomes the new baseline, so the next push is a delta
    // onto the same branch rather than the whole change set again.
    const baseShas = { ...diff.repo.baseShas };
    for (const change of diff.changes) {
      if (change.content === null && !change.base64) { delete baseShas[change.path]; continue; }
      const bytes = change.base64 ? fromBase64(change.base64) : new TextEncoder().encode(change.content ?? '');
      baseShas[change.path] = await gitBlobSha(bytes);
    }
    await updateWorkspaceMeta(sessionId, {
      repo: { ...diff.repo, baseCommit: result.commit, baseShas, pullRequest: { branch: result.branch, number: result.number, url: result.url } },
    });
    return { ok: true, number: result.number, url: result.url, branch: result.branch, changedFiles: diff.changes.length };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'GitHub push failed.' };
  }
}
