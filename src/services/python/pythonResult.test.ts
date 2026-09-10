import { describe, expect, it } from 'vitest';
import {
  formatPythonResultForModel,
  pythonRunsForStorage,
  tidyTraceback,
  toArtifacts,
  toPythonRun,
} from './pythonResult';
import type { PythonRunOutcome } from './pythonTypes';
import type { PythonRun } from '../../types/chat';

/** A file store that always works, and remembers what it was handed. */
function fakeStore() {
  const saved: Array<{ name: string; mime: string; size: number }> = [];
  const saveFile = async (name: string, mime: string, bytes: Uint8Array) => {
    saved.push({ name, mime, size: bytes.length });
    return `file-${saved.length}`;
  };
  return { saved, saveFile };
}

/** A store that cannot write — a private window, or a full disk. */
const brokenStore = async () => null;

const bytes = (length = 4) => new Uint8Array(length).fill(1);

function outcome(overrides: Partial<PythonRunOutcome> = {}): PythonRunOutcome {
  return {
    ok: true,
    durationMs: 400,
    stdout: '',
    stderr: '',
    freshSession: false,
    outputs: [],
    files: [],
    ...overrides,
  };
}

describe('what the model is told', () => {
  it('gives back the printed output', async () => {
    const result = outcome({ stdout: '391\n' });
    const text = formatPythonResultForModel(await toPythonRun('print(17 * 23)', result, fakeStore().saveFile), result);
    expect(text).toContain('Ran in 0.4s');
    expect(text).toContain('391');
  });

  it('hands back the traceback and asks for a fix, not a guess', async () => {
    // The whole value of running code is that a failure is information. A
    // result that only said "it failed" would leave the model inventing the
    // answer, which is the outcome the tool exists to prevent.
    const result = outcome({
      ok: false,
      error: "NameError: name 'df' is not defined",
      stdout: 'loading\n',
    });
    const text = formatPythonResultForModel(await toPythonRun('df.head()', result, fakeStore().saveFile), result);
    expect(text).toContain("NameError: name 'df' is not defined");
    expect(text).toContain('It printed this before failing');
    expect(text).toContain('Do not guess');
  });

  it('strips the sandbox out of the traceback and keeps the model\'s own frames', () => {
    // Found live: a one-line NameError came back wrapped in four frames of
    // Pyodide's evaluator. It is expensive on the exact path the model is
    // already struggling on, and it points the model at the wrong code.
    const raw = [
      'Traceback (most recent call last):',
      '  File "/lib/python314.zip/_pyodide/_base.py", line 597, in eval_code_async',
      '    await CodeRunner(',
      '  File "<exec>", line 1, in <module>',
      "NameError: name 'df' is not defined",
    ].join('\n');
    expect(tidyTraceback(raw)).toBe([
      'Traceback (most recent call last):',
      '  File "<exec>", line 1, in <module>',
      "NameError: name 'df' is not defined",
    ].join('\n'));
  });

  it('leaves a message that is not a traceback alone', () => {
    expect(tidyTraceback('Python stopped: out of memory.')).toBe('Python stopped: out of memory.');
  });

  it('heads off the pip flailing a missing module causes', async () => {
    // Live: `!pip install openpyxl`, then a shell command, then subprocess —
    // three rounds spent on things that do not exist in this sandbox.
    const result = outcome({ ok: false, error: "ModuleNotFoundError: No module named 'openpyxl'" });
    const text = formatPythonResultForModel(await toPythonRun('df.to_excel()', result, fakeStore().saveFile), result);
    expect(text).toContain('no pip, no shell');
    expect(text).toContain('install themselves when you import them');
  });

  it('says outright when the interpreter was restarted', async () => {
    // Otherwise a NameError for a variable the model definitely defined looks
    // like the sandbox lying to it, and it stops trusting the tool.
    const result = outcome({ freshSession: true, stdout: 'ok\n' });
    const text = formatPythonResultForModel(await toPythonRun('print("ok")', result, fakeStore().saveFile), result);
    expect(text).toContain('new Python session');
  });

  it('explains a timeout as something to retry smaller, and admits the state is gone', async () => {
    const result = outcome({
      ok: false,
      timedOut: true,
      error: 'The code ran for more than 30 seconds and was stopped.',
    });
    const text = formatPythonResultForModel(await toPythonRun('while True: pass', result, fakeStore().saveFile), result);
    expect(text).toContain('was stopped');
    expect(text).toContain('anything earlier calls defined is gone');
    expect(text).toContain('less work');
  });

  it('tells the model the user can already see what was shown', async () => {
    // The failure this prevents: a chart is rendered under the message and the
    // model then transcribes the same table into its reply.
    const result = outcome({
      outputs: [
        { kind: 'image', bytes: bytes() },
        { kind: 'table', columns: ['a'], rows: [['1']], totalRows: 1, totalColumns: 1 },
      ],
    });
    const text = formatPythonResultForModel(await toPythonRun('show(df)', result, fakeStore().saveFile), result);
    expect(text).toContain('1 chart, 1 table');
    // Live failure: handed back a vector diagram it had just drawn, the model
    // still wrote "Draw a horizontal arrow to the right…" underneath it.
    expect(text).toContain('never describe how to draw something you have already drawn');
  });

  it('uses the other warning when there is no chart to describe', async () => {
    const result = outcome({
      outputs: [{ kind: 'table', columns: ['a'], rows: [['1']], totalRows: 1, totalColumns: 1 }],
    });
    const text = formatPythonResultForModel(await toPythonRun('show(df)', result, fakeStore().saveFile), result);
    expect(text).toContain('do not repeat the contents');
  });

  it('names generated files as downloads the user already has', async () => {
    const result = outcome({ files: [{ name: 'report.csv', size: 2048, bytes: bytes() }] });
    const text = formatPythonResultForModel(await toPythonRun('...', result, fakeStore().saveFile), result);
    expect(text).toContain('report.csv (2.0 KB)');
    expect(text).toContain('downloads');
    // Found live: the model turned "saved to /outputs" into a markdown image
    // and put a broken one in its answer beside the working chart.
    expect(text).toContain('not a web address');
  });

  it('nudges toward print() when a run produced nothing at all', async () => {
    const result = outcome();
    const text = formatPythonResultForModel(await toPythonRun('x = 1', result, fakeStore().saveFile), result);
    expect(text).toContain('print()');
    expect(text).toContain('show()');
  });
});

describe('what the user is shown', () => {
  it('puts the bytes in the file store and keeps only the id on the message', async () => {
    // The whole point of the substrate: a chart must not travel inside the
    // conversation. It used to be a base64 data URL on the message, which put
    // it in the localStorage blob and in a Supabase JSON column.
    const store = fakeStore();
    const artifacts = await toArtifacts(outcome({
      outputs: [
        { kind: 'image', bytes: bytes(64) },
        {
          kind: 'table',
          columns: ['month', 'total'],
          rows: [['Jan', '12']],
          totalRows: 400,
          totalColumns: 2,
        },
      ],
    }), store.saveFile);

    expect(artifacts[0]).toMatchObject({ kind: 'image', fileId: 'file-1' });
    expect(artifacts[0]).not.toHaveProperty('dataUrl');
    expect(store.saved[0]).toMatchObject({ mime: 'image/png', size: 64 });
    // The table keeps the real totals so the card can say what it is not
    // showing. A silently truncated table is a wrong table.
    expect(artifacts[1]).toMatchObject({ kind: 'table', totalRows: 400 });
  });

  it('gives a generated file the right type so the download opens', async () => {
    const store = fakeStore();
    const [artifact] = await toArtifacts(
      outcome({ files: [{ name: 'sales.xlsx', size: 10, bytes: bytes() }] }),
      store.saveFile,
    );
    expect(artifact).toMatchObject({ kind: 'file', fileId: 'file-1' });
    expect(store.saved[0].mime)
      .toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  });

  it('keeps a file that was too large to carry, so the model is not told it failed', async () => {
    const [artifact] = await toArtifacts(
      outcome({ files: [{ name: 'huge.zip', size: 90_000_000 }] }),
      fakeStore().saveFile,
    );
    expect(artifact).toMatchObject({ kind: 'file', dropped: true });
    expect(artifact).not.toHaveProperty('fileId');
  });

  it('still shows the artifact when the device could not store it', async () => {
    // A private window, a full disk, a browser with site data blocked. The
    // answer still arrived; only the bytes did not, and the card has to say
    // that rather than quietly render nothing.
    const artifacts = await toArtifacts(
      outcome({ outputs: [{ kind: 'image', bytes: bytes() }] }),
      brokenStore,
    );
    expect(artifacts[0]).toMatchObject({ kind: 'image', dropped: true });
  });
});

describe('what survives being saved', () => {
  const run = (id: string): PythonRun => ({
    id,
    code: 'plot()',
    ok: true,
    durationMs: 100,
    artifacts: [{ kind: 'image', fileId: `f-${id}` }],
  });

  it('keeps the file reference, because the bytes are not in here', () => {
    const [stored] = pythonRunsForStorage([run('a')]);
    expect(stored.artifacts[0]).toMatchObject({ kind: 'image', fileId: 'f-a' });
  });

  it('leaves runs in the order they happened', () => {
    expect(pythonRunsForStorage([run('a'), run('b')]).map(entry => entry.id)).toEqual(['a', 'b']);
  });

  it('bounds a turn that ran Python over and over', () => {
    const many = Array.from({ length: 20 }, (_unused, index) => run(String(index)));
    expect(pythonRunsForStorage(many).length).toBeLessThanOrEqual(6);
    // The most recent runs are the ones worth keeping.
    const kept = pythonRunsForStorage(many);
    expect(kept[kept.length - 1].id).toBe('19');
  });
});
