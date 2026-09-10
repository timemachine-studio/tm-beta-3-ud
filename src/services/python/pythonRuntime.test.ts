import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PYTHON_PHASE_BUDGET_MS, createPythonRuntime } from './pythonRuntime';
import type { PythonRunOutcome, PythonWorkerRequest, PythonWorkerResponse } from './pythonTypes';

/**
 * A worker that does nothing until the test tells it to.
 *
 * The point of these tests is the half of the sandbox the browser cannot be
 * trusted to do for us: noticing that Python has stopped answering, killing
 * it, and turning that into something the model can read. None of that needs
 * Pyodide, and all of it is the part that fails at three in the morning.
 */
class FakeWorker extends EventTarget {
  posted: PythonWorkerRequest[] = [];
  terminated = false;

  postMessage(message: PythonWorkerRequest) {
    this.posted.push(message);
  }

  terminate() {
    this.terminated = true;
  }

  send(message: PythonWorkerResponse) {
    const event = new Event('message') as Event & { data: PythonWorkerResponse };
    event.data = message;
    this.dispatchEvent(event);
  }

  crash(message: string) {
    const event = new Event('error') as Event & { message: string };
    event.message = message;
    this.dispatchEvent(event);
  }
}

function outcome(overrides: Partial<PythonRunOutcome> = {}): PythonRunOutcome {
  return {
    ok: true,
    durationMs: 12,
    stdout: '4\n',
    stderr: '',
    freshSession: true,
    outputs: [],
    files: [],
    ...overrides,
  };
}

function harness() {
  const workers: FakeWorker[] = [];
  const runtime = createPythonRuntime(() => {
    const worker = new FakeWorker();
    workers.push(worker);
    return worker as unknown as Worker;
  });
  return { runtime, workers, latest: () => workers[workers.length - 1] };
}

describe('the Python runtime', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('does not start a worker until something asks it to run', () => {
    const { workers } = harness();
    expect(workers).toHaveLength(0);
  });

  it('passes the result straight back', async () => {
    const { runtime, latest } = harness();
    const pending = runtime.run('2 + 2');
    await vi.advanceTimersByTimeAsync(0);
    latest().send({ type: 'result', id: latest().posted[0].id, outcome: outcome() });
    await expect(pending).resolves.toMatchObject({ ok: true, stdout: '4\n' });
  });

  it('reports progress and gives each phase its own clock', async () => {
    const { runtime, latest } = harness();
    const phases: string[] = [];
    const pending = runtime.run('import pandas', { onPhase: phase => phases.push(phase) });
    await vi.advanceTimersByTimeAsync(0);
    const worker = latest();
    const id = worker.posted[0].id;

    // A download that takes longer than a run is allowed to: the budget only
    // starts meaning "stuck" once nothing is being fetched.
    worker.send({ type: 'phase', id, phase: 'installing' });
    await vi.advanceTimersByTimeAsync(PYTHON_PHASE_BUDGET_MS.running + 1000);
    expect(worker.terminated).toBe(false);

    worker.send({ type: 'phase', id, phase: 'running' });
    worker.send({ type: 'result', id, outcome: outcome() });
    await expect(pending).resolves.toMatchObject({ ok: true });
    expect(phases).toEqual(['installing', 'running']);
  });

  it('kills a run that will not stop, and says so instead of throwing', async () => {
    // Pyodide runs Python synchronously, so a `while True:` ignores every
    // message sent to it. Termination is the only stop there is.
    const { runtime, latest } = harness();
    const pending = runtime.run('while True: pass');
    await vi.advanceTimersByTimeAsync(0);
    const worker = latest();
    worker.send({ type: 'phase', id: worker.posted[0].id, phase: 'running' });

    await vi.advanceTimersByTimeAsync(PYTHON_PHASE_BUDGET_MS.running + 1);
    const result = await pending;
    expect(result.timedOut).toBe(true);
    expect(result.ok).toBe(false);
    expect(worker.terminated).toBe(true);
  });

  it('ends in an outcome even if the worker never answers at all', async () => {
    const { runtime } = harness();
    const pending = runtime.run('print(1)');
    await vi.advanceTimersByTimeAsync(PYTHON_PHASE_BUDGET_MS.starting + 1);
    await expect(pending).resolves.toMatchObject({ ok: false, timedOut: true });
  });

  it('starts a fresh interpreter after one has been killed', async () => {
    const { runtime, workers, latest } = harness();
    const first = runtime.run('while True: pass');
    await vi.advanceTimersByTimeAsync(0);
    latest().send({ type: 'phase', id: latest().posted[0].id, phase: 'running' });
    await vi.advanceTimersByTimeAsync(PYTHON_PHASE_BUDGET_MS.running + 1);
    await first;

    const second = runtime.run('1 + 1');
    await vi.advanceTimersByTimeAsync(0);
    expect(workers).toHaveLength(2);
    latest().send({ type: 'result', id: latest().posted[0].id, outcome: outcome() });
    await expect(second).resolves.toMatchObject({ ok: true });
  });

  it('treats a dead worker as an out-of-memory failure, not a hang', async () => {
    const { runtime, latest } = harness();
    const pending = runtime.run('[0] * 10**12');
    await vi.advanceTimersByTimeAsync(0);
    latest().crash('out of memory');
    const result = await pending;
    expect(result.ok).toBe(false);
    expect(result.error).toContain('out of memory');
    expect(latest().terminated).toBe(true);
  });

  it('runs one at a time, because there is only one interpreter', async () => {
    const { runtime, latest } = harness();
    const first = runtime.run('a = 1');
    const second = runtime.run('print(a)');
    await vi.advanceTimersByTimeAsync(0);
    const worker = latest();
    expect(worker.posted).toHaveLength(1);

    worker.send({ type: 'result', id: worker.posted[0].id, outcome: outcome() });
    await first;
    await vi.advanceTimersByTimeAsync(0);
    expect(worker.posted).toHaveLength(2);
    worker.send({ type: 'result', id: worker.posted[1].id, outcome: outcome() });
    await expect(second).resolves.toMatchObject({ ok: true });
  });

  it('stops when the user stops the turn', async () => {
    const { runtime, latest } = harness();
    const controller = new AbortController();
    const pending = runtime.run('import time; time.sleep(60)', { signal: controller.signal });
    await vi.advanceTimersByTimeAsync(0);
    controller.abort();
    await expect(pending).resolves.toMatchObject({ ok: false, error: 'The run was cancelled.' });
    expect(latest().terminated).toBe(true);
  });

  it('refuses a run whose turn was already abandoned, without starting anything', async () => {
    const { runtime, workers } = harness();
    const controller = new AbortController();
    controller.abort();
    await expect(runtime.run('print(1)', { signal: controller.signal }))
      .resolves.toMatchObject({ ok: false });
    expect(workers).toHaveLength(0);
  });
});
