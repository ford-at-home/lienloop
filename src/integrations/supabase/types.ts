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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      lienloop_ai_calls: {
        Row: {
          call_index: number
          created_at: string
          error: string | null
          gateway_run_id: string | null
          id: string
          input_tokens: number
          model: string
          outcome: string
          output_tokens: number
          owner_id: string
          provider: string
          response_text: string | null
          run_id: string
          state_version: number
          stop_reason: string | null
          tool_calls: Json
        }
        Insert: {
          call_index: number
          created_at?: string
          error?: string | null
          gateway_run_id?: string | null
          id?: string
          input_tokens?: number
          model: string
          outcome: string
          output_tokens?: number
          owner_id: string
          provider: string
          response_text?: string | null
          run_id: string
          state_version: number
          stop_reason?: string | null
          tool_calls?: Json
        }
        Update: {
          call_index?: number
          created_at?: string
          error?: string | null
          gateway_run_id?: string | null
          id?: string
          input_tokens?: number
          model?: string
          outcome?: string
          output_tokens?: number
          owner_id?: string
          provider?: string
          response_text?: string | null
          run_id?: string
          state_version?: number
          stop_reason?: string | null
          tool_calls?: Json
        }
        Relationships: [
          {
            foreignKeyName: "lienloop_ai_calls_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "lienloop_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      lienloop_decisions: {
        Row: {
          approval_id: string
          created_at: string
          decision: string
          id: string
          owner_id: string
          revision: number
          run_id: string
        }
        Insert: {
          approval_id: string
          created_at?: string
          decision: string
          id?: string
          owner_id: string
          revision: number
          run_id: string
        }
        Update: {
          approval_id?: string
          created_at?: string
          decision?: string
          id?: string
          owner_id?: string
          revision?: number
          run_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lienloop_decisions_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "lienloop_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      lienloop_postings: {
        Row: {
          amount_cents: number | null
          approval_id: string
          created_at: string
          id: string
          kind: string
          owner_id: string
          revision: number
          run_id: string
        }
        Insert: {
          amount_cents?: number | null
          approval_id: string
          created_at?: string
          id?: string
          kind: string
          owner_id: string
          revision: number
          run_id: string
        }
        Update: {
          amount_cents?: number | null
          approval_id?: string
          created_at?: string
          id?: string
          kind?: string
          owner_id?: string
          revision?: number
          run_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lienloop_postings_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "lienloop_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      lienloop_runs: {
        Row: {
          created_at: string
          id: string
          input_tokens: number
          model_call_limit: number
          model_calls: number
          output_tokens: number
          owner_id: string
          scenario: string
          state: Json
          updated_at: string
          version: number
        }
        Insert: {
          created_at?: string
          id?: string
          input_tokens?: number
          model_call_limit?: number
          model_calls?: number
          output_tokens?: number
          owner_id: string
          scenario: string
          state: Json
          updated_at?: string
          version?: number
        }
        Update: {
          created_at?: string
          id?: string
          input_tokens?: number
          model_call_limit?: number
          model_calls?: number
          output_tokens?: number
          owner_id?: string
          scenario?: string
          state?: Json
          updated_at?: string
          version?: number
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      lienloop_commit: {
        Args: {
          p_decision?: Json
          p_expected: number
          p_owner: string
          p_postings?: Json
          p_run: string
          p_state: Json
        }
        Returns: number
      }
      lienloop_reserve_model_call: {
        Args: { p_daily_limit: number; p_owner: string; p_run: string }
        Returns: number
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
