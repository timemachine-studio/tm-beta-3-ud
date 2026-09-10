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
 * Both api/ and src/ import this file, so it must stay dependency-free.
 */

/** A tool the browser executes. Anything not in here runs on the server. */
export const DEVICE_TOOL_NAMES = [
  'notes_search',
  'notes_read',
  'notes_create',
  'notes_edit',
  'chats_search',
  'chats_read',
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

export const NOTES_TOOLS = [notesSearchTool, notesReadTool, notesCreateTool, notesEditTool];
export const CHAT_HISTORY_TOOLS = [chatsSearchTool, chatsReadTool];
export const DEVICE_TOOLS = [...NOTES_TOOLS, ...CHAT_HISTORY_TOOLS];

/**
 * Which device apps a client says it can execute for.
 *
 * The client declares this per request rather than the server assuming it:
 * an older cached bundle that does not know these tools would otherwise be
 * offered them and strand every run at the first call.
 */
export const DEVICE_APPS = ['notes', 'chats'] as const;
export type DeviceApp = (typeof DEVICE_APPS)[number];

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
  const enabled: typeof DEVICE_TOOLS = [];
  if (apps.includes('notes')) {
    enabled.push(notesCreateTool);
    if (hasData.includes('notes')) enabled.push(notesSearchTool, notesReadTool, notesEditTool);
  }
  if (apps.includes('chats') && hasData.includes('chats')) {
    enabled.push(...CHAT_HISTORY_TOOLS);
  }
  return enabled;
}
