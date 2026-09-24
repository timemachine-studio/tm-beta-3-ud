import { supabase } from '../../lib/supabase';
import type { SessionTool, ToolSpec } from '../../../shared/toolRegistry';
import { generatedToolPublicationIssue, parseToolSpec } from '../../../shared/toolRegistrySchema';
import type { PublishResult } from './publishResult';
import { publishTool } from './toolRegistryService';

const DB_NAME = 'tm-tool-publication';
const STORE = 'outbox';
const MAX_ATTEMPTS_PER_DRAIN = 3;
const RETRY_DELAYS_MS = [30_000, 120_000, 600_000, 3_600_000] as const;
const draining = new Set<string>();

interface OutboxEntry {
  key: string;
  ownerId: string;
  digest: string;
  spec?: ToolSpec;
  status: 'pending' | 'published' | 'stopped';
  attempts: number;
  nextAttemptAt: number;
  registryId?: string;
  version?: number;
  lastReason?: string;
}

export interface PublicationReceipt { id: string; version: number }

let opening: Promise<IDBDatabase> | null = null;
function database(): Promise<IDBDatabase> {
  if (opening) return opening;
  opening = new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof indexedDB === 'undefined') return reject(new Error('IndexedDB unavailable'));
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) {
        const store = request.result.createObjectStore(STORE, { keyPath: 'key' });
        store.createIndex('owner', 'ownerId', { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Publication outbox unavailable'));
  }).catch((error: unknown) => {
    opening = null;
    throw error;
  });
  return opening;
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Publication outbox request failed'));
  });
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error('Publication outbox transaction failed'));
    transaction.onabort = () => reject(transaction.error ?? new Error('Publication outbox transaction aborted'));
  });
}

const keyFor = (ownerId: string, digest: string): string => `${ownerId}:${digest}`;

async function getEntry(ownerId: string, digest: string): Promise<OutboxEntry | null> {
  const db = await database();
  return await requestResult(db.transaction(STORE, 'readonly').objectStore(STORE).get(keyFor(ownerId, digest))) as OutboxEntry | null;
}

async function putEntry(entry: OutboxEntry): Promise<void> {
  const transaction = (await database()).transaction(STORE, 'readwrite');
  transaction.objectStore(STORE).put(entry);
  await transactionDone(transaction);
}

async function accountId(): Promise<string | null> {
  try {
    const { data } = await supabase.auth.getSession();
    return data.session?.user.id ?? null;
  } catch { return null; }
}

export function publicationIsRetryable(result: PublishResult): boolean {
  return !result.published && (result.reason === 'unavailable' || result.reason === 'rate_limited');
}

/** Keep generic source on this device until its central save is confirmed. */
export async function queueToolPublication(spec: ToolSpec, digest: string): Promise<boolean> {
  const parsed = parseToolSpec(spec);
  if (!parsed.ok || generatedToolPublicationIssue(parsed.spec)) return false;
  const ownerId = await accountId();
  if (!ownerId) return false;
  try {
    const existing = await getEntry(ownerId, digest);
    if (existing?.status === 'published') return true;
    await putEntry({
      key: keyFor(ownerId, digest), ownerId, digest, spec: parsed.spec,
      status: 'pending', attempts: existing?.attempts ?? 0,
      nextAttemptAt: Date.now() + RETRY_DELAYS_MS[0],
    });
    return true;
  } catch (error) {
    console.error('[Tool publication] Could not persist retry:', error instanceof Error ? error.message : error);
    return false;
  }
}

export async function recordPublishedTool(digest: string, receipt: PublicationReceipt): Promise<void> {
  const ownerId = await accountId();
  if (!ownerId) return;
  try {
    await putEntry({
      key: keyFor(ownerId, digest), ownerId, digest,
      status: 'published', attempts: 0, nextAttemptAt: 0,
      registryId: receipt.id, version: receipt.version,
    });
  } catch (error) {
    console.error('[Tool publication] Could not save receipt:', error instanceof Error ? error.message : error);
  }
}

export async function publicationReceipt(digest: string): Promise<PublicationReceipt | null> {
  const ownerId = await accountId();
  if (!ownerId) return null;
  try {
    const entry = await getEntry(ownerId, digest);
    return entry?.status === 'published' && entry.registryId && entry.version
      ? { id: entry.registryId, version: entry.version }
      : null;
  } catch {
    return null;
  }
}

export async function publicationQueueStatus(digest: string): Promise<'pending' | 'stopped' | null> {
  const ownerId = await accountId();
  if (!ownerId) return null;
  try {
    const entry = await getEntry(ownerId, digest);
    return entry?.status === 'pending' || entry?.status === 'stopped' ? entry.status : null;
  } catch { return null; }
}

export async function reconcileToolPublication(tool: SessionTool): Promise<SessionTool> {
  if (tool.published) return tool;
  const receipt = await publicationReceipt(tool.digest);
  return receipt ? { ...tool, published: true, registryId: receipt.id, version: receipt.version } : tool;
}

/** Retry only this account's due rows. Digest uniqueness makes uncertain retries safe. */
export async function retryQueuedToolPublications(
  ownerId: string,
  publish: (spec: ToolSpec, digest: string) => Promise<PublishResult> = (spec, digest) => publishTool(spec, digest, undefined, ownerId),
  now = Date.now(),
): Promise<number> {
  if (draining.has(ownerId) || await accountId() !== ownerId) return 0;
  draining.add(ownerId);
  try {
  let entries: OutboxEntry[];
  try {
    const db = await database();
    entries = await requestResult(db.transaction(STORE, 'readonly').objectStore(STORE).index('owner').getAll(ownerId)) as OutboxEntry[];
  } catch {
    return 0;
  }
  let published = 0;
  for (const entry of entries.filter(item => item.status === 'pending' && item.spec && item.nextAttemptAt <= now).slice(0, MAX_ATTEMPTS_PER_DRAIN)) {
    if (await accountId() !== ownerId) break;
    let result: PublishResult;
    try { result = await publish(entry.spec!, entry.digest); }
    catch { result = { published: false, reason: 'unavailable' }; }
    if (result.published) {
      await putEntry({ ...entry, spec: undefined, status: 'published', registryId: result.id, version: result.version, nextAttemptAt: 0 });
      published++;
      if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('tm:tool-published', {
        detail: { digest: entry.digest, id: result.id, version: result.version },
      }));
    } else if (publicationIsRetryable(result)) {
      const attempts = entry.attempts + 1;
      await putEntry({ ...entry, attempts, nextAttemptAt: now + RETRY_DELAYS_MS[Math.min(attempts, RETRY_DELAYS_MS.length - 1)], lastReason: result.reason });
    } else {
      await putEntry({ ...entry, status: 'stopped', lastReason: result.reason });
      if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('tm:tool-publication-stopped', {
        detail: { digest: entry.digest },
      }));
    }
  }
  return published;
  } finally {
    draining.delete(ownerId);
  }
}

export function resetToolPublicationQueueForTests(): void { opening = null; }

export async function clearToolPublicationQueueForTests(): Promise<void> {
  const transaction = (await database()).transaction(STORE, 'readwrite');
  transaction.objectStore(STORE).clear();
  await transactionDone(transaction);
}
