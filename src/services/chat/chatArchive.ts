import { supabase } from '../../lib/supabase';
import { getLocalSessions } from './chatService';

/**
 * Bounded reads over the user's own chat history.
 *
 * `getSupabaseSessions` loads every message of every session — fine for
 * painting a history page, ruinous as a model tool. Nothing here ever returns
 * the whole archive: list and search are capped and paged, and message text
 * only comes back for one chat at a time.
 *
 * Both stores are read from the browser under the user's own session, which is
 * why this is a device tool rather than a server one: it works the same for an
 * anonymous user on `localStorage` as for a signed-in user on their own
 * RLS-scoped rows, and it keeps working when history moves to IndexedDB.
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

// ─── Local (anonymous) ──────────────────────────────────────────────────────

function localSummaries(): ChatSummary[] {
  return getLocalSessions().map(session => ({
    id: session.id,
    title: session.name || 'Untitled chat',
    createdAt: session.createdAt,
    updatedAt: session.lastModified,
    messageCount: session.messages?.length ?? 0,
  }));
}

function searchLocal(terms: string[], limit: number, after?: string, before?: string, excludeChatId?: string): ChatSearchHit[] {
  const hits: ChatSearchHit[] = [];

  for (const session of getLocalSessions()) {
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

// ─── Cloud (signed in) ──────────────────────────────────────────────────────

/**
 * PostgREST treats `%`, `_` and `,` inside a filter value as syntax, not text.
 * Escaping them keeps a search for "50%" from becoming a wildcard soup — and
 * keeps a comma from splitting one `or()` term into two.
 */
export function escapeLike(term: string): string {
  return term.replace(/[\\%_,()]/g, char => `\\${char}`);
}

async function listCloud(userId: string, limit: number, after?: string, before?: string): Promise<ChatSummary[]> {
  let query = supabase
    .from('chat_sessions')
    .select('id, name, created_at, updated_at')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
    .limit(limit);

  if (after) query = query.gte('updated_at', after);
  if (before) query = query.lt('updated_at', before);

  const { data, error } = await query;
  if (error) throw error;

  return (data || []).map(row => ({
    id: row.id,
    title: row.name || 'Untitled chat',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

async function searchCloud(
  userId: string,
  terms: string[],
  limit: number,
  after?: string,
  before?: string,
  excludeChatId?: string,
): Promise<ChatSearchHit[]> {
  // Two bounded queries rather than one join: titles, then message bodies.
  const titleFilter = terms.map(term => `name.ilike.%${escapeLike(term)}%`).join(',');

  let titleQuery = supabase
    .from('chat_sessions')
    .select('id, name, created_at, updated_at')
    .eq('user_id', userId)
    .or(titleFilter)
    .order('updated_at', { ascending: false })
    .limit(limit);
  if (after) titleQuery = titleQuery.gte('updated_at', after);
  if (before) titleQuery = titleQuery.lt('updated_at', before);

  let messageQuery = supabase
    .from('chat_messages')
    .select('session_id, content, created_at')
    .eq('user_id', userId)
    .or(terms.map(term => `content.ilike.%${escapeLike(term)}%`).join(','))
    .order('created_at', { ascending: false })
    .limit(limit * 4);
  if (after) messageQuery = messageQuery.gte('created_at', after);
  if (before) messageQuery = messageQuery.lt('created_at', before);

  const [titles, messages] = await Promise.all([titleQuery, messageQuery]);
  if (titles.error) throw titles.error;
  if (messages.error) throw messages.error;

  const hits = new Map<string, ChatSearchHit>();

  for (const row of titles.data || []) {
    if (row.id === excludeChatId) continue;
    hits.set(row.id, {
      id: row.id,
      title: row.name || 'Untitled chat',
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  }

  // Message hits need their session's title, which the message row does not
  // carry. One extra lookup for the ids we did not already resolve.
  const unresolved = [...new Set((messages.data || [])
    .map(row => row.session_id)
    .filter(id => id && id !== excludeChatId && !hits.has(id)))] as string[];

  if (unresolved.length > 0) {
    const { data: sessions, error } = await supabase
      .from('chat_sessions')
      .select('id, name, created_at, updated_at')
      .eq('user_id', userId)
      .in('id', unresolved.slice(0, limit * 2));
    if (error) throw error;

    for (const row of sessions || []) {
      const match = (messages.data || []).find(message => message.session_id === row.id);
      hits.set(row.id, {
        id: row.id,
        title: row.name || 'Untitled chat',
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        excerpt: match ? excerptAround(match.content || '', terms) : undefined,
        matchedAt: match?.created_at,
      });
    }
  }

  return [...hits.values()]
    .sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''))
    .slice(0, limit);
}

async function readCloud(userId: string, chatId: string, offset: number, limit: number): Promise<ChatTranscript | null> {
  const { data: session, error: sessionError } = await supabase
    .from('chat_sessions')
    .select('id, name')
    .eq('user_id', userId)
    .eq('id', chatId)
    .maybeSingle();
  if (sessionError) throw sessionError;
  if (!session) return null;

  const { data, error, count } = await supabase
    .from('chat_messages')
    .select('role, content, created_at', { count: 'exact' })
    .eq('session_id', chatId)
    .eq('user_id', userId)
    .order('created_at', { ascending: true })
    .range(offset, offset + limit - 1);
  if (error) throw error;

  return {
    id: chatId,
    title: session.name || 'Untitled chat',
    totalMessages: count ?? (data || []).length,
    offset,
    messages: (data || []).map(row => ({
      role: row.role === 'assistant' ? 'assistant' as const : 'user' as const,
      content: truncate(row.content || ''),
      createdAt: row.created_at,
    })),
  };
}

// ─── Entry points (called through ChatService) ──────────────────────────────

export async function listChatSummaries(
  userId: string | null,
  options: { limit?: number; after?: string; before?: string } = {},
): Promise<ChatSummary[]> {
  const limit = clamp(options.limit ?? 10, MAX_LIMIT);
  if (userId) return listCloud(userId, limit, options.after, options.before);

  return localSummaries()
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
  // Terms shorter than three characters match everything and rank nothing.
  const terms = query.toLowerCase().split(/\s+/).map(term => term.trim()).filter(term => term.length >= 3);
  if (terms.length === 0) {
    const summaries = await listChatSummaries(userId, options);
    return summaries.filter(summary => summary.id !== options.excludeChatId);
  }

  return userId
    ? searchCloud(userId, terms, limit, options.after, options.before, options.excludeChatId)
    : searchLocal(terms, limit, options.after, options.before, options.excludeChatId);
}

/**
 * Is there any earlier conversation at all, other than this one?
 *
 * Cheap on purpose: the answer decides whether the history tools are worth
 * putting in front of the model, and asking that question must not cost more
 * than the tokens it saves. The cloud path is a count with no rows returned.
 */
export async function hasArchivedChats(userId: string | null, excludeChatId?: string): Promise<boolean> {
  if (userId) {
    let query = supabase
      .from('chat_sessions')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId);
    if (excludeChatId) query = query.neq('id', excludeChatId);

    const { count, error } = await query;
    // A failed count must not silently remove the capability — the tools are
    // harmless when there is nothing to find, and a lookup that returns
    // nothing is a far better failure than one the model never got to make.
    if (error) return true;
    return (count ?? 0) > 0;
  }

  return getLocalSessions().some(session =>
    session.id !== excludeChatId && (session.messages?.length ?? 0) > 0);
}

export async function readChatTranscript(
  userId: string | null,
  chatId: string,
  options: { offset?: number; limit?: number } = {},
): Promise<ChatTranscript | null> {
  const limit = clamp(options.limit ?? 20, MAX_MESSAGES);
  const offset = Math.max(0, Math.floor(options.offset ?? 0));

  if (userId) return readCloud(userId, chatId, offset, limit);

  const session = getLocalSessions().find(candidate => candidate.id === chatId);
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
