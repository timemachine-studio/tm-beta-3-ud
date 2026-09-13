import { requestPublicationApproval } from './publicationApproval';
/**
 * Executes Max Mode's workspace tools (shared/maxMode.ts) on the device.
 *
 * Each tool returns two things: text for the model — the transcript is the
 * only channel it has — and a few fields for the card the user sees. The two
 * are shaped differently on purpose. The model gets a numbered file; the user
 * gets "Read src/App.tsx · 212 lines". The model gets "edited, 1 replacement";
 * the user gets the diff.
 *
 * The runtime, the preview and GitHub are imported lazily: a Plan turn that
 * only reads files must not boot a Node runtime.
 */

import {
  DEFAULT_COMMAND_TIMEOUT_SECONDS,
  MAX_COMMAND_TIMEOUT_SECONDS,
  MAX_MODE_RESULT_CHARS,
  MAX_MODE_TOOLS,
  WORKSPACE_TOOLS,
  type MaxModeKind,
  isIgnoredWorkspacePath,
  normalizeWorkspacePath,
  type WorkspaceToolName,
} from '../../../shared/maxMode';
import type { WorkspaceToolExecutor, WorkspaceToolResult } from '../agent/deviceToolRunner';
import { diffSummary, lineDiff } from './diff';
import {
  WorkspaceStorageError,
  deleteWorkspacePath,
  listWorkspace,
  readWorkspaceFile,
  writeWorkspaceFile,
} from './workspaceStore';

export interface WorkspaceExecutorOptions {
  sessionId: string;
  mode: MaxModeKind;
  /** Stop pressed. Commands are killed; file tools finish what they started. */
  signal?: AbortSignal;
}

const MAX_LISTING = 500;
/** Lines of command output the card keeps. The model gets more, from the end. */
const CARD_OUTPUT_CHARS = 6_000;

function asString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function asInt(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.trunc(value) : fallback;
}

function tail(text: string, chars: number): string {
  return text.length > chars ? `…${text.slice(-chars)}` : text;
}

export { globToRegExp } from './workspaceSearch';

function numbered(lines: string[], from: number): string {
  const width = String(from + lines.length - 1).length;
  return lines.map((line, index) => `${String(from + index).padStart(width, ' ')}\t${line}`).join('\n');
}

export function createWorkspaceExecutor(options: WorkspaceExecutorOptions): WorkspaceToolExecutor {
  const { sessionId, signal, mode } = options;

  const run = async (
    name: WorkspaceToolName,
    args: Record<string, unknown>,
    context: { onStatus?: (status: string) => void },
  ): Promise<WorkspaceToolResult> => {
    if (signal?.aborted) return { ok: false, content: 'Error: the user stopped this turn. No tool was executed.' };
    if (!MAX_MODE_TOOLS[mode].includes(name)) {
      return { ok: false, content: `Error: ${name} is not allowed in ${mode} mode.` };
    }
    const schema = WORKSPACE_TOOLS[name].function.parameters as {
      properties: Record<string, { type: string }>; required: string[];
    };
    for (const key of schema.required) {
      const type = schema.properties[key].type;
      const value = args[key];
      const valid = type === 'integer' ? typeof value === 'number' && Number.isSafeInteger(value) : typeof value === type;
      if (!valid) return { ok: false, content: `Error: ${name}.${key} must be ${type}. No action was taken.` };
    }
    if (Object.keys(args).some(key => !(key in schema.properties))) {
      return { ok: false, content: `Error: ${name} received an unknown argument. No action was taken.` };
    }
    switch (name) {
      case 'list_files': return listFiles(asString(args.path));
      case 'read_file': return readFile(asString(args.path), asInt(args.start_line, 0), asInt(args.end_line, 0));
      case 'write_file': return writeFile(asString(args.path), asString(args.content));
      case 'edit_file': return editFile(asString(args.path), asString(args.old_string), asString(args.new_string), args.replace_all === true);
      case 'delete_file': return deleteFile(asString(args.path));
      case 'grep_files': return grepFiles(asString(args.query), asString(args.path_glob));
      case 'run_command': return runCommand(asString(args.command), asInt(args.timeout_seconds, 0), context);
      case 'open_preview': return openPreview(asString(args.target), context);
      case 'open_pull_request': return openPullRequest(asString(args.title), asString(args.body), asString(args.branch), context);
      default: return { ok: false, content: `Error: ${String(name)} is not a workspace tool.` };
    }
  };

  // ─── Files ────────────────────────────────────────────────────────────────

  async function listFiles(rawPath: string): Promise<WorkspaceToolResult> {
    const dir = rawPath.trim() === '' ? '' : normalizeWorkspacePath(rawPath);
    if (dir === null) return { ok: false, content: `Error: "${rawPath}" is not a valid path.` };
    const entries = await listWorkspace(sessionId);
    const prefix = dir ? `${dir}/` : '';
    const dirs = new Map<string, number>();
    const files: Array<{ name: string; size: number }> = [];
    for (const entry of entries) {
      if (!entry.path.startsWith(prefix)) continue;
      const rest = entry.path.slice(prefix.length);
      const slash = rest.indexOf('/');
      if (slash === -1) files.push({ name: rest, size: entry.size });
      else dirs.set(rest.slice(0, slash), (dirs.get(rest.slice(0, slash)) ?? 0) + 1);
    }
    if (dirs.size === 0 && files.length === 0) {
      return {
        ok: true,
        path: dir || undefined,
        detail: 'empty',
        content: dir ? `${dir}/ does not exist or is empty.` : 'The workspace is empty.',
      };
    }
    const lines = [
      ...[...dirs.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([name, count]) => `${name}/  (${count} file${count === 1 ? '' : 's'})`),
      ...files.sort((a, b) => a.name.localeCompare(b.name)).map(file => `${file.name}  ${file.size.toLocaleString()} B`),
    ];
    const shown = lines.slice(0, MAX_LISTING);
    return {
      ok: true,
      path: dir || undefined,
      detail: `${dirs.size} folder${dirs.size === 1 ? '' : 's'}, ${files.length} file${files.length === 1 ? '' : 's'}`,
      output: shown.join('\n'),
      content: `${dir || '.'}/\n${shown.join('\n')}${lines.length > shown.length ? `\n… ${lines.length - shown.length} more` : ''}`,
    };
  }

  async function readFile(rawPath: string, startLine: number, endLine: number): Promise<WorkspaceToolResult> {
    const path = normalizeWorkspacePath(rawPath);
    if (!path) return { ok: false, content: `Error: "${rawPath}" is not a valid path.` };
    const file = await readWorkspaceFile(sessionId, path);
    if (!file) return { ok: false, path, detail: 'not found', content: `Error: ${path} does not exist. Call list_files to see what does.` };
    if (file.text === null) return { ok: false, path, detail: 'binary', content: `Error: ${path} is a binary file (${file.size.toLocaleString()} bytes) and cannot be read as text.` };

    const lines = file.text.split('\n');
    const total = lines.length;
    if (startLine < 0 || endLine < 0 || startLine > total) {
      return { ok: false, path, content: `Error: invalid line range; ${path} has ${total} lines. Use 0 for the beginning/end.` };
    }
    const from = startLine > 0 ? startLine : 1;
    const to = endLine > 0 ? Math.min(endLine, total) : total;
    if (to < from) return { ok: false, path, content: `Error: end_line ${endLine} is before start_line ${startLine}; the file has ${total} lines.` };

    let slice = lines.slice(from - 1, to);
    let body = numbered(slice, from);
    let note = '';
    if (body.length > MAX_MODE_RESULT_CHARS - 400) {
      // Cut on a line boundary and say where, so the model asks for the rest
      // by number instead of guessing that the file ended.
      let budget = 0;
      let count = 0;
      for (const line of slice) {
        budget += line.length + 8;
        if (budget > MAX_MODE_RESULT_CHARS - 400) break;
        count++;
      }
      slice = slice.slice(0, Math.max(count, 1));
      body = numbered(slice, from);
      note = `\n\n[Showing lines ${from}–${from + slice.length - 1} of ${total}. Call read_file again with start_line ${from + slice.length} for the rest.]`;
    }
    const range = from === 1 && to === total ? `${total} lines` : `lines ${from}–${to} of ${total}`;
    return {
      ok: true,
      path,
      detail: range,
      content: `${path} (${range}):\n${body}${note}`,
    };
  }

  async function writeFile(rawPath: string, content: string): Promise<WorkspaceToolResult> {
    const path = normalizeWorkspacePath(rawPath);
    if (!path) return { ok: false, content: `Error: "${rawPath}" is not a valid path.` };
    if (isIgnoredWorkspacePath(path)) return { ok: false, path, content: `Error: ${path} is inside a directory the workspace does not track (node_modules, dist, .git…).` };
    const existing = await readWorkspaceFile(sessionId, path);
    try {
      await writeWorkspaceFile(sessionId, path, content);
    } catch (error) {
      if (error instanceof WorkspaceStorageError) return { ok: false, path, detail: 'not saved', content: `Error: ${error.message}` };
      throw error;
    }
    const lineCount = content === '' ? 0 : content.split('\n').length;
    if (existing?.text != null) {
      const diff = lineDiff(existing.text, content);
      return {
        ok: true, path,
        detail: diffSummary(diff),
        output: diff.unified ?? undefined,
        content: `Wrote ${path} (${lineCount} lines, replacing the previous ${existing.text.split('\n').length}).`,
      };
    }
    return {
      ok: true, path,
      detail: `new · ${lineCount} lines`,
      output: lineCount <= 120 ? content : `${content.split('\n').slice(0, 120).join('\n')}\n…`,
      content: `Created ${path} (${lineCount} lines).`,
    };
  }

  async function editFile(rawPath: string, oldString: string, newString: string, replaceAll: boolean): Promise<WorkspaceToolResult> {
    const path = normalizeWorkspacePath(rawPath);
    if (!path) return { ok: false, content: `Error: "${rawPath}" is not a valid path.` };
    if (oldString === '') return { ok: false, path, content: 'Error: old_string is empty. To create a file or replace all of it, use write_file.' };
    if (oldString === newString) return { ok: false, path, content: 'Error: old_string and new_string are identical; nothing to change.' };
    const file = await readWorkspaceFile(sessionId, path);
    if (!file) return { ok: false, path, detail: 'not found', content: `Error: ${path} does not exist. Use write_file to create it.` };
    if (file.text === null) return { ok: false, path, detail: 'binary', content: `Error: ${path} is binary and cannot be edited as text.` };

    const occurrences = file.text.split(oldString).length - 1;
    if (occurrences === 0) {
      return {
        ok: false, path, detail: 'no match',
        content: `Error: old_string was not found in ${path}. It must match the file exactly, including whitespace and indentation. Read the file again and copy the text verbatim.`,
      };
    }
    if (occurrences > 1 && !replaceAll) {
      return {
        ok: false, path, detail: `${occurrences} matches`,
        content: `Error: old_string appears ${occurrences} times in ${path}. Include more surrounding lines so it is unique, or set replace_all to true to change every occurrence.`,
      };
    }
    const next = replaceAll ? file.text.split(oldString).join(newString) : file.text.replace(oldString, () => newString);
    try {
      await writeWorkspaceFile(sessionId, path, next);
    } catch (error) {
      if (error instanceof WorkspaceStorageError) return { ok: false, path, detail: 'not saved', content: `Error: ${error.message}` };
      throw error;
    }
    const diff = lineDiff(file.text, next);
    return {
      ok: true, path,
      detail: diffSummary(diff),
      output: diff.unified ?? undefined,
      content: `Edited ${path}: ${replaceAll ? `${occurrences} replacements` : '1 replacement'} (${diffSummary(diff)}).`,
    };
  }

  async function deleteFile(rawPath: string): Promise<WorkspaceToolResult> {
    const path = normalizeWorkspacePath(rawPath);
    if (!path) return { ok: false, content: `Error: "${rawPath}" is not a valid path.` };
    const removed = await deleteWorkspacePath(sessionId, rawPath);
    if (removed.length === 0) return { ok: false, path, detail: 'not found', content: `Error: ${path} does not exist.` };
    return {
      ok: true, path,
      detail: removed.length === 1 ? 'deleted' : `${removed.length} files deleted`,
      output: removed.length > 1 ? removed.join('\n') : undefined,
      content: removed.length === 1 ? `Deleted ${removed[0]}.` : `Deleted ${removed.length} files under ${path}/:\n${removed.join('\n')}`,
    };
  }

  async function grepFiles(query: string, pathGlob: string): Promise<WorkspaceToolResult> {
    const { runWorkspaceSearch } = await import('./workspaceSearchRuntime');
    return runWorkspaceSearch({ sessionId, query, pathGlob }, signal);
  }

  // ─── Running ──────────────────────────────────────────────────────────────

  async function runCommand(command: string, timeoutSeconds: number, context: { onStatus?: (status: string) => void }): Promise<WorkspaceToolResult> {
    if (!command.trim()) return { ok: false, content: 'Error: command is empty.' };
    const { nodeRuntime, nodeRuntimeSupported } = await import('./nodeRuntime');
    if (!nodeRuntimeSupported()) {
      return { ok: false, detail: 'no runtime', content: 'Error: this browser cannot run the Node runtime, so run_command is unavailable. Continue as an Edit turn and tell the user what to run.' };
    }
    const timeoutMs = 1000 * Math.min(timeoutSeconds > 0 ? timeoutSeconds : DEFAULT_COMMAND_TIMEOUT_SECONDS, MAX_COMMAND_TIMEOUT_SECONDS);
    const result = await nodeRuntime().run(sessionId, command, {
      timeoutMs,
      signal,
      onPhase: (phase) => context.onStatus?.(phase),
    });
    const output = result.output.trim();
    const shown = tail(output, MAX_MODE_RESULT_CHARS - 600);
    const status = result.timedOut
      ? `timed out after ${Math.round(timeoutMs / 1000)}s`
      : `exit ${result.exitCode} in ${(result.durationMs / 1000).toFixed(1)}s`;
    const synced = result.syncedBack.length > 0
      ? `\n\n[${result.syncedBack.length} workspace file${result.syncedBack.length === 1 ? '' : 's'} changed by this command: ${result.syncedBack.slice(0, 20).join(', ')}${result.syncedBack.length > 20 ? ', …' : ''}]`
      : '';
    return {
      ok: !result.timedOut && result.exitCode === 0,
      detail: status,
      output: tail(output, CARD_OUTPUT_CHARS) || '(no output)',
      content: `$ ${command}\n${shown || '(no output)'}\n\n[${status}]${result.timedOut ? ' The process was killed. A command that never exits — a dev server, a watcher — belongs in open_preview.' : ''}${synced}`,
    };
  }

  async function openPreview(target: string, context: { onStatus?: (status: string) => void }): Promise<WorkspaceToolResult> {
    if (!target.trim()) return { ok: false, content: 'Error: target is empty. Give an HTML file path or a dev-server command.' };
    const { previewController } = await import('./previewController');

    const asPath = normalizeWorkspacePath(target);
    const isHtml = !!asPath && /\.html?$/i.test(asPath) && !target.trim().includes(' ');
    if (isHtml) {
      const file = await readWorkspaceFile(sessionId, asPath!);
      if (!file) return { ok: false, path: asPath!, detail: 'not found', content: `Error: ${asPath} does not exist.` };
      context.onStatus?.(`Previewing ${asPath}`);
      const report = await previewController.showHtml(sessionId, asPath!, signal);
      return {
        ok: report.loaded && report.errors === 0,
        path: asPath!,
        detail: !report.loaded ? 'load not confirmed' : report.errors > 0 ? `${report.errors} console error${report.errors === 1 ? '' : 's'}` : 'loaded',
        output: report.console.join('\n') || undefined,
        content: !report.loaded ? `Preview of ${asPath} was requested but its load was not confirmed. This is not a successful rendering check.` : report.console.length > 0
          ? `Preview of ${asPath} is showing. Console:\n${report.console.join('\n')}`
          : `Preview of ${asPath} is showing. The console reported nothing.`,
      };
    }

    const { nodeRuntime, nodeRuntimeSupported } = await import('./nodeRuntime');
    if (!nodeRuntimeSupported()) {
      return { ok: false, detail: 'no runtime', content: 'Error: this browser cannot run the Node runtime, so a dev server cannot be started. Preview a plain HTML file instead, or tell the user what to run.' };
    }
    context.onStatus?.('Starting the dev server');
    const server = await nodeRuntime().startServer(sessionId, target, { signal, timeoutMs: 90_000, onPhase: (phase) => context.onStatus?.(phase) });
    if (!server.url) {
      return {
        ok: false,
        detail: 'no server',
        output: tail(server.output, CARD_OUTPUT_CHARS) || undefined,
        content: `The command did not start listening on a port within 90 seconds.\n$ ${target}\n${tail(server.output, MAX_MODE_RESULT_CHARS - 600) || '(no output)'}`,
      };
    }
    const report = await previewController.showUrl(sessionId, server.url, target, signal);
    return {
      ok: report.loaded && report.errors === 0,
      detail: !report.loaded ? 'load not confirmed' : report.errors ? `${report.errors} browser errors` : `loaded on port ${server.port}`,
      output: tail(server.output, CARD_OUTPUT_CHARS) || undefined,
      content: `The dev server is running on port ${server.port}. ${report.loaded ? 'The preview frame loaded.' : 'The preview frame did not confirm loading.'} This is not a visual inspection.\nBrowser errors forwarded by the runtime:\n${report.console.join('\n') || '(none received)'}\nServer output:\n$ ${target}\n${tail(server.output, 4_000)}`,
    };
  }

  // ─── GitHub ───────────────────────────────────────────────────────────────

  async function openPullRequest(title: string, body: string, branch: string, context: { onStatus?: (status: string) => void }): Promise<WorkspaceToolResult> {
    if (!title.trim()) return { ok: false, content: 'Error: title is empty.' };
    const { openPullRequestFromWorkspace } = await import('./githubService');
    context.onStatus?.('Waiting for your approval to publish');
    const result = await openPullRequestFromWorkspace(sessionId, {
      title: title.trim(), body, branch: branch.trim() || undefined, signal,
      approve: proposal => requestPublicationApproval(sessionId, proposal, signal),
    });
    if (!result.ok) return { ok: false, detail: 'not pushed', content: `Error: ${result.error}` };
    return {
      ok: true,
      detail: `#${result.number} on ${result.branch}`,
      output: result.url,
      content: `Opened pull request #${result.number}: ${result.url}\nBranch ${result.branch} carries ${result.changedFiles} changed file${result.changedFiles === 1 ? '' : 's'}. Give the user the link.`,
    };
  }

  return { run };
}
