import { supabase } from '../../lib/supabase';

export interface AIMemory {
  id: string;
  user_id: string;
  persona: string;
  memory_type: 'preference' | 'fact' | 'instruction' | 'general';
  content: string;
  importance: number; // 1-10
  last_accessed: string;
  access_count: number;
  created_at: string;
}

export interface CreateMemoryInput {
  persona?: string;
  memory_type?: AIMemory['memory_type'];
  content: string;
  importance?: number;
}

// ============================================
// MEMORY CRUD OPERATIONS
// ============================================

export async function createMemory(
  userId: string,
  input: CreateMemoryInput
): Promise<AIMemory | null> {
  try {
    const { data, error } = await supabase
      .from('ai_memories')
      .insert({
        user_id: userId,
        persona: input.persona || 'default',
        memory_type: input.memory_type || 'general',
        content: input.content,
        importance: input.importance || 5,
      })
      .select()
      .single();

    if (error) throw error;
    return data as AIMemory;
  } catch (error) {
    console.error('Error creating memory:', error);
    return null;
  }
}

export async function getMemories(
  userId: string,
  options?: {
    persona?: string;
    memory_type?: AIMemory['memory_type'];
    limit?: number;
  }
): Promise<AIMemory[]> {
  try {
    let query = supabase
      .from('ai_memories')
      .select('*')
      .eq('user_id', userId)
      .order('importance', { ascending: false })
      .order('last_accessed', { ascending: false });

    if (options?.persona) {
      query = query.eq('persona', options.persona);
    }

    if (options?.memory_type) {
      query = query.eq('memory_type', options.memory_type);
    }

    if (options?.limit) {
      query = query.limit(options.limit);
    }

    const { data, error } = await query;

    if (error) throw error;
    return (data || []) as AIMemory[];
  } catch (error) {
    console.error('Error fetching memories:', error);
    return [];
  }
}

export async function updateMemory(
  memoryId: string,
  updates: Partial<Pick<AIMemory, 'content' | 'importance' | 'memory_type'>>
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('ai_memories')
      .update(updates)
      .eq('id', memoryId);

    return !error;
  } catch (error) {
    console.error('Error updating memory:', error);
    return false;
  }
}

export async function deleteMemory(memoryId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('ai_memories')
      .delete()
      .eq('id', memoryId);

    return !error;
  } catch (error) {
    console.error('Error deleting memory:', error);
    return false;
  }
}

// Mark a memory as accessed (updates last_accessed and increments count)
export async function touchMemory(memoryId: string): Promise<void> {
  try {
    // First get current access_count
    const { data } = await supabase
      .from('ai_memories')
      .select('access_count')
      .eq('id', memoryId)
      .single();

    if (data) {
      await supabase
        .from('ai_memories')
        .update({
          last_accessed: new Date().toISOString(),
          access_count: (data.access_count || 0) + 1,
        })
        .eq('id', memoryId);
    }
  } catch (error) {
    console.error('Error touching memory:', error);
  }
}

// ============================================
// MEMORY FORMATTING FOR AI CONTEXT
// ============================================

export function formatMemoriesForPrompt(memories: AIMemory[], userProfile?: { nickname?: string; about_me?: string }): string {
  if (memories.length === 0 && !userProfile?.about_me) {
    return '';
  }

  let context = '\n\n[USER CONTEXT - Remember this about the user]\n';

  // Add user profile info
  if (userProfile?.nickname) {
    context += `- User's name: ${userProfile.nickname}\n`;
  }

  if (userProfile?.about_me) {
    context += `- About user: ${userProfile.about_me}\n`;
  }

  // Group memories by type
  const grouped = memories.reduce((acc, mem) => {
    if (!acc[mem.memory_type]) acc[mem.memory_type] = [];
    acc[mem.memory_type].push(mem);
    return acc;
  }, {} as Record<string, AIMemory[]>);

  // Add preferences
  if (grouped.preference?.length) {
    context += '\nUser preferences:\n';
    grouped.preference.forEach(m => {
      context += `- ${m.content}\n`;
    });
  }

  // Add facts
  if (grouped.fact?.length) {
    context += '\nThings to remember about this user:\n';
    grouped.fact.forEach(m => {
      context += `- ${m.content}\n`;
    });
  }

  // Add instructions
  if (grouped.instruction?.length) {
    context += '\nUser instructions:\n';
    grouped.instruction.forEach(m => {
      context += `- ${m.content}\n`;
    });
  }

  // Add general memories
  if (grouped.general?.length) {
    context += '\nOther notes:\n';
    grouped.general.forEach(m => {
      context += `- ${m.content}\n`;
    });
  }

  context += '[END USER CONTEXT]\n';

  return context;
}

// ============================================
// MEMORY EXTRACTION (Auto-extract from conversations)
// ============================================

// Keywords that might indicate memorable information
const MEMORY_TRIGGERS = {
  preference: [
    'i like', 'i love', 'i prefer', 'i hate', 'i dislike',
    'my favorite', 'i always', 'i never', 'i usually',
  ],
  fact: [
    'i am', "i'm", 'my name is', 'i work', 'i live',
    'i have', 'my job', 'my hobby', 'i study',
  ],
  instruction: [
    'remember that', 'don\'t forget', 'keep in mind',
    'always', 'never', 'please remember',
  ],
};

export function detectMemoryType(content: string): AIMemory['memory_type'] | null {
  const lowerContent = content.toLowerCase();

  for (const [type, triggers] of Object.entries(MEMORY_TRIGGERS)) {
    if (triggers.some(trigger => lowerContent.includes(trigger))) {
      return type as AIMemory['memory_type'];
    }
  }

  return null;
}

// Simple heuristic to extract potential memories from user messages
export function extractPotentialMemories(userMessage: string): CreateMemoryInput[] {
  const memories: CreateMemoryInput[] = [];
  const sentences = userMessage.split(/[.!?]+/).filter(s => s.trim().length > 10);

  for (const sentence of sentences) {
    const memoryType = detectMemoryType(sentence);
    if (memoryType) {
      memories.push({
        content: sentence.trim(),
        memory_type: memoryType,
        importance: memoryType === 'instruction' ? 8 : 5,
      });
    }
  }

  return memories;
}

// ============================================
// MEMORY SERVICE CLASS
// ============================================

export class MemoryService {
  private userId: string | null = null;
  private cachedMemories: AIMemory[] = [];
  private lastFetch: number = 0;
  private cacheTimeout = 5 * 60 * 1000; // 5 minutes

  setUserId(userId: string | null) {
    this.userId = userId;
    this.cachedMemories = [];
    this.lastFetch = 0;
  }

  async getRelevantMemories(persona?: string, limit: number = 10): Promise<AIMemory[]> {
    if (!this.userId) return [];

    // Use cache if fresh
    const now = Date.now();
    if (this.cachedMemories.length > 0 && now - this.lastFetch < this.cacheTimeout) {
      return persona
        ? this.cachedMemories.filter(m => m.persona === persona || m.persona === 'default').slice(0, limit)
        : this.cachedMemories.slice(0, limit);
    }

    // Fetch fresh memories
    const memories = await getMemories(this.userId, { limit: 50 });
    this.cachedMemories = memories;
    this.lastFetch = now;

    return persona
      ? memories.filter(m => m.persona === persona || m.persona === 'default').slice(0, limit)
      : memories.slice(0, limit);
  }

  async addMemory(input: CreateMemoryInput): Promise<AIMemory | null> {
    if (!this.userId) return null;
    const memory = await createMemory(this.userId, input);
    if (memory) {
      this.cachedMemories = []; // Invalidate cache
    }
    return memory;
  }

  async removeMemory(memoryId: string): Promise<boolean> {
    const result = await deleteMemory(memoryId);
    if (result) {
      this.cachedMemories = this.cachedMemories.filter(m => m.id !== memoryId);
    }
    return result;
  }

  // Auto-extract and save memories from a conversation
  async processUserMessage(message: string, persona: string = 'default'): Promise<void> {
    if (!this.userId) return;

    const potentialMemories = extractPotentialMemories(message);

    for (const mem of potentialMemories) {
      // Check if similar memory already exists
      const existing = this.cachedMemories.find(
        m => m.content.toLowerCase().includes(mem.content.toLowerCase().slice(0, 50))
      );

      if (!existing) {
        await this.addMemory({ ...mem, persona });
      }
    }
  }

  clearCache() {
    this.cachedMemories = [];
    this.lastFetch = 0;
  }
}

export const memoryService = new MemoryService();

// ============================================
// PROFILE TO MEMORY AUTO-SYNC
// ============================================

/**
 * Sync user profile (nickname, about_me) to memories.
 * Creates or updates profile-type memories when profile is updated.
 */
export async function syncProfileToMemory(
  userId: string,
  profile: { nickname?: string | null; about_me?: string | null }
): Promise<void> {
  try {
    // Check for existing profile memory
    const { data: existingMemories } = await supabase
      .from('ai_memories')
      .select('*')
      .eq('user_id', userId)
      .eq('memory_type', 'fact')
      .or('content.ilike.%User goes by%,content.ilike.%User described themselves%');

    // Handle nickname
    if (profile.nickname) {
      const nicknameContent = `User goes by the name "${profile.nickname}"`;
      const existingNickname = existingMemories?.find(m => m.content.includes('User goes by'));

      if (existingNickname) {
        // Update existing
        await supabase
          .from('ai_memories')
          .update({ content: nicknameContent, importance: 10 })
          .eq('id', existingNickname.id);
      } else {
        // Create new
        await supabase
          .from('ai_memories')
          .insert({
            user_id: userId,
            persona: 'default',
            memory_type: 'fact',
            content: nicknameContent,
            importance: 10 // Highest importance for profile info
          });
      }
    }

    // Handle about_me
    if (profile.about_me) {
      const aboutContent = `User described themselves: "${profile.about_me}"`;
      const existingAbout = existingMemories?.find(m => m.content.includes('User described themselves'));

      if (existingAbout) {
        // Update existing
        await supabase
          .from('ai_memories')
          .update({ content: aboutContent, importance: 10 })
          .eq('id', existingAbout.id);
      } else {
        // Create new
        await supabase
          .from('ai_memories')
          .insert({
            user_id: userId,
            persona: 'default',
            memory_type: 'fact',
            content: aboutContent,
            importance: 10 // Highest importance for profile info
          });
      }
    }

    // Invalidate cache
    memoryService.clearCache();
  } catch (error) {
    console.error('Error syncing profile to memory:', error);
  }
}

export default memoryService;
