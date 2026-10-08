import { beforeEach, describe, expect, it, vi } from 'vitest';
const hooks = vi.hoisted(() => ({ setters: [] as ReturnType<typeof vi.fn>[], cleanup: undefined as (() => void) | undefined }));
vi.mock('react', () => ({
  useState: (initial: unknown) => { const setter = vi.fn(); hooks.setters.push(setter); return [initial, setter]; },
  useRef: () => ({ current: null }),
  useCallback: (callback: unknown) => callback,
  useEffect: (effect: () => () => void) => { hooks.cleanup = effect(); },
}));
import { useWorkConnectionCheck } from './useWorkConnectionCheck';
beforeEach(() => { hooks.setters = []; hooks.cleanup = undefined; });
describe('explicit Work connection checks', () => {
  it('makes no automatic network request and stores an explicit result', async () => {
    const state = useWorkConnectionCheck<string>(); const load = vi.fn().mockResolvedValue('actual-result');
    expect(load).not.toHaveBeenCalled(); expect(state.result).toBeNull();
    await state.check(load);
    expect(load.mock.calls[0][0]).toBeInstanceOf(AbortSignal);
    expect(hooks.setters[0]).toHaveBeenLastCalledWith('actual-result');
    expect(hooks.setters[2].mock.calls).toEqual([[true], [false]]);
  });
  it('aborts the previous request and never overwrites a newer result', async () => {
    const state = useWorkConnectionCheck<string>();
    let resolveOld!: (value: string) => void; let oldSignal!: AbortSignal;
    const old = state.check(signal => { oldSignal = signal; return new Promise(resolve => { resolveOld = resolve; }); });
    await state.check(async () => 'new-result');
    expect(oldSignal.aborted).toBe(true); resolveOld('stale-result'); await old;
    expect(hooks.setters[0]).toHaveBeenLastCalledWith('new-result');
    expect(hooks.setters[0]).not.toHaveBeenCalledWith('stale-result');
  });
  it('aborts on unmount and suppresses late error/state changes', async () => {
    const state = useWorkConnectionCheck<string>(); let reject!: (error: Error) => void;
    const load = vi.fn((_signal: AbortSignal) => new Promise<string>((_resolve, onReject) => { reject = onReject; }));
    const pending = state.check(load); hooks.cleanup?.();
    expect(load.mock.calls[0][0].aborted).toBe(true); reject(new Error('late-error')); await pending;
    expect(hooks.setters[1]).not.toHaveBeenCalledWith('late-error');
    expect(hooks.setters[2].mock.calls).toEqual([[true]]);
  });
  it('shows a failed check, clears stale data, and lets the user retry', async () => {
    const state = useWorkConnectionCheck<string>();
    await state.check(async () => { throw new Error('The connected service timed out.'); });
    expect(hooks.setters[1]).toHaveBeenLastCalledWith('The connected service timed out.');
    expect(hooks.setters[0]).toHaveBeenLastCalledWith(null);
    await state.check(async () => 'retried');
    expect(hooks.setters[1]).toHaveBeenLastCalledWith(null); expect(hooks.setters[0]).toHaveBeenLastCalledWith('retried');
  });
});
