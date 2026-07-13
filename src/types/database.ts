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
      flight_control_catalog: {
        Row: {
          id: string;
          kind: 'skill' | 'mcp';
          slug: string;
          name: string;
          description: string;
          icon_name: string;
          is_published: boolean;
          default_enabled: boolean;
          sort_order: number;
          skill_content: string | null;
          mcp_server_url: string | null;
          mcp_auth_mode: 'none' | 'bearer_env' | null;
          mcp_auth_env_var: string | null;
          mcp_allowed_tools: string[];
          mcp_auto_approve_tools: string[];
          mcp_connect_timeout_ms: number;
          mcp_call_timeout_ms: number;
          mcp_result_char_limit: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          kind: 'skill' | 'mcp';
          slug: string;
          name: string;
          description?: string;
          icon_name?: string;
          is_published?: boolean;
          default_enabled?: boolean;
          sort_order?: number;
          skill_content?: string | null;
          mcp_server_url?: string | null;
          mcp_auth_mode?: 'none' | 'bearer_env' | null;
          mcp_auth_env_var?: string | null;
          mcp_allowed_tools?: string[];
          mcp_auto_approve_tools?: string[];
          mcp_connect_timeout_ms?: number;
          mcp_call_timeout_ms?: number;
          mcp_result_char_limit?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['flight_control_catalog']['Insert']>;
      };
      user_flight_control_settings: {
        Row: {
          user_id: string;
          catalog_id: string;
          enabled: boolean;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          catalog_id: string;
          enabled: boolean;
          updated_at?: string;
        };
        Update: {
          enabled?: boolean;
          updated_at?: string;
        };
      };
      mcp_tool_runs: {
        Row: {
          id: string;
          user_id: string;
          catalog_id: string;
          chat_session_id: string | null;
          tool_name: string;
          argument_preview: Json;
          argument_hash: string;
          status: string;
          continuation_state: Json | null;
          error_code: string | null;
          duration_ms: number | null;
          expires_at: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          catalog_id: string;
          chat_session_id?: string | null;
          tool_name: string;
          argument_preview?: Json;
          argument_hash: string;
          status?: string;
          continuation_state?: Json | null;
          error_code?: string | null;
          duration_ms?: number | null;
          expires_at?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          status?: string;
          continuation_state?: Json | null;
          error_code?: string | null;
          duration_ms?: number | null;
          updated_at?: string;
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
export type FlightControlCatalog = Database['public']['Tables']['flight_control_catalog']['Row'];
export type UserFlightControlSetting = Database['public']['Tables']['user_flight_control_settings']['Row'];
