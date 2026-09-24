import { getLocalSessions } from './chatService';
import { chatWorkspace, listDeviceSessions } from './chatDeviceRepository';
import type { ChatSession } from './chatService';

/**
 * Bounded reads over the user's own chat history.
 *
 * The history page can load every message of every session, which would be
 * ruinous as a model tool. Nothing here ever returns
 * the whole archive: list and search are capped and paged, and message text
 * only comes back for one chat at a time.
 *
 * History is read from the account-isolated IndexedDB workspace on this
 * device. localStorage remains only as a fallback for browsers without
 * IndexedDB and as the source of the one-time guest migration.
 */

export interface ChatSummary {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messageCount?: number;
}

export interface ChatSearchHit extends ChatSummary {
  /** The matching text, with a little either side. Absent for a title match. */
  excerpt?: string;
  matchedAt?: string;
}

export interface ChatTranscript {
  id: string;
  title: string;
  totalMessages: number;
  offset: number;
  messages: Array<{ role: 'user' | 'assistant'; content: string; createdAt?: string }>;
}

const MAX_LIMIT = 25;
const MAX_MESSAGES = 40;
const EXCERPT_RADIUS = 120;
/**
 * Per-message ceiling inside a transcript.
 *
 * A read result is replayed into every remaining leg of the turn, so its size
 * is multiplied by however many rounds follow it. Enough to see what was said
 * and quote it; not enough for one long answer to fill the window.
 */
const MAX_MESSAGE_CHARS = 1_200;

function clamp(value: number, max: number): number {
  if (!Number.isFinite(value) || value < 1) return Math.min(5, max);
  return Math.min(Math.floor(value), max);
}

function withinRange(timestamp: string, after?: string, before?: string): boolean {
  if (after && timestamp < after) return false;
  // `before` is exclusive, and a bare YYYY-MM-DD sorts before that day's
  // timestamps — so a caller asking for "before 2026-09-01" gets August.
  if (before && timestamp >= before) return false;
  return true;
}

function excerptAround(content: string, terms: string[]): string {
  const lower = content.toLowerCase();
  const at = terms.map(term => lower.indexOf(term)).filter(index => index >= 0).sort((a, b) => a - b)[0];
  if (at === undefined) return content.slice(0, EXCERPT_RADIUS * 2);
  const start = Math.max(0, at - EXCERPT_RADIUS);
  const end = Math.min(content.length, at + EXCERPT_RADIUS);
  return `${start > 0 ? '…' : ''}${content.slice(start, end)}${end < content.length ? '…' : ''}`;
}

function truncate(content: string): string {
  return content.length > MAX_MESSAGE_CHARS ? `${content.slice(0, MAX_MESSAGE_CHARS)}… [truncated]` : content;
}

// ─── Device history ─────────────────────────────────────────────────────────

function localSummaries(sessions: readonly ChatSession[]): ChatSummary[] {
  return sessions.map(session => ({
    id: session.id,
    title: session.name || 'Untitled chat',
    createdAt: session.createdAt,
    updatedAt: session.lastModified,
    messageCount: session.messages?.length ?? 0,
  }));
}

function searchLocal(sessions: readonly ChatSession[], terms: string[], limit: number, after?: string, before?: string, excludeChatId?: string): ChatSearchHit[] {
  const hits: ChatSearchHit[] = [];

  for (const session of sessions) {
    if (session.id === excludeChatId) continue;
    if (!withinRange(session.lastModified || session.createdAt, after, before)) continue;

    const summary: ChatSummary = {
      id: session.id,
      title: session.name || 'Untitled chat',
      createdAt: session.createdAt,
      updatedAt: session.lastModified,
      messageCount: session.messages?.length ?? 0,
    };

    if (terms.some(term => (session.name || '').toLowerCase().includes(term))) {
      hits.push(summary);
      continue;
    }

    const match = (session.messages || []).find(message =>
      terms.some(term => (message.content || '').toLowerCase().includes(term)));
    if (match) {
      hits.push({ ...summary, excerpt: excerptAround(match.content, terms), matchedAt: match.createdAt });
    }
  }

  return hits
    .sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''))
    .slice(0, limit);
}

/**
 * Kept for import/backward-compatibility tests while legacy cloud search is
 * retired. New history reads use the device repository for every account.
 */
export function escapeLike(term: string): string {
  return term.replace(/[\\%_,()]/g, char => `\\${char}`);
}

// ─── Entry points (called through ChatService) ──────────────────────────────

export async function listChatSummaries(
  userId: string | null,
  options: { limit?: number; after?: string; before?: string } = {},
): Promise<ChatSummary[]> {
  const limit = clamp(options.limit ?? 10, MAX_LIMIT);
  if (userId && typeof indexedDB === 'undefined') throw new Error('device_history_unavailable');
  const sessions = typeof indexedDB === 'undefined'
    ? getLocalSessions()
    : await listDeviceSessions(chatWorkspace(userId));
  return localSummaries(sessions)
    .filter(summary => withinRange(summary.updatedAt || summary.createdAt, options.after, options.before))
    .sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''))
    .slice(0, limit);
}

export async function searchChatArchive(
  userId: string | null,
  query: string,
  options: { limit?: number; after?: string; before?: string; excludeChatId?: string } = {},
): Promise<ChatSearchHit[]> {
  const limit = clamp(options.limit ?? 10, MAX_LIMIT);
  if (userId && typeof indexedDB === 'undefined') throw new Error('device_history_unavailable');
  // Terms shorter than three characters match everything and rank nothing.
  const terms = query.toLowerCase().split(/\s+/).map(term => term.trim()).filter(term => term.length >= 3);
  if (terms.length === 0) {
    const summaries = await listChatSummaries(userId, options);
    return summaries.filter(summary => summary.id !== options.excludeChatId);
  }

  const sessions = typeof indexedDB === 'undefined'
    ? getLocalSessions()
    : await listDeviceSessions(chatWorkspace(userId));
  return searchLocal(sessions, terms, limit, options.after, options.before, options.excludeChatId);
}

/**
 * Is there any earlier conversation at all, other than this one?
 *
 * Cheap on purpose: the answer decides whether the history tools are worth
 * putting in front of the model, and asking that question must not cost more
 * than the tokens it saves.
 */
export async function hasArchivedChats(userId: string | null, excludeChatId?: string): Promise<boolean> {
  if (userId && typeof indexedDB === 'undefined') throw new Error('device_history_unavailable');
  const sessions = typeof indexedDB === 'undefined'
    ? getLocalSessions()
    : await listDeviceSessions(chatWorkspace(userId));
  return sessions.some(session =>
    session.id !== excludeChatId && (session.messages?.length ?? 0) > 0);
}

export async function readChatTranscript(
  userId: string | null,
  chatId: string,
  options: { offset?: number; limit?: number } = {},
): Promise<ChatTranscript | null> {
  const limit = clamp(options.limit ?? 20, MAX_MESSAGES);
  const offset = Math.max(0, Math.floor(options.offset ?? 0));
  if (userId && typeof indexedDB === 'undefined') throw new Error('device_history_unavailable');

  const sessions = typeof indexedDB === 'undefined'
    ? getLocalSessions()
    : await listDeviceSessions(chatWorkspace(userId));
  const session = sessions.find(candidate => candidate.id === chatId);
  if (!session) return null;

  const messages = session.messages || [];
  return {
    id: chatId,
    title: session.name || 'Untitled chat',
    totalMessages: messages.length,
    offset,
    messages: messages.slice(offset, offset + limit).map(message => ({
      role: message.isAI ? 'assistant' as const : 'user' as const,
      content: truncate(message.content || ''),
      createdAt: message.createdAt,
    })),
  };
}
