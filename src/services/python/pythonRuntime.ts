/**
 * The main-thread half of the Python sandbox: lifecycle, budgets, and the
 * guarantee that a bad run cannot take the app with it.
 *
 * Everything here exists because the worker cannot stop itself. Pyodide runs
 * Python synchronously, so a runaway loop ignores every message sent to it;
 * `worker.terminate()` is the only stop, and it is absolute — the interpreter
 * and everything defined in it are gone. That is the trade this file manages:
 * a timer per phase, termination when one expires, and an outcome the model
 * can act on rather than an exception nobody catches.
 *
 * What it deliberately does *not* claim is a memory ceiling. WebAssembly
 * memory cannot be capped per instance from here, so a large allocation ends
 * as a Python MemoryError or as a dead worker, and the second is handled by
 * the same path as a crash. Bounding what crosses back — output, tables,
 * files — is done instead, because that is the part that would otherwise reach
 * the user's storage.
 */

import type {
  PythonPhase,
  PythonMount,
  PythonRunOptions,
  PythonRunOutcome,
  PythonWorkerRequest,
  PythonWorkerResponse,
} from './pythonTypes';

/**
 * Per-phase time budgets.
 *
 * The clock restarts on every phase the worker reports, so these are limits on
 * being stuck rather than on the whole call. Starting is generous because the
 * first run in a session downloads about ten megabytes of runtime, and on a
 * phone on mobile data that is genuinely slow — killing it at thirty seconds
 * would make the feature look broken on exactly the devices that need the
 * clearest failure. Running is tight because by then nothing is downloading.
 */
export const PYTHON_PHASE_BUDGET_MS: Record<PythonPhase, number> = {
  starting: 120_000,
  installing: 120_000,
  running: 30_000,
};

/**
 * Bytes of any one generated file carried back from the sandbox.
 *
 * Matches the file store's own per-file limit. It was a quarter of this while
 * generated files rode inside the message as base64; now that they go to
 * IndexedDB there is no reason for the sandbox to be the tighter of the two.
 */
export const MAX_PYTHON_FILE_BYTES = 25_000_000;

/**
 * How long an idle interpreter is kept.
 *
 * Pyodide holds a few hundred megabytes once numpy and pandas are in, which is
 * a lot to leave sitting in a phone's tab for a conversation that has moved
 * on. Ten minutes keeps it through a working session and releases it after.
 * The cost of being wrong is one reload, and the model is told when it happens.
 */
export const PYTHON_IDLE_TEARDOWN_MS = 600_000;

export interface PythonRuntime {
  run(code: string, options?: PythonRunOptions): Promise<PythonRunOutcome>;
  /** Drop the interpreter. The next run starts a fresh one. */
  dispose(): void;
}

function failure(message: string, startedAt: number, extra: Partial<PythonRunOutcome> = {}): PythonRunOutcome {
  return {
    ok: false,
    durationMs: Date.now() - startedAt,
    stdout: '',
    stderr: '',
    error: message,
    freshSession: false,
    outputs: [],
    files: [],
    ...extra,
  };
}

/**
 * A runtime over a worker factory.
 *
 * The factory is a parameter rather than a hardcoded `new Worker(...)` so that
 * this logic — the part with the failure modes in it — can be exercised
 * without a browser, and so nothing imports the Pyodide worker into a test
 * process that has no use for it.
 */
export function createPythonRuntime(createWorker: () => Worker): PythonRuntime {
  let worker: Worker | null = null;
  let workersCreated = 0;
  let nextId = 1;
  /**
   * Files already written into the live worker.
   *
   * Attachments stay attached for the rest of the conversation, so without
   * this every run would re-send the same spreadsheet. Cleared with the worker,
   * because a replacement interpreter has an empty filesystem.
   */
  let mounted = new Set<string>();
  /** One run at a time: a single interpreter cannot serve two. */
  let queue: Promise<unknown> = Promise.resolve();
  let idleTimer: ReturnType<typeof setTimeout> | null = null;

  const stop = () => {
    if (idleTimer !== null) { clearTimeout(idleTimer); idleTimer = null; }
    worker?.terminate();
    worker = null;
    mounted = new Set<string>();
  };

  const armIdleTeardown = () => {
    if (idleTimer !== null) clearTimeout(idleTimer);
    idleTimer = setTimeout(stop, PYTHON_IDLE_TEARDOWN_MS);
  };

  const runOnce = (code: string, options: PythonRunOptions): Promise<PythonRunOutcome> => {
    const startedAt = Date.now();
    if (options.signal?.aborted) return Promise.resolve(failure('The run was cancelled.', startedAt));

    if (!worker) {
      try {
        worker = createWorker();
        workersCreated++;
      } catch (error: unknown) {
        return Promise.resolve(failure(
          `Python could not start in this browser: ${error instanceof Error ? error.message : String(error)}`,
          startedAt,
        ));
      }
    }

    const active = worker;
    const id = nextId++;

    return new Promise<PythonRunOutcome>((resolve) => {
      let settled = false;
      let phaseTimer: ReturnType<typeof setTimeout> | null = null;

      const finish = (outcome: PythonRunOutcome) => {
        if (settled) return;
        settled = true;
        if (phaseTimer !== null) clearTimeout(phaseTimer);
        active.removeEventListener('message', onMessage);
        active.removeEventListener('error', onError);
        options.signal?.removeEventListener('abort', onAbort);
        resolve(outcome);
      };

      /** Kill the interpreter and report it as an outcome, never as a throw. */
      const abandon = (message: string, timedOut: boolean) => {
        if (worker === active) stop();
        else active.terminate();
        finish(failure(message, startedAt, { timedOut }));
      };

      const arm = (phase: PythonPhase) => {
        if (phaseTimer !== null) clearTimeout(phaseTimer);
        phaseTimer = setTimeout(() => abandon(
          phase === 'running'
            ? `The code ran for more than ${Math.round(PYTHON_PHASE_BUDGET_MS.running / 1000)} seconds and was stopped.`
            : 'Python did not finish starting up in time.',
          true,
        ), PYTHON_PHASE_BUDGET_MS[phase]);
      };

      const onMessage = (event: MessageEvent<PythonWorkerResponse>) => {
        const message = event.data;
        if (!message || message.id !== id) return;
        if (message.type === 'phase') {
          arm(message.phase);
          options.onPhase?.(message.phase);
          return;
        }
        if (message.type === 'failed') {
          if (message.fatal && worker === active) stop();
          finish(failure(message.message, startedAt));
          return;
        }
        armIdleTeardown();
        // The worker only knows it has not run before. Whether that means the
        // model *lost* anything is knowable only here: on the very first run
        // of a conversation there was nothing to lose, and telling the model
        // its variables are gone would be a confusing untruth.
        finish({
          ...message.outcome,
          freshSession: message.outcome.freshSession && workersCreated > 1,
        });
      };

      // A worker error here is the interpreter dying — an out-of-memory kill,
      // or a runtime that failed to load at all. Either way this worker is not
      // usable again.
      const onError = (event: Event) => {
        const detail = 'message' in event && typeof (event as ErrorEvent).message === 'string'
          ? (event as ErrorEvent).message
          : 'the Python sandbox stopped unexpectedly';
        abandon(`Python stopped: ${detail}. It may have run out of memory.`, false);
      };

      const onAbort = () => { abandon('The run was cancelled.', false); };

      active.addEventListener('message', onMessage);
      active.addEventListener('error', onError);
      options.signal?.addEventListener('abort', onAbort, { once: true });

      // Armed before the first message, so a worker that never answers at all
      // still ends in an outcome rather than a hung turn.
      arm('starting');

      const pending: PythonMount[] = (options.mount ?? []).filter(file => !mounted.has(file.id));
      const request: PythonWorkerRequest = {
        type: 'run',
        id,
        code,
        maxFileBytes: MAX_PYTHON_FILE_BYTES,
        mount: pending.map(file => ({ name: file.name, bytes: file.bytes })),
      };
      // Recorded before the reply: the worker writes them whatever the code
      // then does, and a failed run must not make the next one re-send them.
      for (const file of pending) mounted.add(file.id);
      active.postMessage(request);
    });
  };

  return {
    run(code, options = {}) {
      const next = queue.then(() => runOnce(code, options));
      // The queue must survive a rejected run, or one failure strands every
      // later call behind it.
      queue = next.catch(() => undefined);
      return next;
    },
    dispose: stop,
  };
}

let shared: PythonRuntime | null = null;

/**
 * The app's one interpreter.
 *
 * Built on first use, not at import: constructing a Worker at module scope
 * would download ten megabytes of Pyodide for everyone who never asks a
 * question that needs it.
 */
export function pythonRuntime(): PythonRuntime {
  shared ??= createPythonRuntime(() => new Worker(
    new URL('./pythonWorker.ts', import.meta.url),
    { type: 'module' },
  ));
  return shared;
}
