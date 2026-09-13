import { describe, expect, it, vi } from 'vitest';
import { createWorkspaceExecutor } from './workspaceTools';
import { writeWorkspaceFile } from './workspaceStore';
vi.mock('./workspaceStore', () => ({ WorkspaceStorageError: class extends Error {}, writeWorkspaceFile: vi.fn(), readWorkspaceFile: vi.fn(), listWorkspace: vi.fn(), deleteWorkspacePath: vi.fn() }));

describe('workspace execution policy', () => {
  it.each(['write_file', 'edit_file', 'delete_file', 'run_command', 'open_preview', 'open_pull_request'] as const)('Plan refuses %s at execution time', async name => {
    const executor = createWorkspaceExecutor({ sessionId: 's', mode: 'plan' });
    expect(await executor.run(name, {}, {})).toMatchObject({ ok: false, content: expect.stringContaining('not allowed') });
    expect(writeWorkspaceFile).not.toHaveBeenCalled();
  });
  it.each(['run_command', 'open_preview', 'open_pull_request'] as const)('Edit refuses %s', async name => {
    expect(await createWorkspaceExecutor({ sessionId: 's', mode: 'edit' }).run(name, {}, {})).toMatchObject({ ok: false });
  });
  it('a stopped Auto turn cannot start another mutation', async () => {
    const signal = AbortSignal.abort();
    expect(await createWorkspaceExecutor({ sessionId: 's', mode: 'auto', signal }).run('write_file', { path: 'a', content: 'bad' }, {}))
      .toMatchObject({ ok: false, content: expect.stringContaining('stopped') });
    expect(writeWorkspaceFile).not.toHaveBeenCalled();
  });
});

it('refuses a missing write payload instead of replacing a file with an empty string', async () => {
  const result = await createWorkspaceExecutor({ sessionId: 's', mode: 'auto' }).run('write_file', { path: 'a.ts' }, {});
  expect(result).toMatchObject({ ok: false, content: expect.stringContaining('content must be string') });
  expect(writeWorkspaceFile).not.toHaveBeenCalled();
});
