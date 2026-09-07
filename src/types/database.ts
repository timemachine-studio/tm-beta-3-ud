// Supabase schema types.
//
// NOT machine-generated. `npx supabase gen types` needs a personal access
// token, so the nine tables added for production-check.md 1.2 were written by
// hand from every query and migration in this repo. They are accurate to how
// the code uses each table, but they are not proof of what the live schema
// says — regenerate from the project (and add it as an npm script) the first
// time someone runs the CLI with credentials, and re-run it after every
// migration.

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
        Relationships: [];
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
        Relationships: [];
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
        Relationships: [];
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
        Relationships: [];
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
        Relationships: [];
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
        Relationships: [];
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
        Relationships: [];
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
        Relationships: [];
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
        Relationships: [];
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
        Relationships: [];
      };
      // ─── Healthcare catalogue (read-only from the app) ──────────────────
      manufacturers: {
        Row: {
          id: number;
          name: string;
        };
        Insert: {
          id?: number;
          name: string;
        };
        Update: {
          id?: number;
          name?: string;
        };
        Relationships: [];
      };
      pregnancy_categories: {
        Row: {
          id: string;
          description: string | null;
        };
        Insert: {
          id: string;
          description?: string | null;
        };
        Update: {
          id?: string;
          description?: string | null;
        };
        Relationships: [];
      };
      generics: {
        Row: {
          id: number;
          name: string;
          indication: string | null;
          side_effect: string | null;
          precaution: string | null;
          adult_dose: string | null;
          child_dose: string | null;
          pregnancy_category_id: string | null;
        };
        Insert: {
          id?: number;
          name: string;
          indication?: string | null;
          side_effect?: string | null;
          precaution?: string | null;
          adult_dose?: string | null;
          child_dose?: string | null;
          pregnancy_category_id?: string | null;
        };
        Update: {
          id?: number;
          name?: string;
          indication?: string | null;
          side_effect?: string | null;
          precaution?: string | null;
          adult_dose?: string | null;
          child_dose?: string | null;
          pregnancy_category_id?: string | null;
        };
        Relationships: [];
      };
      brands: {
        Row: {
          id: number;
          name: string;
          form: string | null;
          strength: string | null;
          price: string | null;
          pack_size: string | null;
          generic_id: number | null;
          manufacturer_id: number | null;
        };
        Insert: {
          id?: number;
          name: string;
          form?: string | null;
          strength?: string | null;
          price?: string | null;
          pack_size?: string | null;
          generic_id?: number | null;
          manufacturer_id?: number | null;
        };
        Update: {
          id?: number;
          name?: string;
          form?: string | null;
          strength?: string | null;
          price?: string | null;
          pack_size?: string | null;
          generic_id?: number | null;
          manufacturer_id?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: 'brands_generic_id_fkey';
            columns: ['generic_id'];
            isOneToOne: false;
            referencedRelation: 'generics';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'brands_manufacturer_id_fkey';
            columns: ['manufacturer_id'];
            isOneToOne: false;
            referencedRelation: 'manufacturers';
            referencedColumns: ['id'];
          },
        ];
      };
      // ─── Group chat ─────────────────────────────────────────────────────
      group_chats: {
        Row: {
          id: string;
          session_id: string | null;
          owner_id: string;
          owner_nickname: string;
          name: string;
          persona: string;
          is_active: boolean;
          current_music: Json | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          session_id?: string | null;
          owner_id: string;
          owner_nickname: string;
          name: string;
          persona: string;
          is_active?: boolean;
          current_music?: Json | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          name?: string;
          persona?: string;
          is_active?: boolean;
          current_music?: Json | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      group_chat_participants: {
        Row: {
          id: string;
          group_chat_id: string;
          user_id: string;
          nickname: string;
          avatar_url: string | null;
          is_owner: boolean;
          joined_at: string;
        };
        Insert: {
          id?: string;
          group_chat_id: string;
          user_id: string;
          nickname: string;
          avatar_url?: string | null;
          is_owner?: boolean;
          joined_at?: string;
        };
        Update: {
          nickname?: string;
          avatar_url?: string | null;
          is_owner?: boolean;
        };
        Relationships: [];
      };
      group_chat_messages: {
        Row: {
          id: string;
          group_chat_id: string;
          content: string;
          role: string;
          sender_id: string | null;
          sender_nickname: string | null;
          sender_avatar: string | null;
          images: string[] | null;
          audio_url: string | null;
          reasoning: string | null;
          reactions: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          group_chat_id: string;
          content: string;
          role: string;
          sender_id?: string | null;
          sender_nickname?: string | null;
          sender_avatar?: string | null;
          images?: string[] | null;
          audio_url?: string | null;
          reasoning?: string | null;
          reactions?: Json | null;
          created_at?: string;
        };
        Update: {
          content?: string;
          reactions?: Json | null;
        };
        Relationships: [];
      };
      // ─── Misc feature tables ────────────────────────────────────────────
      user_music: {
        Row: {
          id: string;
          user_id: string;
          song_name: string;
          style: string;
          lyrics: string;
          cover_prompt: string;
          audio_url: string;
          image_url: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          song_name: string;
          style: string;
          lyrics: string;
          cover_prompt: string;
          audio_url: string;
          image_url: string;
          created_at?: string;
        };
        Update: {
          song_name?: string;
          style?: string;
          lyrics?: string;
          cover_prompt?: string;
          audio_url?: string;
          image_url?: string;
        };
        Relationships: [];
      };
      contact_messages: {
        Row: {
          id: string;
          name: string;
          email: string;
          message: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          email: string;
          message: string;
          created_at?: string;
        };
        Update: {
          name?: string;
          email?: string;
          message?: string;
        };
        Relationships: [];
      };
      kitchen_recipes: {
        Row: {
          id: string;
          title: string;
          chef: string | null;
          image: string | null;
          time: string | null;
          difficulty: string | null;
          rating: number | null;
          tags: string[] | null;
          ingredients: Json | null;
          steps: Json | null;
          featured: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          chef?: string | null;
          image?: string | null;
          time?: string | null;
          difficulty?: string | null;
          rating?: number | null;
          tags?: string[] | null;
          ingredients?: Json | null;
          steps?: Json | null;
          featured?: boolean;
          created_at?: string;
        };
        Update: {
          title?: string;
          chef?: string | null;
          image?: string | null;
          time?: string | null;
          difficulty?: string | null;
          rating?: number | null;
          tags?: string[] | null;
          ingredients?: Json | null;
          steps?: Json | null;
          featured?: boolean;
        };
        Relationships: [];
      };
      pro_generation_jobs: {
        Row: {
          id: string;
          created_at: string;
          updated_at: string;
          user_id: string | null;
          chat_session_id: string | null;
          run_id: string | null;
          persona: string;
          status: string;
          error: string | null;
          final_content: string | null;
        };
        Insert: {
          id?: string;
          created_at?: string;
          updated_at?: string;
          user_id?: string | null;
          chat_session_id?: string | null;
          run_id?: string | null;
          persona?: string;
          status?: string;
          error?: string | null;
          final_content?: string | null;
        };
        Update: {
          updated_at?: string;
          run_id?: string | null;
          status?: string;
          error?: string | null;
          final_content?: string | null;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      // supabase/migrations/healthcare_search.sql
      search_drugs: {
        Args: { search_query: string };
        Returns: {
          brand_id: number;
          brand_name: string;
          generic_id: number;
          generic_name: string;
          form: string | null;
          strength: string | null;
          price: string | null;
          pack_size: string | null;
          manufacturer: string | null;
          indication: string | null;
          side_effect: string | null;
          precaution: string | null;
          adult_dose: string | null;
          child_dose: string | null;
          pregnancy_cat: string | null;
          relevance: number;
        }[];
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
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
export type Brand = Database['public']['Tables']['brands']['Row'];
export type Generic = Database['public']['Tables']['generics']['Row'];
export type GroupChatRow = Database['public']['Tables']['group_chats']['Row'];
export type GroupChatMessageRow = Database['public']['Tables']['group_chat_messages']['Row'];
export type GroupChatParticipantRow = Database['public']['Tables']['group_chat_participants']['Row'];
export type UserMusicRow = Database['public']['Tables']['user_music']['Row'];
export type ProGenerationJobRow = Database['public']['Tables']['pro_generation_jobs']['Row'];
