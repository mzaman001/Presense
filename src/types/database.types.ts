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
    PostgrestVersion: "14.15"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      categories: {
        Row: {
          color: string
          created_at: string | null
          id: string
          name: string
          user_id: string
        }
        Insert: {
          color: string
          created_at?: string | null
          id?: string
          name: string
          user_id: string
        }
        Update: {
          color?: string
          created_at?: string | null
          id?: string
          name?: string
          user_id?: string
        }
        Relationships: []
      }
      explores: {
        Row: {
          deleted_at: string | null
          digest_at: string | null
          id: string
          linked_thread_id: string | null
          note: string | null
          revisited_at: string | null
          saved_at: string | null
          status: string | null
          tags: string[] | null
          title: string
          type: string | null
          url: string | null
          user_id: string
        }
        Insert: {
          deleted_at?: string | null
          digest_at?: string | null
          id?: string
          linked_thread_id?: string | null
          note?: string | null
          revisited_at?: string | null
          saved_at?: string | null
          status?: string | null
          tags?: string[] | null
          title: string
          type?: string | null
          url?: string | null
          user_id: string
        }
        Update: {
          deleted_at?: string | null
          digest_at?: string | null
          id?: string
          linked_thread_id?: string | null
          note?: string | null
          revisited_at?: string | null
          saved_at?: string | null
          status?: string | null
          tags?: string[] | null
          title?: string
          type?: string | null
          url?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "explores_linked_thread_id_fkey"
            columns: ["linked_thread_id"]
            isOneToOne: false
            referencedRelation: "threads"
            referencedColumns: ["id"]
          },
        ]
      }
      items: {
        Row: {
          category: string | null
          completed_at: string | null
          created_at: string | null
          deadline: string | null
          deleted_at: string | null
          first_step: string | null
          id: string
          ifthen_trigger: string | null
          linked_people_ids: string[] | null
          notes: string | null
          notification_sent_1h: boolean | null
          notification_sent_24h: boolean | null
          notification_sent_6h: boolean | null
          notification_sent_72h: boolean | null
          notification_sent_overdue: boolean | null
          priority: number | null
          recurrence: string | null
          snoozed_until: string | null
          start_date: string | null
          status: string | null
          subtasks: Json[] | null
          time_estimate: number | null
          time_spent_minutes: number | null
          title: string
          user_id: string
        }
        Insert: {
          category?: string | null
          completed_at?: string | null
          created_at?: string | null
          deadline?: string | null
          deleted_at?: string | null
          first_step?: string | null
          id?: string
          ifthen_trigger?: string | null
          linked_people_ids?: string[] | null
          notes?: string | null
          notification_sent_1h?: boolean | null
          notification_sent_24h?: boolean | null
          notification_sent_6h?: boolean | null
          notification_sent_72h?: boolean | null
          notification_sent_overdue?: boolean | null
          priority?: number | null
          recurrence?: string | null
          snoozed_until?: string | null
          start_date?: string | null
          status?: string | null
          subtasks?: Json[] | null
          time_estimate?: number | null
          time_spent_minutes?: number | null
          title: string
          user_id: string
        }
        Update: {
          category?: string | null
          completed_at?: string | null
          created_at?: string | null
          deadline?: string | null
          deleted_at?: string | null
          first_step?: string | null
          id?: string
          ifthen_trigger?: string | null
          linked_people_ids?: string[] | null
          notes?: string | null
          notification_sent_1h?: boolean | null
          notification_sent_24h?: boolean | null
          notification_sent_6h?: boolean | null
          notification_sent_72h?: boolean | null
          notification_sent_overdue?: boolean | null
          priority?: number | null
          recurrence?: string | null
          snoozed_until?: string | null
          start_date?: string | null
          status?: string | null
          subtasks?: Json[] | null
          time_estimate?: number | null
          time_spent_minutes?: number | null
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      locations: {
        Row: {
          created_at: string | null
          deleted_at: string | null
          id: string
          item_name: string
          location_text: string
          photo_url: string | null
          status: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          deleted_at?: string | null
          id?: string
          item_name: string
          location_text: string
          photo_url?: string | null
          status?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          deleted_at?: string | null
          id?: string
          item_name?: string
          location_text?: string
          photo_url?: string | null
          status?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      people: {
        Row: {
          color: string | null
          created_at: string | null
          deleted_at: string | null
          id: string
          initials: string | null
          last_seen: string | null
          name: string
          next_meeting: string | null
          notes: Json[] | null
          relationship: string | null
          sort_order: number | null
          status: string | null
          user_id: string
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          deleted_at?: string | null
          id?: string
          initials?: string | null
          last_seen?: string | null
          name: string
          next_meeting?: string | null
          notes?: Json[] | null
          relationship?: string | null
          sort_order?: number | null
          status?: string | null
          user_id: string
        }
        Update: {
          color?: string | null
          created_at?: string | null
          deleted_at?: string | null
          id?: string
          initials?: string | null
          last_seen?: string | null
          name?: string
          next_meeting?: string | null
          notes?: Json[] | null
          relationship?: string | null
          sort_order?: number | null
          status?: string | null
          user_id?: string
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth_key: string
          created_at: string | null
          endpoint: string
          id: string
          p256dh: string
          user_id: string
        }
        Insert: {
          auth_key: string
          created_at?: string | null
          endpoint: string
          id?: string
          p256dh: string
          user_id: string
        }
        Update: {
          auth_key?: string
          created_at?: string | null
          endpoint?: string
          id?: string
          p256dh?: string
          user_id?: string
        }
        Relationships: []
      }
      ritual_logs: {
        Row: {
          completed_at: string
          id: string
          ritual_type: string
          user_id: string
        }
        Insert: {
          completed_at?: string
          id?: string
          ritual_type: string
          user_id: string
        }
        Update: {
          completed_at?: string
          id?: string
          ritual_type?: string
          user_id?: string
        }
        Relationships: []
      }
      session_logs: {
        Row: {
          completed_at: string | null
          duration_minutes: number
          id: string
          task_id: string | null
          type: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          duration_minutes: number
          id?: string
          task_id?: string | null
          type: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          duration_minutes?: number
          id?: string
          task_id?: string | null
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_logs_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
        ]
      }
      threads: {
        Row: {
          color_accent: string | null
          created_at: string | null
          deleted_at: string | null
          entries: Json[] | null
          id: string
          is_pinned: boolean | null
          last_updated: string | null
          linked_people_ids: string[] | null
          stale_prompt: string | null
          stale_prompt_at: string | null
          status: string | null
          title: string
          user_id: string
        }
        Insert: {
          color_accent?: string | null
          created_at?: string | null
          deleted_at?: string | null
          entries?: Json[] | null
          id?: string
          is_pinned?: boolean | null
          last_updated?: string | null
          linked_people_ids?: string[] | null
          stale_prompt?: string | null
          stale_prompt_at?: string | null
          status?: string | null
          title: string
          user_id: string
        }
        Update: {
          color_accent?: string | null
          created_at?: string | null
          deleted_at?: string | null
          entries?: Json[] | null
          id?: string
          is_pinned?: boolean | null
          last_updated?: string | null
          linked_people_ids?: string[] | null
          stale_prompt?: string | null
          stale_prompt_at?: string | null
          status?: string | null
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      user_settings: {
        Row: {
          ambient_bg: boolean | null
          auto_archive_days: number | null
          auto_snooze: boolean | null
          auto_start_breaks: boolean | null
          avatar_color: string | null
          color_mode: string | null
          created_at: string | null
          daily_briefing: boolean | null
          daily_capacity_minutes: number | null
          default_view: string | null
          digest_enabled: boolean | null
          display_name: string | null
          do_categories: string[] | null
          do_category_colors: Json | null
          explore_custom_types: string[] | null
          last_evening_ritual_date: string | null
          last_ritual_date: string | null
          location_detection: boolean | null
          long_break_duration: number | null
          nlp_date_parsing: boolean | null
          notif_1h: boolean | null
          notif_24h: boolean | null
          notif_6h: boolean | null
          notif_72h: boolean | null
          notif_briefing: boolean | null
          notif_digest: boolean | null
          notif_overdue: boolean | null
          notif_stale_threads: boolean | null
          notifications_enabled: boolean | null
          nudge_time: string | null
          ollama_enabled: boolean | null
          ollama_url: string | null
          onboarding_complete: boolean | null
          people_categories: Json | null
          pomodoro_duration: number | null
          pomodoro_long_break_interval: number | null
          pomodoro_sound: boolean | null
          pomodoros_completed: number | null
          primary_struggles: string[] | null
          quiet_end: string | null
          quiet_start: string | null
          reduce_motion: boolean | null
          relationship_colors: Json | null
          ritual_streak: number | null
          routing_confidence: string | null
          short_break_duration: number | null
          shutdown_time: string | null
          smart_routing_enabled: boolean | null
          theme: string | null
          timezone: string | null
          user_id: string
        }
        Insert: {
          ambient_bg?: boolean | null
          auto_archive_days?: number | null
          auto_snooze?: boolean | null
          auto_start_breaks?: boolean | null
          avatar_color?: string | null
          color_mode?: string | null
          created_at?: string | null
          daily_briefing?: boolean | null
          daily_capacity_minutes?: number | null
          default_view?: string | null
          digest_enabled?: boolean | null
          display_name?: string | null
          do_categories?: string[] | null
          do_category_colors?: Json | null
          explore_custom_types?: string[] | null
          last_evening_ritual_date?: string | null
          last_ritual_date?: string | null
          location_detection?: boolean | null
          long_break_duration?: number | null
          nlp_date_parsing?: boolean | null
          notif_1h?: boolean | null
          notif_24h?: boolean | null
          notif_6h?: boolean | null
          notif_72h?: boolean | null
          notif_briefing?: boolean | null
          notif_digest?: boolean | null
          notif_overdue?: boolean | null
          notif_stale_threads?: boolean | null
          notifications_enabled?: boolean | null
          nudge_time?: string | null
          ollama_enabled?: boolean | null
          ollama_url?: string | null
          onboarding_complete?: boolean | null
          people_categories?: Json | null
          pomodoro_duration?: number | null
          pomodoro_long_break_interval?: number | null
          pomodoro_sound?: boolean | null
          pomodoros_completed?: number | null
          primary_struggles?: string[] | null
          quiet_end?: string | null
          quiet_start?: string | null
          reduce_motion?: boolean | null
          relationship_colors?: Json | null
          ritual_streak?: number | null
          routing_confidence?: string | null
          short_break_duration?: number | null
          shutdown_time?: string | null
          smart_routing_enabled?: boolean | null
          theme?: string | null
          timezone?: string | null
          user_id: string
        }
        Update: {
          ambient_bg?: boolean | null
          auto_archive_days?: number | null
          auto_snooze?: boolean | null
          auto_start_breaks?: boolean | null
          avatar_color?: string | null
          color_mode?: string | null
          created_at?: string | null
          daily_briefing?: boolean | null
          daily_capacity_minutes?: number | null
          default_view?: string | null
          digest_enabled?: boolean | null
          display_name?: string | null
          do_categories?: string[] | null
          do_category_colors?: Json | null
          explore_custom_types?: string[] | null
          last_evening_ritual_date?: string | null
          last_ritual_date?: string | null
          location_detection?: boolean | null
          long_break_duration?: number | null
          nlp_date_parsing?: boolean | null
          notif_1h?: boolean | null
          notif_24h?: boolean | null
          notif_6h?: boolean | null
          notif_72h?: boolean | null
          notif_briefing?: boolean | null
          notif_digest?: boolean | null
          notif_overdue?: boolean | null
          notif_stale_threads?: boolean | null
          notifications_enabled?: boolean | null
          nudge_time?: string | null
          ollama_enabled?: boolean | null
          ollama_url?: string | null
          onboarding_complete?: boolean | null
          people_categories?: Json | null
          pomodoro_duration?: number | null
          pomodoro_long_break_interval?: number | null
          pomodoro_sound?: boolean | null
          pomodoros_completed?: number | null
          primary_struggles?: string[] | null
          quiet_end?: string | null
          quiet_start?: string | null
          reduce_motion?: boolean | null
          relationship_colors?: Json | null
          ritual_streak?: number | null
          routing_confidence?: string | null
          short_break_duration?: number | null
          shutdown_time?: string | null
          smart_routing_enabled?: boolean | null
          theme?: string | null
          timezone?: string | null
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      rename_category: {
        Args: {
          p_categories_key: string
          p_colors_key: string
          p_new_category: string
          p_old_category: string
        }
        Returns: undefined
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
