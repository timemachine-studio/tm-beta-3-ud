/**
 * The Max Mode workspace: a project's files, on the device, one per chat.
 *
 * A chat in Max Mode owns a workspace — the files the harness reads and
 * writes, the tree the user sees in the panel, the checkout a GitHub repo is
 * cloned into. It lives in IndexedDB rather than `localStorage` for the same
 * reasons the file store does (see fileStore.ts): a project is easily larger
 * than five megabytes, and a silent write failure here is a lost edit with no
 * cloud copy behind it. Every failure throws.
 *
 * Keyed by chat session id, so reopening a chat reopens its project and a new
 * chat starts empty. There is no cross-chat workspace: the model is told the
 * tree in the prompt, and one tree per conversation is the contract.
 *
 * Text is stored as strings, binary as bytes, and the two never mix: a PNG
 * cloned from a repo keeps its bytes for the push back, but the harness's
 * tools only ever read and edit text.
 */

import { zipSync, strToU8 } from 'fflate';
import type { ToolTranscriptMessage } from '../../../shared/deviceTools';
import {
  MAX_WORKSPACE_FILES,
  MAX_WORKSPACE_FILE_BYTES,
  MAX_SUMMARY_PATHS,
  isIgnoredWorkspacePath,
  normalizeWorkspacePath,
  type MaxModeKind,
  type MaxModeWorkspaceSummary,
  type MaxModeRuntime,
  type WorkspaceRepoRef,
} from '../../../shared/maxMode';

const DB_NAME = 'tm-workspaces';
const DB_VERSION = 1;
const FILES = 'files';
const META = 'meta';

export class WorkspaceStorageError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'WorkspaceStorageError';
  }
}

interface FileRecord {
  /** `${sessionId}\u0000${path}` — one key space, indexed by session. */
  key: string;
  sessionId: string;
  path: string;
  text: string | null;
  bytes: Uint8Array | null;
  size: number;
  updatedAt: string;
}

export interface WorkspaceEntry {
  path: string;
  size: number;
  binary: boolean;
  updatedAt: string;
}

export interface WorkspaceFile extends WorkspaceEntry {
  text: string | null;
  bytes: Uint8Array | null;
}

/** A preview, as remembered: a workspace HTML file, or the command that served it. */
export type WorkspacePreviewRef =
  | { kind: 'html'; path: string }
  | { kind: 'url'; command: string };

export interface WorkspaceMeta {
  sessionId: string;
  /** The harness mode the chat was left in. Null when Max Mode is off. */
  mode: MaxModeKind | null;
  activeHarnessTurnId?: string;
  repo?: WorkspaceRepoRef & {
    /** Paths and blob shas as cloned, so a push can tell what changed. */
    baseShas: Record<string, string>;
    /** The commit the clone was taken at. */
    baseCommit: string;
    /** Once pushed: the branch and PR later pushes keep adding to. */
    pullRequest?: { branch: string; number: number; url: string };
  };
  /** What the preview pane last showed, so reopening the chat shows it again. */
  previewTarget?: WorkspacePreviewRef;
  /**
   * Durable checkpoint for the current/interrupted turn. Kept here rather than
   * on the message because it is a replay transcript — large, and only
   * meaningful to this workspace — and because a message is saved to
   * whichever store the chat uses while the workspace is always on the
   * device. Matched by a stable turn key (the user message timestamp) and
   * prompt, since database message ids can change on reload.
   * Cleared when a turn completes or a new one starts.
   */
  resume?: { userContent: string; turnId?: string; mode?: MaxModeKind; toolTranscript: ToolTranscriptMessage[]; deviceRounds: number; content: string };
  createdAt: string;
  updatedAt: string;
}

function request<T>(source: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    source.onsuccess = () => resolve(source.result);
    source.onerror = () => reject(source.error ?? new Error('IndexedDB request failed'));
  });
}

function done(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('IndexedDB transaction failed'));
    tx.onabort = () => reject(tx.error ?? new Error('IndexedDB transaction aborted'));
  });
}

let open: Promise<IDBDatabase> | null = null;

function openDatabase(): Promise<IDBDatabase> {
  if (open) return open;
  open = new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new WorkspaceStorageError('This browser has no workspace storage available.'));
      return;
    }
    const opening = indexedDB.open(DB_NAME, DB_VERSION);
    opening.onupgradeneeded = () => {
      const db = opening.result;
      if (!db.objectStoreNames.contains(FILES)) {
        const store = db.createObjectStore(FILES, { keyPath: 'key' });
        store.createIndex('sessionId', 'sessionId');
      }
      if (!db.objectStoreNames.contains(META)) {
        db.createObjectStore(META, { keyPath: 'sessionId' });
      }
    };
    opening.onsuccess = () => resolve(opening.result);
    opening.onerror = () => reject(new WorkspaceStorageError(
      'Workspace storage could not be opened. Private browsing or blocked site data will do this.',
      { cause: opening.error },
    ));
  }).catch((error: unknown) => {
    open = null;
    throw error;
  });
  return open;
}

function fileKey(sessionId: string, path: string): string {
  return `${sessionId}\u0000${path}`;
}

// ─── Change notification ────────────────────────────────────────────────────
//
// The panel re-renders its tree from this rather than polling; the harness
// writes through the same functions the user's editor does, so both reach it.

type Listener = (sessionId: string, path: string | null) => void;
const listeners = new Set<Listener>();

export function subscribeWorkspace(listener: Listener): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

function notify(sessionId: string, path: string | null): void {
  for (const listener of listeners) {
    try { listener(sessionId, path); } catch (error) { console.error('Workspace listener failed:', error); }
  }
}

// ─── Files ──────────────────────────────────────────────────────────────────

function requirePath(raw: string): string {
  const path = normalizeWorkspacePath(raw);
  if (!path) throw new WorkspaceStorageError(`"${raw}" is not a valid workspace path.`);
  return path;
}

function toEntry(record: FileRecord): WorkspaceEntry {
  return { path: record.path, size: record.size, binary: record.bytes !== null, updatedAt: record.updatedAt };
}

/** Every file in the workspace, sorted by path. */
export async function listWorkspace(sessionId: string): Promise<WorkspaceEntry[]> {
  const db = await openDatabase();
  const tx = db.transaction(FILES, 'readonly');
  const records = await request(tx.objectStore(FILES).index('sessionId').getAll(sessionId)) as FileRecord[];
  return records.map(toEntry).sort((a, b) => a.path.localeCompare(b.path));
}

export async function readWorkspaceFile(sessionId: string, rawPath: string): Promise<WorkspaceFile | null> {
  const path = requirePath(rawPath);
  const db = await openDatabase();
  const tx = db.transaction(FILES, 'readonly');
  const record = await request(tx.objectStore(FILES).get(fileKey(sessionId, path))) as FileRecord | undefined;
  return record ? { ...toEntry(record), text: record.text, bytes: record.bytes } : null;
}

/**
 * Create or replace a file.
 *
 * A directory is implied by the paths under it — there is no record for one —
 * so writing `a/b/c.ts` is all it takes to make `a/b` exist. Writing a path
 * that is a prefix of an existing file ("src" while "src/x.ts" exists) is
 * refused, because a tree cannot show a file and a folder with one name.
 */
export async function writeWorkspaceFile(
  sessionId: string,
  rawPath: string,
  content: string | Uint8Array,
): Promise<WorkspaceEntry> {
  const path = requirePath(rawPath);
  const size = typeof content === 'string' ? new TextEncoder().encode(content).byteLength : content.byteLength;
  if (size > MAX_WORKSPACE_FILE_BYTES) {
    throw new WorkspaceStorageError(`${path} is ${Math.round(size / 1024)} KB; the workspace holds files up to ${MAX_WORKSPACE_FILE_BYTES / 1024} KB.`);
  }

  const db = await openDatabase();
  const tx = db.transaction(FILES, 'readwrite');
  const store = tx.objectStore(FILES);
  const existing = await request(store.get(fileKey(sessionId, path))) as FileRecord | undefined;
  if (!existing) {
    const all = await request(store.index('sessionId').getAllKeys(sessionId));
    if (all.length >= MAX_WORKSPACE_FILES) {
      throw new WorkspaceStorageError(`The workspace already holds ${MAX_WORKSPACE_FILES} files.`);
    }
    const prefix = `${path}/`;
    const clash = (all as string[]).some(key => {
      const other = key.slice(sessionId.length + 1);
      return other.startsWith(prefix) || path.startsWith(`${other}/`);
    });
    if (clash) throw new WorkspaceStorageError(`${path} clashes with an existing directory or file of the same name.`);
  }

  const record: FileRecord = {
    key: fileKey(sessionId, path),
    sessionId,
    path,
    text: typeof content === 'string' ? content : null,
    bytes: typeof content === 'string' ? null : content,
    size,
    updatedAt: new Date().toISOString(),
  };
  store.put(record);
  await done(tx);
  notify(sessionId, path);
  return toEntry(record);
}

/** Delete one file, or — for a path ending in "/" or naming a directory — everything under it. Returns the paths removed. */
export async function deleteWorkspacePath(sessionId: string, rawPath: string): Promise<string[]> {
  const asDirectory = rawPath.endsWith('/');
  const path = requirePath(rawPath);
  const db = await openDatabase();
  const tx = db.transaction(FILES, 'readwrite');
  const store = tx.objectStore(FILES);
  const removed: string[] = [];

  const direct = await request(store.get(fileKey(sessionId, path))) as FileRecord | undefined;
  if (direct && !asDirectory) {
    store.delete(direct.key);
    removed.push(direct.path);
  } else {
    const prefix = `${path}/`;
    const records = await request(store.index('sessionId').getAll(sessionId)) as FileRecord[];
    for (const record of records) {
      if (record.path.startsWith(prefix)) {
        store.delete(record.key);
        removed.push(record.path);
      }
    }
  }
  await done(tx);
  if (removed.length > 0) notify(sessionId, null);
  return removed;
}

/** Remove every file and the metadata. Used when the user resets the workspace. */
export async function clearWorkspace(sessionId: string): Promise<void> {
  const db = await openDatabase();
  const tx = db.transaction([FILES, META], 'readwrite');
  const store = tx.objectStore(FILES);
  const keys = await request(store.index('sessionId').getAllKeys(sessionId));
  for (const key of keys) store.delete(key);
  tx.objectStore(META).delete(sessionId);
  await done(tx);
  notify(sessionId, null);
}

/** A clone replaces the live workspace only after its entire stream succeeds. */
export async function promoteWorkspaceClone(stagingId: string, sessionId: string, repo: NonNullable<WorkspaceMeta['repo']>): Promise<void> {
  const db = await openDatabase();
  const tx = db.transaction([FILES, META], 'readwrite');
  const store = tx.objectStore(FILES);
  const staged = await request(store.index('sessionId').getAll(stagingId)) as FileRecord[];
  const oldKeys = await request(store.index('sessionId').getAllKeys(sessionId));
  const metadata = tx.objectStore(META);
  const previous = await request(metadata.get(sessionId)) as WorkspaceMeta | undefined;
  for (const key of oldKeys) store.delete(key);
  for (const file of staged) {
    store.put({ ...file, key: fileKey(sessionId, file.path), sessionId });
    store.delete(file.key);
  }
  const now = new Date().toISOString();
  metadata.put({ sessionId, mode: previous?.mode ?? null, repo, createdAt: previous?.createdAt ?? now, updatedAt: now } satisfies WorkspaceMeta);
  metadata.delete(stagingId);
  await done(tx);
  notify(sessionId, null);
}

/**
 * Write many files in one transaction — a clone, an import, a sync back from
 * the Node runtime. Oversized and ignored paths are skipped and reported,
 * never silently dropped.
 */
export async function writeWorkspaceFiles(
  sessionId: string,
  files: ReadonlyArray<{ path: string; content: string | Uint8Array }>,
): Promise<{ written: string[]; skipped: Array<{ path: string; reason: string }> }> {
  const written: string[] = [];
  const skipped: Array<{ path: string; reason: string }> = [];
  const db = await openDatabase();
  const tx = db.transaction(FILES, 'readwrite');
  const store = tx.objectStore(FILES);
  const existing = new Set((await request(store.index('sessionId').getAllKeys(sessionId)) as string[]));
  const now = new Date().toISOString();

  for (const file of files) {
    const path = normalizeWorkspacePath(file.path);
    if (!path) { skipped.push({ path: file.path, reason: 'invalid path' }); continue; }
    if (isIgnoredWorkspacePath(path)) { skipped.push({ path, reason: 'ignored directory' }); continue; }
    const size = typeof file.content === 'string' ? new TextEncoder().encode(file.content).byteLength : file.content.byteLength;
    if (size > MAX_WORKSPACE_FILE_BYTES) { skipped.push({ path, reason: 'too large' }); continue; }
    const key = fileKey(sessionId, path);
    if (!existing.has(key) && existing.size >= MAX_WORKSPACE_FILES) {
      skipped.push({ path, reason: 'workspace full' });
      continue;
    }
    const clash = [...existing].some(otherKey => {
      const other = otherKey.slice(sessionId.length + 1);
      return other.startsWith(`${path}/`) || path.startsWith(`${other}/`);
    });
    if (clash) { skipped.push({ path, reason: 'file/directory conflict' }); continue; }
    existing.add(key);
    store.put({
      key, sessionId, path,
      text: typeof file.content === 'string' ? file.content : null,
      bytes: typeof file.content === 'string' ? null : file.content,
      size, updatedAt: now,
    } satisfies FileRecord);
    written.push(path);
  }
  await done(tx);
  if (written.length > 0) notify(sessionId, null);
  return { written, skipped };
}

/** Compare contents, not timestamps: two writes can land in the same millisecond. */
export function sameWorkspaceContent(a: WorkspaceFile | null, b: WorkspaceFile | null): boolean {
  if (!a || !b) return a === b;
  if (a.text !== b.text) return false;
  if (!a.bytes || !b.bytes) return a.bytes === b.bytes;
  return a.bytes.length === b.bytes.length && a.bytes.every((byte, i) => byte === b.bytes![i]);
}

/** Apply a runtime diff atomically, preserving edits made in the UI during a command. */
export async function reconcileWorkspaceRuntime(
  sessionId: string,
  baseline: ReadonlyMap<string, WorkspaceFile>,
  files: ReadonlyArray<{ path: string; content: string | Uint8Array }>,
  present: ReadonlySet<string>,
): Promise<{ changed: string[]; conflicts: string[]; skipped: string[] }> {
  const db = await openDatabase();
  const tx = db.transaction(FILES, 'readwrite');
  const store = tx.objectStore(FILES);
  const records = await request(store.index('sessionId').getAll(sessionId)) as FileRecord[];
  const current = new Map(records.map(record => [record.path, record]));
  const changed: string[] = [];
  const conflicts: string[] = [];
  const skipped: string[] = [];
  const asFile = (record: FileRecord | undefined): WorkspaceFile | null => record
    ? { ...toEntry(record), text: record.text, bytes: record.bytes } : null;
  // Deletions first allow a command to replace a directory with a file.
  for (const [path, before] of baseline) {
    if (present.has(path)) continue;
    if (!sameWorkspaceContent(before, asFile(current.get(path)))) { conflicts.push(path); continue; }
    store.delete(fileKey(sessionId, path));
    current.delete(path);
    changed.push(path);
  }
  for (const file of files) {
    const path = normalizeWorkspacePath(file.path);
    if (!path || isIgnoredWorkspacePath(path)) { skipped.push(file.path); continue; }
    const text = typeof file.content === 'string' ? file.content : null;
    const bytes = typeof file.content === 'string' ? null : file.content;
    const size = bytes?.byteLength ?? new TextEncoder().encode(text!).byteLength;
    const next: WorkspaceFile = { path, text, bytes, size, binary: bytes !== null, updatedAt: new Date().toISOString() };
    const before = baseline.get(path) ?? null;
    const now = asFile(current.get(path));
    if (sameWorkspaceContent(next, before) || sameWorkspaceContent(next, now)) continue;
    if (!sameWorkspaceContent(before, now)) { conflicts.push(path); continue; }
    if (size > MAX_WORKSPACE_FILE_BYTES || (!now && current.size >= MAX_WORKSPACE_FILES)
      || [...current.keys()].some(other => other.startsWith(`${path}/`) || path.startsWith(`${other}/`))) {
      skipped.push(path);
      continue;
    }
    const record: FileRecord = { key: fileKey(sessionId, path), sessionId, path, text, bytes, size, updatedAt: next.updatedAt };
    store.put(record);
    current.set(path, record);
    changed.push(path);
  }
  await done(tx);
  if (changed.length) notify(sessionId, null);
  return { changed, conflicts, skipped };
}

// ─── Metadata ───────────────────────────────────────────────────────────────

export async function getWorkspaceMeta(sessionId: string): Promise<WorkspaceMeta | null> {
  const db = await openDatabase();
  const tx = db.transaction(META, 'readonly');
  return (await request(tx.objectStore(META).get(sessionId)) as WorkspaceMeta | undefined) ?? null;
}

export async function updateWorkspaceMeta(
  sessionId: string,
  patch: Partial<Omit<WorkspaceMeta, 'sessionId' | 'createdAt' | 'updatedAt'>>,
  expectedHarnessTurnId?: string,
): Promise<WorkspaceMeta> {
  const db = await openDatabase();
  const tx = db.transaction(META, 'readwrite');
  const store = tx.objectStore(META);
  const now = new Date().toISOString();
  const current = (await request(store.get(sessionId)) as WorkspaceMeta | undefined)
    ?? { sessionId, mode: null, createdAt: now, updatedAt: now };
  if (expectedHarnessTurnId && current.activeHarnessTurnId !== expectedHarnessTurnId) return current;
  const next: WorkspaceMeta = { ...current, ...patch, sessionId, updatedAt: now };
  store.put(next);
  await done(tx);
  return next;
}

/** Whether this chat has a workspace at all — files or a remembered mode. */
export async function hasWorkspace(sessionId: string): Promise<boolean> {
  try {
    const meta = await getWorkspaceMeta(sessionId);
    if (meta?.mode) return true;
    const db = await openDatabase();
    const tx = db.transaction(FILES, 'readonly');
    const count = await request(tx.objectStore(FILES).index('sessionId').count(sessionId));
    return count > 0;
  } catch {
    return false;
  }
}

// ─── Summary for the prompt ─────────────────────────────────────────────────

/**
 * What the server is told: paths, whether there are more, the repo, and the
 * runtimes this browser can offer. Sizes are left out of the prompt — the
 * tree is for orientation, and list_files has the numbers.
 */
export async function summarizeWorkspace(
  sessionId: string,
  runtimes: MaxModeRuntime[],
): Promise<MaxModeWorkspaceSummary> {
  const [entries, meta] = await Promise.all([listWorkspace(sessionId), getWorkspaceMeta(sessionId)]);
  const paths = entries.map(entry => entry.path);
  return {
    paths: paths.slice(0, MAX_SUMMARY_PATHS),
    truncated: paths.length > MAX_SUMMARY_PATHS,
    ...(meta?.repo ? { repo: { owner: meta.repo.owner, name: meta.repo.name, branch: meta.repo.branch } } : {}),
    runtimes,
  };
}

// ─── Zip in and out ─────────────────────────────────────────────────────────

/** The whole workspace as a zip, for the user to take away. */
export async function exportWorkspaceZip(sessionId: string): Promise<Uint8Array> {
  const entries = await listWorkspace(sessionId);
  const files: Record<string, Uint8Array> = Object.create(null);
  for (const entry of entries) {
    const file = await readWorkspaceFile(sessionId, entry.path);
    if (!file) continue;
    files[entry.path] = file.bytes ?? strToU8(file.text ?? '');
  }
  return zipSync(files, { level: 6 });
}

/** Whether bytes look like text: no NUL in the first few KB and valid UTF-8. */
export function looksLikeText(bytes: Uint8Array): boolean {
  const head = bytes.subarray(0, 8192);
  for (let i = 0; i < head.length; i++) if (head[i] === 0) return false;
  try {
    new TextDecoder('utf-8', { fatal: true }).decode(head);
    return true;
  } catch {
    return false;
  }
}

/**
 * Unpack a zip into the workspace. A zip with a single top-level folder — the
 * way GitHub's "Download ZIP" and most exports are shaped — has that folder
 * stripped, so the project lands at the root where the model expects it.
 */
export async function importWorkspaceZip(sessionId: string, zip: Uint8Array): Promise<{ written: string[]; skipped: Array<{ path: string; reason: string }> }> {
  const { decodeWorkspaceArchiveInWorker } = await import('./workspaceArchiveRuntime');
  const decoded = await decodeWorkspaceArchiveInWorker(zip);
  const result = await writeWorkspaceFiles(sessionId, decoded.files);
  return { written: result.written, skipped: [...decoded.skipped, ...result.skipped] };
}
