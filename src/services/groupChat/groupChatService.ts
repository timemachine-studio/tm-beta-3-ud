import { supabase } from '../../lib/supabase';
import { GroupChat, GroupChatMessage, GroupChatParticipant, GroupChatInvite } from '../../types/groupChat';
import { AI_PERSONAS } from '../../config/constants';

// Get all group chats for a user (where they are a participant)
export async function getUserGroupChats(userId: string): Promise<{
  id: string;
  name: string;
  persona: keyof typeof AI_PERSONAS;
  owner_nickname: string;
  updated_at: string;
  participant_count: number;
}[]> {
  try {
    // Get all group chat IDs where user is a participant
    const { data: participations, error: partError } = await supabase
      .from('group_chat_participants')
      .select('group_chat_id')
      .eq('user_id', userId);

    if (partError || !participations || participations.length === 0) {
      return [];
    }

    const groupChatIds = participations.map(p => p.group_chat_id);

    // Get group chat details
    const { data: chats, error: chatError } = await supabase
      .from('group_chats')
      .select('id, name, persona, owner_nickname, updated_at, is_active')
      .in('id', groupChatIds)
      .eq('is_active', true)
      .order('updated_at', { ascending: false });

    if (chatError || !chats) {
      return [];
    }

    // Get participant counts for each chat
    const result = await Promise.all(
      chats.map(async (chat) => {
        const { count } = await supabase
          .from('group_chat_participants')
          .select('*', { count: 'exact', head: true })
          .eq('group_chat_id', chat.id);

        return {
          id: chat.id,
          name: chat.name,
          persona: chat.persona as keyof typeof AI_PERSONAS,
          owner_nickname: chat.owner_nickname,
          updated_at: chat.updated_at,
          participant_count: count || 1
        };
      })
    );

    return result;
  } catch (error) {
    console.error('Failed to get user group chats:', error);
    return [];
  }
}

// Generate a short shareable ID
function generateShareId(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let result = '';
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Create a new group chat from an existing session
export async function createGroupChat(
  sessionId: string,
  userId: string,
  userNickname: string,
  chatName: string,
  persona: keyof typeof AI_PERSONAS
): Promise<string | null> {
  try {
    const shareId = generateShareId();

    // Create group chat record
    const { data, error } = await supabase
      .from('group_chats')
      .insert({
        id: shareId,
        session_id: sessionId,
        owner_id: userId,
        owner_nickname: userNickname,
        name: chatName,
        persona,
        is_active: true,
      })
      .select()
      .single();

    if (error) throw error;

    // Add owner as first participant
    await supabase.from('group_chat_participants').insert({
      group_chat_id: shareId,
      user_id: userId,
      nickname: userNickname,
      is_owner: true,
    });

    return shareId;
  } catch (error) {
    console.error('Failed to create group chat:', error);
    return null;
  }
}

// Get group chat info (for invite preview)
export async function getGroupChatInvite(chatId: string): Promise<GroupChatInvite | null> {
  try {
    const { data: chat, error } = await supabase
      .from('group_chats')
      .select('*')
      .eq('id', chatId)
      .eq('is_active', true)
      .single();

    if (error || !chat) return null;

    const { count } = await supabase
      .from('group_chat_participants')
      .select('*', { count: 'exact', head: true })
      .eq('group_chat_id', chatId);

    return {
      chat_id: chat.id,
      chat_name: chat.name,
      owner_nickname: chat.owner_nickname,
      persona: chat.persona as keyof typeof AI_PERSONAS,
      participant_count: count || 1,
    };
  } catch (error) {
    console.error('Failed to get group chat invite:', error);
    return null;
  }
}

// Join a group chat
export async function joinGroupChat(
  chatId: string,
  userId: string,
  userNickname: string,
  avatarUrl?: string
): Promise<boolean> {
  try {
    // Check if already a participant
    const { data: existing } = await supabase
      .from('group_chat_participants')
      .select('id')
      .eq('group_chat_id', chatId)
      .eq('user_id', userId)
      .single();

    if (existing) return true; // Already joined

    const { error } = await supabase
      .from('group_chat_participants')
      .insert({
        group_chat_id: chatId,
        user_id: userId,
        nickname: userNickname,
        avatar_url: avatarUrl,
        is_owner: false,
      });

    return !error;
  } catch (error) {
    console.error('Failed to join group chat:', error);
    return false;
  }
}

// Get full group chat with messages and participants
export async function getGroupChat(chatId: string): Promise<GroupChat | null> {
  try {
    const { data: chat, error: chatError } = await supabase
      .from('group_chats')
      .select('*')
      .eq('id', chatId)
      .single();

    if (chatError || !chat) return null;

    // Get participants
    const { data: participants } = await supabase
      .from('group_chat_participants')
      .select('*')
      .eq('group_chat_id', chatId)
      .order('joined_at', { ascending: true });

    // Get messages
    const { data: messages } = await supabase
      .from('group_chat_messages')
      .select('*')
      .eq('group_chat_id', chatId)
      .order('created_at', { ascending: true });

    return {
      id: chat.id,
      name: chat.name,
      owner_id: chat.owner_id,
      owner_nickname: chat.owner_nickname,
      persona: chat.persona as keyof typeof AI_PERSONAS,
      is_active: chat.is_active,
      created_at: chat.created_at,
      updated_at: chat.updated_at,
      participants: (participants || []).map(p => ({
        id: p.id,
        user_id: p.user_id,
        nickname: p.nickname,
        avatar_url: p.avatar_url,
        joined_at: p.joined_at,
        is_owner: p.is_owner,
      })),
      messages: (messages || []).map(m => ({
        id: new Date(m.created_at).getTime(),
        content: m.content,
        isAI: m.role === 'assistant',
        hasAnimated: true,
        sender_id: m.sender_id,
        sender_nickname: m.sender_nickname,
        sender_avatar: m.sender_avatar,
        inputImageUrls: m.images,
        audioUrl: m.audio_url,
        thinking: m.reasoning,
        reactions: m.reactions || {},
      })),
    };
  } catch (error) {
    console.error('Failed to get group chat:', error);
    return null;
  }
}

// Send a message to group chat
export async function sendGroupChatMessage(
  chatId: string,
  content: string,
  senderId: string,
  senderNickname: string,
  senderAvatar?: string,
  isAI: boolean = false,
  images?: string[],
  audioUrl?: string,
  reasoning?: string
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('group_chat_messages')
      .insert({
        group_chat_id: chatId,
        content,
        role: isAI ? 'assistant' : 'user',
        sender_id: senderId, // Always store sender_id for filtering
        sender_nickname: isAI ? 'TimeMachine' : senderNickname,
        sender_avatar: senderAvatar,
        images,
        audio_url: audioUrl,
        reasoning,
      });

    return !error;
  } catch (error) {
    console.error('Failed to send group chat message:', error);
    return false;
  }
}

// Check if user is participant
export async function isGroupChatParticipant(chatId: string, userId: string): Promise<boolean> {
  try {
    const { data } = await supabase
      .from('group_chat_participants')
      .select('id')
      .eq('group_chat_id', chatId)
      .eq('user_id', userId)
      .single();

    return !!data;
  } catch {
    return false;
  }
}

// Disable group chat (owner only)
export async function disableGroupChat(chatId: string, userId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('group_chats')
      .update({ is_active: false })
      .eq('id', chatId)
      .eq('owner_id', userId);

    return !error;
  } catch (error) {
    console.error('Failed to disable group chat:', error);
    return false;
  }
}

// Kick a participant from group chat (admin only)
export async function kickParticipant(chatId: string, adminId: string, targetUserId: string): Promise<boolean> {
  try {
    // Verify admin is owner
    const { data: chat } = await supabase
      .from('group_chats')
      .select('owner_id')
      .eq('id', chatId)
      .single();

    if (!chat || chat.owner_id !== adminId) {
      console.error('Not authorized to kick participants');
      return false;
    }

    // Cannot kick yourself (use leaveGroupChat instead)
    if (targetUserId === adminId) {
      console.error('Cannot kick yourself');
      return false;
    }

    const { error } = await supabase
      .from('group_chat_participants')
      .delete()
      .eq('group_chat_id', chatId)
      .eq('user_id', targetUserId);

    return !error;
  } catch (error) {
    console.error('Failed to kick participant:', error);
    return false;
  }
}

// Leave a group chat
export async function leaveGroupChat(chatId: string, userId: string): Promise<boolean> {
  try {
    // Check if user is owner
    const { data: chat } = await supabase
      .from('group_chats')
      .select('owner_id')
      .eq('id', chatId)
      .single();

    if (chat?.owner_id === userId) {
      // Owner leaving - disable the group chat
      await disableGroupChat(chatId, userId);
    }

    const { error } = await supabase
      .from('group_chat_participants')
      .delete()
      .eq('group_chat_id', chatId)
      .eq('user_id', userId);

    return !error;
  } catch (error) {
    console.error('Failed to leave group chat:', error);
    return false;
  }
}

// Update group chat name (admin only)
export async function updateGroupName(chatId: string, userId: string, newName: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('group_chats')
      .update({ name: newName })
      .eq('id', chatId)
      .eq('owner_id', userId);

    return !error;
  } catch (error) {
    console.error('Failed to update group name:', error);
    return false;
  }
}

// Toggle reaction on a message
export async function toggleMessageReaction(
  messageId: number,
  emoji: string,
  userId: string
): Promise<Record<string, string[]> | null> {
  try {
    // Get current reactions
    const { data: message, error: fetchError } = await supabase
      .from('group_chat_messages')
      .select('reactions')
      .eq('id', messageId)
      .single();

    if (fetchError) {
      console.error('Failed to fetch message reactions:', fetchError);
      return null;
    }

    // Parse current reactions (default to empty object)
    const reactions: Record<string, string[]> = message?.reactions || {};

    // Toggle the reaction
    if (reactions[emoji]) {
      const userIndex = reactions[emoji].indexOf(userId);
      if (userIndex > -1) {
        // Remove user's reaction
        reactions[emoji].splice(userIndex, 1);
        // If no more users have this reaction, remove the emoji key
        if (reactions[emoji].length === 0) {
          delete reactions[emoji];
        }
      } else {
        // Add user's reaction
        reactions[emoji].push(userId);
      }
    } else {
      // Create new reaction with user
      reactions[emoji] = [userId];
    }

    // Update the message
    const { error: updateError } = await supabase
      .from('group_chat_messages')
      .update({ reactions })
      .eq('id', messageId);

    if (updateError) {
      console.error('Failed to update reactions:', updateError);
      return null;
    }

    return reactions;
  } catch (error) {
    console.error('Failed to toggle reaction:', error);
    return null;
  }
}

// Update current music for group chat (syncs across all participants)
export async function updateGroupChatMusic(
  chatId: string,
  music: { videoId: string; title: string; artist?: string } | null
): Promise<boolean> {
  try {
    console.log('[GroupChat] Updating music for', chatId, ':', music);
    const { error } = await supabase
      .from('group_chats')
      .update({ current_music: music })
      .eq('id', chatId);

    if (error) {
      console.error('[GroupChat] Failed to update group music:', error);
      return false;
    }

    console.log('[GroupChat] Music updated successfully');
    return true;
  } catch (error) {
    console.error('[GroupChat] Failed to update group music:', error);
    return false;
  }
}

// Get current music for group chat
export async function getGroupChatMusic(
  chatId: string
): Promise<{ videoId: string; title: string; artist?: string } | null> {
  try {
    const { data, error } = await supabase
      .from('group_chats')
      .select('current_music')
      .eq('id', chatId)
      .single();

    if (error || !data) return null;
    return data.current_music;
  } catch (error) {
    console.error('Failed to get group music:', error);
    return null;
  }
}

// Subscribe to group chat music changes
export function subscribeToGroupChatMusic(
  chatId: string,
  onMusicChange: (music: { videoId: string; title: string; artist?: string } | null) => void
) {
  const subscriptionId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  const channel = supabase
    .channel(`group_music_${chatId}_${subscriptionId}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'group_chats',
        filter: `id=eq.${chatId}`,
      },
      (payload) => {
        console.log('[GroupChat] Music change received:', payload);
        const newData = payload.new as any;
        if (newData.current_music !== undefined) {
          console.log('[GroupChat] Broadcasting music change:', newData.current_music);
          onMusicChange(newData.current_music);
        }
      }
    )
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        console.log(`[GroupChat] Subscribed to music changes for ${chatId}`);
      }
    });

  return () => {
    channel.unsubscribe();
  };
}

// Subscribe to group chat messages (real-time)
export function subscribeToGroupChat(
  chatId: string,
  onMessage: (message: GroupChatMessage) => void,
  onParticipantJoin: (participant: GroupChatParticipant) => void,
  onReactionUpdate?: (messageId: number, reactions: Record<string, string[]>) => void
) {
  // Generate unique channel names to prevent channel sharing issues
  const subscriptionId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  // Subscribe to new messages
  const messagesChannel = supabase
    .channel(`group_messages_${chatId}_${subscriptionId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'group_chat_messages',
        filter: `group_chat_id=eq.${chatId}`,
      },
      (payload) => {
        const m = payload.new as any;
        onMessage({
          id: new Date(m.created_at).getTime(),
          content: m.content,
          isAI: m.role === 'assistant',
          hasAnimated: false,
          sender_id: m.sender_id,
          sender_nickname: m.sender_nickname,
          sender_avatar: m.sender_avatar,
          inputImageUrls: m.images,
          audioUrl: m.audio_url,
          thinking: m.reasoning,
          reactions: m.reactions || {},
        });
      }
    )
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        console.log(`[GroupChat] Subscribed to messages for ${chatId}`);
      } else if (status === 'CHANNEL_ERROR') {
        console.error(`[GroupChat] Error subscribing to messages for ${chatId}`);
      }
    });

  // Subscribe to message updates (for reactions)
  const messageUpdatesChannel = supabase
    .channel(`group_message_updates_${chatId}_${subscriptionId}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'group_chat_messages',
        filter: `group_chat_id=eq.${chatId}`,
      },
      (payload) => {
        const m = payload.new as any;
        if (onReactionUpdate && m.reactions !== undefined) {
          // Use the same ID format as when messages are created
          const messageId = new Date(m.created_at).getTime();
          console.log('[GroupChat] Reaction update received:', messageId, m.reactions);
          onReactionUpdate(messageId, m.reactions || {});
        }
      }
    )
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        console.log(`[GroupChat] Subscribed to message updates for ${chatId}`);
      }
    });

  // Subscribe to new participants
  const participantsChannel = supabase
    .channel(`group_participants_${chatId}_${subscriptionId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'group_chat_participants',
        filter: `group_chat_id=eq.${chatId}`,
      },
      (payload) => {
        const p = payload.new as any;
        onParticipantJoin({
          id: p.id,
          user_id: p.user_id,
          nickname: p.nickname,
          avatar_url: p.avatar_url,
          joined_at: p.joined_at,
          is_owner: p.is_owner,
        });
      }
    )
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        console.log(`[GroupChat] Subscribed to participants for ${chatId}`);
      }
    });

  // Return unsubscribe function
  return () => {
    console.log(`[GroupChat] Unsubscribing from ${chatId}`);
    messagesChannel.unsubscribe();
    messageUpdatesChannel.unsubscribe();
    participantsChannel.unsubscribe();
  };
}
