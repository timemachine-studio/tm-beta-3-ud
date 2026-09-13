/**
 * What the preview pane shows, and what the page in it said.
 *
 * Two kinds of preview. A workspace HTML file is rendered as `srcdoc` in a
 * sandboxed iframe with its relative scripts, styles and images inlined from
 * the store — no server, instant, and its console comes back to the harness
 * through postMessage from a capture script injected at the top of <head>.
 * A dev server started in the Node runtime is shown by URL; that document is
 * on another origin and its console is not ours to read.
 *
 * This is a tiny store rather than React state because the harness (a
 * service) sets it and the panel (a component) shows it, and neither should
 * know the other exists.
 */

import { readWorkspaceFile } from './workspaceStore';

export type PreviewTarget =
  | { kind: 'html'; sessionId: string; path: string; srcdoc: string; generation: number }
  | { kind: 'url'; sessionId: string; url: string; command: string; generation: number };

export interface PreviewReport {
  console: string[];
  errors: number;
  loaded: boolean;
}

/** The sandbox the preview iframe must use. Never add allow-same-origin (CLAUDE.md 0.6). */
export const PREVIEW_SANDBOX = 'allow-scripts allow-modals allow-forms allow-popups';

const MAX_CONSOLE_LINES = 200;
const SETTLE_MS = 1_200;
const LOAD_TIMEOUT_MS = 5_000;

const MIME_BY_EXT: Record<string, string> = {
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp',
  svg: 'image/svg+xml', ico: 'image/x-icon', woff: 'font/woff', woff2: 'font/woff2', ttf: 'font/ttf',
  mp3: 'audio/mpeg', wav: 'audio/wav', mp4: 'video/mp4', json: 'application/json',
};

/** Runs first in the framed page: forwards console output and errors to the parent. */
function captureScript(generation: number): string {
  return `<script>(function(){
var g=${generation};var send=function(level,args){try{var text=Array.prototype.map.call(args,function(a){if(a instanceof Error)return a.stack||a.message;if(typeof a==='object'){try{return JSON.stringify(a)}catch(e){return String(a)}}return String(a)}).join(' ');parent.postMessage({source:'tm-preview',generation:g,level:level,text:text.slice(0,2000)},'*')}catch(e){}};
['log','info','warn','error','debug'].forEach(function(level){var orig=console[level];console[level]=function(){send(level,arguments);try{orig.apply(console,arguments)}catch(e){}}});
window.addEventListener('error',function(e){send('error',[(e.message||'Error')+(e.filename?' ('+e.filename.split('/').pop()+':'+e.lineno+')':'')])});
window.addEventListener('unhandledrejection',function(e){send('error',['Unhandled rejection: '+(e.reason&&e.reason.message||e.reason)])});
window.addEventListener('load',function(){parent.postMessage({source:'tm-preview',generation:g,level:'ready',text:''},'*')});
})();</script>`;
}

function resolveRelative(from: string, ref: string): string | null {
  if (/^(?:[a-z]+:|\/\/|#|data:)/i.test(ref)) return null;
  const clean = ref.split(/[?#]/)[0];
  if (!clean) return null;
  const base = from.includes('/') ? from.slice(0, from.lastIndexOf('/')).split('/') : [];
  const parts = clean.startsWith('/') ? [] : [...base];
  for (const part of clean.replace(/^\//, '').split('/')) {
    if (part === '' || part === '.') continue;
    if (part === '..') { parts.pop(); continue; }
    parts.push(part);
  }
  return parts.join('/');
}

function toDataUrl(bytes: Uint8Array, mime: string): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return `data:${mime};base64,${btoa(binary)}`;
}

/**
 * Inline a page's relative assets from the workspace.
 *
 * Regular expressions, not a parser: the page is the model's own output and
 * the point is to render it, not to validate it. Anything that does not
 * resolve is left alone and the browser reports it on the console, which
 * comes back to the model — the right outcome for a broken path.
 */
export async function buildPreviewDocument(sessionId: string, path: string, html: string, generation: number): Promise<string> {
  const read = async (ref: string) => {
    const target = resolveRelative(path, ref);
    return target ? readWorkspaceFile(sessionId, target) : null;
  };

  let out = html;
  // <script src="…">…</script>
  const scripts = [...out.matchAll(/<script\b([^>]*?)\bsrc\s*=\s*["']([^"']+)["']([^>]*)>\s*<\/script>/gi)];
  for (const match of scripts) {
    const file = await read(match[2]);
    if (!file?.text) continue;
    const attrs = `${match[1]} ${match[3]}`.replace(/\s+/g, ' ').trim();
    out = out.replace(match[0], `<script${attrs ? ` ${attrs}` : ''}>\n${file.text.replace(/<\/script/gi, '<\\/script')}\n</script>`);
  }
  // <link rel="stylesheet" href="…">
  const links = [...out.matchAll(/<link\b[^>]*\bhref\s*=\s*["']([^"']+)["'][^>]*>/gi)];
  for (const match of links) {
    if (!/rel\s*=\s*["']?stylesheet/i.test(match[0])) continue;
    const file = await read(match[1]);
    if (!file?.text) continue;
    out = out.replace(match[0], `<style>\n${file.text}\n</style>`);
  }
  // <img src>, <source src>, <audio src>, <video src>, and CSS url() in the document.
  const refs = [...out.matchAll(/(?:src\s*=\s*["']([^"']+)["'])|(?:url\(\s*["']?([^"')]+)["']?\s*\))/gi)];
  const seen = new Map<string, string>();
  for (const match of refs) {
    const ref = match[1] ?? match[2];
    if (!ref || seen.has(ref)) continue;
    const file = await read(ref);
    if (!file?.bytes) continue;
    const ext = ref.split(/[?#]/)[0].split('.').pop()?.toLowerCase() ?? '';
    const mime = MIME_BY_EXT[ext] ?? 'application/octet-stream';
    seen.set(ref, toDataUrl(file.bytes, mime));
  }
  for (const [ref, dataUrl] of seen) {
    out = out.split(`"${ref}"`).join(`"${dataUrl}"`).split(`'${ref}'`).join(`'${dataUrl}'`).split(`(${ref})`).join(`(${dataUrl})`);
  }

  const capture = captureScript(generation);
  if (/<head\b[^>]*>/i.test(out)) return out.replace(/<head\b[^>]*>/i, match => `${match}\n${capture}`);
  if (/<html\b[^>]*>/i.test(out)) return out.replace(/<html\b[^>]*>/i, match => `${match}\n<head>${capture}</head>`);
  return `${capture}\n${out}`;
}

type Listener = (target: PreviewTarget | null, log: readonly string[]) => void;

export class PreviewController {
  private target: PreviewTarget | null = null;
  private generation = 0;
  private log: string[] = [];
  private listeners = new Set<Listener>();
  private waiters: Array<(message: { level: string; text: string }) => void> = [];
  private listening = false;
  private frame: Window | null = null;
  private loaded = false;

  bindFrame(frame: Window | null, generation: number): void {
    if (generation === this.generation) this.frame = frame;
  }

  markLoaded(generation: number): void {
    if (generation !== this.generation) return;
    this.loaded = true;
    for (const waiter of this.waiters) waiter({ level: 'ready', text: '' });
  }

  recordRuntimeError(sessionId: string, text: string): void {
    if (this.target?.kind !== 'url' || this.target.sessionId !== sessionId) return;
    this.log.push(`[error] ${text.slice(0, 2000)}`);
    if (this.log.length > MAX_CONSOLE_LINES) this.log.shift();
    this.notify();
  }

  current(): PreviewTarget | null { return this.target; }
  consoleLog(): readonly string[] { return this.log; }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.target, this.log);
    return () => { this.listeners.delete(listener); };
  }

  private notify(): void {
    for (const listener of this.listeners) {
      try { listener(this.target, this.log); } catch (error) { console.error('Preview listener failed:', error); }
    }
  }

  private listen(): void {
    if (this.listening || typeof window === 'undefined') return;
    this.listening = true;
    window.addEventListener('message', (event: MessageEvent) => {
      const data = event.data as { source?: string; generation?: number; level?: string; text?: string } | null;
      if (!this.frame || event.source !== this.frame || !data || data.source !== 'tm-preview' || data.generation !== this.generation) return;
      const message = { level: String(data.level ?? 'log'), text: String(data.text ?? '').slice(0, 2000) };
      if (message.level === 'ready') this.loaded = true;
      if (message.level !== 'ready') {
        this.log.push(`[${message.level}] ${message.text}`);
        if (this.log.length > MAX_CONSOLE_LINES) this.log.splice(0, this.log.length - MAX_CONSOLE_LINES);
        this.notify();
      }
      for (const waiter of this.waiters) waiter(message);
    });
  }

  private async report(generation: number, signal?: AbortSignal): Promise<PreviewReport> {
    await new Promise<void>(resolve => {
      let settled = false;
      let settleTimer: ReturnType<typeof setTimeout> | undefined;
      const finish = () => {
        if (settled) return;
        settled = true;
        clearTimeout(loadTimer);
        clearTimeout(settleTimer);
        this.waiters = this.waiters.filter(listener => listener !== onMessage);
        signal?.removeEventListener('abort', finish);
        resolve();
      };
      const onMessage = (message: { level: string }) => {
        if (generation !== this.generation || message.level === 'cancelled') { finish(); return; }
        if (message.level === 'ready' && !settleTimer) {
          clearTimeout(loadTimer);
          settleTimer = setTimeout(finish, SETTLE_MS);
        }
      };
      const loadTimer = setTimeout(finish, LOAD_TIMEOUT_MS);
      this.waiters.push(onMessage);
      signal?.addEventListener('abort', finish, { once: true });
      if (signal?.aborted) finish();
      else if (this.loaded) onMessage({ level: 'ready' });
    });
    const current = generation === this.generation && !signal?.aborted;
    const log = current ? [...this.log] : [];
    return { console: log, errors: log.filter(line => line.startsWith('[error]')).length, loaded: current && this.loaded };
  }

  private begin(target: PreviewTarget, signal?: AbortSignal): Promise<PreviewReport> {
    for (const waiter of [...this.waiters]) waiter({ level: 'cancelled', text: '' });
    this.log = [];
    this.frame = null;
    this.loaded = false;
    this.target = target;
    const report = this.report(target.generation, signal);
    this.notify();
    return report;
  }

  /** Render a workspace HTML file and wait for the actual frame to load. */
  async showHtml(sessionId: string, path: string, signal?: AbortSignal): Promise<PreviewReport> {
    signal?.throwIfAborted();
    this.listen();
    const generation = ++this.generation;
    const file = await readWorkspaceFile(sessionId, path);
    if (!file || file.text === null) throw new Error(`${path} is not a readable HTML file.`);
    const srcdoc = await buildPreviewDocument(sessionId, path, file.text, generation);
    signal?.throwIfAborted();
    if (generation !== this.generation) return { console: [], errors: 0, loaded: false };
    return this.begin({ kind: 'html', sessionId, path, srcdoc, generation }, signal);
  }

  /** Show a dev server; errors arrive through WebContainer's preview-message events. */
  showUrl(sessionId: string, url: string, command: string, signal?: AbortSignal): Promise<PreviewReport> {
    signal?.throwIfAborted();
    return this.begin({ kind: 'url', sessionId, url, command, generation: ++this.generation }, signal);
  }

  /** The user's own reload of an HTML preview from the panel. */
  async refresh(): Promise<void> {
    if (this.target?.kind === 'html') await this.showHtml(this.target.sessionId, this.target.path);
  }

  clear(): void {
    this.generation++;
    for (const waiter of [...this.waiters]) waiter({ level: 'cancelled', text: '' });
    this.frame = null;
    this.loaded = false;
    this.target = null;
    this.log = [];
    this.notify();
  }
}

export const previewController = new PreviewController();
