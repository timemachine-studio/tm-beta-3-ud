/**
 * What the history page knows about a chat beyond the chat itself: the
 * subject it was named for, the picture found for that subject, and whether
 * it is pinned.
 *
 * Kept on the device, in IndexedDB, keyed by chat id — never in Supabase.
 * `chat_sessions` is on its way out (CLAUDE.md, Storage direction), so a
 * new column there would be a migration for a table that is being removed;
 * and a card's decoration is exactly the kind of thing that should follow
 * the chat to the device store when LS.2 lands. Until then a signed-in
 * person sees their covers and pins on the device that made them, which is
 * the trade the product already makes for files.
 *
 * This is decoration, not conversation: a store that cannot be opened is
 * logged and the page shows text cards. Nothing here is the only copy of
 * anything a person wrote.
 */

const DB_NAME = 'tm-chat-cards';
const DB_VERSION = 1;
const STORE = 'cards';

export interface ChatCover {
  /** The thumbnail, sized for a card (up to 800px wide). */
  url: string;
  width: number;
  height: number;
  /** The Wikipedia article the picture leads, for the credit line. */
  pageTitle: string;
  pageUrl: string;
}

export interface ChatCardMeta {
  chatId: string;
  /** What the namer thought the chat was about; null when it was a task. */
  subject: string | null;
  /** The picture, or null when none was found — `coverLookedUp` tells which. */
  cover: ChatCover | null;
  /** Whether the picture has been searched for, so a miss is not retried on every visit. */
  coverLookedUp: boolean;
  /** Reconsider misses made before the broader automatic-cover rules. */
  coverVersion?: number;
  /** When the namer gave the chat its title; null while it still wears its opening words. */
  namedAt: string | null;
  pinned: boolean;
  updatedAt: string;
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
      reject(new Error('This browser has no IndexedDB.'));
      return;
    }
    const opening = indexedDB.open(DB_NAME, DB_VERSION);
    opening.onupgradeneeded = () => {
      const db = opening.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'chatId' });
    };
    opening.onsuccess = () => resolve(opening.result);
    opening.onerror = () => reject(opening.error ?? new Error('IndexedDB open failed'));
  }).catch((error: unknown) => {
    // A failed open is not cached: the usual causes clear on their own.
    open = null;
    throw error;
  });
  return open;
}

const EMPTY = (chatId: string): ChatCardMeta => ({
  chatId, subject: null, cover: null, coverLookedUp: false, namedAt: null, pinned: false, updatedAt: '',
});

export async function readCard(chatId: string): Promise<ChatCardMeta | null> {
  try {
    const db = await openDatabase();
    const record = await request(db.transaction(STORE, 'readonly').objectStore(STORE).get(chatId) as IDBRequest<ChatCardMeta | undefined>);
    return record ?? null;
  } catch (error) {
    console.error('[ChatCards] read failed:', error instanceof Error ? error.message : error);
    return null;
  }
}

export async function listCards(): Promise<Map<string, ChatCardMeta>> {
  try {
    const db = await openDatabase();
    const records = await request(db.transaction(STORE, 'readonly').objectStore(STORE).getAll() as IDBRequest<ChatCardMeta[]>);
    return new Map(records.map(record => [record.chatId, record]));
  } catch (error) {
    console.error('[ChatCards] list failed:', error instanceof Error ? error.message : error);
    return new Map();
  }
}

/** Merge a change into a card, creating it if the chat has none yet. */
export async function writeCard(chatId: string, patch: Partial<Omit<ChatCardMeta, 'chatId' | 'updatedAt'>>): Promise<ChatCardMeta | null> {
  try {
    const db = await openDatabase();
    const transaction = db.transaction(STORE, 'readwrite');
    const store = transaction.objectStore(STORE);
    const current = (await request(store.get(chatId) as IDBRequest<ChatCardMeta | undefined>)) ?? EMPTY(chatId);
    const next: ChatCardMeta = { ...current, ...patch, chatId, updatedAt: new Date().toISOString() };
    await request(store.put(next));
    return next;
  } catch (error) {
    console.error('[ChatCards] write failed:', error instanceof Error ? error.message : error);
    return null;
  }
}

export async function deleteCard(chatId: string): Promise<void> {
  try {
    const db = await openDatabase();
    await request(db.transaction(STORE, 'readwrite').objectStore(STORE).delete(chatId));
  } catch (error) {
    console.error('[ChatCards] delete failed:', error instanceof Error ? error.message : error);
  }
}
