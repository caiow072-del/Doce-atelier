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
      customers: {
        Row: {
          address: string
          created_at: string
          email: string | null
          id: string
          name: string
          notes: string | null
          phone: string
          shop_id: string
          source: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          address: string
          created_at?: string
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          phone: string
          shop_id: string
          source?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          address?: string
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          phone?: string
          shop_id?: string
          source?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      event_occurrences: {
        Row: {
          closed_at: string | null
          created_at: string
          event_id: string
          id: string
          notes: string | null
          occurrence_date: string
          payment_summary: Json | null
          updated_at: string
        }
        Insert: {
          closed_at?: string | null
          created_at?: string
          event_id: string
          id?: string
          notes?: string | null
          occurrence_date: string
          payment_summary?: Json | null
          updated_at?: string
        }
        Update: {
          closed_at?: string | null
          created_at?: string
          event_id?: string
          id?: string
          notes?: string | null
          occurrence_date?: string
          payment_summary?: Json | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_occurrences_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_products: {
        Row: {
          batches: number
          created_at: string
          event_id: string
          id: string
          image_url: string | null
          name: string
          planned_qty: number
          position: number
          recipe_id: string | null
          sale_mode: string
          sold_qty: number
          unit_price: number
          updated_at: string
        }
        Insert: {
          batches?: number
          created_at?: string
          event_id: string
          id?: string
          image_url?: string | null
          name: string
          planned_qty?: number
          position?: number
          recipe_id?: string | null
          sale_mode?: string
          sold_qty?: number
          unit_price?: number
          updated_at?: string
        }
        Update: {
          batches?: number
          created_at?: string
          event_id?: string
          id?: string
          image_url?: string | null
          name?: string
          planned_qty?: number
          position?: number
          recipe_id?: string | null
          sale_mode?: string
          sold_qty?: number
          unit_price?: number
          updated_at?: string
        }
        Relationships: []
      }
      event_recipes: {
        Row: {
          batches: number
          event_id: string
          id: string
          recipe_id: string
        }
        Insert: {
          batches?: number
          event_id: string
          id?: string
          recipe_id: string
        }
        Update: {
          batches?: number
          event_id?: string
          id?: string
          recipe_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_recipes_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_recipes_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
        ]
      }
      event_tasks: {
        Row: {
          created_at: string
          day_key: string
          done: boolean
          event_id: string
          id: string
          position: number
          task: string
        }
        Insert: {
          created_at?: string
          day_key: string
          done?: boolean
          event_id: string
          id?: string
          position?: number
          task: string
        }
        Update: {
          created_at?: string
          day_key?: string
          done?: boolean
          event_id?: string
          id?: string
          position?: number
          task?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_tasks_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_types: {
        Row: {
          color: string | null
          created_at: string
          icon: string | null
          id: string
          kind: string
          name: string
          shop_id: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          icon?: string | null
          id?: string
          kind?: string
          name: string
          shop_id: string
        }
        Update: {
          color?: string | null
          created_at?: string
          icon?: string | null
          id?: string
          kind?: string
          name?: string
          shop_id?: string
        }
        Relationships: []
      }
      events: {
        Row: {
          closed_at: string | null
          created_at: string
          customer_name: string | null
          date: string
          day_of_month: number | null
          event_type_id: string | null
          fee: number
          guests: number | null
          id: string
          location: string | null
          main_flavor: string | null
          name: string
          notes: string | null
          opening_cash: number
          parent_event_id: string | null
          payment_summary: Json | null
          recurrence: string
          recurrence_until: string | null
          shop_id: string
          start_time: string | null
          updated_at: string
          weekday: number | null
        }
        Insert: {
          closed_at?: string | null
          created_at?: string
          customer_name?: string | null
          date: string
          day_of_month?: number | null
          event_type_id?: string | null
          fee?: number
          guests?: number | null
          id?: string
          location?: string | null
          main_flavor?: string | null
          name: string
          notes?: string | null
          opening_cash?: number
          parent_event_id?: string | null
          payment_summary?: Json | null
          recurrence?: string
          recurrence_until?: string | null
          shop_id: string
          start_time?: string | null
          updated_at?: string
          weekday?: number | null
        }
        Update: {
          closed_at?: string | null
          created_at?: string
          customer_name?: string | null
          date?: string
          day_of_month?: number | null
          event_type_id?: string | null
          fee?: number
          guests?: number | null
          id?: string
          location?: string | null
          main_flavor?: string | null
          name?: string
          notes?: string | null
          opening_cash?: number
          parent_event_id?: string | null
          payment_summary?: Json | null
          recurrence?: string
          recurrence_until?: string | null
          shop_id?: string
          start_time?: string | null
          updated_at?: string
          weekday?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "events_event_type_id_fkey"
            columns: ["event_type_id"]
            isOneToOne: false
            referencedRelation: "event_types"
            referencedColumns: ["id"]
          },
        ]
      }
      ingredients: {
        Row: {
          created_at: string
          id: string
          name: string
          package_qty: number
          price_paid: number
          shop_id: string
          stock_qty: number
          unit: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          package_qty: number
          price_paid: number
          shop_id: string
          stock_qty?: number
          unit: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          package_qty?: number
          price_paid?: number
          shop_id?: string
          stock_qty?: number
          unit?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ingredients_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          created_at: string
          customer_id: string | null
          customer_name: string
          customer_phone: string | null
          delivery_address: string | null
          delivery_at: string
          delivery_method: string
          deposit_paid: number
          description: string
          id: string
          items: Json | null
          notes: string | null
          recipe_id: string | null
          servings: number | null
          shop_id: string
          source: string
          status: Database["public"]["Enums"]["order_status"]
          total_price: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer_id?: string | null
          customer_name: string
          customer_phone?: string | null
          delivery_address?: string | null
          delivery_at: string
          delivery_method?: string
          deposit_paid?: number
          description: string
          id?: string
          items?: Json | null
          notes?: string | null
          recipe_id?: string | null
          servings?: number | null
          shop_id: string
          source?: string
          status?: Database["public"]["Enums"]["order_status"]
          total_price?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer_id?: string | null
          customer_name?: string
          customer_phone?: string | null
          delivery_address?: string | null
          delivery_at?: string
          delivery_method?: string
          deposit_paid?: number
          description?: string
          id?: string
          items?: Json | null
          notes?: string | null
          recipe_id?: string | null
          servings?: number | null
          shop_id?: string
          source?: string
          status?: Database["public"]["Enums"]["order_status"]
          total_price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
        ]
      }
      pdv_products: {
        Row: {
          active: boolean
          created_at: string
          icon: string | null
          id: string
          image_url: string | null
          label: string
          position: number
          price: number
          shop_id: string
          tone: string | null
        }
        Insert: {
          active?: boolean
          created_at?: string
          icon?: string | null
          id?: string
          image_url?: string | null
          label: string
          position?: number
          price: number
          shop_id: string
          tone?: string | null
        }
        Update: {
          active?: boolean
          created_at?: string
          icon?: string | null
          id?: string
          image_url?: string | null
          label?: string
          position?: number
          price?: number
          shop_id?: string
          tone?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      recipe_ingredients: {
        Row: {
          id: string
          ingredient_id: string
          quantity: number
          recipe_id: string
        }
        Insert: {
          id?: string
          ingredient_id: string
          quantity: number
          recipe_id: string
        }
        Update: {
          id?: string
          ingredient_id?: string
          quantity?: number
          recipe_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recipe_ingredients_ingredient_id_fkey"
            columns: ["ingredient_id"]
            isOneToOne: false
            referencedRelation: "ingredients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recipe_ingredients_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
        ]
      }
      recipes: {
        Row: {
          catalog_position: number
          category: string | null
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          labor_cost: number
          name: string
          packaging_cost: number
          public_price: number | null
          servings: number
          shop_id: string
          show_in_catalog: boolean
          slice_price: number | null
          target_margin: number
          updated_at: string
          waste_pct: number
        }
        Insert: {
          catalog_position?: number
          category?: string | null
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          labor_cost?: number
          name: string
          packaging_cost?: number
          public_price?: number | null
          servings: number
          shop_id: string
          show_in_catalog?: boolean
          slice_price?: number | null
          target_margin?: number
          updated_at?: string
          waste_pct?: number
        }
        Update: {
          catalog_position?: number
          category?: string | null
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          labor_cost?: number
          name?: string
          packaging_cost?: number
          public_price?: number | null
          servings?: number
          shop_id?: string
          show_in_catalog?: boolean
          slice_price?: number | null
          target_margin?: number
          updated_at?: string
          waste_pct?: number
        }
        Relationships: [
          {
            foreignKeyName: "recipes_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      sales: {
        Row: {
          cart_id: string | null
          created_by: string | null
          event_id: string | null
          id: string
          item: string
          payment_method: string
          price: number
          product_id: string | null
          qty: number
          shop_id: string
          sold_at: string
        }
        Insert: {
          cart_id?: string | null
          created_by?: string | null
          event_id?: string | null
          id?: string
          item: string
          payment_method?: string
          price: number
          product_id?: string | null
          qty?: number
          shop_id: string
          sold_at?: string
        }
        Update: {
          cart_id?: string | null
          created_by?: string | null
          event_id?: string | null
          id?: string
          item?: string
          payment_method?: string
          price?: number
          product_id?: string | null
          qty?: number
          shop_id?: string
          sold_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "pdv_products"
            referencedColumns: ["id"]
          },
        ]
      }
      shop_members: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["shop_role"]
          shop_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["shop_role"]
          shop_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["shop_role"]
          shop_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shop_members_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      shop_storefront: {
        Row: {
          banner_url: string | null
          created_at: string
          hero_subtitle: string | null
          hero_title: string | null
          promotions: Json
          sections: Json
          shop_id: string
          social: Json
          theme_overrides: Json
          updated_at: string
        }
        Insert: {
          banner_url?: string | null
          created_at?: string
          hero_subtitle?: string | null
          hero_title?: string | null
          promotions?: Json
          sections?: Json
          shop_id: string
          social?: Json
          theme_overrides?: Json
          updated_at?: string
        }
        Update: {
          banner_url?: string | null
          created_at?: string
          hero_subtitle?: string | null
          hero_title?: string | null
          promotions?: Json
          sections?: Json
          shop_id?: string
          social?: Json
          theme_overrides?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shop_storefront_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: true
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      shops: {
        Row: {
          created_at: string
          created_by: string
          description: string | null
          id: string
          logo_url: string | null
          name: string
          slug: string
          target_margin: number
          theme: Json
          updated_at: string
          whatsapp: string | null
        }
        Insert: {
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          logo_url?: string | null
          name: string
          slug: string
          target_margin?: number
          theme?: Json
          updated_at?: string
          whatsapp?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          logo_url?: string | null
          name?: string
          slug?: string
          target_margin?: number
          theme?: Json
          updated_at?: string
          whatsapp?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_shop_role: {
        Args: {
          _roles: Database["public"]["Enums"]["shop_role"][]
          _shop_id: string
          _user_id: string
        }
        Returns: boolean
      }
      is_shop_member: {
        Args: { _shop_id: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      order_status:
        | "orcamento"
        | "confirmado"
        | "produzindo"
        | "pronto"
        | "entregue"
        | "cancelado"
      shop_role: "owner" | "manager" | "staff"
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
      order_status: [
        "orcamento",
        "confirmado",
        "produzindo",
        "pronto",
        "entregue",
        "cancelado",
      ],
      shop_role: ["owner", "manager", "staff"],
    },
  },
} as const
