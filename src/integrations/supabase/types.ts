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
      animal_events: {
        Row: {
          animal_id: string
          cost: number | null
          created_at: string
          data: Json
          description: string | null
          event_date: string
          event_type: string
          id: string
          next_due_date: string | null
          title: string
          user_id: string
        }
        Insert: {
          animal_id: string
          cost?: number | null
          created_at?: string
          data?: Json
          description?: string | null
          event_date?: string
          event_type: string
          id?: string
          next_due_date?: string | null
          title: string
          user_id: string
        }
        Update: {
          animal_id?: string
          cost?: number | null
          created_at?: string
          data?: Json
          description?: string | null
          event_date?: string
          event_type?: string
          id?: string
          next_due_date?: string | null
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "animal_events_animal_id_fkey"
            columns: ["animal_id"]
            isOneToOne: false
            referencedRelation: "animals"
            referencedColumns: ["id"]
          },
        ]
      }
      animals: {
        Row: {
          birth_date: string | null
          breed: string | null
          created_at: string
          death_date: string | null
          death_reason: string | null
          father_id: string | null
          id: string
          identifier: string | null
          lote: string | null
          mother_id: string | null
          notes: string | null
          origin: string | null
          sex: string | null
          status: string
          type: string
          updated_at: string
          user_id: string
          weight_kg: number | null
        }
        Insert: {
          birth_date?: string | null
          breed?: string | null
          created_at?: string
          death_date?: string | null
          death_reason?: string | null
          father_id?: string | null
          id?: string
          identifier?: string | null
          lote?: string | null
          mother_id?: string | null
          notes?: string | null
          origin?: string | null
          sex?: string | null
          status?: string
          type: string
          updated_at?: string
          user_id: string
          weight_kg?: number | null
        }
        Update: {
          birth_date?: string | null
          breed?: string | null
          created_at?: string
          death_date?: string | null
          death_reason?: string | null
          father_id?: string | null
          id?: string
          identifier?: string | null
          lote?: string | null
          mother_id?: string | null
          notes?: string | null
          origin?: string | null
          sex?: string | null
          status?: string
          type?: string
          updated_at?: string
          user_id?: string
          weight_kg?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "animals_father_id_fkey"
            columns: ["father_id"]
            isOneToOne: false
            referencedRelation: "animals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "animals_mother_id_fkey"
            columns: ["mother_id"]
            isOneToOne: false
            referencedRelation: "animals"
            referencedColumns: ["id"]
          },
        ]
      }
      market_prices: {
        Row: {
          created_at: string
          id: string
          price: number
          product: string
          reference_date: string
          region: string
          unit: string
          variation: number | null
        }
        Insert: {
          created_at?: string
          id?: string
          price: number
          product: string
          reference_date?: string
          region: string
          unit: string
          variation?: number | null
        }
        Update: {
          created_at?: string
          id?: string
          price?: number
          product?: string
          reference_date?: string
          region?: string
          unit?: string
          variation?: number | null
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount: number
          created_at: string
          id: string
          method: string
          paid_at: string
          status: string
          user_id: string
        }
        Insert: {
          amount?: number
          created_at?: string
          id?: string
          method: string
          paid_at?: string
          status?: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          method?: string
          paid_at?: string
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          farm_name: string | null
          full_name: string | null
          id: string
          region: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          farm_name?: string | null
          full_name?: string | null
          id: string
          region?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          farm_name?: string | null
          full_name?: string | null
          id?: string
          region?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      promotions: {
        Row: {
          active: boolean
          created_at: string
          discount_type: string
          discount_value: number
          ends_at: string
          id: string
          name: string
          plans: string[]
          starts_at: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          discount_type: string
          discount_value: number
          ends_at: string
          id?: string
          name: string
          plans?: string[]
          starts_at?: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          discount_type?: string
          discount_value?: number
          ends_at?: string
          id?: string
          name?: string
          plans?: string[]
          starts_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      sales: {
        Row: {
          buyer: string | null
          category: string
          created_at: string
          id: string
          item: string
          notes: string | null
          quantity: number
          sale_date: string
          total: number
          unit: string | null
          unit_price: number
          user_id: string
        }
        Insert: {
          buyer?: string | null
          category: string
          created_at?: string
          id?: string
          item: string
          notes?: string | null
          quantity?: number
          sale_date?: string
          total?: number
          unit?: string | null
          unit_price?: number
          user_id: string
        }
        Update: {
          buyer?: string | null
          category?: string
          created_at?: string
          id?: string
          item?: string
          notes?: string | null
          quantity?: number
          sale_date?: string
          total?: number
          unit?: string | null
          unit_price?: number
          user_id?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          amount: number
          auto_renew: boolean
          cancelled_at: string | null
          card_fingerprint: string | null
          card_last4: string | null
          created_at: string
          expires_at: string | null
          id: string
          payment_method: string | null
          plan: string
          started_at: string | null
          status: string
          trial_ends_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          amount?: number
          auto_renew?: boolean
          cancelled_at?: string | null
          card_fingerprint?: string | null
          card_last4?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          payment_method?: string | null
          plan?: string
          started_at?: string | null
          status?: string
          trial_ends_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          auto_renew?: boolean
          cancelled_at?: string | null
          card_fingerprint?: string | null
          card_last4?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          payment_method?: string | null
          plan?: string
          started_at?: string | null
          status?: string
          trial_ends_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      trial_usage: {
        Row: {
          card_fingerprint: string
          created_at: string
          email: string
          id: string
          user_id: string
        }
        Insert: {
          card_fingerprint: string
          created_at?: string
          email: string
          id?: string
          user_id: string
        }
        Update: {
          card_fingerprint?: string
          created_at?: string
          email?: string
          id?: string
          user_id?: string
        }
        Relationships: []
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
      app_role: "admin" | "user"
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
      app_role: ["admin", "user"],
    },
  },
} as const
