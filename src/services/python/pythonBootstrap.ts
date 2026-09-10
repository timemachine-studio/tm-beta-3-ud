/**
 * The Python side of the sandbox: what is defined before any model code runs.
 *
 * Two things live here and nowhere else.
 *
 * **`show()` is the whole user-visible contract.** The brief asked for Python
 * whose output the user can see — tables, charts, downloadable files — as a
 * separate capability from Python the model uses to think. It is not a
 * separate tool and not a parameter on one: it is this function. Code that
 * calls `show(df)` or draws a figure has said, in the only place that can
 * actually know, that the output is the deliverable. `print()` stays the
 * model's own working. Nothing here asks the user to approve anything —
 * showing a table is not an action that needs consent.
 *
 * **Everything is bounded in Python, before it crosses back.** A DataFrame
 * with a million rows must not become a million-row JSON payload on its way
 * to a `postMessage`, so the caps are applied at the point the object is read,
 * not after. The JS side bounds again — it does not trust these numbers — but
 * the expensive mistake is only avoidable here.
 *
 * Kept as a string rather than a `.py` file because the worker has to hand it
 * to Pyodide as source anyway, and a build step that copies a Python file into
 * the bundle is one more thing that can silently ship stale.
 */

/** Where generated files go. Anything written here is offered as a download. */
export const PYTHON_OUTPUT_DIR = '/outputs';

/** Where the user's own attachments are mounted, read-only by convention. */
export const PYTHON_INPUT_DIR = '/files';

/** Rows, columns and characters one `show()` may carry back. */
export const PYTHON_SHOW_LIMITS = { rows: 50, columns: 20, textChars: 4000 } as const;

export const PYTHON_BOOTSTRAP = `
import base64
import io
import json
import os
import sys
import warnings

# matplotlib picks an interactive backend when it thinks it has a browser to
# draw into. There is no DOM in a worker, so say so before pyplot is imported;
# figures are captured as PNG bytes instead.
os.environ["MPLBACKEND"] = "AGG"

_TM_OUTPUT_DIR = ${JSON.stringify(PYTHON_OUTPUT_DIR)}
_TM_INPUT_DIR = ${JSON.stringify(PYTHON_INPUT_DIR)}
_TM_MAX_ROWS = ${PYTHON_SHOW_LIMITS.rows}
_TM_MAX_COLS = ${PYTHON_SHOW_LIMITS.columns}
_TM_MAX_TEXT = ${PYTHON_SHOW_LIMITS.textChars}

os.makedirs(_TM_OUTPUT_DIR, exist_ok=True)
os.makedirs(_TM_INPUT_DIR, exist_ok=True)

# Working directory is where the user's own files are. Models write bare
# filenames — open("expenses.csv"), df.to_excel("out.xlsx") — far more often
# than absolute paths, and a FileNotFoundError for a file that is plainly
# attached is the worst possible answer. Bare reads now find the attachment,
# and bare writes land somewhere that is still collected: _tm_files walks both
# directories, so a file written next to the input is offered as a download
# exactly like one written to /outputs.
os.chdir(_TM_INPUT_DIR)

# plt.show() is the line every model writes, and with no canvas to show into
# matplotlib warns about it every time. The figure is captured either way, so
# the warning is not something the model can act on — it is noise in a tool
# result that costs tokens and invites the model to apologise for a run that
# worked.
warnings.filterwarnings("ignore", message="FigureCanvasAgg is non-interactive")

_tm_outputs = []
_tm_shown_figures = set()


def _tm_text(value):
    text = value if isinstance(value, str) else repr(value)
    if len(text) > _TM_MAX_TEXT:
        text = text[:_TM_MAX_TEXT] + "\\n… (truncated)"
    return text


def _tm_figure(fig):
    buffer = io.BytesIO()
    # Warnings raised in here belong to the capture, not to the model's code.
    # Letting matplotlib's own deprecations through would put three lines of
    # someone else's internals into every result that drew a chart.
    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        fig.savefig(buffer, format="png", dpi=96, bbox_inches="tight")
    _tm_shown_figures.add(fig.number)
    return {"kind": "image", "data": base64.b64encode(buffer.getvalue()).decode("ascii")}


def _tm_table(frame, caption):
    import pandas as pd

    if isinstance(frame, pd.Series):
        frame = frame.to_frame()
    total_rows = int(len(frame.index))
    total_columns = int(len(frame.columns))
    view = frame.iloc[:_TM_MAX_ROWS, :_TM_MAX_COLS]
    return {
        "kind": "table",
        "caption": caption,
        "columns": [str(column) for column in view.columns],
        "index": [str(label) for label in view.index],
        "rows": [["" if cell is None else str(cell) for cell in row]
                 for row in view.itertuples(index=False, name=None)],
        "totalRows": total_rows,
        "totalColumns": total_columns,
    }


def show(value, caption=None):
    """Put something in front of the user: a chart, a table, or text."""
    module = type(value).__module__.split(".")[0]
    if module == "matplotlib":
        # Accepts a Figure or anything that has one, so show(ax) works too.
        _tm_outputs.append(_tm_figure(getattr(value, "figure", value)))
        return
    if module == "pandas":
        _tm_outputs.append(_tm_table(value, caption))
        return
    _tm_outputs.append({"kind": "text", "caption": caption, "text": _tm_text(value)})


def _tm_reset():
    _tm_outputs.clear()
    _tm_shown_figures.clear()


def _tm_sweep():
    """Capture figures the code drew but never passed to show().

    Models write plt.plot(...) and stop, or end with plt.show(), far more often
    than they hand the figure over. A drawn figure is a figure meant to be
    seen, so anything still open when the code finishes is collected — minus
    what show() already took, which would otherwise appear twice.
    """
    pyplot = sys.modules.get("matplotlib.pyplot")
    if pyplot is not None:
        for number in pyplot.get_fignums():
            if number not in _tm_shown_figures:
                _tm_outputs.append(_tm_figure(pyplot.figure(number)))
        pyplot.close("all")
    _tm_shown_figures.clear()
    return json.dumps(_tm_outputs)


def _tm_files():
    found = []
    for directory in (_TM_OUTPUT_DIR, _TM_INPUT_DIR):
        for root, _directories, names in os.walk(directory):
            for name in names:
                path = os.path.join(root, name)
                try:
                    stats = os.stat(path)
                except OSError:
                    continue
                found.append({
                    "path": path,
                    "name": os.path.basename(path),
                    "size": int(stats.st_size),
                    "mtime": float(stats.st_mtime),
                })
    return json.dumps(found)


async def _tm_install(*packages):
    """Install PyPI wheels quietly, and never fatally.

    micropip narrates every install through the logging module, and that
    narration was landing in stdout as though the model's own code had printed
    it. A failed install is left to become the ImportError it was always going
    to be — which the model can read and work around — rather than an error
    before its code has run.
    """
    import logging

    logging.getLogger("micropip").setLevel(logging.ERROR)
    try:
        import micropip
    except ImportError:
        # Nothing to do, and nothing worth raising: the model's own import is
        # about to fail with a message that names the module it actually asked
        # for, which is far more use than one naming our installer.
        return

    for package in packages:
        try:
            await micropip.install(package)
        except Exception:
            pass


def _tm_read(path, limit):
    with open(path, "rb") as handle:
        return base64.b64encode(handle.read(limit)).decode("ascii")
`;
