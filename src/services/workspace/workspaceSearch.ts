import type { WorkspaceToolResult } from '../agent/deviceToolRunner';
import { listWorkspace, readWorkspaceFile } from './workspaceStore';

const MAX_GREP_MATCHES = 200;
const MAX_GREP_LINE_CHARS = 300;

/** Glob → RegExp. `**` crosses directories, `*` and `?` do not. Anything else is literal. */
export function globToRegExp(glob: string): RegExp {
  const trimmed = glob.trim().replace(/^\.\//, '');
  if (!trimmed) return /.*/;
  let source = '';
  for (let i = 0; i < trimmed.length; i++) {
    const ch = trimmed[i];
    if (ch === '*') {
      if (trimmed[i + 1] === '*') {
        // `**/` matches zero or more whole directories.
        if (trimmed[i + 2] === '/') { source += '(?:.*/)?'; i += 2; }
        else { source += '.*'; i += 1; }
      } else {
        source += '[^/]*';
      }
    } else if (ch === '?') {
      source += '[^/]';
    } else {
      source += ch.replace(/[.+^${}()|[\]\\]/g, '\\$&');
    }
  }
  // A bare name matches at any depth, the way people type "*.ts".
  const anchored = trimmed.includes('/') ? `^${source}$` : `(?:^|/)${source}$`;
  return new RegExp(anchored);
}


export async function searchWorkspace(sessionId: string, query: string, pathGlob: string): Promise<WorkspaceToolResult> {
  if (!query.trim()) return { ok: false, content: 'Error: query is empty.' };
  let pattern: RegExp;
  try {
    pattern = new RegExp(query, 'i');
  } catch {
    // Not a valid regex: search for it literally rather than failing the call.
    pattern = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
  }
  const glob = globToRegExp(pathGlob);
  const entries = await listWorkspace(sessionId);
  const matches: string[] = [];
  let filesSearched = 0;
  let filesWithMatches = 0;
  for (const entry of entries) {
    if (entry.binary || !glob.test(entry.path)) continue;
    const file = await readWorkspaceFile(sessionId, entry.path);
    if (!file?.text) continue;
    filesSearched++;
    let hit = false;
    const lines = file.text.split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (!pattern.test(lines[i])) continue;
      hit = true;
      const text = lines[i].length > MAX_GREP_LINE_CHARS ? `${lines[i].slice(0, MAX_GREP_LINE_CHARS)}…` : lines[i];
      matches.push(`${entry.path}:${i + 1}: ${text.trim()}`);
      if (matches.length >= MAX_GREP_MATCHES) break;
    }
    if (hit) filesWithMatches++;
    if (matches.length >= MAX_GREP_MATCHES) break;
  }
  if (matches.length === 0) {
    return {
      ok: true,
      detail: 'no matches',
      content: `No matches for ${JSON.stringify(query)} in ${filesSearched} file${filesSearched === 1 ? '' : 's'}${pathGlob.trim() ? ` matching ${pathGlob}` : ''}.`,
    };
  }
  const capped = matches.length >= MAX_GREP_MATCHES;
  return {
    ok: true,
    detail: `${matches.length}${capped ? '+' : ''} match${matches.length === 1 ? '' : 'es'} in ${filesWithMatches} file${filesWithMatches === 1 ? '' : 's'}`,
    output: matches.join('\n'),
    content: `${matches.join('\n')}${capped ? `\n… stopped at ${MAX_GREP_MATCHES} matches; narrow the query or path_glob.` : ''}`,
  };
}
