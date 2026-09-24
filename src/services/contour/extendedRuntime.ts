import { contourNeedleTools } from '../../components/contour/capabilityRegistry';
import type { NeedleCompletion } from '../../components/contour/contracts';
import {
  getContourExtendedState,
  readContourExtendedAssets,
  setContourExtendedError,
  setContourExtendedRuntimePhase,
} from './extendedPackStore';
import type { NeedleWorkerRequest, NeedleWorkerResponse } from './needleProtocol';

const INIT_TIMEOUT_MS = 60_000;
// First-turn WASM inference can be slower on phones and low-power laptops.
// This is still bounded, but does not kill a healthy local run mid-decode.
const COMPLETE_TIMEOUT_MS = 30_000;
const IDLE_TEARDOWN_MS = 5 * 60_000;

interface Pending<T> {
  resolve(value: T): void;
  reject(error: Error): void;
  timer: ReturnType<typeof setTimeout>;
}

class ContourExtendedRuntime {
  private worker: Worker | null = null;
  private ready: Promise<void> | null = null;
  private nextId = 1;
  private pending = new Map<number, Pending<NeedleCompletion | void>>();
  private idleTimer: ReturnType<typeof setTimeout> | null = null;

  private createWorker(): Worker {
    const worker = new Worker(new URL('./needleWorker.ts', import.meta.url));
    worker.addEventListener('message', this.onMessage);
    worker.addEventListener('error', this.onWorkerError);
    return worker;
  }

  private onMessage = (event: MessageEvent<NeedleWorkerResponse>) => {
    const message = event.data;
    const pending = this.pending.get(message.id);
    if (!pending) return;
    clearTimeout(pending.timer);
    this.pending.delete(message.id);

    if (message.type === 'error') {
      pending.reject(new Error(message.message));
      if (message.fatal) this.dispose();
      return;
    }
    if (message.type === 'ready') pending.resolve();
    else pending.resolve(message.completion);
  };

  private onWorkerError = (event: ErrorEvent) => {
    const error = new Error(event.message || 'Contour Extended stopped unexpectedly.');
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timer);
      pending.reject(error);
    }
    this.pending.clear();
    this.dispose();
    setContourExtendedError(error);
  };

  private request<T extends NeedleCompletion | void>(request: NeedleWorkerRequest, timeoutMs: number, transfer: Transferable[] = []): Promise<T> {
    const worker = this.worker;
    if (!worker) return Promise.reject(new Error('Contour Extended is not running.'));
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(request.id);
        reject(new Error('Contour Extended took too long and was stopped.'));
        this.dispose();
      }, timeoutMs);
      this.pending.set(request.id, { resolve: resolve as Pending<NeedleCompletion | void>['resolve'], reject, timer });
      worker.postMessage(request, transfer);
    });
  }

  async load(): Promise<void> {
    const phase = getContourExtendedState().phase;
    if (phase === 'active' && this.worker) return;
    if (phase !== 'ready' && phase !== 'loading') throw new Error('Contour Extended is not installed.');
    if (this.ready) return this.ready;

    setContourExtendedRuntimePhase('loading');
    this.ready = (async () => {
      const assets = await readContourExtendedAssets();
      this.worker = this.createWorker();
      const id = this.nextId++;
      await this.request<void>({
        type: 'init',
        id,
        loader: assets.loader,
        wasm: assets.wasm,
        model: assets.model,
        system: [
          `date: ${new Date().toISOString()}`,
          `locale: ${navigator.language || 'en'}`,
          'assistant: TimeMachine Contour',
        ].join('; '),
        tools: contourNeedleTools(),
      }, INIT_TIMEOUT_MS, [assets.wasm, assets.model]);
      setContourExtendedRuntimePhase('active');
      this.armIdle();
    })().catch(error => {
      this.ready = null;
      setContourExtendedError(error);
      throw error;
    });
    return this.ready;
  }

  async complete(input: string): Promise<NeedleCompletion> {
    await this.load();
    const id = this.nextId++;
    const completion = await this.request<NeedleCompletion>({ type: 'complete', id, input }, COMPLETE_TIMEOUT_MS);
    this.armIdle();
    return completion;
  }

  private armIdle() {
    if (this.idleTimer) clearTimeout(this.idleTimer);
    this.idleTimer = setTimeout(() => this.dispose(), IDLE_TEARDOWN_MS);
  }

  dispose(): void {
    if (this.idleTimer) clearTimeout(this.idleTimer);
    this.idleTimer = null;
    this.worker?.terminate();
    this.worker = null;
    this.ready = null;
    if (getContourExtendedState().phase === 'active' || getContourExtendedState().phase === 'loading') {
      setContourExtendedRuntimePhase('ready');
    }
  }
}

let shared: ContourExtendedRuntime | null = null;

export function contourExtendedRuntime(): ContourExtendedRuntime {
  shared ??= new ContourExtendedRuntime();
  return shared;
}

export function disposeContourExtendedRuntime(): void {
  shared?.dispose();
  shared = null;
}
