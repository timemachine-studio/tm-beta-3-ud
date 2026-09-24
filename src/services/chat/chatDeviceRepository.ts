import type { ChatSession } from './chatService';

const DB_NAME = 'tm-chat-history';
const DB_VERSION = 1;
const SESSIONS = 'sessions';
const META = 'meta';

interface StoredSession extends ChatSession {
  key: string;
  workspace: string;
}

interface MetaRecord {
  key: string;
  value: string;
  updatedAt: string;
}

function idbRequest<T>(source: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    source.onsuccess = () => resolve(source.result);
    source.onerror = () => reject(source.error ?? new Error('IndexedDB request failed'));
  });
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error('IndexedDB transaction failed'));
    transaction.onabort = () => reject(transaction.error ?? new Error('IndexedDB transaction aborted'));
  });
}

let opening: Promise<IDBDatabase> | null = null;

function database(): Promise<IDBDatabase> {
  if (opening) return opening;
  const pending = new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('indexeddb_unavailable'));
      return;
    }
    const source = indexedDB.open(DB_NAME, DB_VERSION);
    source.onupgradeneeded = () => {
      const db = source.result;
      if (!db.objectStoreNames.contains(SESSIONS)) {
        const sessions = db.createObjectStore(SESSIONS, { keyPath: 'key' });
        sessions.createIndex('workspace', 'workspace', { unique: false });
        sessions.createIndex('workspaceUpdated', ['workspace', 'lastModified'], { unique: false });
      }
      if (!db.objectStoreNames.contains(META)) db.createObjectStore(META, { keyPath: 'key' });
    };
    source.onsuccess = () => resolve(source.result);
    source.onerror = () => reject(source.error ?? new Error('IndexedDB open failed'));
  });
  opening = pending.catch((error: unknown) => {
    opening = null;
    throw error;
  });
  return opening;
}

export function chatWorkspace(userId: string | null): string {
  return userId ? `account:${userId}` : 'guest';
}

const sessionKey = (workspace: string, id: string) => `${workspace}:${id}`;

function publicSession(record: StoredSession): ChatSession {
  const { key: _key, workspace: _workspace, ...session } = record;
  void _key;
  void _workspace;
  return session;
}

export async function listDeviceSessions(workspace: string): Promise<ChatSession[]> {
  const db = await database();
  const rows = await idbRequest(
    db.transaction(SESSIONS, 'readonly').objectStore(SESSIONS).index('workspace').getAll(workspace),
  ) as StoredSession[];
  return rows.map(publicSession).sort((a, b) => b.lastModified.localeCompare(a.lastModified));
}

export async function readDeviceSession(workspace: string, id: string): Promise<ChatSession | null> {
  const db = await database();
  const row = await idbRequest(
    db.transaction(SESSIONS, 'readonly').objectStore(SESSIONS).get(sessionKey(workspace, id)),
  ) as StoredSession | undefined;
  return row ? publicSession(row) : null;
}

export async function writeDeviceSession(workspace: string, session: ChatSession): Promise<void> {
  const db = await database();
  const transaction = db.transaction(SESSIONS, 'readwrite');
  transaction.objectStore(SESSIONS).put({ ...session, key: sessionKey(workspace, session.id), workspace });
  await transactionDone(transaction);
}

export async function deleteDeviceSession(workspace: string, id: string): Promise<void> {
  const db = await database();
  const transaction = db.transaction(SESSIONS, 'readwrite');
  transaction.objectStore(SESSIONS).delete(sessionKey(workspace, id));
  await transactionDone(transaction);
}

export async function writeDeviceSessions(workspace: string, sessions: readonly ChatSession[]): Promise<void> {
  if (sessions.length === 0) return;
  const db = await database();
  const transaction = db.transaction(SESSIONS, 'readwrite');
  const store = transaction.objectStore(SESSIONS);
  for (const session of sessions) store.put({ ...session, key: sessionKey(workspace, session.id), workspace });
  await transactionDone(transaction);
}

export async function readHistoryMeta(key: string): Promise<string | null> {
  const db = await database();
  const row = await idbRequest(db.transaction(META, 'readonly').objectStore(META).get(key)) as MetaRecord | undefined;
  return row?.value ?? null;
}

export async function writeHistoryMeta(key: string, value: string): Promise<void> {
  const db = await database();
  const transaction = db.transaction(META, 'readwrite');
  transaction.objectStore(META).put({ key, value, updatedAt: new Date().toISOString() } satisfies MetaRecord);
  await transactionDone(transaction);
}

/** Test-only reset. Data remains unless the test deletes the database. */
export function resetChatDeviceRepositoryForTests(): void {
  opening = null;
}

/** Clear this repository without deleting unrelated IndexedDB databases. */
export async function clearChatDeviceRepositoryForTests(): Promise<void> {
  const db = await database();
  const transaction = db.transaction([SESSIONS, META], 'readwrite');
  transaction.objectStore(SESSIONS).clear();
  transaction.objectStore(META).clear();
  await transactionDone(transaction);
}
