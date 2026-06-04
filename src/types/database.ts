export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string | null;
          phone: string | null;
          nickname: string | null;
          about_me: string | null;
          avatar_url: string | null;
          is_pro: boolean;
          gender: string | null;
          birth_date: string | null;
          rate_limit_overrides: Json | null; // Custom rate limits per persona { "default": 100, "pro": 50 }
          default_theme: Json | null; // User's default theme preference { mode: 'dark', season: 'autumnDark' }
          last_persona: string | null; // User's last selected persona (e.g., 'default', 'girlie', 'pro')
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email?: string | null;
          phone?: string | null;
          nickname?: string | null;
          about_me?: string | null;
          avatar_url?: string | null;
          is_pro?: boolean;
          gender?: string | null;
          birth_date?: string | null;
          rate_limit_overrides?: Json | null;
          default_theme?: Json | null;
          last_persona?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string | null;
          phone?: string | null;
          nickname?: string | null;
          about_me?: string | null;
          avatar_url?: string | null;
          is_pro?: boolean;
          gender?: string | null;
          birth_date?: string | null;
          rate_limit_overrides?: Json | null;
          default_theme?: Json | null;
          last_persona?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      rate_limits: {
        Row: {
          id: string;
          user_id: string | null;
          ip_address: string | null;
          persona: string;
          message_count: number;
          window_start: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          ip_address?: string | null;
          persona: string;
          message_count?: number;
          window_start?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string | null;
          ip_address?: string | null;
          persona?: string;
          message_count?: number;
          window_start?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      chat_sessions: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          persona: string;
          heat_level: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name?: string;
          persona?: string;
          heat_level?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          persona?: string;
          heat_level?: number;
          created_at?: string;
          updated_at?: string;
        };
      };
      chat_messages: {
        Row: {
          id: string;
          session_id: string;
          user_id: string;
          role: string;
          content: string;
          images: string[] | null;
          audio_url: string | null;
          reasoning: string | null;
          emotion: string | null;
          metadata: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          session_id: string;
          user_id: string;
          role: string;
          content: string;
          images?: string[] | null;
          audio_url?: string | null;
          reasoning?: string | null;
          emotion?: string | null;
          metadata?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          session_id?: string;
          user_id?: string;
          role?: string;
          content?: string;
          images?: string[] | null;
          audio_url?: string | null;
          reasoning?: string | null;
          emotion?: string | null;
          metadata?: Json;
          created_at?: string;
        };
      };
      ai_memories: {
        Row: {
          id: string;
          user_id: string;
          persona: string;
          memory_type: string;
          content: string;
          importance: number;
          last_accessed: string;
          access_count: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          persona?: string;
          memory_type?: string;
          content: string;
          importance?: number;
          last_accessed?: string;
          access_count?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          persona?: string;
          memory_type?: string;
          content?: string;
          importance?: number;
          last_accessed?: string;
          access_count?: number;
          created_at?: string;
        };
      };
      user_images: {
        Row: {
          id: string;
          user_id: string | null;
          storage_path: string;
          public_url: string;
          file_name: string | null;
          file_size: number | null;
          mime_type: string | null;
          width: number | null;
          height: number | null;
          purpose: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          storage_path: string;
          public_url: string;
          file_name?: string | null;
          file_size?: number | null;
          mime_type?: string | null;
          width?: number | null;
          height?: number | null;
          purpose?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string | null;
          storage_path?: string;
          public_url?: string;
          file_name?: string | null;
          file_size?: number | null;
          mime_type?: string | null;
          width?: number | null;
          height?: number | null;
          purpose?: string;
          created_at?: string;
        };
      };
      youtube_music: {
        Row: {
          id: string;
          video_id: string;
          title: string | null;
          order_index: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          video_id: string;
          title?: string | null;
          order_index?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          video_id?: string;
          title?: string | null;
          order_index?: number;
          created_at?: string;
        };
      };
    };
  };
}

// Helper types
export type Profile = Database['public']['Tables']['profiles']['Row'];
export type ChatSession = Database['public']['Tables']['chat_sessions']['Row'];
export type ChatMessage = Database['public']['Tables']['chat_messages']['Row'];
export type AiMemory = Database['public']['Tables']['ai_memories']['Row'];
export type UserImage = Database['public']['Tables']['user_images']['Row'];
export type RateLimit = Database['public']['Tables']['rate_limits']['Row'];
export type YouTubeMusic = Database['public']['Tables']['youtube_music']['Row'];
