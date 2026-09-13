/**
 * Max Mode: TimeMachine PRO as a coding harness.
 *
 * Where Heat Level used to pick one of five personalities, Max Mode turns PRO
 * into an agent that works on a project: a workspace of files that lives on
 * the user's device (IndexedDB, one per chat), a Node runtime in the browser
 * for running and testing, and a GitHub repository the workspace can be
 * cloned from and pushed back to as a pull request.
 *
 * The model still runs on a server that cannot see any of that. So every
 * workspace tool here is a *device* tool in the sense of shared/deviceTools.ts:
 * declared here, offered by the server, executed by the browser, and replayed
 * back through the same stateless transcript bridge. Nothing about the bridge
 * had to change for this — only the budget, because a coding turn legitimately
 * takes forty round trips where a notes lookup takes four.
 *
 * Both api/ and src/ import this file, so it must stay dependency-free.
 */

import type { ToolDefinition } from './toolCatalog.js';

// ─── Modes ──────────────────────────────────────────────────────────────────

/**
 * What the agent is allowed to do this turn. The user picks one; the server
 * offers only the tools that mode permits, so the model cannot write in Plan
 * or run anything in Edit no matter what it decides.
 */
export const MAX_MODE_KINDS = ['plan', 'edit', 'auto'] as const;
export type MaxModeKind = (typeof MAX_MODE_KINDS)[number];

export const MAX_MODE_LABELS: Record<MaxModeKind, { name: string; description: string }> = {
  plan: { name: 'Plan', description: 'Reads the project and writes a plan. Changes nothing.' },
  edit: { name: 'Edit', description: 'Reads and edits files. Never runs anything.' },
  auto: { name: 'Auto', description: 'Edits, runs, previews and fixes until it is done.' },
};

export function isMaxModeKind(value: unknown): value is MaxModeKind {
  return typeof value === 'string' && (MAX_MODE_KINDS as readonly string[]).includes(value);
}

// ─── Budgets ────────────────────────────────────────────────────────────────

/**
 * Device round trips per mode.
 *
 * Each round is one whole model call with the transcript replayed, so this is
 * a cost ceiling before it is a loop guard — the same reasoning as
 * MAX_DEVICE_ROUNDS, with different numbers because the work is different. A
 * plan is a handful of reads. An edit pass reads, writes and re-reads. Auto
 * also installs, runs, reads the failure and goes again, and forty is where a
 * model that has not converged is not going to.
 */
export const MAX_MODE_ROUND_BUDGET: Record<MaxModeKind, number> = { plan: 12, edit: 24, auto: 40 };

/** The client's own stop, and the ceiling the schema accepts. */
export const MAX_MODE_ROUND_HARD_STOP = 48;

/** Ceiling on one workspace tool result before it enters the transcript. */
export const MAX_MODE_RESULT_CHARS = 40_000;

/**
 * How much tool output the transcript may carry between legs, in characters.
 *
 * PRO's models take a long context, and a coding turn genuinely needs to hold
 * several files at once — the file it is editing, the test that fails, the
 * module the test imports. The general loop trims at 20,000; that would forget
 * the file under edit by the third round.
 */
export const MAX_MODE_TRANSCRIPT_BUDGET_CHARS = 160_000;

/** Transcript entries one leg may replay. Two per round, plus slack. */
export const MAX_MODE_TRANSCRIPT_MESSAGES = 200;

/** Bytes a single workspace file may hold. Larger files are not for a chat. */
export const MAX_WORKSPACE_FILE_BYTES = 512 * 1024;

/** Files one workspace may hold. */
export const MAX_WORKSPACE_FILES = 2_000;

/** Paths listed in the request summary, so a big repo does not swamp the prompt. */
export const MAX_SUMMARY_PATHS = 400;

/** Seconds one run_command may take before it is killed. */
export const DEFAULT_COMMAND_TIMEOUT_SECONDS = 120;
export const MAX_COMMAND_TIMEOUT_SECONDS = 600;

// ─── Request shape ──────────────────────────────────────────────────────────

/** What the browser can run for the harness this request. */
export const MAX_MODE_RUNTIMES = ['node', 'python'] as const;
export type MaxModeRuntime = (typeof MAX_MODE_RUNTIMES)[number];

export interface WorkspaceRepoRef {
  owner: string;
  name: string;
  /** The branch the workspace was cloned from. Pushes branch off it. */
  branch: string;
}

/**
 * What the server is told about the workspace. Paths and sizes only — the
 * contents never leave the device until the model reads a file, and then only
 * that file, through the transcript, as with every other device tool.
 */
export interface MaxModeWorkspaceSummary {
  paths: string[];
  /** True when the workspace holds more files than `paths` lists. */
  truncated: boolean;
  repo?: WorkspaceRepoRef;
  runtimes: MaxModeRuntime[];
}

export interface MaxModeRequest {
  mode: MaxModeKind;
  workspace: MaxModeWorkspaceSummary;
}

// ─── Tools ──────────────────────────────────────────────────────────────────
//
// Named the way agents already know them. A model that has seen a coding
// harness before will reach for read_file and edit_file without being taught;
// ws_read would cost a paragraph of description to say the same thing.
//
// Every parameter is required and non-nullable: `strict: true` on an
// OpenAI-compatible endpoint rejects a schema whose `required` does not list
// every key. Where one is logically optional, the documented empty value is
// the "no value" case.

export const listFilesTool: ToolDefinition = {
  type: 'function',
  function: {
    name: 'list_files',
    strict: true,
    description: 'List the files in a workspace directory, with sizes. Use "" for the root. Lists one level; call again on a subdirectory to go deeper.',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Directory path relative to the workspace root, or "" for the root.' },
      },
      required: ['path'],
      additionalProperties: false,
    },
  },
};

export const readFileTool: ToolDefinition = {
  type: 'function',
  function: {
    name: 'read_file',
    strict: true,
    description: 'Read a workspace file. Lines come back numbered. Use start_line and end_line (1-based, inclusive) to read a range; 0 for both reads the whole file.',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'File path relative to the workspace root.' },
        start_line: { type: 'integer', description: 'First line to read, or 0 for the beginning.' },
        end_line: { type: 'integer', description: 'Last line to read, or 0 for the end.' },
      },
      required: ['path', 'start_line', 'end_line'],
      additionalProperties: false,
    },
  },
};

export const writeFileTool: ToolDefinition = {
  type: 'function',
  function: {
    name: 'write_file',
    strict: true,
    description: 'Create a file or replace its entire contents. Parent directories are created. For a change to part of an existing file, prefer edit_file.',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'File path relative to the workspace root.' },
        content: { type: 'string', description: 'The complete new contents of the file.' },
      },
      required: ['path', 'content'],
      additionalProperties: false,
    },
  },
};

export const editFileTool: ToolDefinition = {
  type: 'function',
  function: {
    name: 'edit_file',
    strict: true,
    description: 'Replace an exact string in a file. old_string must match the file exactly, whitespace included, and must be unique unless replace_all is true. Read the file first so the match is exact.',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'File path relative to the workspace root.' },
        old_string: { type: 'string', description: 'The text to replace, exactly as it appears in the file.' },
        new_string: { type: 'string', description: 'What to put in its place.' },
        replace_all: { type: 'boolean', description: 'Replace every occurrence instead of requiring a unique match.' },
      },
      required: ['path', 'old_string', 'new_string', 'replace_all'],
      additionalProperties: false,
    },
  },
};

export const deleteFileTool: ToolDefinition = {
  type: 'function',
  function: {
    name: 'delete_file',
    strict: true,
    description: 'Delete a workspace file, or a whole directory when the path ends with "/".',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'File path relative to the workspace root, or a directory path ending in "/".' },
      },
      required: ['path'],
      additionalProperties: false,
    },
  },
};

export const grepFilesTool: ToolDefinition = {
  type: 'function',
  function: {
    name: 'grep_files',
    strict: true,
    description: 'Search file contents across the workspace. Returns path, line number and the matching line. The query is a case-insensitive regular expression; path_glob narrows which files are searched ("" searches everything).',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Regular expression to search for.' },
        path_glob: { type: 'string', description: 'Glob such as "src/**/*.ts", or "" for all files.' },
      },
      required: ['query', 'path_glob'],
      additionalProperties: false,
    },
  },
};

export const runCommandTool: ToolDefinition = {
  type: 'function',
  function: {
    name: 'run_command',
    strict: true,
    description: 'Run a shell command in the workspace root on a Node.js runtime with npm: install dependencies, run scripts, tests, builds, or any node script. Returns stdout, stderr and the exit code. Long-running servers do not return — start a dev server with open_preview instead. The command runs in the browser, so there is no Python, no Docker and network access depends on browser/runtime restrictions.',
    parameters: {
      type: 'object',
      properties: {
        command: { type: 'string', description: 'The shell command, e.g. "npm install" or "npm test -- --run".' },
        timeout_seconds: { type: 'integer', description: `Seconds to wait before killing it. 0 means the default (${DEFAULT_COMMAND_TIMEOUT_SECONDS}).` },
      },
      required: ['command', 'timeout_seconds'],
      additionalProperties: false,
    },
  },
};

export const openPreviewTool: ToolDefinition = {
  type: 'function',
  function: {
    name: 'open_preview',
    strict: true,
    description: 'Show the user a live preview and read back what the browser console reported. target is either a workspace HTML file (e.g. "index.html") or a dev-server command (e.g. "npm run dev"); a command is started in the background and the preview attaches once it is serving. Use it to verify what you built, then fix whatever the console reports.',
    parameters: {
      type: 'object',
      properties: {
        target: { type: 'string', description: 'An HTML file path in the workspace, or a command that starts a dev server.' },
      },
      required: ['target'],
      additionalProperties: false,
    },
  },
};

export const openPullRequestTool: ToolDefinition = {
  type: 'function',
  function: {
    name: 'open_pull_request',
    strict: true,
    description: 'Commit every change in the workspace to a new branch of the connected GitHub repository and open a pull request against the branch it was cloned from. Only after the user has asked for a PR, and only once the work is verified.',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Pull request title. Also the commit message.' },
        body: { type: 'string', description: 'Pull request description, in Markdown.' },
        branch: { type: 'string', description: 'Branch name to create, e.g. "tm/fix-login-redirect". "" lets the app choose one.' },
      },
      required: ['title', 'body', 'branch'],
      additionalProperties: false,
    },
  },
};

/** The workspace tools, by name. `run_python` joins them from deviceTools.ts. */
export const WORKSPACE_TOOLS = {
  list_files: listFilesTool,
  read_file: readFileTool,
  write_file: writeFileTool,
  edit_file: editFileTool,
  delete_file: deleteFileTool,
  grep_files: grepFilesTool,
  run_command: runCommandTool,
  open_preview: openPreviewTool,
  open_pull_request: openPullRequestTool,
} as const;

export type WorkspaceToolName = keyof typeof WORKSPACE_TOOLS;

export const WORKSPACE_TOOL_NAMES = Object.keys(WORKSPACE_TOOLS) as WorkspaceToolName[];

const WORKSPACE_TOOL_NAME_SET: ReadonlySet<string> = new Set(WORKSPACE_TOOL_NAMES);

export function isWorkspaceToolName(name: string | undefined | null): name is WorkspaceToolName {
  return !!name && WORKSPACE_TOOL_NAME_SET.has(name);
}

/** Tools that change the workspace. Plan mode offers none of these. */
export const WORKSPACE_WRITE_TOOLS: readonly WorkspaceToolName[] = ['write_file', 'edit_file', 'delete_file'];

/** Tools that execute something. Only Auto offers these. */
export const WORKSPACE_RUN_TOOLS: readonly WorkspaceToolName[] = ['run_command', 'open_preview'];

/**
 * Which workspace tools each mode may call. The mode gate is enforced here,
 * by tool selection and by checks at execution time.
 */
export const MAX_MODE_TOOLS: Record<MaxModeKind, readonly WorkspaceToolName[]> = {
  plan: ['list_files', 'read_file', 'grep_files'],
  edit: ['list_files', 'read_file', 'grep_files', 'write_file', 'edit_file', 'delete_file'],
  auto: ['list_files', 'read_file', 'grep_files', 'write_file', 'edit_file', 'delete_file', 'run_command', 'open_preview', 'open_pull_request'],
};

/**
 * The workspace tools to offer, given the mode and what this client can run.
 *
 * `run_command` and dev-server previews need the Node runtime; a browser that
 * cannot boot it is offered only plain HTML previews, so the
 * model is told it cannot run things rather than stranded on a call that
 * cannot be answered. `open_pull_request` needs a connected repository.
 */
export function workspaceToolsFor(request: MaxModeRequest): ToolDefinition[] {
  const { mode, workspace } = request;
  const canRunNode = workspace.runtimes.includes('node');
  return MAX_MODE_TOOLS[mode]
    .filter(name => {
      if (name === 'run_command') return canRunNode;
      if (name === 'open_pull_request') return !!workspace.repo;
      return true;
    })
    .map(name => WORKSPACE_TOOLS[name]);
}

/** Whether Python is part of this mode. Only Auto runs anything. */
export function maxModeOffersPython(request: MaxModeRequest): boolean {
  return request.mode === 'auto' && request.workspace.runtimes.includes('python');
}

// ─── Paths ──────────────────────────────────────────────────────────────────

/**
 * Normalise a workspace path, or return null when it escapes the workspace.
 *
 * The workspace is a flat map of paths on the device, so there is no real
 * filesystem to escape — but a path with `..` in it would still let two names
 * mean the same file, and a leading slash would put a file nowhere the tree
 * can show it. Both sides normalise with this so they agree on every name.
 */
export function normalizeWorkspacePath(raw: string): string | null {
  if (typeof raw !== 'string' || [...raw].some(char => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127) || /^[a-z]:/i.test(raw)) return null;
  const parts: string[] = [];
  for (const part of raw.replace(/\\/g, '/').split('/')) {
    if (part === '' || part === '.') continue;
    if (part === '..') return null;
    parts.push(part);
  }
  const path = parts.join('/');
  if (path.length > 512) return null;
  return path;
}

/** Directories no harness should walk into or sync. */
export const IGNORED_WORKSPACE_DIRS: readonly string[] = ['node_modules', '.git', '.next', '.cache', 'dist', 'build', 'coverage', '.turbo', '.vercel'];

export function isIgnoredWorkspacePath(path: string): boolean {
  return path.split('/').some(part => IGNORED_WORKSPACE_DIRS.includes(part));
}
