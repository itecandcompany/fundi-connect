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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      fundis: {
        Row: {
          bio: string | null
          current_lat: number | null
          current_lng: number | null
          hourly_rate: number
          id: string
          is_available: boolean
          rating: number
          service: Database["public"]["Enums"]["service_type"]
          total_jobs: number
          updated_at: string
        }
        Insert: {
          bio?: string | null
          current_lat?: number | null
          current_lng?: number | null
          hourly_rate?: number
          id: string
          is_available?: boolean
          rating?: number
          service: Database["public"]["Enums"]["service_type"]
          total_jobs?: number
          updated_at?: string
        }
        Update: {
          bio?: string | null
          current_lat?: number | null
          current_lng?: number | null
          hourly_rate?: number
          id?: string
          is_available?: boolean
          rating?: number
          service?: Database["public"]["Enums"]["service_type"]
          total_jobs?: number
          updated_at?: string
        }
        Relationships: []
      }
      job_locations: {
        Row: {
          created_at: string
          id: string
          job_id: string
          lat: number
          lng: number
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          job_id: string
          lat: number
          lng: number
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          job_id?: string
          lat?: number
          lng?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_locations_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      job_messages: {
        Row: {
          body: string
          created_at: string
          id: string
          job_id: string
          sender_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          job_id: string
          sender_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          job_id?: string
          sender_id?: string
        }
        Relationships: []
      }
      job_quotes: {
        Row: {
          created_at: string
          fundi_id: string
          id: string
          job_id: string
          note: string | null
          price: number
          status: string
        }
        Insert: {
          created_at?: string
          fundi_id: string
          id?: string
          job_id: string
          note?: string | null
          price: number
          status?: string
        }
        Update: {
          created_at?: string
          fundi_id?: string
          id?: string
          job_id?: string
          note?: string | null
          price?: number
          status?: string
        }
        Relationships: []
      }
      jobs: {
        Row: {
          after_photos: string[]
          agreed_price: number | null
          arrived_at: string | null
          before_photos: string[]
          cancellation_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          client_address: string | null
          client_id: string
          client_lat: number
          client_lng: number
          commission: number
          completed_at: string | null
          created_at: string
          description: string | null
          direction: Database["public"]["Enums"]["job_direction"]
          fundi_id: string | null
          fundi_lat: number | null
          fundi_lng: number | null
          id: string
          job_photos: string[]
          price: number
          problem_description: string | null
          problem_title: string | null
          service: Database["public"]["Enums"]["service_type"]
          signature_url: string | null
          started_at: string | null
          status: Database["public"]["Enums"]["job_status"]
          updated_at: string
        }
        Insert: {
          after_photos?: string[]
          agreed_price?: number | null
          arrived_at?: string | null
          before_photos?: string[]
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          client_address?: string | null
          client_id: string
          client_lat: number
          client_lng: number
          commission: number
          completed_at?: string | null
          created_at?: string
          description?: string | null
          direction?: Database["public"]["Enums"]["job_direction"]
          fundi_id?: string | null
          fundi_lat?: number | null
          fundi_lng?: number | null
          id?: string
          job_photos?: string[]
          price: number
          problem_description?: string | null
          problem_title?: string | null
          service: Database["public"]["Enums"]["service_type"]
          signature_url?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["job_status"]
          updated_at?: string
        }
        Update: {
          after_photos?: string[]
          agreed_price?: number | null
          arrived_at?: string | null
          before_photos?: string[]
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          client_address?: string | null
          client_id?: string
          client_lat?: number
          client_lng?: number
          commission?: number
          completed_at?: string | null
          created_at?: string
          description?: string | null
          direction?: Database["public"]["Enums"]["job_direction"]
          fundi_id?: string | null
          fundi_lat?: number | null
          fundi_lng?: number | null
          id?: string
          job_photos?: string[]
          price?: number
          problem_description?: string | null
          problem_title?: string | null
          service?: Database["public"]["Enums"]["service_type"]
          signature_url?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["job_status"]
          updated_at?: string
        }
        Relationships: []
      }
      problem_templates: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          service: Database["public"]["Enums"]["service_type"]
          suggested_price: number
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          service: Database["public"]["Enums"]["service_type"]
          suggested_price?: number
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          service?: Database["public"]["Enums"]["service_type"]
          suggested_price?: number
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string
          id: string
          phone: string | null
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name: string
          id: string
          phone?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string
          id?: string
          phone?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Relationships: []
      }
      ratings: {
        Row: {
          client_id: string
          created_at: string
          fundi_id: string
          id: string
          job_id: string
          review: string | null
          stars: number
        }
        Insert: {
          client_id: string
          created_at?: string
          fundi_id: string
          id?: string
          job_id: string
          review?: string | null
          stars: number
        }
        Update: {
          client_id?: string
          created_at?: string
          fundi_id?: string
          id?: string
          job_id?: string
          review?: string | null
          stars?: number
        }
        Relationships: [
          {
            foreignKeyName: "ratings_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: true
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          amount: number
          commission: number
          created_at: string
          fundi_earnings: number
          fundi_id: string
          id: string
          job_id: string
        }
        Insert: {
          amount: number
          commission: number
          created_at?: string
          fundi_earnings: number
          fundi_id: string
          id?: string
          job_id: string
        }
        Update: {
          amount?: number
          commission?: number
          created_at?: string
          fundi_earnings?: number
          fundi_id?: string
          id?: string
          job_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
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
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "client" | "fundi" | "admin"
      job_direction: "fundi_to_client" | "client_to_fundi"
      job_status:
        | "searching"
        | "quoting"
        | "accepted"
        | "on_the_way"
        | "arrived"
        | "in_progress"
        | "completed"
        | "cancelled"
      service_type: "plumber" | "electrician" | "carpenter" | "mechanic"
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
      app_role: ["client", "fundi", "admin"],
      job_direction: ["fundi_to_client", "client_to_fundi"],
      job_status: [
        "searching",
        "quoting",
        "accepted",
        "on_the_way",
        "arrived",
        "in_progress",
        "completed",
        "cancelled",
      ],
      service_type: ["plumber", "electrician", "carpenter", "mechanic"],
    },
  },
} as const
