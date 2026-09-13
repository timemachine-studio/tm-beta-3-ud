import { unzipSync } from 'fflate';
import { isIgnoredWorkspacePath, MAX_WORKSPACE_FILE_BYTES, MAX_WORKSPACE_FILES, normalizeWorkspacePath } from '../../../shared/maxMode';

export const MAX_WORKSPACE_ARCHIVE_BYTES = 64 * 1024 * 1024;
export interface DecodedWorkspaceArchive {
  files: Array<{ path: string; content: string | Uint8Array }>;
  skipped: Array<{ path: string; reason: string }>;
}

/** Filter declared sizes before inflation; decode in a worker to bound CPU too. */
export function decodeWorkspaceArchive(zip: Uint8Array): DecodedWorkspaceArchive {
  if (zip.byteLength > MAX_WORKSPACE_ARCHIVE_BYTES) throw new Error('ZIP archives may be at most 64 MB.');
  const skipped: DecodedWorkspaceArchive['skipped'] = [];
  const names: string[] = [];
  let expandedBytes = 0;
  let acceptedFiles = 0;
  const unpacked = unzipSync(zip, { filter: file => {
    if (file.name.endsWith('/')) return false;
    names.push(file.name);
    const path = normalizeWorkspacePath(file.name);
    let reason: string | null = null;
    if (!path) reason = 'invalid path';
    else if (isIgnoredWorkspacePath(path)) reason = 'ignored directory';
    else if (file.originalSize > MAX_WORKSPACE_FILE_BYTES) reason = 'too large';
    else if (acceptedFiles >= MAX_WORKSPACE_FILES) reason = 'workspace full';
    if (reason) { skipped.push({ path: file.name, reason }); return false; }
    expandedBytes += file.originalSize;
    if (expandedBytes > MAX_WORKSPACE_ARCHIVE_BYTES) throw new Error('Expanded ZIP contents exceed 64 MB. Import a smaller project.');
    acceptedFiles++;
    return true;
  } });
  const roots = new Set(names.map(name => name.split('/')[0]));
  const strip = roots.size === 1 && names.every(name => name.includes('/')) ? `${[...roots][0]}/` : '';
  const files = Object.entries(unpacked).map(([name, bytes]) => {
    const path = strip ? name.slice(strip.length) : name;
    let content: string | Uint8Array = bytes;
    if (!bytes.subarray(0, 8192).includes(0)) {
      try { content = new TextDecoder('utf-8', { fatal: true }).decode(bytes); }
      catch { /* Binary bytes must survive an import unchanged. */ }
    }
    return { path, content };
  });
  return { files, skipped: skipped.map(file => ({ ...file, path: strip ? file.path.slice(strip.length) : file.path })) };
}

