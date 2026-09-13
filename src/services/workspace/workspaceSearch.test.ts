import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { searchWorkspace } from './workspaceSearch';
import { createWorkspaceSearch, WORKSPACE_SEARCH_TIMEOUT_MS } from './workspaceSearchRuntime';
import { writeWorkspaceFiles } from './workspaceStore';

function worker() {
  return { onmessage: null as ((event: MessageEvent) => void) | null, onerror: null, postMessage: vi.fn(), terminate: vi.fn() };
}
afterEach(() => { vi.useRealTimers(); });

describe('bounded workspace search', () => {
  it('searches scoped files with numbered matches', async () => {
    await writeWorkspaceFiles('search', [{ path: 'src/a.ts', content: 'first\nneedle' }, { path: 'test/a.ts', content: 'needle' }]);
    const result = await searchWorkspace('search', 'NEEDLE', 'src/**/*.ts');
    expect(result.content).toBe('src/a.ts:2: needle');
  });
  it('terminates an unresponsive regex worker instead of freezing the UI', async () => {
    vi.useFakeTimers();
    const active = worker();
    const result = createWorkspaceSearch(() => active as unknown as Worker)({ sessionId: 's', query: '(a+)+$', pathGlob: '' });
    await vi.advanceTimersByTimeAsync(WORKSPACE_SEARCH_TIMEOUT_MS);
    expect(await result).toMatchObject({ ok: false, content: expect.stringContaining('exceeded 10 seconds') });
    expect(active.terminate).toHaveBeenCalledTimes(1);
  });
  it('cancellation stops an in-flight search and releases its worker', async () => {
    const active = worker();
    const controller = new AbortController();
    const result = createWorkspaceSearch(() => active as unknown as Worker)({ sessionId: 's', query: 'x', pathGlob: '' }, controller.signal);
    controller.abort();
    expect(await result).toMatchObject({ ok: false, content: expect.stringContaining('cancelled') });
    expect(active.terminate).toHaveBeenCalledTimes(1);
  });
  it('releases a successful worker too', async () => {
    const active = worker();
    const result = createWorkspaceSearch(() => active as unknown as Worker)({ sessionId: 's', query: 'x', pathGlob: '' });
    active.onmessage!({ data: { ok: true, content: 'match' } } as MessageEvent);
    expect(await result).toEqual({ ok: true, content: 'match' });
    expect(active.terminate).toHaveBeenCalledTimes(1);
  });
});
