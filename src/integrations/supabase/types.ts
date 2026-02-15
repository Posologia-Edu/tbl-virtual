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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      application_questions: {
        Row: {
          correct_answer: string | null
          id: string
          option_a: string | null
          option_b: string | null
          option_c: string | null
          option_d: string | null
          question_text: string
          quiz_id: string | null
          room_id: string | null
          sort_order: number
        }
        Insert: {
          correct_answer?: string | null
          id?: string
          option_a?: string | null
          option_b?: string | null
          option_c?: string | null
          option_d?: string | null
          question_text: string
          quiz_id?: string | null
          room_id?: string | null
          sort_order?: number
        }
        Update: {
          correct_answer?: string | null
          id?: string
          option_a?: string | null
          option_b?: string | null
          option_c?: string | null
          option_d?: string | null
          question_text?: string
          quiz_id?: string | null
          room_id?: string | null
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "application_questions_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "quizzes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "application_questions_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      application_responses: {
        Row: {
          id: string
          question_id: string
          room_id: string
          selected_option: string | null
          submitted_at: string
          submitted_by: string
          team_id: string
        }
        Insert: {
          id?: string
          question_id: string
          room_id: string
          selected_option?: string | null
          submitted_at?: string
          submitted_by: string
          team_id: string
        }
        Update: {
          id?: string
          question_id?: string
          room_id?: string
          selected_option?: string | null
          submitted_at?: string
          submitted_by?: string
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "application_responses_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "application_questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "application_responses_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "application_responses_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      irat_responses: {
        Row: {
          id: string
          is_correct: boolean
          points_a: number
          points_b: number
          points_c: number
          points_d: number
          question_id: string
          room_id: string
          score: number
          selected_option: string | null
          student_id: string
          submitted_at: string
        }
        Insert: {
          id?: string
          is_correct?: boolean
          points_a?: number
          points_b?: number
          points_c?: number
          points_d?: number
          question_id: string
          room_id: string
          score?: number
          selected_option?: string | null
          student_id: string
          submitted_at?: string
        }
        Update: {
          id?: string
          is_correct?: boolean
          points_a?: number
          points_b?: number
          points_c?: number
          points_d?: number
          question_id?: string
          room_id?: string
          score?: number
          selected_option?: string | null
          student_id?: string
          submitted_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "irat_responses_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "irat_responses_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          country: string | null
          cpf: string | null
          created_at: string
          email: string | null
          full_name: string
          gender: string | null
          id: string
          institution: string | null
          institution_city: string | null
          is_approved: boolean
          is_blocked: boolean
          neighborhood: string | null
          nickname: string | null
          street: string | null
          street_number: string | null
          zip_code: string | null
        }
        Insert: {
          country?: string | null
          cpf?: string | null
          created_at?: string
          email?: string | null
          full_name: string
          gender?: string | null
          id: string
          institution?: string | null
          institution_city?: string | null
          is_approved?: boolean
          is_blocked?: boolean
          neighborhood?: string | null
          nickname?: string | null
          street?: string | null
          street_number?: string | null
          zip_code?: string | null
        }
        Update: {
          country?: string | null
          cpf?: string | null
          created_at?: string
          email?: string | null
          full_name?: string
          gender?: string | null
          id?: string
          institution?: string | null
          institution_city?: string | null
          is_approved?: boolean
          is_blocked?: boolean
          neighborhood?: string | null
          nickname?: string | null
          street?: string | null
          street_number?: string | null
          zip_code?: string | null
        }
        Relationships: []
      }
      questions: {
        Row: {
          correct_option: string
          id: string
          option_a: string
          option_b: string
          option_c: string
          option_d: string
          question_text: string
          quiz_id: string
          sort_order: number
        }
        Insert: {
          correct_option: string
          id?: string
          option_a: string
          option_b: string
          option_c: string
          option_d: string
          question_text: string
          quiz_id: string
          sort_order?: number
        }
        Update: {
          correct_option?: string
          id?: string
          option_a?: string
          option_b?: string
          option_c?: string
          option_d?: string
          question_text?: string
          quiz_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "questions_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "quizzes"
            referencedColumns: ["id"]
          },
        ]
      }
      quizzes: {
        Row: {
          created_at: string
          id: string
          teacher_id: string
          title: string
        }
        Insert: {
          created_at?: string
          id?: string
          teacher_id: string
          title: string
        }
        Update: {
          created_at?: string
          id?: string
          teacher_id?: string
          title?: string
        }
        Relationships: []
      }
      room_participants: {
        Row: {
          id: string
          joined_at: string
          participant_code: string
          room_id: string
          user_id: string
        }
        Insert: {
          id?: string
          joined_at?: string
          participant_code: string
          room_id: string
          user_id: string
        }
        Update: {
          id?: string
          joined_at?: string
          participant_code?: string
          room_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "room_participants_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "room_participants_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      rooms: {
        Row: {
          application_pct: number | null
          code: string
          created_at: string
          current_stage: Database["public"]["Enums"]["room_stage"]
          id: string
          individual_pct: number | null
          irat_end_time: string | null
          is_active: boolean
          max_grade: number | null
          name: string
          quiz_id: string | null
          show_answers_in_report: boolean | null
          show_individual_in_team: boolean | null
          teacher_id: string
          team_pct: number | null
        }
        Insert: {
          application_pct?: number | null
          code: string
          created_at?: string
          current_stage?: Database["public"]["Enums"]["room_stage"]
          id?: string
          individual_pct?: number | null
          irat_end_time?: string | null
          is_active?: boolean
          max_grade?: number | null
          name: string
          quiz_id?: string | null
          show_answers_in_report?: boolean | null
          show_individual_in_team?: boolean | null
          teacher_id: string
          team_pct?: number | null
        }
        Update: {
          application_pct?: number | null
          code?: string
          created_at?: string
          current_stage?: Database["public"]["Enums"]["room_stage"]
          id?: string
          individual_pct?: number | null
          irat_end_time?: string | null
          is_active?: boolean
          max_grade?: number | null
          name?: string
          quiz_id?: string | null
          show_answers_in_report?: boolean | null
          show_individual_in_team?: boolean | null
          teacher_id?: string
          team_pct?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "rooms_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "quizzes"
            referencedColumns: ["id"]
          },
        ]
      }
      team_members: {
        Row: {
          id: string
          joined_at: string
          room_id: string
          team_id: string
          user_id: string
        }
        Insert: {
          id?: string
          joined_at?: string
          room_id: string
          team_id: string
          user_id: string
        }
        Update: {
          id?: string
          joined_at?: string
          room_id?: string
          team_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_members_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_members_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          id: string
          name: string
          room_id: string
          trat_started_at: string | null
        }
        Insert: {
          id?: string
          name: string
          room_id: string
          trat_started_at?: string | null
        }
        Update: {
          id?: string
          name?: string
          room_id?: string
          trat_started_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "teams_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      trat_attempts: {
        Row: {
          attempt_number: number
          id: string
          is_correct: boolean
          question_id: string
          room_id: string
          selected_option: string
          submitted_at: string
          submitted_by: string
          team_id: string
        }
        Insert: {
          attempt_number: number
          id?: string
          is_correct?: boolean
          question_id: string
          room_id: string
          selected_option: string
          submitted_at?: string
          submitted_by: string
          team_id: string
        }
        Update: {
          attempt_number?: number
          id?: string
          is_correct?: boolean
          question_id?: string
          room_id?: string
          selected_option?: string
          submitted_at?: string
          submitted_by?: string
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trat_attempts_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trat_attempts_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trat_attempts_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      generate_participant_code: {
        Args: { p_room_id: string }
        Returns: string
      }
      generate_room_code: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      is_room_participant: {
        Args: { p_room_id: string; p_user_id: string }
        Returns: boolean
      }
      is_team_member: {
        Args: { p_team_id: string; p_user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "teacher" | "student" | "admin"
      room_stage:
        | "waiting"
        | "irat_open"
        | "trat_open"
        | "application_open"
        | "finished"
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
    Enums: {
      app_role: ["teacher", "student", "admin"],
      room_stage: [
        "waiting",
        "irat_open",
        "trat_open",
        "application_open",
        "finished",
      ],
    },
  },
} as const
