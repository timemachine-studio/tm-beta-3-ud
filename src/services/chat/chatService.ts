import { supabase } from '../../lib/supabase';
import { Message } from '../../types/chat';
import { AI_PERSONAS } from '../../config/constants';

export interface ChatSession {
  id: string;
  user_id?: string;
  name: string;
  messages: Message[];
  persona: keyof typeof AI_PERSONAS;
  heat_level?: number;
  createdAt: string;
  lastModified: string;
}

// Convert database row to ChatSession
function dbRowToSession(row: any, messages: Message[]): ChatSession {
  return {
    id: row.id,
    user_id: row.user_id,
    name: row.name,
    messages,
    persona: row.persona as keyof typeof AI_PERSONAS,
    heat_level: row.heat_level,
    createdAt: row.created_at,
    lastModified: row.updated_at,
  };
}

// Convert Message to database format
function messageToDbRow(message: Message, sessionId: string, userId: string) {
  return {
    session_id: sessionId,
    user_id: userId,
    role: message.isAI ? 'assistant' : 'user',
    content: message.content,
    images: message.inputImageUrls || (message.imageData ? [message.imageData] : null),
    audio_url: message.audioUrl || null,
    reasoning: message.thinking || null,
    metadata: {
      hasAnimated: message.hasAnimated,
      imageDimensions: message.imageDimensions,
      specialMode: message.specialMode || null,
      musicVariations: message.musicVariations || null,
      mcpApproval: message.mcpApproval || null,
    },
    created_at: new Date(message.id).toISOString(),
  };
}

// Convert database row to Message
function dbRowToMessage(row: any): Message {
  return {
    id: new Date(row.created_at).getTime(),
    content: row.content,
    isAI: row.role === 'assistant',
    hasAnimated: row.metadata?.hasAnimated ?? true,
    inputImageUrls: row.images,
    audioUrl: row.audio_url,
    thinking: row.reasoning,
    imageDimensions: row.metadata?.imageDimensions,
    specialMode: row.metadata?.specialMode || undefined,
    musicVariations: row.metadata?.musicVariations || undefined,
    mcpApproval: row.metadata?.mcpApproval || undefined,
  };
}

// ============================================
// LOCAL STORAGE FUNCTIONS (for anonymous users)
// ============================================

export function getLocalSessions(): ChatSession[] {
  try {
    return JSON.parse(localStorage.getItem('chatSessions') || '[]');
  } catch {
    return [];
  }
}

export function saveLocalSession(session: ChatSession): void {
  try {
    const sessions = getLocalSessions();
    const existingIndex = sessions.findIndex(s => s.id === session.id);

    // Filter out messages with empty content (streaming placeholders)
    const sessionToSave: ChatSession = {
      ...session,
      messages: session.messages.filter(msg => msg.content && msg.content.trim() !== '')
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
    console.error('Failed to save local session:', error);
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

        return dbRowToSession(session, (messages || []).map(dbRowToMessage));
      })
    );

    return sessionsWithMessages;
  } catch (error) {
    console.error('Error fetching Supabase sessions:', error);
    return [];
  }
}

// Keep track of active saves to prevent concurrent saves for the same session ID
const saveQueues = new Map<string, Promise<any>>();

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
          heat_level: session.heat_level || 2,
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

      // Filter out messages with empty content (streaming placeholders)
      const validMessages = session.messages.filter(msg => msg.content && msg.content.trim() !== '');

      if (validMessages.length === 0) {
        return activeSessionId;
      }

      // Get existing messages to compare
      const { data: existingMessages, error: fetchError } = await supabase
        .from('chat_messages')
        .select('id, content, role, created_at')
        .eq('session_id', activeSessionId)
        .order('created_at', { ascending: true });

      if (fetchError) {
        console.error('Error fetching existing messages:', fetchError);
      }

      const existingCount = existingMessages?.length || 0;

      // Strategy: Delete all existing messages and re-insert all valid messages
      // This ensures updates to message content (like streaming completion) are saved
      // and avoids complex diff logic that could miss updates
      if (existingCount > 0) {
        const { error: deleteError } = await supabase
          .from('chat_messages')
          .delete()
          .eq('session_id', activeSessionId);

        if (deleteError) {
          console.error('Error deleting old messages:', deleteError);
        }
      }

      // Insert all valid messages
      const messagesToInsert = validMessages.map(msg => messageToDbRow(msg, activeSessionId, userId));

      const { error: msgError } = await supabase
        .from('chat_messages')
        .insert(messagesToInsert);

      if (msgError) {
        console.error('Error saving messages:', msgError);
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

  setUserId(userId: string | null) {
    this.userId = userId;
  }

  async getSessions(): Promise<ChatSession[]> {
    if (this.userId) {
      return getSupabaseSessions(this.userId);
    }
    return getLocalSessions();
  }

  async saveSession(session: ChatSession): Promise<void> {
    if (this.userId) {
      await saveSupabaseSession(session, this.userId);
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

  async migrateOnLogin(): Promise<number> {
    if (this.userId) {
      return migrateLocalSessionsToSupabase(this.userId);
    }
    return 0;
  }
}

export const chatService = new ChatService();
export default chatService;
