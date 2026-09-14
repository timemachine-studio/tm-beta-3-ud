import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { listWorkspace, readWorkspaceFile, writeWorkspaceFile, writeWorkspaceFiles } from './workspaceStore';
import { nodeRuntime } from './nodeRuntime';

const mock = vi.hoisted(() => ({
  files: new Map<string, Uint8Array>(), spawn: vi.fn(), boot: vi.fn(),
  handlers: new Map<string, (...args: never[]) => void>(),
}));
vi.mock('@webcontainer/api', () => ({ WebContainer: { boot: async () => {
  mock.boot();
  return {
    on: (event: string, handler: (...args: never[]) => void) => { mock.handlers.set(event, handler); },
    spawn: mock.spawn,
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

describe('an empty runtime never empties the workspace', () => {
  beforeEach(() => { mock.spawn.mockReset(); mock.spawn.mockImplementation(async () => processResult()); });
  it('refuses to mirror a container that has lost every file', async () => {
    const { NodeRuntime } = await import('./nodeRuntime');
    await writeWorkspaceFiles('runtime-void', [{ path: 'a.ts', content: 'a' }, { path: 'b.ts', content: 'b' }]);
    const runtime = new NodeRuntime();
    mock.spawn.mockImplementationOnce(async () => { mock.files.clear(); return processResult(); });
    await expect(runtime.run('runtime-void', 'oops', { timeoutMs: 1000 })).rejects.toThrow('came back empty');
    expect(await listWorkspace('runtime-void')).toHaveLength(2);
    // The next command re-mounts from the store and carries on.
    await runtime.run('runtime-void', 'again', { timeoutMs: 1000 });
    expect(mock.files.has('a.ts')).toBe(true);
  });
});

describe('the terminal and the preview', () => {
  beforeEach(() => { mock.spawn.mockReset(); mock.spawn.mockImplementation(async () => processResult()); });
  it('replays output to a terminal opened after the fact', async () => {
    const { NodeRuntime } = await import('./nodeRuntime');
    const runtime = new NodeRuntime();
    mock.spawn.mockImplementationOnce(async () => processResult('hello from earlier\n'));
    await runtime.run('runtime-history', 'echo', { timeoutMs: 1000 });
    expect(runtime.outputHistory()).toContain('$ echo');
    expect(runtime.outputHistory()).toContain('hello from earlier');
  });
  it('shows a server the user started from the shell, named by what they typed', async () => {
    const { NodeRuntime } = await import('./nodeRuntime');
    const { previewController } = await import('./previewController');
    const shown = vi.spyOn(previewController, 'showUrl').mockResolvedValue({ console: [], errors: 0, loaded: true });
    const runtime = new NodeRuntime();
    await runtime.run('runtime-shell', 'true', { timeoutMs: 1000 });
    runtime.noteShellCommand('npm run dev');
    (mock.handlers.get('server-ready') as (port: number, url: string) => void)(5173, 'https://p.example');
    expect(shown).toHaveBeenCalledWith('runtime-shell', 'https://p.example', 'npm run dev');
    shown.mockRestore();
  });
  it('does not treat the harness\'s own server as a shell one', async () => {
    const { NodeRuntime } = await import('./nodeRuntime');
    const { previewController } = await import('./previewController');
    const shown = vi.spyOn(previewController, 'showUrl').mockResolvedValue({ console: [], errors: 0, loaded: true });
    const runtime = new NodeRuntime();
    mock.spawn.mockImplementationOnce(async () => processResult('', new Promise<number>(() => undefined)));
    const started = runtime.startServer('runtime-harness', 'npm run dev', { timeoutMs: 5000 });
    await vi.waitFor(() => expect(mock.spawn).toHaveBeenCalledTimes(1));
    (mock.handlers.get('server-ready') as (port: number, url: string) => void)(5173, 'https://p.example');
    expect((await started).url).toBe('https://p.example');
    expect(shown).not.toHaveBeenCalled();
    shown.mockRestore();
  });
  it('installs before restarting a remembered server when nothing is installed', async () => {
    const { NodeRuntime } = await import('./nodeRuntime');
    const { previewController } = await import('./previewController');
    vi.spyOn(previewController, 'showUrl').mockResolvedValue({ console: [], errors: 0, loaded: true });
    await writeWorkspaceFile('runtime-restart', 'package.json', '{}');
    const runtime = new NodeRuntime();
    const commands: string[] = [];
    mock.spawn.mockImplementation(async (_bin: string, args: string[]) => {
      commands.push(args[1]);
      if (args[1] === 'npm run dev') {
        setTimeout(() => (mock.handlers.get('server-ready') as (port: number, url: string) => void)(5173, 'https://p.example'), 0);
        return processResult('', new Promise<number>(() => undefined));
      }
      return processResult();
    });
    const result = await runtime.restartServer('runtime-restart', 'npm run dev', { timeoutMs: 5000 });
    expect(commands).toEqual(['npm install', 'npm run dev']);
    expect(result.url).toBe('https://p.example');
    expect(previewController.showUrl).toHaveBeenCalledWith('runtime-restart', 'https://p.example', 'npm run dev', undefined);
    vi.restoreAllMocks();
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
