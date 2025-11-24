export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      build_sessions: {
        Row: {
          cloudflare_deployment_url: string | null
          cloudflare_project_name: string | null
          created_at: string
          github_repo_name: string | null
          github_repo_url: string | null
          id: string
          messages: Json | null
          netlify_deployment_url: string | null
          netlify_site_id: string | null
          project_files: Json | null
          project_type: string | null
          thumbnail_url: string | null
          title: string | null
          updated_at: string
          user_id: string
          website_id: string | null
        }
        Insert: {
          cloudflare_deployment_url?: string | null
          cloudflare_project_name?: string | null
          created_at?: string
          github_repo_name?: string | null
          github_repo_url?: string | null
          id?: string
          messages?: Json | null
          netlify_deployment_url?: string | null
          netlify_site_id?: string | null
          project_files?: Json | null
          project_type?: string | null
          thumbnail_url?: string | null
          title?: string | null
          updated_at?: string
          user_id: string
          website_id?: string | null
        }
        Update: {
          cloudflare_deployment_url?: string | null
          cloudflare_project_name?: string | null
          created_at?: string
          github_repo_name?: string | null
          github_repo_url?: string | null
          id?: string
          messages?: Json | null
          netlify_deployment_url?: string | null
          netlify_site_id?: string | null
          project_files?: Json | null
          project_type?: string | null
          thumbnail_url?: string | null
          title?: string | null
          updated_at?: string
          user_id?: string
          website_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "build_sessions_website_id_fkey"
            columns: ["website_id"]
            isOneToOne: false
            referencedRelation: "websites"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          metadata: Json | null
          role: string
          session_id: string
          token_count: number | null
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          metadata?: Json | null
          role: string
          session_id: string
          token_count?: number | null
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          metadata?: Json | null
          role?: string
          session_id?: string
          token_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "build_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          description: string | null
          email: string
          id: string
          updated_at: string | null
          username: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          description?: string | null
          email: string
          id: string
          updated_at?: string | null
          username?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          description?: string | null
          email?: string
          id?: string
          updated_at?: string | null
          username?: string | null
        }
        Relationships: []
      }
      projects: {
        Row: {
          ai_response: string | null
          created_at: string
          css: string | null
          html: string | null
          id: string
          js: string | null
          name: string
          project_url: string | null
          prompt: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          ai_response?: string | null
          created_at?: string
          css?: string | null
          html?: string | null
          id?: string
          js?: string | null
          name: string
          project_url?: string | null
          prompt?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          ai_response?: string | null
          created_at?: string
          css?: string | null
          html?: string | null
          id?: string
          js?: string | null
          name?: string
          project_url?: string | null
          prompt?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      websites: {
        Row: {
          build_session_id: string | null
          cloudflare_project_name: string | null
          cloudflare_url: string | null
          created_at: string | null
          ga_measurement_id: string | null
          ga_property_id: string | null
          html_content: string
          id: string
          netlify_site_id: string | null
          netlify_url: string | null
          status: string | null
          thumbnail_url: string | null
          title: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          build_session_id?: string | null
          cloudflare_project_name?: string | null
          cloudflare_url?: string | null
          created_at?: string | null
          ga_measurement_id?: string | null
          ga_property_id?: string | null
          html_content: string
          id?: string
          netlify_site_id?: string | null
          netlify_url?: string | null
          status?: string | null
          thumbnail_url?: string | null
          title: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          build_session_id?: string | null
          cloudflare_project_name?: string | null
          cloudflare_url?: string | null
          created_at?: string | null
          ga_measurement_id?: string | null
          ga_property_id?: string | null
          html_content?: string
          id?: string
          netlify_site_id?: string | null
          netlify_url?: string | null
          status?: string | null
          thumbnail_url?: string | null
          title?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "websites_build_session_id_fkey"
            columns: ["build_session_id"]
            isOneToOne: false
            referencedRelation: "build_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "websites_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
