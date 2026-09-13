import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { listWorkspace, readWorkspaceFile, writeWorkspaceFile, writeWorkspaceFiles } from './workspaceStore';
import { nodeRuntime } from './nodeRuntime';

const mock = vi.hoisted(() => ({ files: new Map<string, Uint8Array>(), spawn: vi.fn(), boot: vi.fn() }));
vi.mock('@webcontainer/api', () => ({ WebContainer: { boot: async () => {
  mock.boot();
  return {
    on: vi.fn(), spawn: mock.spawn,
    fs: {
      readdir: async (dir: string) => {
        const prefix = dir === '.' ? '' : `${dir}/`;
        const names = new Map<string, boolean>();
        for (const path of mock.files.keys()) if (path.startsWith(prefix)) {
          const rest = path.slice(prefix.length);
          const name = rest.split('/')[0];
          names.set(name, rest.includes('/'));
        }
        return [...names].map(([name, directory]) => ({ name, isDirectory: () => directory, isFile: () => !directory }));
      },
      mkdir: async () => undefined,
      rm: async (path: string) => { for (const key of mock.files.keys()) if (key === path || key.startsWith(`${path}/`)) mock.files.delete(key); },
      writeFile: async (path: string, content: string | Uint8Array) => { mock.files.set(path, typeof content === 'string' ? new TextEncoder().encode(content) : content); },
      readFile: async (path: string) => mock.files.get(path)!,
    },
  };
} } }));
function processResult(output = '', exit: Promise<number> = Promise.resolve(0)) {
  return { output: new ReadableStream<string>({ start(c) { c.enqueue(output); c.close(); } }), exit, kill: vi.fn() };
}
const put = (path: string, text: string) => mock.files.set(path, new TextEncoder().encode(text));

describe('runtime lifecycle', () => {
  beforeEach(() => { mock.spawn.mockReset(); mock.spawn.mockImplementation(async () => processResult()); });
  it('syncs changes beyond file 400 and command deletions', async () => {
    await writeWorkspaceFiles('runtime-large', Array.from({ length: 450 }, (_, i) => ({ path: `file-${String(i).padStart(3, '0')}.ts`, content: 'old' })));
    mock.spawn.mockImplementationOnce(async () => { mock.files.delete('file-000.ts'); put('file-449.ts', 'updated'); return processResult(); });
    const result = await nodeRuntime().run('runtime-large', 'generate', { timeoutMs: 1000 });
    expect(result.syncedBack).toEqual(['file-000.ts', 'file-449.ts']);
    expect((await readWorkspaceFile('runtime-large', 'file-449.ts'))?.text).toBe('updated');
    expect(await listWorkspace('runtime-large')).toHaveLength(449);
  });
  it('keeps the last error after a large amount of command output', async () => {
    mock.spawn.mockImplementationOnce(async () => processResult('x'.repeat(250000) + 'FINAL ERROR'));
    const result = await nodeRuntime().run('runtime-output', 'test', { timeoutMs: 1000 });
    expect(result.output).toHaveLength(200000);
    expect(result.output.endsWith('FINAL ERROR')).toBe(true);
  });
  it('does not spawn an already-cancelled command', async () => {
    await expect(nodeRuntime().run('runtime-cancel', 'destroy', { timeoutMs: 1000, signal: AbortSignal.abort() })).rejects.toThrow();
    expect(mock.spawn).not.toHaveBeenCalled();
  });
  it('serializes commands across sessions until sync back completes', async () => {
    let finish!: (code: number) => void;
    const exit = new Promise<number>(resolve => { finish = resolve; });
    mock.spawn.mockImplementationOnce(async () => processResult('', exit));
    const first = nodeRuntime().run('runtime-first', 'slow', { timeoutMs: 10000 });
    await vi.waitFor(() => expect(mock.spawn).toHaveBeenCalledTimes(1));
    const second = nodeRuntime().run('runtime-second', 'next', { timeoutMs: 1000 });
    await Promise.resolve();
    expect(mock.spawn).toHaveBeenCalledTimes(1);
    finish(0);
    await Promise.all([first, second]);
    expect(mock.spawn).toHaveBeenCalledTimes(2);
  });
  it('reports an editor conflict and remounts the user version before the next command', async () => {
    await writeWorkspaceFile('runtime-conflict', 'a.ts', 'old');
    mock.spawn.mockImplementationOnce(async () => { put('a.ts', 'command'); await writeWorkspaceFile('runtime-conflict', 'a.ts', 'user'); return processResult(); });
    await expect(nodeRuntime().run('runtime-conflict', 'generate', { timeoutMs: 1000 })).rejects.toThrow('Kept concurrent workspace edits');
    await nodeRuntime().run('runtime-conflict', 'verify', { timeoutMs: 1000 });
    expect(new TextDecoder().decode(mock.files.get('a.ts'))).toBe('user');
    expect((await readWorkspaceFile('runtime-conflict', 'a.ts'))?.text).toBe('user');
  });
});

it('bounds an unacknowledged kill and blocks later commands instead of hanging forever', async () => {
  const { NodeRuntime } = await import('./nodeRuntime');
  const runtime = new NodeRuntime();
  const process = processResult('', new Promise<number>(() => undefined));
  mock.spawn.mockReset();
  mock.spawn.mockResolvedValue(process);
  const running = runtime.run('runtime-stuck', 'stuck', { timeoutMs: 20 });
  const assertion = expect(running).rejects.toThrow('did not acknowledge stopping');
  await assertion;
  expect(process.kill).toHaveBeenCalledTimes(1);
  await expect(runtime.run('runtime-stuck', 'another', { timeoutMs: 20 })).rejects.toThrow('Further commands are paused');
  expect(mock.spawn).toHaveBeenCalledTimes(1);
});
