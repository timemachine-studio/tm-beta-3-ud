import { previewController } from './previewController';
/**
 * The Node runtime Max Mode runs commands in: a WebContainer, in the browser.
 *
 * Nothing about the project leaves the device to be run. npm installs, tests
 * run, dev servers serve — inside a tab. That is the whole reason to accept
 * the cross-origin-isolation headers the /max route carries (vercel.json):
 * WebContainers need `SharedArrayBuffer`, and a page only gets that when it
 * is isolated, which is why Max Mode is its own route rather than a mode of
 * the main chat page.
 *
 * One container per tab, booted on first use and kept. The workspace store
 * is the source of truth; the container's filesystem is a working copy that
 * is written before a command runs and read back after it finishes, so an
 * `npm init` or a code generator's output lands in the store like any edit.
 * `node_modules` and friends never sync — they are the container's business.
 */

import type { WebContainer, WebContainerProcess } from '@webcontainer/api';
import { isIgnoredWorkspacePath, MAX_WORKSPACE_FILE_BYTES, MAX_WORKSPACE_FILES } from '../../../shared/maxMode';
import {
  listWorkspace,
  looksLikeText,
  readWorkspaceFile,
  reconcileWorkspaceRuntime,
  sameWorkspaceContent,
  type WorkspaceFile,
} from './workspaceStore';

export interface CommandResult {
  output: string;
  exitCode: number;
  timedOut: boolean;
  durationMs: number;
  /** Workspace paths the command changed, now written back to the store. */
  syncedBack: string[];
}

export interface RunOptions {
  timeoutMs: number;
  signal?: AbortSignal;
  onPhase?: (phase: string) => void;
}

export interface ServerResult {
  url: string | null;
  port: number | null;
  output: string;
}

/** A line of terminal output from anything the runtime ran, for the panel. */
export type RuntimeOutputListener = (chunk: string, source: 'command' | 'server' | 'system') => void;

/** Whether this page can boot a container at all. */
export function nodeRuntimeSupported(): boolean {
  return typeof window !== 'undefined'
    && typeof SharedArrayBuffer !== 'undefined'
    && (window as { crossOriginIsolated?: boolean }).crossOriginIsolated === true;
}

const MAX_OUTPUT_CHARS = 200_000;
const MAX_SYNC_BACK_FILES = MAX_WORKSPACE_FILES;

// Built from code points rather than written as literals: the control
// characters are the point, and a literal one in a regex is a lint error.
const ESC = String.fromCharCode(0x1b);
const BEL = String.fromCharCode(0x07);
const ANSI_CSI = new RegExp(`${ESC}\\[[0-9;?]*[A-Za-z]`, 'g');
const ANSI_OSC = new RegExp(`${ESC}\\][^${BEL}]*${BEL}`, 'g');

function stripAnsi(text: string): string {
  // Terminal colour and cursor codes read as garbage in a transcript.
  return text.replace(ANSI_CSI, '').replace(ANSI_OSC, '').replace(/\r/g, '');
}

export class NodeRuntime {
  private booting: Promise<WebContainer> | null = null;
  private container: WebContainer | null = null;
  private fault: string | null = null;

  private assertAvailable(): void {
    if (this.fault) throw new Error(this.fault);
  }
  /** Which session's files are in the container, and what version of each. */
  private mountedSession: string | null = null;
  private mountedFiles = new Map<string, WorkspaceFile>();
  private queue: Promise<unknown> = Promise.resolve();

  private exclusive<T>(work: () => Promise<T>): Promise<T> {
    const result = this.queue.then(work);
    this.queue = result.catch(() => undefined);
    return result;
  }
  private server: { process: WebContainerProcess; command: string; url: string | null; port: number | null } | null = null;
  private outputListeners = new Set<RuntimeOutputListener>();
  private serverReady: Array<(ready: { url: string; port: number }) => void> = [];

  onOutput(listener: RuntimeOutputListener): () => void {
    this.outputListeners.add(listener);
    return () => { this.outputListeners.delete(listener); };
  }

  private emit(chunk: string, source: 'command' | 'server' | 'system'): void {
    for (const listener of this.outputListeners) {
      try { listener(chunk, source); } catch (error) { console.error('Runtime output listener failed:', error); }
    }
  }

  /** Boot once. A second call while booting waits for the first. */
  async boot(onPhase?: (phase: string) => void): Promise<WebContainer> {
    if (this.container) return this.container;
    if (!this.booting) {
      onPhase?.('Starting the Node runtime (first run takes a moment)');
      this.emit('Booting Node runtime…\n', 'system');
      this.booting = import('@webcontainer/api').then(async ({ WebContainer }) => {
        const container = await WebContainer.boot({ coep: 'credentialless', workdirName: 'workspace', forwardPreviewErrors: true });
        container.on('server-ready', (port, url) => {
          if (this.server) { this.server.url = url; this.server.port = port; }
          this.emit(`Server ready on port ${port}: ${url}\n`, 'system');
          const waiting = this.serverReady;
          this.serverReady = [];
          for (const resolve of waiting) resolve({ url, port });
        });
        container.on('preview-message', message => {
          if (!this.mountedSession || !this.server || this.server.port !== message.port) return;
          const text = 'message' in message ? message.message : message.args.map((value: unknown) => {
            try { return typeof value === 'string' ? value : JSON.stringify(value); }
            catch { return String(value); }
          }).join(' ');
          previewController.recordRuntimeError(this.mountedSession, text);
        });
        container.on('error', (error) => {
          this.emit(`Runtime error: ${error.message}\n`, 'system');
        });
        this.container = container;
        this.emit('Node runtime ready.\n', 'system');
        return container;
      }).catch((error: unknown) => {
        this.booting = null;
        throw error;
      });
    }
    return this.booting;
  }

  /** Store → container. Only files whose version changed since the last sync. */
  async sync(sessionId: string, onPhase?: (phase: string) => void): Promise<void> {
    const container = await this.boot(onPhase);
    if (this.mountedSession !== sessionId) {
      // A different chat's project: wipe the working copy so nothing leaks
      // between workspaces, node_modules included.
      onPhase?.('Loading the workspace into the runtime');
      this.stopServer();
      const entries = await container.fs.readdir('.', { withFileTypes: true });
      for (const entry of entries) {
        await container.fs.rm(entry.name, { recursive: true, force: true });
      }
      this.mountedFiles.clear();
      this.mountedSession = sessionId;
      this.server = null;
    }

    const entries = await listWorkspace(sessionId);
    const present = new Set(entries.map(entry => entry.path));
    // Files deleted in the store since the last sync go from the container too.
    for (const path of [...this.mountedFiles.keys()]) {
      if (!present.has(path)) {
        await container.fs.rm(path, { force: true }).catch(() => undefined);
        this.mountedFiles.delete(path);
      }
    }
    for (const entry of entries) {
      const file = await readWorkspaceFile(sessionId, entry.path);
      if (!file || sameWorkspaceContent(this.mountedFiles.get(entry.path) ?? null, file)) continue;
      const dir = entry.path.includes('/') ? entry.path.slice(0, entry.path.lastIndexOf('/')) : '';
      if (dir) await container.fs.mkdir(dir, { recursive: true });
      await container.fs.writeFile(entry.path, file.bytes ?? file.text ?? '');
      this.mountedFiles.set(entry.path, file);
    }
  }

  /** Container → store, for everything a command may have written. */
  private async syncBack(sessionId: string): Promise<string[]> {
    const container = await this.boot();
    const found: Array<{ path: string; content: string | Uint8Array }> = [];
    const present = new Set<string>();
    const skipped: string[] = [];
    const walk = async (dir: string): Promise<void> => {
      const entries = await container.fs.readdir(dir || '.', { withFileTypes: true });
      for (const entry of entries) {
        const path = dir ? `${dir}/${entry.name}` : entry.name;
        if (isIgnoredWorkspacePath(path)) continue;
        if (entry.isDirectory()) { await walk(path); continue; }
        present.add(path);
        if (present.size > MAX_SYNC_BACK_FILES) {
          throw new Error(`Runtime produced more than ${MAX_SYNC_BACK_FILES} files. Sync stopped; files remain in the runtime. Remove generated output or move it to an ignored directory, then retry.`);
        }
        if (!entry.isFile()) { skipped.push(path); continue; }
        const bytes = await container.fs.readFile(path);
        if (bytes.byteLength > MAX_WORKSPACE_FILE_BYTES) { skipped.push(path); continue; }
        found.push({ path, content: looksLikeText(bytes) ? new TextDecoder().decode(bytes) : bytes });
      }
    };
    await walk('');
    const result = await reconcileWorkspaceRuntime(sessionId, this.mountedFiles, found, present);
    // Track what is actually in the runtime, not a newer concurrent UI edit.
    // The next sync can then restore that edit (or remove a UI-deleted file).
    for (const path of this.mountedFiles.keys()) if (!present.has(path)) this.mountedFiles.delete(path);
    for (const file of found) {
      if (result.skipped.includes(file.path)) continue;
      const bytes = typeof file.content === 'string' ? null : file.content;
      this.mountedFiles.set(file.path, {
        path: file.path, text: typeof file.content === 'string' ? file.content : null, bytes,
        size: bytes?.byteLength ?? new TextEncoder().encode(file.content as string).byteLength,
        binary: bytes !== null, updatedAt: '',
      });
    }
    const unsaved = [...skipped, ...result.skipped];
    if (result.conflicts.length || unsaved.length) {
      throw new Error(`Runtime sync saved ${result.changed.length} changes. ${result.conflicts.length ? `Kept concurrent workspace edits in: ${result.conflicts.join(', ')}. ` : ''}${unsaved.length ? `Could not save runtime files: ${unsaved.join(', ')}. Files remain in the runtime.` : ''}`);
    }
    return result.changed;
  }

  /** Run one command to completion. */
  run(sessionId: string, command: string, options: RunOptions): Promise<CommandResult> {
    return this.exclusive(() => this.runCommand(sessionId, command, options));
  }

  private async runCommand(sessionId: string, command: string, options: RunOptions): Promise<CommandResult> {
    this.assertAvailable();
    options.signal?.throwIfAborted();
    await this.sync(sessionId, options.onPhase);
    const container = await this.boot();
    options.signal?.throwIfAborted();
    options.onPhase?.(`Running ${command.slice(0, 60)}`);
    this.emit(`$ ${command}\n`, 'command');

    const started = Date.now();
    const process = await container.spawn('jsh', ['-c', command], { terminal: { cols: 120, rows: 40 } });
    let output = '';
    const reader = process.output.getReader();
    const pump = (async () => {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        const clean = stripAnsi(value);
        output = (output + clean).slice(-MAX_OUTPUT_CHARS);
        this.emit(clean, 'command');
      }
    })();

    let timedOut = false;
    let exitCode: number;
    try {
      exitCode = await new Promise<number>((resolve, reject) => {
        let settled = false;
        let killTimer: ReturnType<typeof setTimeout> | undefined;
        const finish = (code: number | null, error?: unknown) => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          clearTimeout(killTimer);
          options.signal?.removeEventListener('abort', onAbort);
          if (code === null) reject(error);
          else resolve(code);
        };
        const kill = () => {
          if (settled || killTimer) return;
          try { process.kill(); }
          catch (error) { finish(null, error); return; }
          killTimer = setTimeout(() => {
            this.fault = 'The runtime did not acknowledge stopping the process. Further commands are paused to protect the workspace. Reload Max Mode to restart the runtime; the last saved workspace is retained.';
            finish(null, new Error(this.fault));
          }, 2000);
        };
        const onAbort = () => kill();
        const timer = setTimeout(() => { timedOut = true; kill(); }, options.timeoutMs);
        options.signal?.addEventListener('abort', onAbort, { once: true });
        process.exit.then(code => finish(code), error => finish(null, error));
        if (options.signal?.aborted) onAbort();
      });
      // Some child processes keep stdout open after their parent exits.
      let drainTimer: ReturnType<typeof setTimeout> | undefined;
      await Promise.race([
        pump.catch(() => undefined),
        new Promise<void>(resolve => { drainTimer = setTimeout(resolve, 1000); }),
      ]);
      clearTimeout(drainTimer);
    } finally {
      void reader.cancel().catch(() => undefined);
      // Attach a rejection handler even when waiting for process.exit failed.
      void pump.catch(() => undefined);
    }
    const durationMs = Date.now() - started;
    this.emit(`[exit ${exitCode}${timedOut ? ', timed out' : ''} · ${(durationMs / 1000).toFixed(1)}s]\n`, 'system');

    const syncedBack = await this.syncBack(sessionId);
    return { output, exitCode, timedOut, durationMs, syncedBack };
  }

  /**
   * Start a long-running server and resolve once it is listening.
   *
   * The previous server is killed first: one preview, one port, and a
   * second `npm run dev` on a taken port is a confusing failure the model
   * would then try to fix.
   */
  startServer(sessionId: string, command: string, options: RunOptions): Promise<ServerResult> {
    return this.exclusive(() => this.launchServer(sessionId, command, options));
  }

  private async launchServer(sessionId: string, command: string, options: RunOptions): Promise<ServerResult> {
    this.assertAvailable();
    options.signal?.throwIfAborted();
    await this.sync(sessionId, options.onPhase);
    const container = await this.boot();
    options.signal?.throwIfAborted();
    this.stopServer();
    this.emit(`$ ${command}   (background)\n`, 'server');

    let earlyReady: { url: string; port: number } | null = null;
    const captureReady = (value: { url: string; port: number }) => { earlyReady = value; };
    this.serverReady.push(captureReady);
    let process: WebContainerProcess;
    try {
      process = await container.spawn('jsh', ['-c', command], { terminal: { cols: 120, rows: 40 } });
    } finally {
      this.serverReady = this.serverReady.filter(listener => listener !== captureReady);
    }
    const initial = earlyReady as { url: string; port: number } | null;
    const server = { process, command, url: initial?.url ?? null, port: initial?.port ?? null };
    this.server = server;
    let output = '';
    const reader = process.output.getReader();
    void (async () => {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        const clean = stripAnsi(value);
        output = (output + clean).slice(-MAX_OUTPUT_CHARS);
        this.emit(clean, 'server');
      }
    })().catch(() => undefined);

    const ready = await new Promise<{ url: string; port: number } | null>((resolve) => {
      const finish = (value: { url: string; port: number } | null) => {
        clearTimeout(timer);
        this.serverReady = this.serverReady.filter(listener => listener !== onReady);
        options.signal?.removeEventListener('abort', onAbort);
        resolve(value);
      };
      const onReady = (value: { url: string; port: number }) => finish(value);
      const onAbort = () => { process.kill(); finish(null); };
      const timer = setTimeout(() => finish(null), options.timeoutMs);
      this.serverReady.push(onReady);
      const onExit = () => {
        if (this.server === server) this.server = null;
        finish(null);
      };
      process.exit.then(onExit, onExit);
      options.signal?.addEventListener('abort', onAbort, { once: true });
      if (options.signal?.aborted) onAbort();
      else if (server.url && server.port !== null) finish({ url: server.url, port: server.port });
    });
    if (!ready) {
      if (this.server === server) { process.kill(); this.server = null; }
      return { url: null, port: null, output };
    }
    // Anything a scaffold or build step wrote while starting up.
    await this.syncBack(sessionId);
    return { url: ready.url, port: ready.port, output };
  }

  stopServer(): void {
    if (!this.server) return;
    this.server.process.kill();
    this.emit(`[stopped ${this.server.command}]\n`, 'system');
    this.server = null;
  }

  currentServer(): { command: string; url: string | null; port: number | null } | null {
    return this.server ? { command: this.server.command, url: this.server.url, port: this.server.port } : null;
  }

  /** An interactive shell for the terminal tab. The caller owns the process. */
  spawnShell(sessionId: string, size: { cols: number; rows: number }): Promise<WebContainerProcess> {
    return this.exclusive(async () => {
      this.assertAvailable();
      await this.sync(sessionId);
      const container = await this.boot();
      return container.spawn('jsh', [], { terminal: size });
    });
  }

  /** After the user ran something in the shell: pull their changes into the store. */
  async pullChanges(sessionId: string): Promise<string[]> {
    if (this.mountedSession !== sessionId) return [];
    return this.exclusive(() => this.mountedSession === sessionId ? this.syncBack(sessionId) : Promise.resolve([]));
  }
}

let instance: NodeRuntime | null = null;

export function nodeRuntime(): NodeRuntime {
  if (!instance) instance = new NodeRuntime();
  return instance;
}
