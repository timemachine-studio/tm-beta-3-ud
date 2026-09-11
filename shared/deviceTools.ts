/**
 * Device tools: the capabilities that live in the browser, not on the server.
 *
 * TM Notes and personal chat history are stored on the user's device (and, for
 * signed-in users today, in their own RLS-scoped Supabase rows read by their
 * own client). The model runs on a server that cannot see either. So these
 * tools are *declared* here, offered to the model by the server, and executed
 * by the browser: the run suspends, the client does the work against local
 * storage, and the run resumes with the result appended to the transcript.
 *
 * Server-executable app tools (healthcare) live in api/_lib/tools.ts with the
 * rest of the server tools. The split is about where the data is, not about
 * which product surface the tool belongs to.
 *
 * `run_python` joins them for a different reason: its data is wherever the
 * user put it, but its *sandbox* is here. The bridge does not care why a tool
 * has to run on the device, only that it does.
 *
 * Both api/ and src/ import this file, so it must stay dependency-free.
 */

import { capabilitiesMet, type ToolDescriptor } from './toolCatalog.js';

/** A tool the browser executes. Anything not in here runs on the server. */
export const DEVICE_TOOL_NAMES = [
  'notes_search',
  'notes_read',
  'notes_create',
  'notes_edit',
  'chats_search',
  'chats_read',
  'run_python',
] as const;

export type DeviceToolName = (typeof DEVICE_TOOL_NAMES)[number];

const DEVICE_TOOL_NAME_SET: ReadonlySet<string> = new Set(DEVICE_TOOL_NAMES);

export function isDeviceToolName(name: string | undefined | null): name is DeviceToolName {
  return !!name && DEVICE_TOOL_NAME_SET.has(name);
}

/**
 * How many times one user turn may bounce between server and device.
 *
 * Each round is a whole extra model call — a fresh request for Air, a fresh
 * Trigger job for PRO — so this is a cost ceiling first and a loop guard
 * second. The tool a round spends on does not change what it costs.
 *
 * Six covers the deepest chain where each step genuinely needs the one before
 * it: find a chat, read it, read another range of it, then write the note.
 * That is four, plus one for a wrong first guess and one spare. Independent
 * lookups do not need their own rounds — a batch of calls in one model turn
 * runs together and costs one — which is why the directive tells the model to
 * ask for everything it knows it needs at once.
 *
 * Past this the model is looping rather than working, and a bigger number just
 * buys more of the same. Tune in production with DEVICE_ROUND_BUDGET.
 */
export const MAX_DEVICE_ROUNDS = 6;

/**
 * The client's own stop, and the ceiling any configured budget is clamped to.
 *
 * This is a safety valve against a server that keeps asking, not a policy —
 * the budget that actually governs a turn is resolved server-side, because
 * only the server decides whether the tools are offered at all.
 */
export const DEVICE_ROUND_HARD_STOP = 10;

/** Ceiling on a single device tool result before it enters the transcript. */
export const MAX_DEVICE_RESULT_CHARS = 12_000;

/** Wire type for the control frame that suspends a run. */
export interface DeviceToolCall {
  id: string;
  name: string;
  /** Raw JSON string, exactly as the model emitted it. Parsed on the device. */
  arguments: string;
}

export interface DeviceToolRequestFrame {
  type: 'device_tool_request';
  payload: {
    /** The assistant turn that made the calls, replayed verbatim on resume. */
    assistantContent: string | null;
    toolCalls: DeviceToolCall[];
    /** Results for calls in the same batch that the server could execute. */
    resolvedResults: Array<{ id: string; name: string; content: string }>;
    /** Rounds already spent, so the next leg can refuse to grant more. */
    deviceRounds: number;
  };
}

/** One entry of the transcript the client replays back into the next leg. */
export interface ToolTranscriptMessage {
  role: 'assistant' | 'tool';
  content: string | null;
  tool_calls?: Array<{ id: string; type: string; function: { name: string; arguments: string } }>;
  tool_call_id?: string;
  name?: string;
}

// ─── Tool definitions ───────────────────────────────────────────────────────
//
// These travel on every main-chat request, so their size is a per-message tax
// on the cheapest tier. Descriptions are one line each, and parameters the
// executor can decide for itself are not asked of the model at all — `limit`
// used to cost more in schema than it ever bought in control, and the
// executors clamp whatever they are given anyway.
//
// Every parameter that remains is required and non-nullable, matching the
// existing tools: `strict: true` on an OpenAI-compatible endpoint rejects a
// schema whose `required` does not list every key. Where one is logically
// optional, the empty string is the documented "no filter" value.

export const notesSearchTool = {
  type: 'function' as const,
  function: {
    name: 'notes_search',
    strict: true,
    description: "Search the user's notes in TM Notes. Empty query lists their most recent. Returns ids and excerpts; use notes_read for the full text.",
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Words to match, or empty to list recent notes.' },
      },
      required: ['query'],
      additionalProperties: false,
    },
  },
};

export const notesReadTool = {
  type: 'function' as const,
  function: {
    name: 'notes_read',
    strict: true,
    description: 'Read one note in full, as Markdown. Ids come from notes_search.',
    parameters: {
      type: 'object',
      properties: {
        note_id: { type: 'string', description: 'Id from notes_search.' },
      },
      required: ['note_id'],
      additionalProperties: false,
    },
  },
};

export const notesCreateTool = {
  type: 'function' as const,
  function: {
    name: 'notes_create',
    strict: true,
    description: 'Save a new note to TM Notes when the user wants something written down or kept. It appears in the chat with a link to open it.',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Short title.' },
        markdown: {
          type: 'string',
          description: 'Body as Markdown. Headings, lists, task lists, quotes, code fences and dividers all survive.',
        },
      },
      required: ['title', 'markdown'],
      additionalProperties: false,
    },
  },
};

export const notesEditTool = {
  type: 'function' as const,
  function: {
    name: 'notes_edit',
    strict: true,
    description: 'Change an existing note. Use this, never notes_create, when revising one you already saved — otherwise the user ends up with two.',
    parameters: {
      type: 'object',
      properties: {
        note_id: { type: 'string', description: 'Id of the note to change.' },
        title: { type: 'string', description: 'New title, or empty to keep the current one.' },
        markdown: { type: 'string', description: 'Markdown to write, per mode.' },
        mode: {
          type: 'string',
          description: 'How to apply the markdown.',
          enum: ['replace', 'append', 'prepend'],
        },
      },
      required: ['note_id', 'title', 'markdown', 'mode'],
      additionalProperties: false,
    },
  },
};

export const chatsSearchTool = {
  type: 'function' as const,
  function: {
    name: 'chats_search',
    strict: true,
    description: "Search the user's earlier conversations with you, by title and by message text. Empty query lists their most recent. This is how you answer \"what did we talk about\". Returns ids and excerpts; use chats_read for the conversation.",
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Words to match, or empty to list recent chats.' },
        after: { type: 'string', description: 'YYYY-MM-DD lower bound, or empty. Resolve "last month" yourself.' },
        before: { type: 'string', description: 'YYYY-MM-DD upper bound, or empty.' },
      },
      required: ['query', 'after', 'before'],
      additionalProperties: false,
    },
  },
};

export const chatsReadTool = {
  type: 'function' as const,
  function: {
    name: 'chats_read',
    strict: true,
    description: 'Read one earlier conversation, oldest first. Ids come from chats_search. Page a long one with offset.',
    parameters: {
      type: 'object',
      properties: {
        chat_id: { type: 'string', description: 'Id from chats_search.' },
        offset: { type: 'integer', description: 'Messages to skip. Start at 0.' },
      },
      required: ['chat_id', 'offset'],
      additionalProperties: false,
    },
  },
};

// ─── Code execution ─────────────────────────────────────────────────────────
//
// Python runs on the device for the same reason Notes does: not because the
// data is here, but because the *sandbox* is. A browser tab is already the
// strongest isolation boundary this product owns — no filesystem, no network
// credentials, no other users — and it is per-user by construction, so a
// runaway loop costs one person one tab rather than a shared worker.
//
// One tool, not three. The brief asked for reliable arithmetic, data analysis
// and user-visible output, and those are one runtime differing only in where
// the output goes. Splitting them would have put three schemas on every
// request that wants any of them and given the model a classification problem
// it has no reason to get right. What the user sees is decided by the code
// instead: `show()` and files in /outputs are the deliverable, stdout is the
// model's own working. Nothing here asks the user to approve anything —
// showing a table is not an action that needs consent.

export const runPythonTool = {
  type: 'function' as const,
  function: {
    name: 'run_python',
    strict: true,
    description: "Run Python and get its real output. Use it whenever an exact answer matters — arithmetic, physics, dates, counting, parsing, statistics — rather than working it out in your head, and to analyse data the user gave you. numpy, pandas and matplotlib are available, plus python-docx, openpyxl, fpdf2 and pypdf for making and reading Word, Excel and PDF files; imports install themselves. Variables persist between calls. print() what you need to read back; anything passed to show() — a chart, a DataFrame, a string — is displayed to the user, and files written to /outputs become their downloads. Asked to see, draw or visualise something, plot it and show() it: printed numbers are not a drawing.",
    parameters: {
      type: 'object',
      properties: {
        code: {
          type: 'string',
          description: 'Complete, self-contained Python. Imports included.',
        },
      },
      required: ['code'],
      additionalProperties: false,
    },
  },
};

/**
 * Turns that want code run rather than written.
 *
 * Unused while `run_python` is `core`, and kept deliberately: it is the whole
 * gate, ready to go back if the always-on cost stops being worth it. Two live
 * rounds of widening it are why the tool is core now — a keyword list could be
 * made to catch "1200 N … 2300 N" and "make me a PDF invoice", but only after
 * each one had already failed in front of a user, and there was always another
 * phrasing behind it.
 *
 * There is deliberately no veto. BUILD_TERMS, which vetoes generate_image,
 * contains 'python', 'chart', 'graph', 'table' and 'code' — the exact words
 * that should *enable* this tool.
 */
export const PYTHON_TERMS = [
  // Arithmetic and exact answers
  'calculate', 'calculation', 'compute', 'work out', 'how much is',
  'sum of', 'total of', 'add up', 'average of', 'the mean', 'median',
  'standard deviation', 'variance', 'percentage', 'percent of', 'ratio of',
  'round to', 'decimal places', 'significant figures', 'square root',
  'factorial', 'prime number', 'primes', 'fibonacci', 'compound interest',
  'interest rate', 'amortization', 'amortisation', 'probability of',
  // Dates
  'days between', 'weeks between', 'months between', 'years between',
  'how many days', 'day of the week', 'business days', 'leap year',
  // Data
  'this data', 'the data', 'dataset', 'data set', 'csv', 'tsv',
  'spreadsheet', 'dataframe', 'data frame', 'pandas', 'numpy', 'scipy',
  'matplotlib', 'sympy', 'statistics', 'regression', 'correlation',
  'outlier', 'outliers', 'group by', 'pivot', 'aggregate', 'distribution',
  'frequency of', 'word count', 'count how many', 'sort these', 'parse this',
  'deduplicate',
  // Charts
  'plot a', 'plot the', 'plot this', 'plotting', 'chart', 'histogram',
  'scatter plot', 'bar graph', 'line graph', 'pie chart', 'box plot',
  'heatmap', 'graph of', 'graph this', 'visualise', 'visualize',
  'visualisation', 'visualization',
  // Maths, physics and anything with one right answer. Added after a live
  // miss: a resultant-force question carried no operator and none of the words
  // above, so the tool was never offered and the model answered by hand.
  'solve', 'solve for', 'equation', 'formula', 'work it out', 'evaluate',
  'resultant', 'vector', 'magnitude', 'newton', 'newtons', 'force', 'forces',
  'velocity', 'acceleration', 'momentum', 'kinetic', 'trajectory', 'friction',
  'angle', 'degrees', 'radians', 'hypotenuse', 'triangle', 'pythagoras',
  'sine', 'cosine', 'tangent', 'trig', 'quadratic', 'roots of', 'logarithm',
  'derivative', 'integral', 'matrix', 'determinant', 'diagram',
  // Documents. run_python is what makes these, so the words that mean "make me
  // a file" have to reach it — there is no separate PDF or Word tool.
  'pdf', 'word document', 'docx', 'excel', 'xlsx', 'spreadsheet file',
  'worksheet', 'workbook', 'invoice', 'report', 'certificate', 'letter',
  'export to', 'save as a file', 'make a file', 'downloadable', 'download',
  // Explicit
  'run python', 'use python', 'python script', 'run this code',
  'run the code', 'execute this', 'execute python', 'simulate',
  'simulation', 'monte carlo', 'brute force',
];

export const NOTES_TOOLS = [notesSearchTool, notesReadTool, notesCreateTool, notesEditTool];
export const CHAT_HISTORY_TOOLS = [chatsSearchTool, chatsReadTool];
export const DEVICE_TOOLS = [...NOTES_TOOLS, ...CHAT_HISTORY_TOOLS, runPythonTool];

/**
 * Which device apps a client says it can execute for.
 *
 * The client declares this per request rather than the server assuming it:
 * an older cached bundle that does not know these tools would otherwise be
 * offered them and strand every run at the first call.
 */
export const DEVICE_APPS = ['notes', 'chats', 'python'] as const;
export type DeviceApp = (typeof DEVICE_APPS)[number];

/**
 * The apps whose tools are worth withholding when the store is empty.
 *
 * `python` is a capability, not a store: there is nothing in it to be empty,
 * and a client that can run it can always run it. Keeping the distinction
 * explicit is what stops a meaningless `python:data` capability existing.
 */
export const DATA_BACKED_APPS: readonly DeviceApp[] = ['notes', 'chats'];

/**
 * The tools to offer, given what this client can run and what it actually has.
 *
 * `apps` is capability — whether the code to execute these exists. `hasData`
 * is whether there is anything for them to find. They are separate because a
 * tool that reads is useless against an empty store, while a tool that writes
 * is exactly how the store stops being empty: a user with no notes still needs
 * notes_create, and would otherwise never be able to make their first one.
 *
 * Withholding a reader from an empty store is not the intent gate this design
 * set out to avoid. It does not guess what the user means; it reflects what
 * exists. On the free tier — where most people have no notes and no history
 * yet — it takes roughly a thousand tokens off every message they send.
 */
export function deviceToolsFor(
  apps: readonly string[],
  hasData: readonly string[] = DEVICE_APPS,
): typeof DEVICE_TOOLS {
  const capabilities = deviceCapabilities(apps, hasData);
  return DEVICE_TOOL_DESCRIPTORS
    .filter(descriptor => capabilitiesMet(descriptor, capabilities))
    .map(descriptor => descriptor.definition as typeof DEVICE_TOOLS[number]);
}

// ─── Catalogue descriptors ──────────────────────────────────────────────────

/**
 * The same rules as `deviceToolsFor`, expressed as catalogue capabilities.
 *
 * `notes` / `chats` mean the client has the code to execute for that app.
 * `notes:data` / `chats:data` mean there is something in that store worth
 * reading — so a reader declares both and a writer declares only the first.
 * That is the whole "readers are withheld from an empty store" rule, moved
 * from a hand-written branch into data the packer already knows how to read.
 *
 * These are `core`: no intent gate, exactly as before. Gating a user's own
 * notes on keywords is the same mistake as making them open a specialist mode
 * first — it just moves the door.
 */
export function deviceCapabilities(
  apps: readonly string[],
  hasData: readonly string[] = DEVICE_APPS,
): string[] {
  const capabilities: string[] = [];
  for (const app of DEVICE_APPS) {
    if (!apps.includes(app)) continue;
    capabilities.push(app);
    if (DATA_BACKED_APPS.includes(app) && hasData.includes(app)) capabilities.push(`${app}:data`);
  }
  return capabilities;
}

export const DEVICE_TOOL_DESCRIPTORS: ToolDescriptor[] = [
  {
    name: 'notes_create',
    definition: notesCreateTool,
    runtime: 'device',
    tier: 'core',
    // No :data requirement — writing is how an empty store stops being empty.
    requires: ['notes'],
    summary: "Save a new note to the user's TM Notes.",
    origin: 'builtin',
  },
  {
    name: 'notes_search',
    definition: notesSearchTool,
    runtime: 'device',
    tier: 'core',
    requires: ['notes', 'notes:data'],
    summary: "Search the user's own notes in TM Notes.",
    origin: 'builtin',
  },
  {
    name: 'notes_read',
    definition: notesReadTool,
    runtime: 'device',
    tier: 'core',
    requires: ['notes', 'notes:data'],
    summary: 'Read one of the user\'s notes in full.',
    origin: 'builtin',
  },
  {
    name: 'notes_edit',
    definition: notesEditTool,
    runtime: 'device',
    tier: 'core',
    requires: ['notes', 'notes:data'],
    summary: 'Change a note the user already has.',
    origin: 'builtin',
  },
  {
    name: 'chats_search',
    definition: chatsSearchTool,
    runtime: 'device',
    tier: 'core',
    requires: ['chats', 'chats:data'],
    summary: 'Search the user\'s earlier conversations by title and message text.',
    origin: 'builtin',
  },
  {
    name: 'chats_read',
    definition: chatsReadTool,
    runtime: 'device',
    tier: 'core',
    requires: ['chats', 'chats:data'],
    summary: 'Read the messages of one earlier conversation.',
    origin: 'builtin',
  },
  {
    name: 'run_python',
    definition: runPythonTool,
    runtime: 'device',
    // Core, after two rounds of the gate being wrong in front of a user: a
    // resultant-force question answered by hand with the angle off in the
    // second decimal, and "use python to show it" that printed instead of
    // drawing. Both were gate misses, and each fix only closed the phrasing
    // that had already failed.
    //
    // Core is the right tier on its own terms, too. It means "a capability the
    // user has, not a guess about what they meant", and a code sandbox is
    // exactly that — the same argument that makes their own notes core. The
    // failure the gating mechanism was built for is an unwanted *picture*;
    // Python that is offered and not needed simply is not called.
    //
    // It costs ~290 tokens on every Air message. `select` below is the gate it
    // would go back to: change this one word and the terms take over again.
    tier: 'core',
    requires: ['python'],
    summary: 'Run Python for exact results, data analysis, charts, tables, and PDF, Word or Excel files the user can download.',
    origin: 'builtin',
    select: {
      intent: PYTHON_TERMS,
      // Neither "17 * 23" nor "1200 N … 2300 N" contains a word a term list
      // could match, and between them they are most of what this tool is for.
      predicates: ['calculation_in_message', 'quantities_in_message'],
    },
  },
];
