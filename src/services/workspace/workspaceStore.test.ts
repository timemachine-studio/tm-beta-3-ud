import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { MAX_WORKSPACE_FILES } from '../../../shared/maxMode';
import { listWorkspace, readWorkspaceFile, reconcileWorkspaceRuntime, writeWorkspaceFile, writeWorkspaceFiles, type WorkspaceFile } from './workspaceStore';

async function baseline(session: string): Promise<Map<string, WorkspaceFile>> {
  const result = new Map<string, WorkspaceFile>();
  for (const entry of await listWorkspace(session)) result.set(entry.path, (await readWorkspaceFile(session, entry.path))!);
  return result;
}

describe('workspace transactions', () => {
  it('counts only new paths when a batch updates existing files at capacity', async () => {
    const session = 'capacity';
    await writeWorkspaceFiles(session, Array.from({ length: MAX_WORKSPACE_FILES - 1 }, (_, i) => ({ path: `${i}.txt`, content: 'old' })));
    const result = await writeWorkspaceFiles(session, [{ path: '0.txt', content: 'changed' }, { path: 'new.txt', content: 'new' }, { path: 'overflow.txt', content: 'no' }]);
    expect(result.written).toEqual(['0.txt', 'new.txt']);
    expect(result.skipped).toEqual([{ path: 'overflow.txt', reason: 'workspace full' }]);
    expect(await listWorkspace(session)).toHaveLength(MAX_WORKSPACE_FILES);
  });
  it('rejects file/directory collisions within the same import batch', async () => {
    const result = await writeWorkspaceFiles('clash', [{ path: 'src', content: 'file' }, { path: 'src/a.ts', content: 'bad' }, { path: 'lib/a.ts', content: 'ok' }, { path: 'lib', content: 'bad' }]);
    expect(result.written).toEqual(['src', 'lib/a.ts']);
    expect(result.skipped).toHaveLength(2);
  });
  it('persists command deletions and additions together', async () => {
    await writeWorkspaceFiles('delete', [{ path: 'old.ts', content: 'old' }, { path: 'keep.ts', content: 'keep' }]);
    const result = await reconcileWorkspaceRuntime('delete', await baseline('delete'), [{ path: 'keep.ts', content: 'keep' }, { path: 'new.ts', content: 'new' }], new Set(['keep.ts', 'new.ts']));
    expect(result.changed).toEqual(['old.ts', 'new.ts']);
    expect((await listWorkspace('delete')).map(entry => entry.path)).toEqual(['keep.ts', 'new.ts']);
  });
  it('preserves concurrent editor changes against both command writes and deletions', async () => {
    await writeWorkspaceFiles('conflict', [{ path: 'edit.ts', content: 'old' }, { path: 'delete.ts', content: 'old' }]);
    const before = await baseline('conflict');
    await writeWorkspaceFiles('conflict', [{ path: 'edit.ts', content: 'user edit' }, { path: 'delete.ts', content: 'user edit' }]);
    const result = await reconcileWorkspaceRuntime('conflict', before, [{ path: 'edit.ts', content: 'command edit' }], new Set(['edit.ts']));
    expect(result.conflicts.sort()).toEqual(['delete.ts', 'edit.ts']);
    expect(result.changed).toEqual([]);
    expect((await readWorkspaceFile('conflict', 'edit.ts'))?.text).toBe('user edit');
    expect((await readWorkspaceFile('conflict', 'delete.ts'))?.text).toBe('user edit');
  });
  it('does not overwrite a concurrent new file', async () => {
    await writeWorkspaceFile('new-conflict', 'new.ts', 'user');
    expect((await reconcileWorkspaceRuntime('new-conflict', new Map(), [{ path: 'new.ts', content: 'agent' }], new Set(['new.ts']))).conflicts).toEqual(['new.ts']);
    expect((await readWorkspaceFile('new-conflict', 'new.ts'))?.text).toBe('user');
  });
});
