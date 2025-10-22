// TypeScript definitions for Supabase database schema
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Database schema types for DeGiro portfolio tracker
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      account_activities: {
        Row: {
          created_at: string
          datum: string
          fx: string
          id: string
          is_excluded: boolean
          isin: string
          mutatie: number
          mutatie_currency: string
          omschrijving: string
          order_id: string
          product: string
          saldo: number
          saldo_currency: string
          tijd: string
          user_id: string
          valutadatum: string
        }
        Insert: {
          created_at?: string
          datum: string
          fx: string
          id?: string
          is_excluded?: boolean
          isin: string
          mutatie: number
          mutatie_currency: string
          omschrijving: string
          order_id: string
          product: string
          saldo: number
          saldo_currency: string
          tijd: string
          user_id: string
          valutadatum: string
        }
        Update: {
          created_at?: string
          datum?: string
          fx?: string
          id?: string
          is_excluded?: boolean
          isin?: string
          mutatie?: number
          mutatie_currency?: string
          omschrijving?: string
          order_id?: string
          product?: string
          saldo?: number
          saldo_currency?: string
          tijd?: string
          user_id?: string
          valutadatum?: string
        }
        Relationships: []
      }
      current_prices: {
        Row: {
          created_at: string
          current_price: number
          id: string
          isin: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          current_price: number
          id?: string
          isin: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          current_price?: number
          id?: string
          isin?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      dividends: {
        Row: {
          amount: number
          created_at: string
          date: string
          description: string | null
          id: string
          isin: string | null
          product: string | null
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          date: string
          description?: string | null
          id?: string
          isin?: string | null
          product?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          date?: string
          description?: string | null
          id?: string
          isin?: string | null
          product?: string | null
          user_id?: string
        }
        Relationships: []
      }
      portfolio_snapshots: {
        Row: {
          borrowed_amount: number
          created_at: string
          id: string
          net_value: number
          portfolio_value: number
          timestamp: string
          user_id: string
        }
        Insert: {
          borrowed_amount?: number
          created_at?: string
          id?: string
          net_value: number
          portfolio_value: number
          timestamp?: string
          user_id: string
        }
        Update: {
          borrowed_amount?: number
          created_at?: string
          id?: string
          net_value?: number
          portfolio_value?: number
          timestamp?: string
          user_id?: string
        }
        Relationships: []
      }
      price_history: {
        Row: {
          created_at: string
          id: string
          isin: string
          price: number
          product: string
          timestamp: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          isin: string
          price: number
          product: string
          timestamp?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          isin?: string
          price?: number
          product?: string
          timestamp?: string
          user_id?: string
        }
        Relationships: []
      }
      transactions: {
        Row: {
          aantal: number
          beurs: string
          created_at: string
          datum: string
          id: string
          is_excluded: boolean
          isin: string
          koers: number
          koers_currency: string
          lokale_waarde: number
          lokale_waarde_currency: string
          order_id: string
          product: string
          tijd: string
          totaal: number
          totaal_currency: string
          transactiekosten: number
          transactiekosten_currency: string
          uitvoeringsplaats: string
          user_id: string
          waarde: number
          waarde_currency: string
          wisselkoers: number
        }
        Insert: {
          aantal: number
          beurs: string
          created_at?: string
          datum: string
          id?: string
          is_excluded?: boolean
          isin: string
          koers: number
          koers_currency: string
          lokale_waarde: number
          lokale_waarde_currency: string
          order_id: string
          product: string
          tijd: string
          totaal: number
          totaal_currency: string
          transactiekosten: number
          transactiekosten_currency: string
          uitvoeringsplaats: string
          user_id: string
          waarde: number
          waarde_currency: string
          wisselkoers: number
        }
        Update: {
          aantal?: number
          beurs?: string
          created_at?: string
          datum?: string
          id?: string
          is_excluded?: boolean
          isin?: string
          koers?: number
          koers_currency?: string
          lokale_waarde?: number
          lokale_waarde_currency?: string
          order_id?: string
          product?: string
          tijd?: string
          totaal?: number
          totaal_currency?: string
          transactiekosten?: number
          transactiekosten_currency?: string
          uitvoeringsplaats?: string
          user_id?: string
          waarde?: number
          waarde_currency?: string
          wisselkoers?: number
        }
        Relationships: []
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
