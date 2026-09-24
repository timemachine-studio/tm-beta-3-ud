/** Durable, device-local timers.
 *
 * A timer is an absolute deadline, never a decrementing counter. IndexedDB
 * preserves it across refreshes; while TM is open we arm a timeout and emit a
 * local event. Browser notifications are used only when permission was already
 * granted — starting a timer never surprises the user with a permission prompt.
 */

const DB_NAME = 'tm-agent-runtime';
const DB_VERSION = 1;
const STORE = 'timers';
const CHANGE_EVENT = 'tm:timer-changed';

export type TimerStatus = 'running' | 'paused' | 'cancelled' | 'completed';

export interface TimerRecord {
  id: string;
  label: string;
  durationMs: number;
  remainingMs: number;
  status: TimerStatus;
  startedAt: string;
  deadlineAt: string | null;
  updatedAt: string;
  completedAt?: string;
}

function request<T>(source: IDBRequest<T>): Promise<T> {
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
function openDatabase(): Promise<IDBDatabase> {
  if (opening) return opening;
  opening = new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('This browser has no IndexedDB.'));
      return;
    }
    const source = indexedDB.open(DB_NAME, DB_VERSION);
    source.onupgradeneeded = () => {
      if (!source.result.objectStoreNames.contains(STORE)) {
        const store = source.result.createObjectStore(STORE, { keyPath: 'id' });
        store.createIndex('updatedAt', 'updatedAt');
      }
    };
    source.onsuccess = () => resolve(source.result);
    source.onerror = () => reject(source.error ?? new Error('IndexedDB open failed'));
  }).catch((error: unknown) => {
    opening = null;
    throw error;
  });
  return opening;
}

function newId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `timer-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function normalize(record: TimerRecord, now = Date.now()): TimerRecord {
  if (record.status !== 'running' || !record.deadlineAt) return record;
  const deadline = Date.parse(record.deadlineAt);
  if (!Number.isFinite(deadline) || deadline > now) return record;
  const iso = new Date(now).toISOString();
  return { ...record, status: 'completed', remainingMs: 0, deadlineAt: null, updatedAt: iso, completedAt: iso };
}

async function put(record: TimerRecord): Promise<TimerRecord> {
  const db = await openDatabase();
  const transaction = db.transaction(STORE, 'readwrite');
  transaction.objectStore(STORE).put(record);
  await transactionDone(transaction);
  emit(record);
  arm(record);
  return record;
}

export async function readTimer(id: string): Promise<TimerRecord | null> {
  const db = await openDatabase();
  const found = await request(db.transaction(STORE, 'readonly').objectStore(STORE).get(id) as IDBRequest<TimerRecord | undefined>);
  if (!found) return null;
  const current = normalize(found);
  return current === found ? found : put(current);
}

export async function listTimers(): Promise<TimerRecord[]> {
  const db = await openDatabase();
  const records = await request(db.transaction(STORE, 'readonly').objectStore(STORE).getAll() as IDBRequest<TimerRecord[]>);
  const normalized = await Promise.all(records.map(async record => {
    const current = normalize(record);
    return current === record ? record : put(current);
  }));
  return normalized.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function startTimer(durationMs: number, label = 'Timer'): Promise<TimerRecord> {
  if (!Number.isFinite(durationMs) || durationMs <= 0) throw new Error('Timer duration must be greater than zero.');
  const now = Date.now();
  const iso = new Date(now).toISOString();
  return put({
    id: newId(),
    label: label.trim().slice(0, 80) || 'Timer',
    durationMs: Math.round(durationMs),
    remainingMs: Math.round(durationMs),
    status: 'running',
    startedAt: iso,
    deadlineAt: new Date(now + durationMs).toISOString(),
    updatedAt: iso,
  });
}

export async function controlTimer(id: string | undefined, action: 'pause' | 'resume' | 'cancel'): Promise<TimerRecord | null> {
  const target = id ? await readTimer(id) : (await listTimers()).find(timer => timer.status === 'running' || timer.status === 'paused') ?? null;
  if (!target) return null;
  const now = Date.now();
  const iso = new Date(now).toISOString();
  let next: TimerRecord;

  if (action === 'pause') {
    if (target.status !== 'running' || !target.deadlineAt) return target;
    next = { ...target, status: 'paused', remainingMs: Math.max(0, Date.parse(target.deadlineAt) - now), deadlineAt: null, updatedAt: iso };
  } else if (action === 'resume') {
    if (target.status !== 'paused') return target;
    next = { ...target, status: 'running', deadlineAt: new Date(now + target.remainingMs).toISOString(), updatedAt: iso };
  } else {
    next = { ...target, status: 'cancelled', deadlineAt: null, updatedAt: iso };
  }
  return put(next);
}

const armed = new Map<string, ReturnType<typeof setTimeout>>();

function emit(record: TimerRecord): void {
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent<TimerRecord>(CHANGE_EVENT, { detail: record }));
}

function notify(record: TimerRecord): void {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
  try { new Notification('TimeMachine Timer', { body: `${record.label} is complete.` }); } catch { /* in-app card still updates */ }
}

function arm(record: TimerRecord): void {
  const existing = armed.get(record.id);
  if (existing) clearTimeout(existing);
  armed.delete(record.id);
  if (record.status !== 'running' || !record.deadlineAt) return;
  const delay = Math.max(0, Date.parse(record.deadlineAt) - Date.now());
  // setTimeout is not reliable beyond 2^31-1 ms. Re-arm long timers later.
  const timeout = setTimeout(() => {
    armed.delete(record.id);
    void readTimer(record.id).then(current => {
      if (!current) return;
      emit(current);
      if (current.status === 'completed') notify(current);
      else arm(current);
    });
  }, Math.min(delay + 25, 2_147_000_000));
  armed.set(record.id, timeout);
}

export function subscribeTimerChanges(listener: (record: TimerRecord) => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const handle = (event: Event) => listener((event as CustomEvent<TimerRecord>).detail);
  window.addEventListener(CHANGE_EVENT, handle);
  return () => window.removeEventListener(CHANGE_EVENT, handle);
}

/** Test-only reset of module handles; deleting records remains the test's job. */
export function resetTimerRepositoryForTests(): void {
  for (const timeout of armed.values()) clearTimeout(timeout);
  armed.clear();
  opening = null;
}

export async function clearTimersForTests(): Promise<void> {
  const db = await openDatabase();
  const transaction = db.transaction(STORE, 'readwrite');
  transaction.objectStore(STORE).clear();
  await transactionDone(transaction);
  for (const timeout of armed.values()) clearTimeout(timeout);
  armed.clear();
}
