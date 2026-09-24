/**
 * Device-local run ledger for ordinary chat actions.
 *
 * The server may take several model/device legs, but the user made one
 * request. This ledger gives that request one stable identity and an ordered,
 * persisted account of what happened. It is intentionally content-free:
 * prompts, note bodies and tool arguments never enter operational telemetry.
 */

const DB_NAME = 'tm-agent-runs';
const DB_VERSION = 1;
const STORE = 'runs';
const MAX_RUNS = 100;

export type ClientRunStatus =
  | 'understanding'
  | 'discovering'
  | 'waiting_device'
  | 'executing'
  | 'verifying'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'interrupted';

export interface ClientRunEvent {
  sequence: number;
  at: string;
  status: ClientRunStatus;
  label: string;
  tool?: string;
}

export interface ClientRunRecord {
  id: string;
  sessionId: string;
  assistantMessageId: string;
  status: ClientRunStatus;
  sequence: number;
  createdAt: string;
  updatedAt: string;
  events: ClientRunEvent[];
}

function request<T>(source: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    source.onsuccess = () => resolve(source.result);
    source.onerror = () => reject(source.error ?? new Error('IndexedDB request failed'));
  });
}

function done(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error('IndexedDB transaction failed'));
    transaction.onabort = () => reject(transaction.error ?? new Error('IndexedDB transaction aborted'));
  });
}

let opening: Promise<IDBDatabase> | null = null;
function openDatabase(): Promise<IDBDatabase> {
  if (opening) return opening;
  opening = new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof indexedDB === 'undefined') { reject(new Error('This browser has no IndexedDB.')); return; }
    const source = indexedDB.open(DB_NAME, DB_VERSION);
    source.onupgradeneeded = () => {
      if (!source.result.objectStoreNames.contains(STORE)) {
        const store = source.result.createObjectStore(STORE, { keyPath: 'id' });
        store.createIndex('updatedAt', 'updatedAt');
      }
    };
    source.onsuccess = () => resolve(source.result);
    source.onerror = () => reject(source.error ?? new Error('IndexedDB open failed'));
  }).catch((error: unknown) => { opening = null; throw error; });
  return opening;
}

async function write(record: ClientRunRecord): Promise<void> {
  try {
    const db = await openDatabase();
    const transaction = db.transaction(STORE, 'readwrite');
    transaction.objectStore(STORE).put(record);
    await done(transaction);
  } catch (error) {
    // The run still executes when diagnostics cannot persist. Do not turn an
    // observability failure into a failed user action.
    console.error('[RunLedger] write failed:', error instanceof Error ? error.message : error);
  }
}

export async function readRun(id: string): Promise<ClientRunRecord | null> {
  try {
    const db = await openDatabase();
    return (await request(db.transaction(STORE, 'readonly').objectStore(STORE).get(id) as IDBRequest<ClientRunRecord | undefined>)) ?? null;
  } catch { return null; }
}

export async function beginRun(input: { id: string; sessionId: string; assistantMessageId: string }): Promise<ClientRunRecord> {
  const existing = await readRun(input.id);
  if (existing && !['completed', 'failed', 'cancelled'].includes(existing.status)) return existing;
  const now = new Date().toISOString();
  const record: ClientRunRecord = {
    ...input,
    status: 'understanding',
    sequence: 1,
    createdAt: now,
    updatedAt: now,
    events: [{ sequence: 1, at: now, status: 'understanding', label: 'Understanding your request' }],
  };
  await write(record);
  return record;
}

export async function recordRunEvent(id: string, status: ClientRunStatus, label: string, tool?: string): Promise<ClientRunRecord | null> {
  const current = await readRun(id);
  if (!current) return null;
  const now = new Date().toISOString();
  const sequence = current.sequence + 1;
  const record: ClientRunRecord = {
    ...current,
    status,
    sequence,
    updatedAt: now,
    events: [...current.events, { sequence, at: now, status, label: label.slice(0, 160), ...(tool ? { tool } : {}) }].slice(-80),
  };
  await write(record);
  return record;
}

export async function settleRun(id: string, status: Extract<ClientRunStatus, 'completed' | 'failed' | 'cancelled'>, label: string): Promise<void> {
  await recordRunEvent(id, status, label);
  void pruneRuns();
}

/** Mark abandoned work truthfully after a reload instead of leaving it running forever. */
export async function reconcileInterruptedRuns(): Promise<number> {
  try {
    const db = await openDatabase();
    const records = await request(db.transaction(STORE, 'readonly').objectStore(STORE).getAll() as IDBRequest<ClientRunRecord[]>);
    const active = records.filter(record => !['completed', 'failed', 'cancelled', 'interrupted'].includes(record.status));
    await Promise.all(active.map(record => recordRunEvent(record.id, 'interrupted', 'Interrupted when TimeMachine closed or refreshed')));
    return active.length;
  } catch { return 0; }
}

async function pruneRuns(): Promise<void> {
  try {
    const db = await openDatabase();
    const records = await request(db.transaction(STORE, 'readonly').objectStore(STORE).getAll() as IDBRequest<ClientRunRecord[]>);
    if (records.length <= MAX_RUNS) return;
    const remove = records.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(MAX_RUNS);
    const transaction = db.transaction(STORE, 'readwrite');
    for (const record of remove) transaction.objectStore(STORE).delete(record.id);
    await done(transaction);
  } catch { /* best-effort retention */ }
}

export function resetRunLedgerForTests(): void { opening = null; }

export async function clearRunLedgerForTests(): Promise<void> {
  const db = await openDatabase();
  const transaction = db.transaction(STORE, 'readwrite');
  transaction.objectStore(STORE).clear();
  await done(transaction);
}
