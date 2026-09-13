/**
 * The GitHub sheet in the workspace panel: connect, pick a repository and
 * branch to clone, and push the workspace back as a pull request.
 *
 * Everything here goes through githubService → /api/github. The token never
 * reaches this component; "connect" is a redirect to GitHub and back.
 */

import { useEffect, useState } from 'react';
import { GitBranch, GitPullRequest, FolderGit2, Loader2, RefreshCw, X } from 'lucide-react';
import {
  cloneRepoIntoWorkspace,
  githubConnectUrl,
  githubDisconnect,
  githubStatus,
  listGithubBranches,
  listGithubRepos,
  openPullRequestFromWorkspace,
  workspaceChanges,
  type GithubRepo,
  type GithubStatus,
} from '../../services/workspace/githubService';
import type { WorkspaceMeta } from '../../services/workspace/workspaceStore';

interface GithubPanelProps {
  sessionId: string;
  meta: WorkspaceMeta | null;
  signedIn: boolean;
  onClose: () => void;
  onChanged: () => void;
}

export function GithubPanel({ sessionId, meta, signedIn, onClose, onChanged }: GithubPanelProps) {
  const [status, setStatus] = useState<GithubStatus | null>(null);
  const [repos, setRepos] = useState<GithubRepo[] | null>(null);
  const [filter, setFilter] = useState('');
  const [picked, setPicked] = useState<GithubRepo | null>(null);
  const [branches, setBranches] = useState<string[] | null>(null);
  const [branch, setBranch] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [changeCount, setChangeCount] = useState<number | null>(null);
  const [prTitle, setPrTitle] = useState('');
  const [prBody, setPrBody] = useState('');

  const repo = meta?.repo ?? null;

  useEffect(() => {
    if (!signedIn) return;
    githubStatus().then(setStatus).catch((cause: unknown) => setError(cause instanceof Error ? cause.message : 'Could not reach GitHub.'));
  }, [signedIn]);

  useEffect(() => {
    if (!status?.connected || repo) return;
    listGithubRepos().then(setRepos).catch((cause: unknown) => setError(cause instanceof Error ? cause.message : 'Could not list repositories.'));
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

  useEffect(() => {
    if (!repo) return;
    workspaceChanges(sessionId).then(diff => setChangeCount(diff?.changes.length ?? 0)).catch(() => setChangeCount(null));
  }, [repo, sessionId]);

  const connect = async () => {
    setBusy('connect');
    try {
      window.location.assign(await githubConnectUrl(window.location.pathname));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not start the GitHub connection.');
      setBusy(null);
    }
  };

  const clone = async () => {
    if (!picked || !branch) return;
    setBusy('clone');
    setError(null);
    try {
      const result = await cloneRepoIntoWorkspace(sessionId, { owner: picked.owner, name: picked.name, branch });
      if (result.truncated) setError(`The repository is larger than a workspace holds; ${result.written} files were cloned.`);
      onChanged();
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Clone failed.');
    } finally {
      setBusy(null);
    }
  };

  const push = async () => {
    if (!prTitle.trim()) return;
    setBusy('push');
    setError(null);
    const result = await openPullRequestFromWorkspace(sessionId, { title: prTitle.trim(), body: prBody });
    setBusy(null);
    if (!result.ok) { setError(result.error); return; }
    onChanged();
    window.open(result.url, '_blank', 'noopener');
    onClose();
  };

  const disconnect = async () => {
    setBusy('disconnect');
    try {
      await githubDisconnect();
      setStatus(await githubStatus());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not disconnect.');
    } finally {
      setBusy(null);
    }
  };

  const filtered = (repos ?? []).filter(candidate => candidate.fullName.toLowerCase().includes(filter.toLowerCase())).slice(0, 60);

  return (
    <div className="absolute inset-0 z-20 flex flex-col bg-black/40 backdrop-blur-xl">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-white/10">
        <FolderGit2 className="w-4 h-4 text-white/70" />
        <span className="text-sm font-medium text-white/90 flex-1">GitHub</span>
        <button type="button" onClick={onClose} className="p-1 rounded hover:bg-white/10 text-white/60" aria-label="Close">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 text-sm">
        {error && <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-rose-200 text-xs">{error}</div>}

        {!signedIn ? (
          <p className="text-white/60">Sign in to connect a GitHub repository.</p>
        ) : !status ? (
          <p className="text-white/40 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Checking…</p>
        ) : !status.configured ? (
          <p className="text-white/60">GitHub is not configured on this deployment yet.</p>
        ) : !status.connected ? (
          <div className="space-y-3">
            <p className="text-white/60 leading-relaxed">Connect your GitHub account to clone a repository into this workspace and push changes back as a pull request. You choose which repositories the TimeMachine app can see.</p>
            <button type="button" onClick={connect} disabled={busy === 'connect'} className="px-4 py-2 rounded-full bg-white/10 border border-white/15 text-white/90 hover:bg-white/15 disabled:opacity-50">
              {busy === 'connect' ? 'Redirecting…' : 'Connect GitHub'}
            </button>
          </div>
        ) : repo ? (
          <div className="space-y-4">
            <div className="rounded-xl border border-white/10 bg-white/5 p-3 space-y-1">
              <div className="flex items-center gap-2 text-white/90"><GitBranch className="w-4 h-4 text-white/50" /> {repo.owner}/{repo.name} · <span className="font-mono text-xs">{repo.branch}</span></div>
              <div className="text-xs text-white/40">
                {changeCount === null ? 'Comparing…' : changeCount === 0 ? 'No changes since the clone.' : `${changeCount} file${changeCount === 1 ? '' : 's'} changed since the clone.`}
                {repo.pullRequest && <> Pull request <a className="text-cyan-300 underline" href={repo.pullRequest.url} target="_blank" rel="noopener noreferrer">#{repo.pullRequest.number}</a> on <span className="font-mono">{repo.pullRequest.branch}</span>.</>}
              </div>
            </div>
            <div className="space-y-2">
              <div className="text-xs uppercase tracking-wider text-white/40">{repo.pullRequest ? 'Push more changes' : 'Open a pull request'}</div>
              <input value={prTitle} onChange={event => setPrTitle(event.target.value)} placeholder="Title (also the commit message)" className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-white/90 placeholder:text-white/30 outline-none focus:border-cyan-400/50" />
              <textarea value={prBody} onChange={event => setPrBody(event.target.value)} placeholder="Description (Markdown)" rows={4} className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-white/90 placeholder:text-white/30 outline-none focus:border-cyan-400/50 resize-y" />
              <button type="button" onClick={push} disabled={busy === 'push' || !prTitle.trim() || changeCount === 0} className="flex items-center gap-2 px-4 py-2 rounded-full bg-cyan-500/20 border border-cyan-400/30 text-cyan-100 hover:bg-cyan-500/30 disabled:opacity-50">
                {busy === 'push' ? <Loader2 className="w-4 h-4 animate-spin" /> : <GitPullRequest className="w-4 h-4" />}
                {repo.pullRequest ? 'Push to the pull request' : 'Create pull request'}
              </button>
            </div>
            <button type="button" onClick={() => { pick(null); setRepos(null); onChanged(); }} className="text-xs text-white/40 hover:text-white/70">
              Clone a different repository (replaces the workspace)
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-xs text-white/50">Connected as <span className="text-white/80">{status.login}</span></div>
              <div className="flex items-center gap-2">
                {status.installUrl && <a href={status.installUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-cyan-300 hover:underline">Choose repositories</a>}
                <button type="button" onClick={disconnect} className="text-xs text-white/40 hover:text-white/70">Disconnect</button>
              </div>
            </div>
            {!picked ? (
              <>
                <div className="flex items-center gap-2">
                  <input value={filter} onChange={event => setFilter(event.target.value)} placeholder="Find a repository" className="flex-1 rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-white/90 placeholder:text-white/30 outline-none focus:border-cyan-400/50" />
                  <button type="button" onClick={() => { setRepos(null); listGithubRepos().then(setRepos).catch(() => undefined); }} className="p-2 rounded-lg hover:bg-white/10 text-white/60" aria-label="Refresh">
                    <RefreshCw className="w-4 h-4" />
                  </button>
                </div>
                {repos === null ? (
                  <p className="text-white/40 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Loading repositories…</p>
                ) : filtered.length === 0 ? (
                  <p className="text-white/40 text-xs">No repositories. Install the app on the ones you want to use with "Choose repositories".</p>
                ) : (
                  <div className="rounded-xl border border-white/10 divide-y divide-white/5 max-h-72 overflow-y-auto">
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
                <label className="block text-xs text-white/50">
                  Branch
                  {branches === null ? (
                    <div className="mt-1 text-white/40">Loading branches…</div>
                  ) : (
                    <select value={branch} onChange={event => setBranch(event.target.value)} className="mt-1 w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-white/90 outline-none">
                      {branches.map(name => <option key={name} value={name} className="bg-neutral-900">{name}</option>)}
                    </select>
                  )}
                </label>
                <p className="text-xs text-white/40">Cloning replaces everything in this workspace.</p>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={clone} disabled={busy === 'clone' || !branch} className="flex items-center gap-2 px-4 py-2 rounded-full bg-cyan-500/20 border border-cyan-400/30 text-cyan-100 hover:bg-cyan-500/30 disabled:opacity-50">
                    {busy === 'clone' && <Loader2 className="w-4 h-4 animate-spin" />} Clone into workspace
                  </button>
                  <button type="button" onClick={() => pick(null)} className="text-xs text-white/40 hover:text-white/70">Back</button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
