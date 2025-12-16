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
          project_icon: string | null
          project_type: string | null
          public_url: string | null
          thumbnail_url: string | null
          title: string | null
          updated_at: string
          user_id: string
          web_analytics_site_token: string | null
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
          project_icon?: string | null
          project_type?: string | null
          public_url?: string | null
          thumbnail_url?: string | null
          title?: string | null
          updated_at?: string
          user_id: string
          web_analytics_site_token?: string | null
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
          project_icon?: string | null
          project_type?: string | null
          public_url?: string | null
          thumbnail_url?: string | null
          title?: string | null
          updated_at?: string
          user_id?: string
          web_analytics_site_token?: string | null
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
          messages_used: number | null
          tokens_quota: number | null
          tokens_used: number | null
          updated_at: string | null
          username: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          description?: string | null
          email: string
          id: string
          messages_used?: number | null
          tokens_quota?: number | null
          tokens_used?: number | null
          updated_at?: string | null
          username?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          description?: string | null
          email?: string
          id?: string
          messages_used?: number | null
          tokens_quota?: number | null
          tokens_used?: number | null
          updated_at?: string | null
          username?: string | null
        }
        Relationships: []
      }
      project_blog_posts: {
        Row: {
          content: string | null
          created_at: string | null
          featured_image: string | null
          id: string
          project_id: string
          published_at: string | null
          slug: string
          status: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          content?: string | null
          created_at?: string | null
          featured_image?: string | null
          id?: string
          project_id: string
          published_at?: string | null
          slug: string
          status?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          content?: string | null
          created_at?: string | null
          featured_image?: string | null
          id?: string
          project_id?: string
          published_at?: string | null
          slug?: string
          status?: string | null
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_blog_posts_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "build_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      project_contacts: {
        Row: {
          created_at: string | null
          email: string
          id: string
          message: string | null
          name: string
          phone: string | null
          project_id: string
          status: string | null
        }
        Insert: {
          created_at?: string | null
          email: string
          id?: string
          message?: string | null
          name: string
          phone?: string | null
          project_id: string
          status?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string
          id?: string
          message?: string | null
          name?: string
          phone?: string | null
          project_id?: string
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_contacts_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "build_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      project_domains: {
        Row: {
          created_at: string | null
          dns_records: Json | null
          domain_name: string
          id: string
          is_primary: boolean | null
          project_id: string
          status: string | null
          verified_at: string | null
        }
        Insert: {
          created_at?: string | null
          dns_records?: Json | null
          domain_name: string
          id?: string
          is_primary?: boolean | null
          project_id: string
          status?: string | null
          verified_at?: string | null
        }
        Update: {
          created_at?: string | null
          dns_records?: Json | null
          domain_name?: string
          id?: string
          is_primary?: boolean | null
          project_id?: string
          status?: string | null
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_domains_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "build_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      project_finance: {
        Row: {
          expense_tracking: Json | null
          id: string
          payment_methods: Json | null
          project_id: string
          revenue_stats: Json | null
          updated_at: string | null
        }
        Insert: {
          expense_tracking?: Json | null
          id?: string
          payment_methods?: Json | null
          project_id: string
          revenue_stats?: Json | null
          updated_at?: string | null
        }
        Update: {
          expense_tracking?: Json | null
          id?: string
          payment_methods?: Json | null
          project_id?: string
          revenue_stats?: Json | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_finance_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: true
            referencedRelation: "build_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      project_invoices: {
        Row: {
          amount: number
          client_info: Json | null
          created_at: string | null
          currency: string | null
          due_date: string | null
          id: string
          invoice_number: string
          line_items: Json | null
          paid_at: string | null
          project_id: string
          status: string | null
        }
        Insert: {
          amount: number
          client_info?: Json | null
          created_at?: string | null
          currency?: string | null
          due_date?: string | null
          id?: string
          invoice_number: string
          line_items?: Json | null
          paid_at?: string | null
          project_id: string
          status?: string | null
        }
        Update: {
          amount?: number
          client_info?: Json | null
          created_at?: string | null
          currency?: string | null
          due_date?: string | null
          id?: string
          invoice_number?: string
          line_items?: Json | null
          paid_at?: string | null
          project_id?: string
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_invoices_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "build_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      project_marketing: {
        Row: {
          campaigns: Json | null
          email_settings: Json | null
          id: string
          project_id: string
          social_links: Json | null
          updated_at: string | null
        }
        Insert: {
          campaigns?: Json | null
          email_settings?: Json | null
          id?: string
          project_id: string
          social_links?: Json | null
          updated_at?: string | null
        }
        Update: {
          campaigns?: Json | null
          email_settings?: Json | null
          id?: string
          project_id?: string
          social_links?: Json | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_marketing_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: true
            referencedRelation: "build_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      project_memory: {
        Row: {
          architecture: Json | null
          created_at: string | null
          known_issues: Json[] | null
          recent_changes: Json[] | null
          session_id: string
          updated_at: string | null
          user_preferences: Json | null
        }
        Insert: {
          architecture?: Json | null
          created_at?: string | null
          known_issues?: Json[] | null
          recent_changes?: Json[] | null
          session_id: string
          updated_at?: string | null
          user_preferences?: Json | null
        }
        Update: {
          architecture?: Json | null
          created_at?: string | null
          known_issues?: Json[] | null
          recent_changes?: Json[] | null
          session_id?: string
          updated_at?: string | null
          user_preferences?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "project_memory_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: true
            referencedRelation: "build_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      project_seo: {
        Row: {
          id: string
          keywords: Json | null
          meta_description: string | null
          meta_title: string | null
          page_path: string
          project_id: string
          updated_at: string | null
        }
        Insert: {
          id?: string
          keywords?: Json | null
          meta_description?: string | null
          meta_title?: string | null
          page_path: string
          project_id: string
          updated_at?: string | null
        }
        Update: {
          id?: string
          keywords?: Json | null
          meta_description?: string | null
          meta_title?: string | null
          page_path?: string
          project_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_seo_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "build_sessions"
            referencedColumns: ["id"]
          },
        ]
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
      published_projects: {
        Row: {
          build_session_id: string
          id: string
          last_updated: string | null
          published_at: string | null
          subdomain: string
          view_count: number | null
        }
        Insert: {
          build_session_id: string
          id?: string
          last_updated?: string | null
          published_at?: string | null
          subdomain: string
          view_count?: number | null
        }
        Update: {
          build_session_id?: string
          id?: string
          last_updated?: string | null
          published_at?: string | null
          subdomain?: string
          view_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "published_projects_build_session_id_fkey"
            columns: ["build_session_id"]
            isOneToOne: false
            referencedRelation: "build_sessions"
            referencedColumns: ["id"]
          },
        ]
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
      increment_view_count: {
        Args: { project_subdomain: string }
        Returns: undefined
      }
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
