import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PreviewController } from './previewController';
import { writeWorkspaceFile } from './workspaceStore';

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe('preview verification', () => {
  it('does not call an unmounted preview a successful load', async () => {
    vi.useFakeTimers();
    const preview = new PreviewController();
    const report = preview.showUrl('s', 'https://preview.example', 'dev');
    await vi.advanceTimersByTimeAsync(5000);
    expect(await report).toEqual({ loaded: false, console: [], errors: 0 });
  });
  it('includes forwarded errors after the frame loads', async () => {
    vi.useFakeTimers();
    const preview = new PreviewController();
    const report = preview.showUrl('s', 'https://preview.example', 'dev');
    preview.markLoaded(preview.current()!.generation);
    preview.recordRuntimeError('other-session', 'wrong session');
    preview.recordRuntimeError('s', 'ReferenceError: broken');
    await vi.advanceTimersByTimeAsync(1200);
    expect(await report).toEqual({ loaded: true, console: ['[error] ReferenceError: broken'], errors: 1 });
  });
  it('Stop releases a pending preview wait', async () => {
    const preview = new PreviewController();
    const controller = new AbortController();
    const report = preview.showUrl('s', 'https://preview.example', 'dev', controller.signal);
    controller.abort();
    expect((await report).loaded).toBe(false);
  });
  it('only accepts HTML console messages from the current preview frame', async () => {
    await writeWorkspaceFile('preview-source', 'index.html', '<h1>Test</h1>');
    vi.useFakeTimers();
    const page = new EventTarget();
    vi.stubGlobal('window', page);
    const preview = new PreviewController();
    let shown!: () => void;
    const ready = new Promise<void>(resolve => { shown = resolve; });
    preview.subscribe(target => { if (target) shown(); });
    const report = preview.showHtml('preview-source', 'index.html');
    await ready;
    const generation = preview.current()!.generation;
    const frame = {} as Window;
    preview.bindFrame(frame, generation);
    const send = (source: unknown, level: string, text: string) => {
      page.dispatchEvent(Object.assign(new Event('message'), { source, data: { source: 'tm-preview', generation, level, text } }));
    };
    send({}, 'error', 'forged');
    send(frame, 'ready', '');
    send(frame, 'error', 'real error');
    await vi.advanceTimersByTimeAsync(1200);
    expect(await report).toEqual({ loaded: true, errors: 1, console: ['[error] real error'] });
  });
});
