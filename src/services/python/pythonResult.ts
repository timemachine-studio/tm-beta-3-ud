/**
 * What a Python run becomes: a string for the model, a card for the user, and
 * a smaller version of that card for storage.
 *
 * Kept apart from the runtime because this is the part with judgement in it
 * and no browser in it. Every rule below is testable without Pyodide, and the
 * two audiences are genuinely different: the model needs to know what happened
 * precisely enough to fix it, and the user needs to see the chart.
 */

import type { PythonArtifact, PythonRun } from '../../types/chat';
import type { PythonRunOutcome } from './pythonTypes';
import { newId } from '../../utils/id';

/** Artifacts one run may show. A loop that draws a hundred charts shows eight. */
const MAX_ARTIFACTS = 8;

/** Runs one saved message keeps, and how much of each call's source. */
const MAX_STORED_RUNS = 6;
const MAX_STORED_CODE_CHARS = 20_000;

/**
 * Put bytes somewhere and get back an id, or null if that failed.
 *
 * Injected rather than imported so this module stays free of IndexedDB and
 * stays testable in a process that has none — and so a storage failure is a
 * value the formatter can talk about instead of an exception it has to catch.
 */
export type SaveArtifactFile = (
  name: string,
  mime: string,
  bytes: Uint8Array,
) => Promise<string | null>;

const MIME_BY_EXTENSION: Record<string, string> = {
  csv: 'text/csv',
  tsv: 'text/tab-separated-values',
  txt: 'text/plain',
  md: 'text/markdown',
  json: 'application/json',
  html: 'text/html',
  xml: 'application/xml',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  svg: 'image/svg+xml',
  gif: 'image/gif',
  pdf: 'application/pdf',
  zip: 'application/zip',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
};

export function mimeForFile(name: string): string {
  const extension = name.toLowerCase().split('.').pop() || '';
  return MIME_BY_EXTENSION[extension] || 'application/octet-stream';
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function caption(value: string | null | undefined): string | undefined {
  const text = typeof value === 'string' ? value.trim() : '';
  return text ? text.slice(0, 200) : undefined;
}

/**
 * Turn what came out of the sandbox into artifacts the chat can render.
 *
 * Bytes go to the file store and the artifact keeps only the id. An artifact
 * whose bytes could not be stored still appears, marked — a chart that simply
 * does not show up reads as the code not having worked.
 */
export async function toArtifacts(
  outcome: PythonRunOutcome,
  saveFile: SaveArtifactFile,
): Promise<PythonArtifact[]> {
  const artifacts: PythonArtifact[] = [];

  for (const output of outcome.outputs) {
    if (artifacts.length >= MAX_ARTIFACTS) break;
    if (output.kind === 'image') {
      const fileId = output.bytes ? await saveFile('chart.png', 'image/png', output.bytes) : null;
      artifacts.push(fileId
        ? { kind: 'image', caption: caption(output.caption), fileId }
        : { kind: 'image', caption: caption(output.caption), dropped: true });
    } else if (output.kind === 'table') {
      artifacts.push({
        kind: 'table',
        caption: caption(output.caption),
        columns: output.columns || [],
        index: output.index,
        rows: output.rows || [],
        totalRows: output.totalRows ?? (output.rows?.length || 0),
        totalColumns: output.totalColumns ?? (output.columns?.length || 0),
      });
    } else {
      artifacts.push({ kind: 'text', caption: caption(output.caption), text: output.text || '' });
    }
  }

  for (const file of outcome.files) {
    if (artifacts.length >= MAX_ARTIFACTS) break;
    const mime = mimeForFile(file.name);
    const fileId = file.bytes ? await saveFile(file.name, mime, file.bytes) : null;
    artifacts.push({
      kind: 'file',
      name: file.name,
      size: file.size,
      mime,
      ...(fileId ? { fileId } : { dropped: true }),
    });
  }

  return artifacts;
}

/**
 * Drop Pyodide's own frames from a traceback.
 *
 * A NameError comes back wrapped in four frames of `_pyodide/_base.py` that
 * describe how the code was evaluated, not what went wrong in it. They cost
 * tokens on a path the model is already having a bad time on, and they invite
 * it to debug the sandbox instead of its own code. `<exec>` is where the
 * model's code starts, so everything above the first such frame goes.
 */
export function tidyTraceback(text: string | undefined): string | undefined {
  if (!text) return text;
  const lines = text.split('\n');
  const start = lines.findIndex(line => line.includes('File "<exec>"'));
  if (start <= 0 || !lines[0].startsWith('Traceback')) return text.trimEnd();
  return [lines[0], ...lines.slice(start)].join('\n').trimEnd();
}

export async function toPythonRun(
  code: string,
  outcome: PythonRunOutcome,
  saveFile: SaveArtifactFile,
): Promise<PythonRun> {
  return {
    id: newId(),
    code,
    ok: outcome.ok,
    durationMs: outcome.durationMs,
    stdout: outcome.stdout || undefined,
    error: tidyTraceback(outcome.error) || undefined,
    timedOut: outcome.timedOut || undefined,
    artifacts: await toArtifacts(outcome, saveFile),
  };
}

function describeShown(artifacts: PythonArtifact[]): string[] {
  const counts = { image: 0, table: 0, text: 0 };
  const files: PythonArtifact[] = [];
  for (const artifact of artifacts) {
    if (artifact.kind === 'file') files.push(artifact);
    else counts[artifact.kind]++;
  }

  const lines: string[] = [];
  const shown = [
    counts.image ? `${counts.image} chart${counts.image === 1 ? '' : 's'}` : null,
    counts.table ? `${counts.table} table${counts.table === 1 ? '' : 's'}` : null,
    counts.text ? `${counts.text} text block${counts.text === 1 ? '' : 's'}` : null,
  ].filter(Boolean);
  if (shown.length > 0) {
    // The point of saying so: the model must not then reproduce in prose what
    // the user is already looking at. The two ways it does that are different
    // enough to need separate wording — a table gets transcribed back, and a
    // chart gets a paragraph of instructions for drawing it by hand, which is
    // what happened live on a diagram the model had just drawn itself.
    const care = counts.image > 0
      ? 'Interpret them, and never describe how to draw something you have already drawn.'
      : 'Interpret them; do not repeat the contents.';
    lines.push(`Displayed to the user: ${shown.join(', ')}. They can see ${shown.length === 1 ? 'it' : 'them'} already. ${care}`);
  }
  if (files.length > 0) {
    const named = files.map(file => file.kind === 'file'
      ? `${file.name} (${formatBytes(file.size)})${file.dropped ? ' — too large to hand over' : ''}`
      : '').join(', ');
    // The second clause is not decoration. Found live: told a chart had been
    // saved to /outputs, the model wrote `![chart](/outputs/line_chart.png)`
    // into its answer, and the user got a broken image next to the working
    // one. /outputs is a path inside the sandbox; it is not a web address.
    lines.push(`Files created and offered to the user as downloads: ${named}. They are already shown with a download button, so do not write a link or an image tag for them — /outputs is inside the sandbox, not a web address.`);
  }
  return lines;
}

/**
 * The `role: 'tool'` string.
 *
 * Written so that every failure mode leads somewhere. A traceback the model
 * can read is the difference between one corrected re-run and an apology, and
 * a lost interpreter has to be stated outright — a `NameError` the model
 * cannot account for is where it starts inventing the answer instead.
 */
export function formatPythonResultForModel(run: PythonRun, outcome: PythonRunOutcome): string {
  const seconds = (run.durationMs / 1000).toFixed(1);
  const lines: string[] = [];

  if (run.timedOut) {
    return [
      run.error || 'The code was stopped for taking too long.',
      'The interpreter was restarted, so anything earlier calls defined is gone.',
      'Try again with less work — a smaller sample, fewer iterations — or tell the user it is too large to compute here.',
    ].join('\n');
  }

  if (!run.ok) {
    lines.push(`The code failed after ${seconds}s.`);
    if (outcome.freshSession) lines.push('This was a new Python session, so nothing from earlier calls existed.');
    lines.push('', run.error || 'No error text was returned.', '');
    if (outcome.stdout.trim()) lines.push('It printed this before failing:', outcome.stdout.trim(), '');
    lines.push('Read the error, fix the code, and call run_python again. Do not guess what the answer would have been.');
    // Seen live: a missing module sent the model into `!pip install`, then a
    // shell command, then subprocess — three wasted rounds, none of which
    // exists in this sandbox. Say what actually works.
    if (/ModuleNotFoundError|No module named/.test(run.error || '')) {
      lines.push('There is no pip, no shell and no "!" commands here. Libraries install themselves when you import them at the top of your code, so just import what you need — and if that already failed, the library is unavailable and you should solve it another way or tell the user.');
    }
    return lines.join('\n');
  }

  lines.push(`Ran in ${seconds}s.`);
  if (outcome.freshSession) {
    lines.push('This was a new Python session; anything earlier calls defined is gone.');
  }

  if (outcome.stdout.trim()) {
    lines.push('', 'Output:', outcome.stdout.trimEnd());
  }
  if (outcome.stderr.trim()) {
    lines.push('', 'Warnings:', outcome.stderr.trimEnd());
  }

  const shown = describeShown(run.artifacts);
  if (shown.length > 0) lines.push('', ...shown);

  if (!outcome.stdout.trim() && shown.length === 0) {
    lines.push('', 'It produced no output. If you need a value back, print() it; if the user should see something, pass it to show().');
  }

  return lines.join('\n');
}

/**
 * The same runs, small enough to save.
 *
 * There is nothing left to trim by size now that bytes live in the file store —
 * a message carries ids — so this only bounds the shape. It stays a function
 * because the byte budget it replaced was load-bearing, and a saved message
 * must never quietly become the thing that overflows the conversation blob
 * again.
 */
export function pythonRunsForStorage(runs: readonly PythonRun[]): PythonRun[] {
  return runs.slice(-MAX_STORED_RUNS).map(run => ({
    ...run,
    code: run.code.slice(0, MAX_STORED_CODE_CHARS),
    artifacts: run.artifacts.slice(0, MAX_ARTIFACTS),
  }));
}
