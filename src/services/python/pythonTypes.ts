/**
 * The worker protocol, and the shape a run comes back in.
 *
 * Separate from both sides so neither imports the other: the worker must not
 * pull the app in, and the app must not pull Pyodide in.
 */

/** What Python handed back, before the app bounds or renders any of it. */
export interface RawPythonOutput {
  kind: 'image' | 'table' | 'text';
  caption?: string | null;
  /** image: raw PNG bytes. Base64 exists only inside the worker. */
  bytes?: Uint8Array;
  /** table */
  columns?: string[];
  index?: string[];
  rows?: string[][];
  totalRows?: number;
  totalColumns?: number;
  /** text */
  text?: string;
}

/** A file the code wrote to /outputs. */
export interface RawPythonFile {
  name: string;
  size: number;
  /** Absent when the file was too large to carry out of the sandbox. */
  bytes?: Uint8Array;
}

export interface PythonRunOutcome {
  ok: boolean;
  durationMs: number;
  stdout: string;
  stderr: string;
  /** A Python traceback, or the reason the run never happened. */
  error?: string;
  /** The run was killed for exceeding its time limit. */
  timedOut?: boolean;
  /**
   * This run started a fresh interpreter, so nothing an earlier call defined
   * still exists. Worth telling the model plainly: a NameError it cannot
   * explain is the difference between fixing the code and giving up.
   */
  freshSession: boolean;
  outputs: RawPythonOutput[];
  files: RawPythonFile[];
}

/** Where a run has got to, for the shimmer. */
export type PythonPhase = 'starting' | 'installing' | 'running';

/** A file to make readable inside the sandbox before the code runs. */
export interface PythonMount {
  /** File-store id, so the runtime can skip one it has already written. */
  id: string;
  /** Name under /files. Already made unique by the caller. */
  name: string;
  bytes: Uint8Array;
}

export interface PythonRunOptions {
  onPhase?: (phase: PythonPhase) => void;
  signal?: AbortSignal;
  /** Files the user attached. The runtime writes any the worker lacks. */
  mount?: readonly PythonMount[];
}

export type PythonWorkerRequest = {
  type: 'run';
  id: number;
  code: string;
  /** Bytes of any one generated file that may be carried back. */
  maxFileBytes: number;
  /** Written to /files before the code runs. Only ones not already there. */
  mount: Array<{ name: string; bytes: Uint8Array }>;
};

export type PythonWorkerResponse =
  | { type: 'phase'; id: number; phase: PythonPhase }
  | { type: 'result'; id: number; outcome: PythonRunOutcome }
  | { type: 'failed'; id: number; message: string; fatal: boolean };
