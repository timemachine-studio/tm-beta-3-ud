import { Message } from './chat';
import { AI_PERSONAS } from '../config/constants';

export interface GroupChatParticipant {
  id: string;
  user_id: string;
  nickname: string;
  avatar_url?: string;
  joined_at: string;
  is_owner: boolean;
}

export interface GroupChatMessage extends Message {
  sender_id?: string;
  sender_nickname?: string;
  sender_avatar?: string;
}

export interface GroupChat {
  id: string;
  name: string;
  owner_id: string;
  owner_nickname: string;
  persona: keyof typeof AI_PERSONAS;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  participants: GroupChatParticipant[];
  messages: GroupChatMessage[];
}

export interface GroupChatInvite {
  chat_id: string;
  chat_name: string;
  owner_nickname: string;
  persona: keyof typeof AI_PERSONAS;
  participant_count: number;
}
