/// <reference lib="webworker" />
/**
 * Pyodide, in a worker.
 *
 * A worker rather than the page for one reason that matters more than the
 * others: Pyodide is synchronous once it is running, so a `while True:` on the
 * main thread would freeze the whole app with no way back. Here the main
 * thread can terminate it — and termination is the *only* reliable stop, since
 * interrupting a running Python thread cooperatively needs a SharedArrayBuffer
 * and that needs cross-origin isolation headers this app does not send.
 *
 * The runtime is fetched from a CDN, not bundled: it is roughly ten megabytes
 * of WebAssembly and its own package index, and it must never land in the
 * initial bundle of a chat app that most people open on a phone. The first
 * `run_python` call in a session pays for the download; the rest are free.
 *
 * The interpreter is kept alive between calls on purpose, so a model can load
 * data once and go on working with it. `_tm_reset()` clears what is *shown*
 * between runs, never the namespace.
 */

import { PYTHON_BOOTSTRAP, PYTHON_INPUT_DIR } from './pythonBootstrap';
import type {
  PythonRunOutcome,
  PythonWorkerRequest,
  PythonWorkerResponse,
  RawPythonFile,
  RawPythonOutput,
} from './pythonTypes';

/** Pinned: an unpinned runtime is a silent behaviour change on someone else's schedule. */
const PYODIDE_VERSION = '314.0.6';
const PYODIDE_BASE = `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/`;

/** Characters of stdout/stderr one run may return. The rest is dropped. */
const MAX_STREAM_CHARS = 8000;

/** Characters of a bare final expression's repr. Enough for a small table. */
const MAX_REPR_CHARS = 2000;

/**
 * Base64 out of Python, bytes onward.
 *
 * Python hands bytes back most simply as base64 — reaching into a `bytes`
 * object through a proxy is more machinery for no gain. But base64 is a third
 * larger than the thing it encodes, and everything past this point (the
 * postMessage, the Blob, IndexedDB) handles bytes natively, so it is decoded
 * here and the inflated form never leaves the worker.
 */
function decodeBase64(encoded: string): Uint8Array {
  const binary = atob(encoded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

/**
 * Modules that are not in Pyodide's own package set but install from PyPI.
 *
 * This is what makes PDF, Word and Excel work without a second tool. Pyodide
 * already fetches numpy and pandas on demand by reading the code's imports;
 * this extends the same trick to a handful of pure-Python wheels, so the model
 * writes `from docx import Document` and it simply works. A new schema, or a
 * directive telling the model to run micropip first, would have been a worse
 * version of the same thing.
 *
 * An allow-list rather than "install whatever is imported": an import name in
 * model-written code must not be able to make the browser fetch and execute an
 * arbitrary package from the internet.
 */
const PYPI_PACKAGES: Record<string, string> = {
  docx: 'python-docx',       // Word
  openpyxl: 'openpyxl',      // Excel, read and write
  xlsxwriter: 'XlsxWriter',  // Excel, write with formatting
  fpdf: 'fpdf2',             // PDF creation
  pypdf: 'pypdf',            // PDF inspection, merging, page surgery
  reportlab: 'reportlab',    // PDF with precise layout
  markdown: 'markdown',
  yaml: 'PyYAML',
};

/**
 * Packages a call needs without importing them.
 *
 * `df.to_excel(...)` reaches openpyxl from inside pandas, so scanning imports
 * misses it entirely and the run dies on a ModuleNotFoundError for a module
 * the model never mentioned. Seen live, followed by the model trying `!pip
 * install` and then a shell command, neither of which exists here.
 */
const PYPI_BY_USAGE: Array<[RegExp, string]> = [
  [/\b(?:to_excel|read_excel|ExcelWriter|ExcelFile)\b/, 'openpyxl'],
];

/** Top-level module names the code imports. Deliberately conservative. */
function importedModules(code: string): string[] {
  const found = new Set<string>();
  const pattern = /^[ \t]*(?:import[ \t]+([A-Za-z_][\w.]*)|from[ \t]+([A-Za-z_][\w.]*)[ \t]+import)/gm;
  for (const match of code.matchAll(pattern)) {
    const module = (match[1] || match[2] || '').split('.')[0];
    if (module) found.add(module);
  }
  return [...found];
}

/** The slice of Pyodide this worker uses. Narrow on purpose — see CLAUDE.md on `any`. */
interface PyodideApi {
  runPythonAsync(code: string): Promise<unknown>;
  loadPackagesFromImports(
    code: string,
    options?: { messageCallback?: (text: string) => void; errorCallback?: (text: string) => void },
  ): Promise<void>;
  loadPackage(
    names: string | string[],
    options?: { messageCallback?: (text: string) => void; errorCallback?: (text: string) => void },
  ): Promise<unknown>;
  setStdout(options: { batched: (text: string) => void }): void;
  setStderr(options: { batched: (text: string) => void }): void;
  FS: { writeFile(path: string, data: Uint8Array): void };
}

interface PyodideModule {
  loadPyodide(options: { indexURL: string }): Promise<PyodideApi>;
}

let pyodide: PyodideApi | null = null;
let starting: Promise<PyodideApi> | null = null;
/** True until the first run finishes, so the caller can say the session is new. */
let neverRan = true;

function post(message: PythonWorkerResponse) {
  (self as unknown as DedicatedWorkerGlobalScope).postMessage(message);
}

async function ready(id: number): Promise<PyodideApi> {
  if (pyodide) return pyodide;
  if (!starting) {
    post({ type: 'phase', id, phase: 'starting' });
    starting = (async () => {
      // A variable, and @vite-ignore, because the bundler must not try to
      // resolve or rewrite a CDN URL at build time.
      const url = `${PYODIDE_BASE}pyodide.mjs`;
      const module = await import(/* @vite-ignore */ url) as PyodideModule;
      const instance = await module.loadPyodide({ indexURL: PYODIDE_BASE });
      await instance.runPythonAsync(PYTHON_BOOTSTRAP);
      pyodide = instance;
      return instance;
    })().catch((error: unknown) => {
      // A failed load must not poison every later attempt: the usual cause is
      // a flaky network, and the next call deserves a fresh try.
      starting = null;
      throw error;
    });
  }
  return starting;
}

/** Everything in the sandbox's two file directories, keyed by full path. */
async function fileIndex(
  instance: PyodideApi,
): Promise<Map<string, { name: string; size: number; mtime: number }>> {
  const listing = await instance.runPythonAsync('_tm_files()') as string;
  const entries = JSON.parse(listing) as Array<{ path: string; name: string; size: number; mtime: number }>;
  return new Map(entries.map(entry => [entry.path, entry]));
}

/**
 * Files this run created or changed.
 *
 * A diff rather than the whole directory, because the interpreter persists:
 * without it, every later run would re-offer the CSV written by the first one.
 */
async function newFiles(
  instance: PyodideApi,
  before: Map<string, { name: string; size: number; mtime: number }>,
  maxFileBytes: number,
): Promise<RawPythonFile[]> {
  const after = await fileIndex(instance);
  const files: RawPythonFile[] = [];
  for (const [path, stats] of after) {
    const previous = before.get(path);
    // An attachment the code rewrote in place counts as new — that is the
    // user asking for a changed version of their own file back.
    if (previous && previous.size === stats.size && previous.mtime === stats.mtime) continue;
    if (stats.size > maxFileBytes) {
      // Reported, not carried: the model should know the file exists and is
      // too big rather than believe the write failed.
      files.push({ name: stats.name, size: stats.size });
      continue;
    }
    const encoded = await instance.runPythonAsync(
      `_tm_read(${JSON.stringify(path)}, ${maxFileBytes})`,
    ) as string;
    files.push({ name: stats.name, size: stats.size, bytes: decodeBase64(encoded) });
  }
  return files;
}

function clamp(text: string, limit: number): string {
  return text.length > limit ? `${text.slice(0, limit)}\n… (truncated)` : text;
}

async function run(request: PythonWorkerRequest): Promise<PythonRunOutcome> {
  const started = Date.now();
  const freshSession = neverRan;
  const instance = await ready(request.id);

  const out: string[] = [];
  const err: string[] = [];
  /**
   * Nothing before the model's own code counts as its output.
   *
   * Package loading narrates itself — "Loading Pillow, fonttools" — through
   * whatever stdout is attached at the time, and micropip does it a second
   * time from inside its own installs. Silencing the loader's callbacks was
   * not enough because the narration comes from Pyodide's console, not the
   * callback. So the capturing handlers are attached at the last possible
   * moment instead, and detached the instant the code finishes.
   */
  const silence = () => {
    instance.setStdout({ batched: () => {} });
    instance.setStderr({ batched: () => {} });
  };
  const capture = () => {
    // `batched` fires once per line and strips the newline, so it has to be put
    // back — without it `print(a)` then `print(b)` come back as one glued token,
    // which reads as a single wrong number rather than two right ones.
    instance.setStdout({ batched: (text: string) => { out.push(`${text}\n`); } });
    instance.setStderr({ batched: (text: string) => { err.push(`${text}\n`); } });
  };
  silence();

  // The user's own files, before their code can ask for them. Writing them
  // through the emscripten FS rather than Python keeps the bytes out of a
  // base64 round trip they have already avoided once.
  for (const file of request.mount) {
    try {
      instance.FS.writeFile(`${PYTHON_INPUT_DIR}/${file.name}`, file.bytes);
    } catch (error: unknown) {
      // Reported through the code's own FileNotFoundError, which names the
      // path the model asked for. Failing the run before it starts would say
      // less and cost the turn.
      console.error('Could not mount an attachment:', error);
    }
  }

  const before = await fileIndex(instance);
  await instance.runPythonAsync('_tm_reset()');

  let ok = true;
  let error: string | undefined;
  try {
    post({ type: 'phase', id: request.id, phase: 'installing' });
    // Reads the imports and fetches numpy/pandas/matplotlib on demand, so a
    // one-line arithmetic run does not pay for a scientific stack.
    // Silenced, not captured: the loader narrates "Loading numpy, pandas…"
    // through the same stdout handler, and that narration in a tool result is
    // both noise and a lie about what the model's own code printed.
    await instance.loadPackagesFromImports(request.code, {
      messageCallback: () => {},
      errorCallback: () => {},
    });
    // Then the PyPI wheels Pyodide does not ship. Quiet, and best-effort: a
    // package that will not install must surface as the ImportError the model
    // can read, not as a failure before its code ever ran.
    const wanted = [...new Set([
      ...importedModules(request.code)
        .map(module => PYPI_PACKAGES[module])
        .filter((name): name is string => !!name),
      ...PYPI_BY_USAGE
        .filter(([pattern]) => pattern.test(request.code))
        .map(([, name]) => name),
    ])];
    if (wanted.length > 0) {
      // micropip has to be loaded by name. `loadPackagesFromImports` reads the
      // *model's* imports, and the model imports `fpdf`, not `micropip` — so
      // nothing had asked for it, and every document run failed at line 1 with
      // a ModuleNotFoundError for a module the user's code never mentioned.
      await instance.loadPackage('micropip', {
        messageCallback: () => {},
        errorCallback: () => {},
      });
      await instance.runPythonAsync(
        `await _tm_install(${wanted.map(name => JSON.stringify(name)).join(', ')})`,
      );
    }
    post({ type: 'phase', id: request.id, phase: 'running' });
    capture();
    const value = await instance.runPythonAsync(request.code);
    // A bare final expression is how anyone writes a calculation. Pyodide
    // hands back a proxy for a Python object; String() is its repr, and the
    // proxy has to be released or the object is pinned for the session.
    if (value !== undefined && value !== null) {
      out.push(`${clamp(String(value), MAX_REPR_CHARS)}\n`);
      const proxy = value as { destroy?: () => void };
      if (typeof proxy.destroy === 'function') proxy.destroy();
    }
  } catch (thrown: unknown) {
    ok = false;
    error = thrown instanceof Error ? thrown.message : String(thrown);
  } finally {
    silence();
  }

  // The sweep runs even after a failure: code that drew a chart and then threw
  // has still drawn the chart, and closing the figures matters either way.
  let outputs: RawPythonOutput[] = [];
  try {
    const swept = JSON.parse(await instance.runPythonAsync('_tm_sweep()') as string) as Array<
      RawPythonOutput & { data?: string }
    >;
    outputs = swept.map(({ data, ...output }) => (
      data ? { ...output, bytes: decodeBase64(data) } : output
    ));
  } catch {
    // A sweep that fails costs the user their chart, not their answer.
  }

  let files: RawPythonFile[];
  try {
    files = await newFiles(instance, before, request.maxFileBytes);
  } catch {
    // Same reasoning as the sweep: a download the user cannot have is worth
    // less than the answer they can.
    files = [];
  }

  neverRan = false;
  return {
    ok,
    durationMs: Date.now() - started,
    stdout: clamp(out.join(''), MAX_STREAM_CHARS),
    stderr: clamp(err.join(''), MAX_STREAM_CHARS),
    error: error ? clamp(error, MAX_STREAM_CHARS) : undefined,
    freshSession,
    outputs,
    files,
  };
}

self.addEventListener('message', (event: MessageEvent<PythonWorkerRequest>) => {
  const request = event.data;
  if (request?.type !== 'run') return;
  void run(request).then(
    outcome => post({ type: 'result', id: request.id, outcome }),
    (error: unknown) => post({
      type: 'failed',
      id: request.id,
      message: error instanceof Error ? error.message : String(error),
      // The interpreter never came up, so this worker is not worth keeping.
      fatal: pyodide === null,
    }),
  );
});
