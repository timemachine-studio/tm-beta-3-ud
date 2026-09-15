import { parseStoredMetadata } from './storedChatValidation';
import {
  hasArchivedChats,
  listChatSummaries,
  readChatTranscript,
  searchChatArchive,
  type ChatSearchHit,
  type ChatSummary,
  type ChatTranscript,
} from './chatArchive';
import { supabase } from '../../lib/supabase';
import { Message } from '../../types/chat';
import { AI_PERSONAS } from '../../config/constants';
import { newId } from '../../utils/id';
import { pythonRunsForStorage } from '../python/pythonResult';
import type { MaxModeKind } from '../../../shared/maxMode';
import type { Json, ChatSession as SessionRow, ChatMessage as MessageRow } from '../../types/database';

export interface ChatSession {
  id: string;
  user_id?: string;
  name: string;
  messages: Message[];
  persona: keyof typeof AI_PERSONAS;
  /**
   * Max Mode (PRO only): the harness mode this chat was last in. Local
   * sessions keep it; the cloud row has no column for it, and needs none —
   * the workspace itself lives on the device, and a chat that has one is a
   * Max Mode chat whatever the row says.
   */
  maxMode?: MaxModeKind;
  createdAt: string;
  lastModified: string;
}

// A message worth persisting: it has content, or it is a failed turn whose
// retry row should still be there when the chat is reopened (1.10/1.13).
// Everything else is a streaming placeholder.
export function isPersistable(message: Message): boolean {
  return Boolean((message.content && message.content.trim() !== '') || message.status === 'error');
}

/**
 * One message, bounded for storage.
 *
 * Python artifacts used to carry base64 bytes, which meant a chart travelled
 * inside the conversation — into a localStorage blob that stops saving silently
 * at about five megabytes (LS.2), and into a Supabase JSON column. They carry a
 * file-store id now, so this bounds the shape rather than the size.
 */
function messageForStorage(message: Message): Message {
  // harnessResume is a replay transcript for the bridge that produced it —
  // large, and useless once the page is gone. It never reaches a store.
  // (The Supabase path builds its row field by field, so it never sees it.)
  const { harnessResume: _resume, ...rest } = message;
  void _resume;
  if (!message.pythonRuns?.length) return rest;
  return { ...rest, pythonRuns: pythonRunsForStorage(message.pythonRuns) };
}

// Convert database row to ChatSession
function dbRowToSession(row: SessionRow, messages: Message[]): ChatSession {
  return {
    id: row.id,
    user_id: row.user_id,
    name: row.name,
    messages,
    persona: row.persona as keyof typeof AI_PERSONAS,
    createdAt: row.created_at,
    lastModified: row.updated_at,
  };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Convert Message to database format. The row carries the message's own id so
// a save is an upsert by id rather than a wipe-and-rewrite (A.4). Ids that
// predate 1.12 are numeric strings, not uuids; those rows get a fresh id and
// the message takes it on the next load.
function messageToDbRow(message: Message, sessionId: string, userId: string) {
  return {
    id: UUID.test(message.id) ? message.id : newId(),
    session_id: sessionId,
    user_id: userId,
    role: message.isAI ? 'assistant' : 'user',
    content: message.content,
    images: message.inputImageUrls
      || (message.imageData ? (Array.isArray(message.imageData) ? message.imageData : [message.imageData]) : null),
    audio_url: message.audioUrl || null,
    reasoning: message.thinking || null,
    metadata: {
      hasAnimated: message.hasAnimated,
      imageDimensions: message.imageDimensions,
      specialMode: message.specialMode || null,
      musicVariations: message.musicVariations || null,
      mcpApproval: message.mcpApproval || null,
      // A failed turn has to come back as a failed turn, or reopening the chat
      // shows a blank bubble where the Retry row was (1.10).
      status: message.status || null,
      errorCode: message.errorCode || null,
      partialContent: message.partialContent || null,
      appObjects: message.appObjects || null,
      pythonRuns: messageForStorage(message).pythonRuns || null,
      attachments: message.attachments || null,
      createdTools: message.createdTools || null,
      harnessActions: message.harnessActions || null,
    } as unknown as Json,
    // Ordering is by created_at, and ids are no longer timestamps (1.12),
    // so the message has to carry its own clock.
    created_at: message.createdAt || new Date().toISOString(),
  };
}

// Convert database row to Message
function dbRowToMessage(row: MessageRow): Message {
  const saved = parseStoredMetadata(row.metadata);
  return {
    id: row.id != null ? String(row.id) : newId(),
    createdAt: row.created_at,
    content: row.content,
    isAI: row.role === 'assistant',
    hasAnimated: saved.hasAnimated ?? true,
    inputImageUrls: row.images ?? undefined,
    audioUrl: row.audio_url ?? undefined,
    thinking: row.reasoning ?? undefined,
    imageDimensions: saved.imageDimensions ?? undefined,
    specialMode: saved.specialMode || undefined,
    musicVariations: saved.musicVariations || undefined,
    mcpApproval: saved.mcpApproval || undefined,
    status: saved.status || undefined,
    errorCode: saved.errorCode || undefined,
    partialContent: saved.partialContent || undefined,
    appObjects: saved.appObjects || undefined,
    pythonRuns: saved.pythonRuns || undefined,
    attachments: saved.attachments || undefined,
    createdTools: saved.createdTools || undefined,
    harnessActions: saved.harnessActions || undefined,
  };
}

// ============================================
// LOCAL STORAGE FUNCTIONS (for anonymous users)
// ============================================

// Migration shim for sessions written before 1.12, whose message ids are
// numeric timestamps. Numbers become strings and the old id survives as the
// message's createdAt, so restored history keeps its ordering.
function normalizeStoredSession(session: ChatSession): ChatSession {
  const messages = (session.messages || []).map((message) => {
    const rawId = message.id as unknown;
    if (typeof rawId === 'number') {
      return {
        ...message,
        id: String(rawId),
        createdAt: message.createdAt || new Date(rawId).toISOString(),
      };
    }
    return typeof rawId === 'string' && rawId ? message : { ...message, id: newId() };
  });
  return { ...session, messages };
}

export function getLocalSessions(): ChatSession[] {
  try {
    const parsed = JSON.parse(localStorage.getItem('chatSessions') || '[]');
    return Array.isArray(parsed) ? parsed.map(normalizeStoredSession) : [];
  } catch {
    return [];
  }
}

export function saveLocalSession(session: ChatSession): void {
  try {
    const sessions = getLocalSessions();
    const existingIndex = sessions.findIndex(s => s.id === session.id);

    const sessionToSave: ChatSession = {
      ...session,
      messages: session.messages.filter(isPersistable).map(messageForStorage)
    };

    // Don't save sessions with no valid messages
    if (sessionToSave.messages.length === 0) {
      return;
    }

    if (existingIndex !== -1) {
      sessions[existingIndex] = sessionToSave;
    } else {
      sessions.push(sessionToSave);
    }

    localStorage.setItem('chatSessions', JSON.stringify(sessions));
  } catch (error) {
    // Usually QuotaExceededError: the single localStorage blob is full (LS.2).
    // There is no other copy of an anonymous chat, so this must reach the
    // user rather than a console nobody reads (pre-launch-audit.md A.4).
    console.error('Failed to save local session:', error);
    throw error instanceof Error ? error : new Error('local_save_failed');
  }
}

export function deleteLocalSession(sessionId: string): void {
  try {
    const sessions = getLocalSessions().filter(s => s.id !== sessionId);
    localStorage.setItem('chatSessions', JSON.stringify(sessions));
  } catch (error) {
    console.error('Failed to delete local session:', error);
  }
}

// ============================================
// SUPABASE FUNCTIONS (for logged in users)
// ============================================

export async function getSupabaseSessions(userId: string): Promise<ChatSession[]> {
  try {
    const { data: sessions, error } = await supabase
      .from('chat_sessions')
      .select('*')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false });

    if (error) throw error;
    if (!sessions) return [];

    // Fetch messages for each session
    const sessionsWithMessages = await Promise.all(
      sessions.map(async (session) => {
        const { data: messages, error: msgError } = await supabase
          .from('chat_messages')
          .select('*')
          .eq('session_id', session.id)
          .order('created_at', { ascending: true });

        if (msgError) {
          console.error('Error fetching messages:', msgError);
          return dbRowToSession(session, []);
        }

        // A user message and the assistant placeholder for its reply used to
        // be created in the same tick, so created_at ties and Postgres returns
        // them in any order — a reloaded chat showed the reply above the
        // prompt, and Retry (which walks back from the failed turn to its
        // prompt) found nothing. New turns are stamped apart; for rows that
        // already tie, the prompt comes before its reply. Row ids are uuids,
        // so they are no help as a tiebreaker.
        const ordered = (messages || []).map(dbRowToMessage).sort((a, b) =>
          (a.createdAt ?? '').localeCompare(b.createdAt ?? '') || Number(a.isAI) - Number(b.isAI));
        return dbRowToSession(session, ordered);
      })
    );

    return sessionsWithMessages;
  } catch (error) {
    console.error('Error fetching Supabase sessions:', error);
    return [];
  }
}

// Keep track of active saves to prevent concurrent saves for the same session ID
const saveQueues = new Map<string, Promise<string | null>>();

export async function saveSupabaseSession(
  session: ChatSession,
  userId: string
): Promise<string | null> {
  const sessionId = session.id;
  
  // Get the existing promise queue for this session or a resolved promise if none exists
  const existingQueue = saveQueues.get(sessionId) || Promise.resolve();
  
  // Define the save operation
  const performSave = async (): Promise<string | null> => {
    try {
      // Use upsert to handle both insert and update in one operation
      const { data: savedSession, error: sessionError } = await supabase
        .from('chat_sessions')
        .upsert({
          id: session.id,
          user_id: userId,
          name: session.name,
          persona: session.persona,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'id'
        })
        .select()
        .single();

      if (sessionError) {
        console.error('Error upserting session:', sessionError);
        throw sessionError;
      }

      const activeSessionId = savedSession?.id || session.id;

      const validMessages = session.messages.filter(isPersistable);

      if (validMessages.length === 0) {
        return activeSessionId;
      }

      // Upsert first, delete after — never the other way round. The previous
      // strategy deleted every row of the session and re-inserted the lot, so
      // an insert that failed (network, RLS, an oversized row) left the chat
      // empty in the database with nothing but a console.error to show for it
      // (pre-launch-audit.md A.4). Now the rows are written by id; only once
      // that has succeeded are rows the client no longer has removed.
      const rows = validMessages.map(msg => messageToDbRow(msg, activeSessionId, userId));
      const { error: upsertError } = await supabase
        .from('chat_messages')
        .upsert(rows, { onConflict: 'id' });
      if (upsertError) {
        console.error('Error saving messages:', upsertError);
        throw upsertError;
      }

      const keep = new Set(rows.map(row => row.id));
      const { data: existing, error: fetchError } = await supabase
        .from('chat_messages')
        .select('id')
        .eq('session_id', activeSessionId);
      if (fetchError) {
        // The messages are saved; only the prune of stale rows is skipped.
        console.error('Error listing existing messages:', fetchError);
        return activeSessionId;
      }
      const stale = (existing || []).map(row => String(row.id)).filter(id => !keep.has(id));
      if (stale.length > 0) {
        const { error: deleteError } = await supabase
          .from('chat_messages')
          .delete()
          .in('id', stale);
        if (deleteError) console.error('Error pruning stale messages:', deleteError);
      }

      return activeSessionId;
    } catch (error) {
      console.error('Error saving Supabase session:', error);
      return null;
    }
  };
  
  // Chain the new save operation to the queue
  const nextQueue = existingQueue.then(performSave);
  saveQueues.set(sessionId, nextQueue);
  
  // Clean up the queue entry once complete to prevent memory accumulation
  nextQueue.finally(() => {
    if (saveQueues.get(sessionId) === nextQueue) {
      saveQueues.delete(sessionId);
    }
  });
  
  return nextQueue;
}

export async function deleteSupabaseSession(sessionId: string): Promise<boolean> {
  try {
    // Messages will be deleted automatically due to CASCADE
    const { error } = await supabase
      .from('chat_sessions')
      .delete()
      .eq('id', sessionId);

    return !error;
  } catch (error) {
    console.error('Error deleting Supabase session:', error);
    return false;
  }
}

export async function renameSupabaseSession(sessionId: string, newName: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('chat_sessions')
      .update({ name: newName })
      .eq('id', sessionId);

    return !error;
  } catch (error) {
    console.error('Error renaming Supabase session:', error);
    return false;
  }
}

// ============================================
// MIGRATION FUNCTION
// ============================================

// Migrate local sessions to Supabase when user logs in
export async function migrateLocalSessionsToSupabase(userId: string): Promise<number> {
  const localSessions = getLocalSessions();
  if (localSessions.length === 0) return 0;

  let migratedCount = 0;

  for (const session of localSessions) {
    const result = await saveSupabaseSession(session, userId);
    if (result) {
      migratedCount++;
    }
  }

  // Clear local storage after successful migration
  if (migratedCount > 0) {
    localStorage.removeItem('chatSessions');
  }

  return migratedCount;
}

// ============================================
// UNIFIED INTERFACE
// ============================================

export class ChatService {
  private userId: string | null = null;
  /** Memoised hasArchive answer. Cleared when the user or the archive changes. */
  private archiveKnown: boolean | null = null;

  setUserId(userId: string | null) {
    if (userId !== this.userId) this.archiveKnown = null;
    this.userId = userId;
  }

  async getSessions(): Promise<ChatSession[]> {
    if (this.userId) {
      return getSupabaseSessions(this.userId);
    }
    return getLocalSessions();
  }

  /**
   * Persist one session. Throws when the store refused the write — a caller
   * must surface that, because there is no other copy to fall back on.
   */
  async saveSession(session: ChatSession): Promise<void> {
    // Saving one is the moment an empty archive stops being empty.
    this.archiveKnown = null;
    if (this.userId) {
      const saved = await saveSupabaseSession(session, this.userId);
      if (!saved) throw new Error('chat_save_failed');
    } else {
      saveLocalSession(session);
    }
  }

  async deleteSession(sessionId: string): Promise<boolean> {
    if (this.userId) {
      return deleteSupabaseSession(sessionId);
    }
    deleteLocalSession(sessionId);
    return true;
  }

  async renameSession(sessionId: string, newName: string): Promise<boolean> {
    if (this.userId) {
      return renameSupabaseSession(sessionId, newName);
    }
    // For local storage
    const sessions = getLocalSessions();
    const session = sessions.find(s => s.id === sessionId);
    if (session) {
      session.name = newName;
      localStorage.setItem('chatSessions', JSON.stringify(sessions));
      return true;
    }
    return false;
  }

  // ─── Bounded archive reads ────────────────────────────────────────────
  // The AI reaches history through these, never through getSessions() — that
  // one loads every message of every chat, which is a history page's job and
  // nobody else's. Both stores are handled behind the same three calls, so a
  // caller never has to know which one a given user is on.

  async listChats(options?: { limit?: number; after?: string; before?: string }): Promise<ChatSummary[]> {
    return listChatSummaries(this.userId, options);
  }

  async searchChats(
    query: string,
    options?: { limit?: number; after?: string; before?: string; excludeChatId?: string },
  ): Promise<ChatSearchHit[]> {
    return searchChatArchive(this.userId, query, options);
  }

  async readChat(chatId: string, options?: { offset?: number; limit?: number }): Promise<ChatTranscript | null> {
    return readChatTranscript(this.userId, chatId, options);
  }

  /**
   * Whether the history tools have anything to work with. Memoised, because it
   * is asked once per sent message and the answer almost never changes.
   */
  async hasArchive(excludeChatId?: string): Promise<boolean> {
    if (this.archiveKnown !== null) return this.archiveKnown;
    this.archiveKnown = await hasArchivedChats(this.userId, excludeChatId);
    return this.archiveKnown;
  }

  async migrateOnLogin(): Promise<number> {
    if (this.userId) {
      return migrateLocalSessionsToSupabase(this.userId);
    }
    return 0;
  }
}

export const chatService = new ChatService();
export default chatService;
