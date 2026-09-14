import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cloneRepoIntoWorkspace, commitToBranch, createRepositoryForWorkspace, openPullRequestFromWorkspace, pullLatestIntoWorkspace, unlinkRepository } from './githubService';
import { getWorkspaceMeta, listWorkspace, readWorkspaceFile, updateWorkspaceMeta, writeWorkspaceFile } from './workspaceStore';
vi.mock('../../lib/supabase', () => ({ supabase: { auth: { getSession: async () => ({ data: { session: { access_token: 'test-token' } } }) } } }));
afterEach(() => { vi.unstubAllGlobals(); });
const repo = { owner: 'o', name: 'r', branch: 'main' };
const frame = (value: unknown) => JSON.stringify(value) + '\n';

describe('GitHub workspace safety', () => {
  it('a truncated clone preserves the previous workspace and metadata', async () => {
    await writeWorkspaceFile('clone-fail', 'valuable.ts', 'unsaved project');
    await updateWorkspaceMeta('clone-fail', { mode: 'edit' });
    const files = Array.from({ length: 101 }, (_, i) => frame({ type: 'file', path: `${i}.ts`, sha: 'a', content: 'new' })).join('');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(files)));
    await expect(cloneRepoIntoWorkspace('clone-fail', repo)).rejects.toThrow('stopped before it finished');
    expect((await listWorkspace('clone-fail')).map(entry => entry.path)).toEqual(['valuable.ts']);
    expect((await getWorkspaceMeta('clone-fail'))?.mode).toBe('edit');
  });
  it('atomically promotes a complete clone and preserves the chosen mode', async () => {
    await writeWorkspaceFile('clone-ok', 'old.ts', 'old');
    await updateWorkspaceMeta('clone-ok', { mode: 'auto' });
    const body = frame({ type: 'file', path: 'new.ts', sha: 'a', content: 'new' }) + JSON.stringify({ type: 'done', commit: 'c'.repeat(40), written: 1, skipped: 0, truncated: false });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(body)));
    await cloneRepoIntoWorkspace('clone-ok', repo);
    expect((await listWorkspace('clone-ok')).map(entry => entry.path)).toEqual(['new.ts']);
    expect((await getWorkspaceMeta('clone-ok'))?.mode).toBe('auto');
  });
  it('publishes the reviewed snapshot even if the editor changes while approval is pending', async () => {
    await writeWorkspaceFile('publish-snapshot', 'a.ts', 'reviewed');
    await updateWorkspaceMeta('publish-snapshot', { repo: { ...repo, baseCommit: 'b'.repeat(40), baseShas: {} } });
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ number: 1, url: 'https://github.com/o/r/pull/1', branch: 'tm/test', commit: 'c'.repeat(40) })));
    vi.stubGlobal('fetch', fetcher);
    const result = await openPullRequestFromWorkspace('publish-snapshot', { title: 'Fix', body: '', branch: 'tm/test', approve: async proposal => {
      expect(proposal.changes[0].content).toBe('reviewed');
      expect(fetcher).not.toHaveBeenCalled();
      await writeWorkspaceFile('publish-snapshot', 'a.ts', 'new local edit');
      return true;
    } });
    expect(result.ok).toBe(true);
    const sent = JSON.parse(fetcher.mock.calls[0][1].body);
    expect(sent.changes[0].content).toBe('reviewed');
    expect(sent.expectedHead).toBe('b'.repeat(40));
    expect((await readWorkspaceFile('publish-snapshot', 'a.ts'))?.text).toBe('new local edit');
    expect((await getWorkspaceMeta('publish-snapshot'))?.repo?.baseCommit).toBe('c'.repeat(40));
  });
  it('never sends a publication the user declined', async () => {
    await writeWorkspaceFile('publish-denied', 'a.ts', 'local');
    await updateWorkspaceMeta('publish-denied', { repo: { ...repo, baseCommit: 'b'.repeat(40), baseShas: {} } });
    const fetcher = vi.fn();
    vi.stubGlobal('fetch', fetcher);
    expect((await openPullRequestFromWorkspace('publish-denied', { title: 'Fix', body: '', approve: async () => false })).ok).toBe(false);
    expect(fetcher).not.toHaveBeenCalled();
  });
});

describe('repositories from scratch, direct commits, and pulling', () => {
  it('creates a repository, links it with an empty baseline, and the first commit sends every file', async () => {
    await writeWorkspaceFile('create-repo', 'index.html', '<h1>hi</h1>');
    const fetcher = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ owner: 'me', name: 'fresh', defaultBranch: 'main', url: 'https://github.com/me/fresh' })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ number: null, url: 'https://github.com/me/fresh/tree/main', branch: 'main', commit: 'c'.repeat(40) })));
    vi.stubGlobal('fetch', fetcher);
    const created = await createRepositoryForWorkspace('create-repo', { name: 'fresh', private: true });
    expect(created.name).toBe('fresh');
    expect((await getWorkspaceMeta('create-repo'))?.repo).toMatchObject({ owner: 'me', name: 'fresh', branch: 'main', baseCommit: '', baseShas: {} });
    const pushed = await commitToBranch('create-repo', { title: 'Initial commit', body: '' });
    expect(pushed).toMatchObject({ ok: true, number: null, branch: 'main', changedFiles: 1 });
    const sent = JSON.parse(fetcher.mock.calls[1][1].body);
    expect(sent).toMatchObject({ mode: 'direct', expectedHead: '', base: 'main' });
    expect(sent.changes.map((change: { path: string }) => change.path)).toEqual(['index.html']);
    const after = (await getWorkspaceMeta('create-repo'))?.repo;
    expect(after?.baseCommit).toBe('c'.repeat(40));
    expect(after?.pullRequest).toBeUndefined();
  });
  it('pulls remote changes into unchanged files, keeps local edits, reports both-sided changes, and forgets the old pull request', async () => {
    const sha = async (text: string) => {
      const { gitBlobSha } = await import('./githubService');
      return gitBlobSha(new TextEncoder().encode(text));
    };
    await writeWorkspaceFile('pull-merge', 'same.ts', 'base');
    await writeWorkspaceFile('pull-merge', 'mine.ts', 'my edit');
    await writeWorkspaceFile('pull-merge', 'both.ts', 'my version');
    await writeWorkspaceFile('pull-merge', 'gone.ts', 'base');
    await updateWorkspaceMeta('pull-merge', { repo: { ...repo, baseCommit: 'b'.repeat(40), pullRequest: { branch: 'tm/old', number: 3, url: 'u' }, baseShas: {
      'same.ts': await sha('base'), 'mine.ts': await sha('base'), 'both.ts': await sha('base'), 'gone.ts': await sha('base'),
    } } });
    const body = [
      frame({ type: 'file', path: 'same.ts', sha: await sha('remote'), content: 'remote' }),
      frame({ type: 'file', path: 'mine.ts', sha: await sha('base'), content: 'base' }),
      frame({ type: 'file', path: 'both.ts', sha: await sha('their version'), content: 'their version' }),
      frame({ type: 'file', path: 'added.ts', sha: await sha('new'), content: 'new' }),
      JSON.stringify({ type: 'done', commit: 'n'.repeat(40), written: 4, skipped: 0, truncated: false }),
    ].join('');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(body)));
    const result = await pullLatestIntoWorkspace('pull-merge');
    expect(result).toEqual({ updated: ['added.ts', 'same.ts'], removed: ['gone.ts'], conflicts: ['both.ts'], commit: 'n'.repeat(40) });
    expect((await readWorkspaceFile('pull-merge', 'same.ts'))?.text).toBe('remote');
    expect((await readWorkspaceFile('pull-merge', 'mine.ts'))?.text).toBe('my edit');
    expect((await readWorkspaceFile('pull-merge', 'both.ts'))?.text).toBe('my version');
    expect(await readWorkspaceFile('pull-merge', 'gone.ts')).toBeNull();
    const after = (await getWorkspaceMeta('pull-merge'))?.repo;
    expect(after?.baseCommit).toBe('n'.repeat(40));
    expect(after?.pullRequest).toBeUndefined();
    expect(Object.keys(after?.baseShas ?? {}).sort()).toEqual(['added.ts', 'both.ts', 'mine.ts', 'same.ts']);
  });
  it('unlinking forgets the repository and keeps the files', async () => {
    await writeWorkspaceFile('unlink', 'a.ts', 'a');
    await updateWorkspaceMeta('unlink', { repo: { ...repo, baseCommit: 'b'.repeat(40), baseShas: {} } });
    await unlinkRepository('unlink');
    expect((await getWorkspaceMeta('unlink'))?.repo).toBeUndefined();
    expect(await listWorkspace('unlink')).toHaveLength(1);
  });
});
