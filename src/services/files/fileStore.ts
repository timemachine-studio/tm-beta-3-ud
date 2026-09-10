/**
 * Where a file lives once something in TimeMachine has made one.
 *
 * This is the substrate the document tools needed, and it exists because the
 * first version of generated files did the obvious wrong thing: base64 inside
 * the message, which meant the bytes went wherever the conversation went. That
 * is a `localStorage` blob that already stops saving silently at about five
 * megabytes (CLAUDE.md, LS.2) and, for signed-in users, a Supabase JSON column.
 * A single spreadsheet would have broken both.
 *
 * So bytes live here, in IndexedDB, and a message carries only an id. Three
 * things follow from that:
 *
 *  1. **Files are device-first, like the rest of the conversation.** Nothing is
 *     uploaded. Opening the same chat on another device shows the file's name
 *     and says the bytes are not here — which is the honest thing to show, and
 *     the same trade the product already makes for chat history.
 *  2. **A file can be big.** 25 MB each, 200 MB in total, evicting oldest
 *     first. None of that was possible while the bytes rode inside a message.
 *  3. **Failure is loud.** A store that cannot write throws, and the caller
 *     turns it into something the model tells the user about. There is no cloud
 *     copy to fall back on, so a swallowed write is a file that never existed.
 *
 * This is the first IndexedDB in the codebase. LS.2 moves chat history here
 * too; keep the open/upgrade path generic enough to grow another store.
 */

import { newId } from '../../utils/id';

const DB_NAME = 'tm-files';
const DB_VERSION = 1;
const STORE = 'files';

/** Bytes any one file may occupy. Beyond this the caller is told, not silently truncated. */
export const MAX_STORED_FILE_BYTES = 25_000_000;

/** Bytes the whole store may occupy before the oldest files are evicted. */
export const FILE_STORE_CAP_BYTES = 200_000_000;

export type FileSource = 'python' | 'upload';

export interface StoredFileMeta {
  id: string;
  name: string;
  mime: string;
  size: number;
  source: FileSource;
  createdAt: string;
}

interface StoredFile extends StoredFileMeta {
  blob: Blob;
}

/** A storage failure the user has to hear about, because nothing else holds this file. */
export class FileStoreError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'FileStoreError';
  }
}

function request<T>(source: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    source.onsuccess = () => resolve(source.result);
    source.onerror = () => reject(source.error ?? new Error('IndexedDB request failed'));
  });
}

let open: Promise<IDBDatabase> | null = null;

function openDatabase(): Promise<IDBDatabase> {
  if (open) return open;
  open = new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new FileStoreError('This browser has no file storage available.'));
      return;
    }
    const opening = indexedDB.open(DB_NAME, DB_VERSION);
    opening.onupgradeneeded = () => {
      const db = opening.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'id' });
        // Eviction reads the whole store in age order, so the index is what
        // keeps that from being a full scan once there are a few hundred files.
        store.createIndex('createdAt', 'createdAt');
      }
    };
    opening.onsuccess = () => resolve(opening.result);
    opening.onerror = () => reject(new FileStoreError(
      'File storage could not be opened. Private browsing or blocked site data will do this.',
      { cause: opening.error },
    ));
  }).catch((error: unknown) => {
    // A failed open must not be cached: the usual causes (a blocked prompt, a
    // transient quota error) can be gone by the next attempt.
    open = null;
    throw error;
  });
  return open;
}

/**
 * Which files to drop to make room for an incoming one.
 *
 * Pure, and separate from the store, because this is the only part with a
 * decision in it. Oldest first: a file the user generated ten conversations ago
 * is the one they are least likely to click.
 */
export function planEviction(
  existing: readonly StoredFileMeta[],
  incomingSize: number,
  cap: number = FILE_STORE_CAP_BYTES,
): string[] {
  let total = existing.reduce((sum, file) => sum + file.size, 0) + incomingSize;
  if (total <= cap) return [];

  const evicted: string[] = [];
  const oldestFirst = [...existing].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  for (const file of oldestFirst) {
    if (total <= cap) break;
    evicted.push(file.id);
    total -= file.size;
  }
  return evicted;
}

function toMeta(record: StoredFile): StoredFileMeta {
  const { blob: _blob, ...meta } = record;
  return meta;
}

export async function listFiles(): Promise<StoredFileMeta[]> {
  const db = await openDatabase();
  const transaction = db.transaction(STORE, 'readonly');
  const records = await request(transaction.objectStore(STORE).getAll() as IDBRequest<StoredFile[]>);
  return records.map(toMeta);
}

export async function deleteFile(id: string): Promise<void> {
  const db = await openDatabase();
  const transaction = db.transaction(STORE, 'readwrite');
  await request(transaction.objectStore(STORE).delete(id));
}

export interface PutFileInput {
  name: string;
  mime: string;
  bytes: Uint8Array | Blob;
  source: FileSource;
}

export async function putFile(input: PutFileInput): Promise<StoredFileMeta> {
  const blob = input.bytes instanceof Blob
    ? input.bytes
    : new Blob([input.bytes as unknown as BlobPart], { type: input.mime });

  if (blob.size > MAX_STORED_FILE_BYTES) {
    throw new FileStoreError(
      `${input.name} is ${Math.round(blob.size / 1_000_000)} MB, over the ${Math.round(MAX_STORED_FILE_BYTES / 1_000_000)} MB limit for a single file.`,
    );
  }

  const db = await openDatabase();

  for (const id of planEviction(await listFiles(), blob.size)) {
    await deleteFile(id);
  }

  const record: StoredFile = {
    id: newId(),
    name: input.name.slice(0, 200) || 'file',
    mime: input.mime,
    size: blob.size,
    source: input.source,
    createdAt: new Date().toISOString(),
    blob,
  };

  const transaction = db.transaction(STORE, 'readwrite');
  try {
    await request(transaction.objectStore(STORE).put(record));
  } catch (error: unknown) {
    throw new FileStoreError(`${record.name} could not be saved to this device.`, { cause: error });
  }
  return toMeta(record);
}

export async function readFile(id: string): Promise<Blob | null> {
  const db = await openDatabase();
  const transaction = db.transaction(STORE, 'readonly');
  const record = await request(transaction.objectStore(STORE).get(id) as IDBRequest<StoredFile | undefined>);
  return record?.blob ?? null;
}

export async function readFileMeta(id: string): Promise<StoredFileMeta | null> {
  const db = await openDatabase();
  const transaction = db.transaction(STORE, 'readonly');
  const record = await request(transaction.objectStore(STORE).get(id) as IDBRequest<StoredFile | undefined>);
  return record ? toMeta(record) : null;
}
