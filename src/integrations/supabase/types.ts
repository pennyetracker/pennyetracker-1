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
      app_settings: {
        Row: {
          id: string
          key: string
          updated_at: string
          updated_by: string | null
          value: string | null
        }
        Insert: {
          id?: string
          key: string
          updated_at?: string
          updated_by?: string | null
          value?: string | null
        }
        Update: {
          id?: string
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: string | null
        }
        Relationships: []
      }
      cash_submissions: {
        Row: {
          amount: number
          created_at: string
          id: string
          notes: string | null
          staff_id: string
          submitted_at: string
          updated_at: string
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          notes?: string | null
          staff_id: string
          submitted_at?: string
          updated_at?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          notes?: string | null
          staff_id?: string
          submitted_at?: string
          updated_at?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: []
      }
      delivery_orders: {
        Row: {
          address: string | null
          amount: number
          cash_submission_id: string | null
          created_at: string
          customer_name: string
          customer_phone: string | null
          delivered_at: string | null
          id: string
          order_number: string
          staff_id: string
          status: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          amount?: number
          cash_submission_id?: string | null
          created_at?: string
          customer_name: string
          customer_phone?: string | null
          delivered_at?: string | null
          id?: string
          order_number: string
          staff_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          amount?: number
          cash_submission_id?: string | null
          created_at?: string
          customer_name?: string
          customer_phone?: string | null
          delivered_at?: string | null
          id?: string
          order_number?: string
          staff_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      delivery_staff: {
        Row: {
          address: string | null
          alt_phone: string | null
          created_at: string
          email: string | null
          full_name: string
          id: string
          latitude: number | null
          license_number: string | null
          location_updated_at: string | null
          longitude: number | null
          phone: string
          status: string
          updated_at: string
          user_id: string | null
          vehicle_number: string | null
          ward_id: string | null
        }
        Insert: {
          address?: string | null
          alt_phone?: string | null
          created_at?: string
          email?: string | null
          full_name: string
          id?: string
          latitude?: number | null
          license_number?: string | null
          location_updated_at?: string | null
          longitude?: number | null
          phone: string
          status?: string
          updated_at?: string
          user_id?: string | null
          vehicle_number?: string | null
          ward_id?: string | null
        }
        Update: {
          address?: string | null
          alt_phone?: string | null
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          latitude?: number | null
          license_number?: string | null
          location_updated_at?: string | null
          longitude?: number | null
          phone?: string
          status?: string
          updated_at?: string
          user_id?: string | null
          vehicle_number?: string | null
          ward_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "delivery_staff_ward_id_fkey"
            columns: ["ward_id"]
            isOneToOne: false
            referencedRelation: "wards"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_staff_panchayaths: {
        Row: {
          created_at: string
          id: string
          panchayath_id: string
          staff_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          panchayath_id: string
          staff_id: string
        }
        Update: {
          created_at?: string
          id?: string
          panchayath_id?: string
          staff_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "delivery_staff_panchayaths_panchayath_id_fkey"
            columns: ["panchayath_id"]
            isOneToOne: false
            referencedRelation: "panchayaths"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_staff_panchayaths_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "delivery_staff"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_staff_wards: {
        Row: {
          created_at: string
          id: string
          staff_id: string
          ward_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          staff_id: string
          ward_id: string
        }
        Update: {
          created_at?: string
          id?: string
          staff_id?: string
          ward_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "delivery_staff_wards_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "delivery_staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_staff_wards_ward_id_fkey"
            columns: ["ward_id"]
            isOneToOne: false
            referencedRelation: "wards"
            referencedColumns: ["id"]
          },
        ]
      }
      districts: {
        Row: {
          created_at: string
          id: string
          name: string
          state_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          state_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          state_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "districts_state_id_fkey"
            columns: ["state_id"]
            isOneToOne: false
            referencedRelation: "states"
            referencedColumns: ["id"]
          },
        ]
      }
      panchayath_connections: {
        Row: {
          created_at: string
          direction: Database["public"]["Enums"]["connection_direction"]
          id: string
          source_panchayath_id: string
          target_panchayath_id: string
        }
        Insert: {
          created_at?: string
          direction: Database["public"]["Enums"]["connection_direction"]
          id?: string
          source_panchayath_id: string
          target_panchayath_id: string
        }
        Update: {
          created_at?: string
          direction?: Database["public"]["Enums"]["connection_direction"]
          id?: string
          source_panchayath_id?: string
          target_panchayath_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "panchayath_connections_source_panchayath_id_fkey"
            columns: ["source_panchayath_id"]
            isOneToOne: false
            referencedRelation: "panchayaths"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "panchayath_connections_target_panchayath_id_fkey"
            columns: ["target_panchayath_id"]
            isOneToOne: false
            referencedRelation: "panchayaths"
            referencedColumns: ["id"]
          },
        ]
      }
      panchayaths: {
        Row: {
          created_at: string
          district_id: string
          id: string
          latitude: number | null
          location_updated_at: string | null
          longitude: number | null
          name: string
        }
        Insert: {
          created_at?: string
          district_id: string
          id?: string
          latitude?: number | null
          location_updated_at?: string | null
          longitude?: number | null
          name: string
        }
        Update: {
          created_at?: string
          district_id?: string
          id?: string
          latitude?: number | null
          location_updated_at?: string | null
          longitude?: number | null
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "panchayaths_district_id_fkey"
            columns: ["district_id"]
            isOneToOne: false
            referencedRelation: "districts"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      states: {
        Row: {
          created_at: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
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
      wallet_transactions: {
        Row: {
          amount: number
          created_at: string
          description: string | null
          id: string
          reference: string | null
          staff_id: string
          type: string
        }
        Insert: {
          amount: number
          created_at?: string
          description?: string | null
          id?: string
          reference?: string | null
          staff_id: string
          type?: string
        }
        Update: {
          amount?: number
          created_at?: string
          description?: string | null
          id?: string
          reference?: string | null
          staff_id?: string
          type?: string
        }
        Relationships: []
      }
      ward_connections: {
        Row: {
          created_at: string
          direction: Database["public"]["Enums"]["connection_direction"]
          id: string
          source_ward_id: string
          target_ward_id: string
        }
        Insert: {
          created_at?: string
          direction: Database["public"]["Enums"]["connection_direction"]
          id?: string
          source_ward_id: string
          target_ward_id: string
        }
        Update: {
          created_at?: string
          direction?: Database["public"]["Enums"]["connection_direction"]
          id?: string
          source_ward_id?: string
          target_ward_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ward_connections_source_ward_id_fkey"
            columns: ["source_ward_id"]
            isOneToOne: false
            referencedRelation: "wards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ward_connections_target_ward_id_fkey"
            columns: ["target_ward_id"]
            isOneToOne: false
            referencedRelation: "wards"
            referencedColumns: ["id"]
          },
        ]
      }
      wards: {
        Row: {
          created_at: string
          id: string
          latitude: number | null
          location_updated_at: string | null
          longitude: number | null
          name: string
          panchayath_id: string
          ward_number: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          latitude?: number | null
          location_updated_at?: string | null
          longitude?: number | null
          name: string
          panchayath_id: string
          ward_number?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          latitude?: number | null
          location_updated_at?: string | null
          longitude?: number | null
          name?: string
          panchayath_id?: string
          ward_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "wards_panchayath_id_fkey"
            columns: ["panchayath_id"]
            isOneToOne: false
            referencedRelation: "panchayaths"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_public_delivery_partners: { Args: never; Returns: Json }
      get_public_google_maps_key: { Args: never; Returns: string }
      get_public_offline_mbtiles_meta: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      opposite_direction: {
        Args: { _dir: Database["public"]["Enums"]["connection_direction"] }
        Returns: Database["public"]["Enums"]["connection_direction"]
      }
      promote_to_super_admin: { Args: { _email: string }; Returns: undefined }
    }
    Enums: {
      app_role: "super_admin" | "admin" | "delivery"
      connection_direction: "north" | "south" | "east" | "west"
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
      app_role: ["super_admin", "admin", "delivery"],
      connection_direction: ["north", "south", "east", "west"],
    },
  },
} as const
