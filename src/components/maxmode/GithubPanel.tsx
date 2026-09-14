/**
 * The GitHub sheet in the workspace panel.
 *
 * Connect once; then either clone a repository into the workspace or create
 * one from it. With a repository linked: commit straight to its branch, or
 * open a pull request; pull the branch's newer commits in; unlink.
 *
 * Everything here goes through githubService → /api/mcp-servers?github=.
 * The token never reaches this component; "connect" is a redirect to
 * GitHub and back.
 */

import { useEffect, useState } from 'react';
import { GitBranch, GitCommitHorizontal, GitPullRequest, FolderGit2, Loader2, RefreshCw, Download, Unlink, X } from 'lucide-react';
import {
  GithubError,
  cloneRepoIntoWorkspace,
  commitToBranch,
  createRepositoryForWorkspace,
  githubConnectUrl,
  githubDisconnect,
  githubStatus,
  linkEmptyRepository,
  listGithubBranches,
  listGithubRepos,
  openPullRequestFromWorkspace,
  pullLatestIntoWorkspace,
  unlinkRepository,
  workspaceChanges,
  type GithubRepo,
  type GithubStatus,
} from '../../services/workspace/githubService';
import type { WorkspaceMeta } from '../../services/workspace/workspaceStore';
import { GlassPill } from './glass';

interface GithubPanelProps {
  sessionId: string;
  meta: WorkspaceMeta | null;
  /** How many files the workspace holds, for the create and clone copy. */
  fileCount: number;
  signedIn: boolean;
  onClose: () => void;
  onChanged: () => void;
}

const inputClass = 'w-full rounded-2xl bg-white/5 border border-white/10 px-3 py-2 text-white/90 placeholder:text-white/30 outline-none focus:border-cyan-400/50';

export function GithubPanel({ sessionId, meta, fileCount, signedIn, onClose, onChanged }: GithubPanelProps) {
  const [status, setStatus] = useState<GithubStatus | null>(null);
  const [repos, setRepos] = useState<GithubRepo[] | null>(null);
  const [filter, setFilter] = useState('');
  const [picked, setPicked] = useState<GithubRepo | null>(null);
  const [branches, setBranches] = useState<string[] | null>(null);
  const [branch, setBranch] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [needsReconnect, setNeedsReconnect] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [changeCount, setChangeCount] = useState<number | null>(null);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [newName, setNewName] = useState('');
  const [newPrivate, setNewPrivate] = useState(true);
  const [start, setStart] = useState<'clone' | 'create'>('clone');

  const repo = meta?.repo ?? null;

  const report = (cause: unknown, fallback: string) => {
    const message = cause instanceof Error ? cause.message : fallback;
    setError(message);
    // An expired or revoked token: the fix is to connect again, so say so
    // with a button rather than an error the user cannot act on.
    setNeedsReconnect(cause instanceof GithubError && cause.code === 'AUTH_REQUIRED');
  };

  useEffect(() => {
    if (!signedIn) return;
    githubStatus().then(setStatus).catch((cause: unknown) => report(cause, 'Could not reach GitHub.'));
  }, [signedIn]);

  useEffect(() => {
    if (!status?.connected || repo) return;
    listGithubRepos().then(setRepos).catch((cause: unknown) => report(cause, 'Could not list repositories.'));
  }, [status?.connected, repo]);

  useEffect(() => {
    if (!picked) return;
    let cancelled = false;
    listGithubBranches(picked.owner, picked.name)
      .then(list => { if (!cancelled) setBranches(list); })
      .catch(() => { if (!cancelled) setBranches([picked.defaultBranch]); });
    return () => { cancelled = true; };
  }, [picked]);

  const pick = (candidate: GithubRepo | null) => {
    setPicked(candidate);
    setBranches(null);
    setBranch(candidate?.defaultBranch ?? '');
  };

  const refreshChanges = () => {
    if (!repo) return;
    workspaceChanges(sessionId).then(diff => setChangeCount(diff?.changes.length ?? 0)).catch(() => setChangeCount(null));
  };
  useEffect(refreshChanges, [repo, sessionId, fileCount]);

  const connect = async () => {
    setBusy('connect');
    try {
      window.location.assign(await githubConnectUrl(window.location.pathname));
    } catch (cause) {
      report(cause, 'Could not start the GitHub connection.');
      setBusy(null);
    }
  };

  const clone = async () => {
    if (!picked || !branch) return;
    if (fileCount > 0 && !window.confirm(`Replace the ${fileCount} file${fileCount === 1 ? '' : 's'} in this workspace with ${picked.fullName}?`)) return;
    setBusy('clone');
    setError(null);
    try {
      const result = await cloneRepoIntoWorkspace(sessionId, { owner: picked.owner, name: picked.name, branch });
      if (result.truncated) setError(`The repository is larger than a workspace holds; ${result.written} files were cloned.`);
      onChanged();
      onClose();
    } catch (cause) {
      report(cause, 'Clone failed.');
    } finally {
      setBusy(null);
    }
  };

  const linkEmpty = async () => {
    if (!picked) return;
    setBusy('link');
    setError(null);
    try {
      await linkEmptyRepository(sessionId, { owner: picked.owner, name: picked.name, branch: picked.defaultBranch || 'main' });
      setNotice(`${picked.fullName} is linked. Commit to put the workspace on it.`);
      pick(null);
      onChanged();
    } catch (cause) {
      report(cause, 'Could not link the repository.');
    } finally {
      setBusy(null);
    }
  };

  const create = async () => {
    const name = newName.trim();
    if (!name) return;
    setBusy('create');
    setError(null);
    try {
      const created = await createRepositoryForWorkspace(sessionId, { name, private: newPrivate });
      onChanged();
      const pushed = await commitToBranch(sessionId, { title: 'Initial commit', body: '' });
      if (!pushed.ok) {
        setError(`${created.owner}/${created.name} was created and linked, but the push failed: ${pushed.error} Commit again to retry.`);
      } else {
        setNotice(`${created.owner}/${created.name} is up: ${pushed.changedFiles} file${pushed.changedFiles === 1 ? '' : 's'} on ${pushed.branch}.`);
      }
      onChanged();
    } catch (cause) {
      report(cause, 'Could not create the repository.');
    } finally {
      setBusy(null);
    }
  };

  const push = async (mode: 'direct' | 'pull_request') => {
    if (!title.trim()) return;
    setBusy(mode);
    setError(null);
    setNotice(null);
    const result = mode === 'direct'
      ? await commitToBranch(sessionId, { title: title.trim(), body })
      : await openPullRequestFromWorkspace(sessionId, { title: title.trim(), body });
    setBusy(null);
    if (!result.ok) { setError(result.error); return; }
    setTitle('');
    setBody('');
    onChanged();
    if (result.number !== null) {
      window.open(result.url, '_blank', 'noopener');
      onClose();
    } else {
      setNotice(`Committed ${result.changedFiles} file${result.changedFiles === 1 ? '' : 's'} to ${result.branch}.`);
      refreshChanges();
    }
  };

  const pull = async () => {
    setBusy('pull');
    setError(null);
    setNotice(null);
    try {
      const result = await pullLatestIntoWorkspace(sessionId);
      const parts = [
        result.updated.length ? `${result.updated.length} updated` : '',
        result.removed.length ? `${result.removed.length} removed` : '',
      ].filter(Boolean);
      setNotice(parts.length ? `Pulled: ${parts.join(', ')}.` : 'Already up to date.');
      if (result.conflicts.length) setError(`Changed both here and on GitHub, kept as they are here: ${result.conflicts.join(', ')}`);
      onChanged();
    } catch (cause) {
      report(cause, 'Pull failed.');
    } finally {
      setBusy(null);
    }
  };

  const unlink = async () => {
    if (!window.confirm('Unlink this repository? The files stay in the workspace.')) return;
    setBusy('unlink');
    try {
      await unlinkRepository(sessionId);
      setNotice(null);
      onChanged();
    } catch (cause) {
      report(cause, 'Could not unlink.');
    } finally {
      setBusy(null);
    }
  };

  const disconnect = async () => {
    setBusy('disconnect');
    try {
      await githubDisconnect();
      setStatus(await githubStatus());
    } catch (cause) {
      report(cause, 'Could not disconnect.');
    } finally {
      setBusy(null);
    }
  };

  const filtered = (repos ?? []).filter(candidate => candidate.fullName.toLowerCase().includes(filter.toLowerCase())).slice(0, 60);

  return (
    <div className="absolute inset-0 z-20 flex flex-col backdrop-blur-xl" style={{ background: 'rgb(var(--tm-paper-rgb) / 0.92)' }}>
      <div className="flex items-center gap-2 px-4 py-3 border-b border-white/[0.06]">
        <FolderGit2 className="w-4 h-4 text-white/70" />
        <span className="text-sm font-medium text-white/90 flex-1">GitHub</span>
        <GlassPill onClick={onClose} className="h-8 w-8" aria-label="Close" title="Close">
          <X className="w-4 h-4" />
        </GlassPill>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 text-sm">
        {error && (
          <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-rose-200 text-xs space-y-2">
            <p>{error}</p>
            {needsReconnect && (
              <GlassPill tone="accent" onClick={connect} disabled={busy === 'connect'} className="h-8 px-3">Connect GitHub again</GlassPill>
            )}
          </div>
        )}
        {notice && <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/10 px-3 py-2 text-emerald-100 text-xs">{notice}</div>}

        {!signedIn ? (
          <p className="text-white/60">Sign in to connect a GitHub repository.</p>
        ) : !status ? (
          <p className="text-white/40 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Checking…</p>
        ) : !status.configured ? (
          <p className="text-white/60 leading-relaxed">GitHub isn't available here yet. You can still import a zip or download the workspace.</p>
        ) : !status.connected ? (
          <div className="space-y-3">
            <p className="text-white/60 leading-relaxed">Connect your GitHub account to clone a repository into this workspace, create one from it, and push changes back. You choose which repositories the TimeMachine app can see.</p>
            <GlassPill tone="accent" onClick={connect} disabled={busy === 'connect'} className="h-9 px-4 text-sm">
              {busy === 'connect' ? 'Redirecting…' : 'Connect GitHub'}
            </GlassPill>
          </div>
        ) : repo ? (
          <div className="space-y-4">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-3 space-y-1">
              <div className="flex items-center gap-2 text-white/90"><GitBranch className="w-4 h-4 text-white/50" /> {repo.owner}/{repo.name} · <span className="font-mono text-xs">{repo.branch}</span></div>
              <div className="text-xs text-white/40">
                {!repo.baseCommit
                  ? 'Empty repository: the first commit puts the whole workspace on it.'
                  : changeCount === null ? 'Comparing…' : changeCount === 0 ? 'No changes since the last sync.' : `${changeCount} file${changeCount === 1 ? '' : 's'} changed since the last sync.`}
                {repo.pullRequest && <> Pull request <a className="text-cyan-300 underline" href={repo.pullRequest.url} target="_blank" rel="noopener noreferrer">#{repo.pullRequest.number}</a> on <span className="font-mono">{repo.pullRequest.branch}</span>.</>}
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-xs uppercase tracking-wider text-white/40">{repo.pullRequest ? 'Push more changes' : 'Publish'}</div>
              <input value={title} onChange={event => setTitle(event.target.value)} placeholder="Commit message" className={inputClass} />
              <textarea value={body} onChange={event => setBody(event.target.value)} placeholder="Description (optional, Markdown)" rows={3} className={`${inputClass} resize-y`} />
              <div className="flex flex-wrap items-center gap-2">
                {repo.pullRequest ? (
                  <GlassPill tone="accent" onClick={() => push('pull_request')} disabled={!!busy || !title.trim() || changeCount === 0} className="h-9 px-4 text-sm">
                    {busy === 'pull_request' ? <Loader2 className="w-4 h-4 animate-spin" /> : <GitPullRequest className="w-4 h-4" />}
                    Push to pull request #{repo.pullRequest.number}
                  </GlassPill>
                ) : (
                  <>
                    <GlassPill tone="accent" onClick={() => push('direct')} disabled={!!busy || !title.trim() || changeCount === 0} className="h-9 px-4 text-sm" title={`Commit straight to ${repo.branch}`}>
                      {busy === 'direct' ? <Loader2 className="w-4 h-4 animate-spin" /> : <GitCommitHorizontal className="w-4 h-4" />}
                      Commit to {repo.branch}
                    </GlassPill>
                    {repo.baseCommit && (
                      <GlassPill onClick={() => push('pull_request')} disabled={!!busy || !title.trim() || changeCount === 0} className="h-9 px-4 text-sm" title="Commit to a new branch and open a pull request">
                        {busy === 'pull_request' ? <Loader2 className="w-4 h-4 animate-spin" /> : <GitPullRequest className="w-4 h-4" />}
                        Open a pull request
                      </GlassPill>
                    )}
                  </>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-1">
              {repo.baseCommit && (
                <GlassPill onClick={pull} disabled={!!busy} className="h-8 px-3" title={`Bring newer commits on ${repo.branch} into the workspace`}>
                  {busy === 'pull' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />} Pull latest
                </GlassPill>
              )}
              <GlassPill onClick={unlink} disabled={!!busy} className="h-8 px-3" title="Forget the repository; keep the files">
                <Unlink className="w-3.5 h-3.5" /> Unlink
              </GlassPill>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="text-xs text-white/50">Connected as <span className="text-white/80">{status.login}</span></div>
              <div className="flex items-center gap-2">
                {status.installUrl && <a href={status.installUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-cyan-300 hover:underline">Manage access</a>}
                <GlassPill onClick={disconnect} disabled={busy === 'disconnect'} className="h-7 px-3">Disconnect</GlassPill>
              </div>
            </div>

            <div className="flex items-center gap-1 p-1 rounded-full bg-white/5 border border-white/10 w-fit" role="tablist">
              {([['clone', 'Clone a repository'], ['create', 'Create a repository']] as const).map(([id, label]) => (
                <button key={id} type="button" role="tab" aria-selected={start === id} onClick={() => setStart(id)}
                  className={`h-7 rounded-full px-3 text-xs transition-colors ${start === id ? 'bg-white/15 text-white' : 'text-white/55 hover:text-white/85'}`}>
                  {label}
                </button>
              ))}
            </div>

            {start === 'create' ? (
              <div className="space-y-3">
                <p className="text-xs text-white/50 leading-relaxed">
                  A new repository under your account, with {fileCount > 0 ? `the ${fileCount} file${fileCount === 1 ? '' : 's'} here as its first commit` : 'this workspace as its first commit once it has files'}.
                </p>
                <input value={newName} onChange={event => setNewName(event.target.value.replace(/[^A-Za-z0-9_.-]/g, '-'))} placeholder="repository-name" className={inputClass} />
                <label className="flex items-center gap-2 text-xs text-white/70">
                  <input type="checkbox" checked={newPrivate} onChange={event => setNewPrivate(event.target.checked)} className="accent-cyan-400" />
                  Private
                </label>
                <GlassPill tone="accent" onClick={create} disabled={!!busy || !newName.trim()} className="h-9 px-4 text-sm">
                  {busy === 'create' ? <Loader2 className="w-4 h-4 animate-spin" /> : <FolderGit2 className="w-4 h-4" />}
                  {fileCount > 0 ? 'Create and push' : 'Create'}
                </GlassPill>
              </div>
            ) : !picked ? (
              <>
                <div className="flex items-center gap-2">
                  <input value={filter} onChange={event => setFilter(event.target.value)} placeholder="Find a repository" className="flex-1 rounded-full bg-white/5 border border-white/10 px-4 py-2 text-white/90 placeholder:text-white/30 outline-none focus:border-cyan-400/50" />
                  <GlassPill onClick={() => { setRepos(null); listGithubRepos().then(setRepos).catch(() => undefined); }} className="h-9 w-9" aria-label="Refresh" title="Refresh">
                    <RefreshCw className="w-4 h-4" />
                  </GlassPill>
                </div>
                {repos === null ? (
                  <p className="text-white/40 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Loading repositories…</p>
                ) : filtered.length === 0 ? (
                  <div className="space-y-2">
                    <p className="text-white/40 text-xs">TimeMachine can't see any of your repositories yet.</p>
                    {status.installUrl && (
                      <a href={status.installUrl} target="_blank" rel="noopener noreferrer" className="inline-flex h-9 items-center gap-2 rounded-full px-4 text-sm text-cyan-100" style={{ background: 'rgba(34, 211, 238, 0.18)', border: '1px solid rgba(34, 211, 238, 0.35)' }}>
                        Give access to repositories
                      </a>
                    )}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-white/10 divide-y divide-white/5 max-h-72 overflow-y-auto">
                    {filtered.map(candidate => (
                      <button key={candidate.fullName} type="button" onClick={() => pick(candidate)} className="w-full text-left px-3 py-2 hover:bg-white/5">
                        <div className="text-white/90">{candidate.fullName}</div>
                        <div className="text-xs text-white/40">{candidate.private ? 'private' : 'public'} · default {candidate.defaultBranch}</div>
                      </button>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div className="space-y-3">
                <div className="text-white/90">{picked.fullName}</div>
                {branches === null ? (
                  <div className="text-xs text-white/40">Loading branches…</div>
                ) : branches.length === 0 ? (
                  <div className="space-y-2">
                    <p className="text-xs text-white/50 leading-relaxed">This repository has no commits yet. Link it and the first commit puts this workspace on <span className="font-mono">{picked.defaultBranch || 'main'}</span>.</p>
                    <div className="flex items-center gap-2">
                      <GlassPill tone="accent" onClick={linkEmpty} disabled={busy === 'link'} className="h-9 px-4 text-sm">
                        {busy === 'link' && <Loader2 className="w-4 h-4 animate-spin" />} Link empty repository
                      </GlassPill>
                      <GlassPill onClick={() => pick(null)} className="h-9 px-3">Back</GlassPill>
                    </div>
                  </div>
                ) : (
                  <>
                    <label className="block text-xs text-white/50">
                      Branch
                      <select value={branch} onChange={event => setBranch(event.target.value)} className="mt-1 w-full rounded-2xl bg-white/5 border border-white/10 px-3 py-2 text-white/90 outline-none">
                        {branches.map(name => <option key={name} value={name} className="bg-neutral-900">{name}</option>)}
                      </select>
                    </label>
                    <p className="text-xs text-white/40">{fileCount > 0 ? `Cloning replaces the ${fileCount} file${fileCount === 1 ? '' : 's'} in this workspace.` : 'The branch is checked out into this workspace.'}</p>
                    <div className="flex items-center gap-2">
                      <GlassPill tone="accent" onClick={clone} disabled={busy === 'clone' || !branch} className="h-9 px-4 text-sm">
                        {busy === 'clone' && <Loader2 className="w-4 h-4 animate-spin" />} Clone into workspace
                      </GlassPill>
                      <GlassPill onClick={() => pick(null)} className="h-9 px-3">Back</GlassPill>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
