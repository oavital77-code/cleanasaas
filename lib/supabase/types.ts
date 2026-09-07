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
          clinic_id: string
          id: string
          key: string
          updated_at: string | null
          value: Json
        }
        Insert: {
          clinic_id: string
          id?: string
          key: string
          updated_at?: string | null
          value: Json
        }
        Update: {
          clinic_id?: string
          id?: string
          key?: string
          updated_at?: string | null
          value?: Json
        }
        Relationships: [
          {
            foreignKeyName: "app_settings_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          actor_id: string | null
          after: Json | null
          before: Json | null
          clinic_id: string
          created_at: string | null
          entity: string
          entity_id: string | null
          id: number
        }
        Insert: {
          action: string
          actor_id?: string | null
          after?: Json | null
          before?: Json | null
          clinic_id: string
          created_at?: string | null
          entity: string
          entity_id?: string | null
          id?: number
        }
        Update: {
          action?: string
          actor_id?: string | null
          after?: Json | null
          before?: Json | null
          clinic_id?: string
          created_at?: string | null
          entity?: string
          entity_id?: string | null
          id?: number
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_log_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      availability_events: {
        Row: {
          action: string
          clinic_id: string
          created_at: string | null
          ends_at: string
          id: number
          kind: string
          room_id: string
          starts_at: string
        }
        Insert: {
          action: string
          clinic_id: string
          created_at?: string | null
          ends_at: string
          id?: number
          kind: string
          room_id: string
          starts_at: string
        }
        Update: {
          action?: string
          clinic_id?: string
          created_at?: string | null
          ends_at?: string
          id?: number
          kind?: string
          room_id?: string
          starts_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "availability_events_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "availability_events_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      bookings: {
        Row: {
          admin_note: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          clinic_id: string
          created_at: string | null
          ends_at: string
          hours_charged: number
          hours_refunded: boolean | null
          id: string
          punch_card_id: string | null
          reminder_sent_at: string | null
          room_id: string
          source: Database["public"]["Enums"]["booking_source"]
          starts_at: string
          status: Database["public"]["Enums"]["booking_status"]
          subscription_id: string | null
          user_id: string
          whatsapp_reminder_sent_at: string | null
        }
        Insert: {
          admin_note?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          clinic_id: string
          created_at?: string | null
          ends_at: string
          hours_charged: number
          hours_refunded?: boolean | null
          id?: string
          punch_card_id?: string | null
          reminder_sent_at?: string | null
          room_id: string
          source: Database["public"]["Enums"]["booking_source"]
          starts_at: string
          status?: Database["public"]["Enums"]["booking_status"]
          subscription_id?: string | null
          user_id: string
          whatsapp_reminder_sent_at?: string | null
        }
        Update: {
          admin_note?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          clinic_id?: string
          created_at?: string | null
          ends_at?: string
          hours_charged?: number
          hours_refunded?: boolean | null
          id?: string
          punch_card_id?: string | null
          reminder_sent_at?: string | null
          room_id?: string
          source?: Database["public"]["Enums"]["booking_source"]
          starts_at?: string
          status?: Database["public"]["Enums"]["booking_status"]
          subscription_id?: string | null
          user_id?: string
          whatsapp_reminder_sent_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bookings_cancelled_by_fkey"
            columns: ["cancelled_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_punch_card_id_fkey"
            columns: ["punch_card_id"]
            isOneToOne: false
            referencedRelation: "punch_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "session_subscriptions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      branches: {
        Row: {
          active: boolean | null
          address: string
          clinic_id: string
          created_at: string | null
          id: string
          name: string
          phone: string | null
          sort_order: number | null
          waze_url: string | null
        }
        Insert: {
          active?: boolean | null
          address: string
          clinic_id: string
          created_at?: string | null
          id?: string
          name: string
          phone?: string | null
          sort_order?: number | null
          waze_url?: string | null
        }
        Update: {
          active?: boolean | null
          address?: string
          clinic_id?: string
          created_at?: string | null
          id?: string
          name?: string
          phone?: string | null
          sort_order?: number | null
          waze_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "branches_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      clinic_invites: {
        Row: {
          clinic_id: string
          created_at: string | null
          created_by: string | null
          expires_at: string
          role: Database["public"]["Enums"]["user_role"]
          token: string
          used_at: string | null
          used_by: string | null
        }
        Insert: {
          clinic_id: string
          created_at?: string | null
          created_by?: string | null
          expires_at?: string
          role?: Database["public"]["Enums"]["user_role"]
          token?: string
          used_at?: string | null
          used_by?: string | null
        }
        Update: {
          clinic_id?: string
          created_at?: string | null
          created_by?: string | null
          expires_at?: string
          role?: Database["public"]["Enums"]["user_role"]
          token?: string
          used_at?: string | null
          used_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clinic_invites_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clinic_invites_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clinic_invites_used_by_fkey"
            columns: ["used_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      clinic_payment_settings: {
        Row: {
          clinic_id: string
          updated_at: string | null
          updated_by: string | null
          woo_consumer_key: string | null
          woo_consumer_secret: string | null
          woo_store_url: string | null
          woo_webhook_secret: string | null
        }
        Insert: {
          clinic_id: string
          updated_at?: string | null
          updated_by?: string | null
          woo_consumer_key?: string | null
          woo_consumer_secret?: string | null
          woo_store_url?: string | null
          woo_webhook_secret?: string | null
        }
        Update: {
          clinic_id?: string
          updated_at?: string | null
          updated_by?: string | null
          woo_consumer_key?: string | null
          woo_consumer_secret?: string | null
          woo_store_url?: string | null
          woo_webhook_secret?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clinic_payment_settings_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: true
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clinic_payment_settings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      clinic_whatsapp_settings: {
        Row: {
          api_token: string | null
          clinic_id: string
          enabled: boolean
          hours_before: number
          phone_number_id: string | null
          provider: string
          sender_phone: string | null
          template: string
          template_lang: string
          template_name: string | null
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          api_token?: string | null
          clinic_id: string
          enabled?: boolean
          hours_before?: number
          phone_number_id?: string | null
          provider?: string
          sender_phone?: string | null
          template?: string
          template_lang?: string
          template_name?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          api_token?: string | null
          clinic_id?: string
          enabled?: boolean
          hours_before?: number
          phone_number_id?: string | null
          provider?: string
          sender_phone?: string | null
          template?: string
          template_lang?: string
          template_name?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clinic_whatsapp_settings_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: true
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clinic_whatsapp_settings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      clinics: {
        Row: {
          close_hour: number
          created_at: string | null
          id: string
          name: string
          open_hour: number
          published: boolean
          sessions_enabled: boolean
          slug: string
          status: Database["public"]["Enums"]["clinic_status"]
          timezone: string
        }
        Insert: {
          close_hour?: number
          created_at?: string | null
          id?: string
          name: string
          open_hour?: number
          published?: boolean
          sessions_enabled?: boolean
          slug: string
          status?: Database["public"]["Enums"]["clinic_status"]
          timezone?: string
        }
        Update: {
          close_hour?: number
          created_at?: string | null
          id?: string
          name?: string
          open_hour?: number
          published?: boolean
          sessions_enabled?: boolean
          slug?: string
          status?: Database["public"]["Enums"]["clinic_status"]
          timezone?: string
        }
        Relationships: []
      }
      overrun_charges: {
        Row: {
          amount: number
          booking_id: string | null
          clinic_id: string
          created_at: string | null
          hours_charged: number
          id: string
          minutes: number
          note: string | null
          payment_id: string | null
          recorded_by: string
          source: Database["public"]["Enums"]["overrun_source"]
          user_id: string
        }
        Insert: {
          amount: number
          booking_id?: string | null
          clinic_id: string
          created_at?: string | null
          hours_charged: number
          id?: string
          minutes: number
          note?: string | null
          payment_id?: string | null
          recorded_by: string
          source: Database["public"]["Enums"]["overrun_source"]
          user_id: string
        }
        Update: {
          amount?: number
          booking_id?: string | null
          clinic_id?: string
          created_at?: string | null
          hours_charged?: number
          id?: string
          minutes?: number
          note?: string | null
          payment_id?: string | null
          recorded_by?: string
          source?: Database["public"]["Enums"]["overrun_source"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "overrun_charges_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "overrun_charges_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "overrun_charges_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "overrun_charges_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "overrun_charges_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount_before_vat: number
          amount_total: number
          clinic_id: string
          created_at: string | null
          failure_reason: string | null
          id: string
          invoice_url: string | null
          method: Database["public"]["Enums"]["payment_method"] | null
          paid_at: string | null
          payplus_page_uid: string | null
          payplus_transaction_uid: string | null
          punch_card_id: string | null
          retry_count: number | null
          status: Database["public"]["Enums"]["payment_status"]
          subscription_id: string | null
          type: Database["public"]["Enums"]["payment_type"]
          user_id: string
          vat_amount: number
        }
        Insert: {
          amount_before_vat: number
          amount_total: number
          clinic_id: string
          created_at?: string | null
          failure_reason?: string | null
          id?: string
          invoice_url?: string | null
          method?: Database["public"]["Enums"]["payment_method"] | null
          paid_at?: string | null
          payplus_page_uid?: string | null
          payplus_transaction_uid?: string | null
          punch_card_id?: string | null
          retry_count?: number | null
          status?: Database["public"]["Enums"]["payment_status"]
          subscription_id?: string | null
          type: Database["public"]["Enums"]["payment_type"]
          user_id: string
          vat_amount: number
        }
        Update: {
          amount_before_vat?: number
          amount_total?: number
          clinic_id?: string
          created_at?: string | null
          failure_reason?: string | null
          id?: string
          invoice_url?: string | null
          method?: Database["public"]["Enums"]["payment_method"] | null
          paid_at?: string | null
          payplus_page_uid?: string | null
          payplus_transaction_uid?: string | null
          punch_card_id?: string | null
          retry_count?: number | null
          status?: Database["public"]["Enums"]["payment_status"]
          subscription_id?: string | null
          type?: Database["public"]["Enums"]["payment_type"]
          user_id?: string
          vat_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "payments_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_punch_card_id_fkey"
            columns: ["punch_card_id"]
            isOneToOne: false
            referencedRelation: "punch_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "session_subscriptions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_admins: {
        Row: {
          created_at: string | null
          full_name: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          full_name: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          full_name?: string
          user_id?: string
        }
        Relationships: []
      }
      platform_audit_log: {
        Row: {
          action: string
          actor_id: string | null
          after: Json | null
          before: Json | null
          clinic_id: string | null
          created_at: string | null
          id: number
        }
        Insert: {
          action: string
          actor_id?: string | null
          after?: Json | null
          before?: Json | null
          clinic_id?: string | null
          created_at?: string | null
          id?: number
        }
        Update: {
          action?: string
          actor_id?: string | null
          after?: Json | null
          before?: Json | null
          clinic_id?: string | null
          created_at?: string | null
          id?: number
        }
        Relationships: [
          {
            foreignKeyName: "platform_audit_log_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_plan_limits: {
        Row: {
          max_branches: number | null
          max_rooms: number | null
          max_therapists: number | null
          plan: string
        }
        Insert: {
          max_branches?: number | null
          max_rooms?: number | null
          max_therapists?: number | null
          plan: string
        }
        Update: {
          max_branches?: number | null
          max_rooms?: number | null
          max_therapists?: number | null
          plan?: string
        }
        Relationships: []
      }
      platform_subscriptions: {
        Row: {
          clinic_id: string
          created_at: string | null
          current_period_end: string | null
          external_payment_id: string | null
          plan: string
          status: string
          updated_at: string | null
        }
        Insert: {
          clinic_id: string
          created_at?: string | null
          current_period_end?: string | null
          external_payment_id?: string | null
          plan?: string
          status?: string
          updated_at?: string | null
        }
        Update: {
          clinic_id?: string
          created_at?: string | null
          current_period_end?: string | null
          external_payment_id?: string | null
          plan?: string
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "platform_subscriptions_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: true
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "platform_subscriptions_plan_fkey"
            columns: ["plan"]
            isOneToOne: false
            referencedRelation: "platform_plan_limits"
            referencedColumns: ["plan"]
          },
        ]
      }
      profiles: {
        Row: {
          business_number: string | null
          card_expiry: string | null
          card_last4: string | null
          clerk_user_id: string | null
          clinic_id: string
          created_at: string | null
          door_code: string | null
          email: string
          full_name: string
          ics_token: string | null
          id: string
          locale: string
          national_id: string | null
          payplus_token_uid: string | null
          phone: string
          profession: string | null
          role: Database["public"]["Enums"]["user_role"]
          status: Database["public"]["Enums"]["user_status"]
          terms_accepted_at: string | null
          terms_version: string | null
          whatsapp_reminders: boolean
        }
        Insert: {
          business_number?: string | null
          card_expiry?: string | null
          card_last4?: string | null
          clerk_user_id?: string | null
          clinic_id: string
          created_at?: string | null
          door_code?: string | null
          email: string
          full_name: string
          ics_token?: string | null
          id: string
          locale?: string
          national_id?: string | null
          payplus_token_uid?: string | null
          phone: string
          profession?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          status?: Database["public"]["Enums"]["user_status"]
          terms_accepted_at?: string | null
          terms_version?: string | null
          whatsapp_reminders?: boolean
        }
        Update: {
          business_number?: string | null
          card_expiry?: string | null
          card_last4?: string | null
          clerk_user_id?: string | null
          clinic_id?: string
          created_at?: string | null
          door_code?: string | null
          email?: string
          full_name?: string
          ics_token?: string | null
          id?: string
          locale?: string
          national_id?: string | null
          payplus_token_uid?: string | null
          phone?: string
          profession?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          status?: Database["public"]["Enums"]["user_status"]
          terms_accepted_at?: string | null
          terms_version?: string | null
          whatsapp_reminders?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "profiles_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      punch_card_tiers: {
        Row: {
          active: boolean | null
          clinic_id: string
          deposit_hours: number
          hours: number
          id: string
          price_per_hour: number
          sort_order: number | null
        }
        Insert: {
          active?: boolean | null
          clinic_id: string
          deposit_hours?: number
          hours: number
          id?: string
          price_per_hour: number
          sort_order?: number | null
        }
        Update: {
          active?: boolean | null
          clinic_id?: string
          deposit_hours?: number
          hours?: number
          id?: string
          price_per_hour?: number
          sort_order?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "punch_card_tiers_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      punch_cards: {
        Row: {
          active: boolean | null
          clinic_id: string
          deposit_amount: number
          deposit_remaining: number
          expires_at: string
          expiry_notified_at: string | null
          hours_purchased: number
          hours_remaining: number
          id: string
          low_balance_notified_at: string | null
          price_per_hour: number
          purchased_at: string | null
          tier_id: string | null
          user_id: string
        }
        Insert: {
          active?: boolean | null
          clinic_id: string
          deposit_amount: number
          deposit_remaining: number
          expires_at: string
          expiry_notified_at?: string | null
          hours_purchased: number
          hours_remaining: number
          id?: string
          low_balance_notified_at?: string | null
          price_per_hour: number
          purchased_at?: string | null
          tier_id?: string | null
          user_id: string
        }
        Update: {
          active?: boolean | null
          clinic_id?: string
          deposit_amount?: number
          deposit_remaining?: number
          expires_at?: string
          expiry_notified_at?: string | null
          hours_purchased?: number
          hours_remaining?: number
          id?: string
          low_balance_notified_at?: string | null
          price_per_hour?: number
          purchased_at?: string | null
          tier_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "punch_cards_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "punch_cards_tier_id_fkey"
            columns: ["tier_id"]
            isOneToOne: false
            referencedRelation: "punch_card_tiers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "punch_cards_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      room_blocks: {
        Row: {
          clinic_id: string
          created_at: string | null
          created_by: string | null
          ends_at: string
          id: string
          reason: string
          room_id: string
          starts_at: string
        }
        Insert: {
          clinic_id: string
          created_at?: string | null
          created_by?: string | null
          ends_at: string
          id?: string
          reason: string
          room_id: string
          starts_at: string
        }
        Update: {
          clinic_id?: string
          created_at?: string | null
          created_by?: string | null
          ends_at?: string
          id?: string
          reason?: string
          room_id?: string
          starts_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "room_blocks_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "room_blocks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "room_blocks_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      rooms: {
        Row: {
          active: boolean | null
          branch_id: string
          capacity: number | null
          clinic_id: string
          created_at: string | null
          description: string | null
          equipment: Json | null
          id: string
          images: string[] | null
          name: string
          room_type: Database["public"]["Enums"]["room_type"][]
          sort_order: number | null
        }
        Insert: {
          active?: boolean | null
          branch_id: string
          capacity?: number | null
          clinic_id: string
          created_at?: string | null
          description?: string | null
          equipment?: Json | null
          id?: string
          images?: string[] | null
          name: string
          room_type?: Database["public"]["Enums"]["room_type"][]
          sort_order?: number | null
        }
        Update: {
          active?: boolean | null
          branch_id?: string
          capacity?: number | null
          clinic_id?: string
          created_at?: string | null
          description?: string | null
          equipment?: Json | null
          id?: string
          images?: string[] | null
          name?: string
          room_type?: Database["public"]["Enums"]["room_type"][]
          sort_order?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "rooms_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rooms_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      session_slots: {
        Row: {
          clinic_id: string
          end_time: string
          id: string
          room_id: string
          start_time: string
          subscription_id: string
          weekday: number
        }
        Insert: {
          clinic_id: string
          end_time: string
          id?: string
          room_id: string
          start_time: string
          subscription_id: string
          weekday: number
        }
        Update: {
          clinic_id?: string
          end_time?: string
          id?: string
          room_id?: string
          start_time?: string
          subscription_id?: string
          weekday?: number
        }
        Relationships: [
          {
            foreignKeyName: "session_slots_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_slots_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_slots_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "session_subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      session_subscriptions: {
        Row: {
          cancel_requested_at: string | null
          clinic_id: string
          created_at: string | null
          effective_end_date: string | null
          hold_expires_at: string | null
          id: string
          monthly_price: number
          next_billing_date: string | null
          rejection_reason: string | null
          renewal_reminder_sent_at: string | null
          requested_at: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          start_date: string | null
          status: Database["public"]["Enums"]["sub_status"]
          user_id: string
          weekly_hours: number
        }
        Insert: {
          cancel_requested_at?: string | null
          clinic_id: string
          created_at?: string | null
          effective_end_date?: string | null
          hold_expires_at?: string | null
          id?: string
          monthly_price: number
          next_billing_date?: string | null
          rejection_reason?: string | null
          renewal_reminder_sent_at?: string | null
          requested_at?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["sub_status"]
          user_id: string
          weekly_hours: number
        }
        Update: {
          cancel_requested_at?: string | null
          clinic_id?: string
          created_at?: string | null
          effective_end_date?: string | null
          hold_expires_at?: string | null
          id?: string
          monthly_price?: number
          next_billing_date?: string | null
          rejection_reason?: string | null
          renewal_reminder_sent_at?: string | null
          requested_at?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["sub_status"]
          user_id?: string
          weekly_hours?: number
        }
        Relationships: [
          {
            foreignKeyName: "session_subscriptions_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_subscriptions_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      therapist_admin_notes: {
        Row: {
          clinic_id: string
          note: string | null
          updated_at: string | null
          updated_by: string | null
          user_id: string
        }
        Insert: {
          clinic_id: string
          note?: string | null
          updated_at?: string | null
          updated_by?: string | null
          user_id: string
        }
        Update: {
          clinic_id?: string
          note?: string | null
          updated_at?: string | null
          updated_by?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "therapist_admin_notes_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "therapist_admin_notes_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "therapist_admin_notes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      woo_pending_purchases: {
        Row: {
          amount_total: number
          claimed_at: string | null
          claimed_by: string | null
          clinic_id: string
          created_at: string | null
          email: string | null
          expires_at: string
          id: string
          phone: string | null
          quantity: number
          status: string
          tier_id: string
          woo_order_id: number
        }
        Insert: {
          amount_total: number
          claimed_at?: string | null
          claimed_by?: string | null
          clinic_id: string
          created_at?: string | null
          email?: string | null
          expires_at?: string
          id?: string
          phone?: string | null
          quantity?: number
          status?: string
          tier_id: string
          woo_order_id: number
        }
        Update: {
          amount_total?: number
          claimed_at?: string | null
          claimed_by?: string | null
          clinic_id?: string
          created_at?: string | null
          email?: string | null
          expires_at?: string
          id?: string
          phone?: string | null
          quantity?: number
          status?: string
          tier_id?: string
          woo_order_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "woo_pending_purchases_claimed_by_fkey"
            columns: ["claimed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "woo_pending_purchases_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "woo_pending_purchases_tier_id_fkey"
            columns: ["tier_id"]
            isOneToOne: false
            referencedRelation: "punch_card_tiers"
            referencedColumns: ["id"]
          },
        ]
      }
      woo_product_tiers: {
        Row: {
          clinic_id: string
          created_at: string | null
          tier_id: string
          woo_product_id: number
        }
        Insert: {
          clinic_id: string
          created_at?: string | null
          tier_id: string
          woo_product_id: number
        }
        Update: {
          clinic_id?: string
          created_at?: string | null
          tier_id?: string
          woo_product_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "woo_product_tiers_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "woo_product_tiers_tier_id_fkey"
            columns: ["tier_id"]
            isOneToOne: false
            referencedRelation: "punch_card_tiers"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      public_availability: {
        Row: {
          ends_at: string | null
          kind: string | null
          room_id: string | null
          starts_at: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      accept_therapist_invite: {
        Args: {
          p_email: string
          p_full_name: string
          p_phone: string
          p_token: string
        }
        Returns: {
          clinic_id: string
        }[]
      }
      activate_session_payment: {
        Args: {
          p_card_expiry?: string
          p_card_last4?: string
          p_invoice_url?: string
          p_method: Database["public"]["Enums"]["payment_method"]
          p_payment_id: string
          p_token_uid?: string
          p_transaction_uid: string
        }
        Returns: undefined
      }
      admin_activate_session_cash_payment: {
        Args: {
          p_method: Database["public"]["Enums"]["payment_method"]
          p_payment_id: string
          p_transaction_uid: string
        }
        Returns: undefined
      }
      admin_adjust_punch_card_hours: {
        Args: { p_card_id: string; p_hours_delta: number; p_note: string }
        Returns: undefined
      }
      admin_cancel_booking: {
        Args: { p_booking_id: string; p_refund_hours?: boolean }
        Returns: undefined
      }
      admin_complete_deposit: {
        Args: { p_punch_card_id: string }
        Returns: undefined
      }
      admin_create_booking: {
        Args: {
          p_ends_at: string
          p_note?: string
          p_room_id: string
          p_starts_at: string
          p_user_id: string
        }
        Returns: {
          booking_id: string
        }[]
      }
      admin_create_room_block: {
        Args: {
          p_ends_at: string
          p_reason: string
          p_room_id: string
          p_starts_at: string
        }
        Returns: {
          block_id: string
        }[]
      }
      admin_create_session: {
        Args: {
          p_slots: Json
          p_start_date?: string
          p_term_months?: number
          p_user_id: string
        }
        Returns: {
          monthly_price: number
          subscription_id: string
          weekly_hours: number
        }[]
      }
      admin_create_session_prepaid: {
        Args: {
          p_slots: Json
          p_start_date?: string
          p_term_months?: number
          p_user_id: string
        }
        Returns: {
          subscription_id: string
        }[]
      }
      admin_delete_room_block: {
        Args: { p_block_id: string }
        Returns: undefined
      }
      admin_end_session_term: {
        Args: { p_subscription_id: string }
        Returns: undefined
      }
      admin_issue_punch_card: {
        Args: {
          p_amount_total?: number
          p_hours?: number
          p_method?: Database["public"]["Enums"]["payment_method"]
          p_note?: string
          p_tier_id?: string
          p_user_id: string
        }
        Returns: {
          amount_total: number
          hours: number
          payment_id: string
          punch_card_id: string
        }[]
      }
      admin_mark_session_recurring_paid_cash: {
        Args: {
          p_method: Database["public"]["Enums"]["payment_method"]
          p_payment_id: string
          p_transaction_uid: string
        }
        Returns: undefined
      }
      admin_mark_whatsapp_reminder_sent: {
        Args: { p_booking_id: string }
        Returns: undefined
      }
      admin_renew_session_term: {
        Args: { p_subscription_id: string; p_term_months: number }
        Returns: undefined
      }
      admin_set_booking_status: {
        Args: {
          p_booking_id: string
          p_status: Database["public"]["Enums"]["booking_status"]
        }
        Returns: undefined
      }
      admin_set_clinic_whatsapp_settings: {
        Args: {
          p_access_token?: string
          p_enabled?: boolean
          p_hours_before?: number
          p_phone_number_id?: string
          p_sender_phone?: string
          p_template?: string
          p_template_lang?: string
          p_template_name?: string
        }
        Returns: undefined
      }
      admin_set_clinic_woo_secrets: {
        Args: {
          p_woo_consumer_key?: string
          p_woo_consumer_secret?: string
          p_woo_session_product_id?: number
          p_woo_store_url?: string
          p_woo_webhook_secret?: string
        }
        Returns: undefined
      }
      app_user_id: { Args: never; Returns: string }
      approve_session: {
        Args: { p_subscription_id: string; p_term_months?: number }
        Returns: undefined
      }
      assert_service_or_admin: { Args: never; Returns: undefined }
      assert_within_plan_quota: {
        Args: { p_clinic_id: string; p_resource: string }
        Returns: undefined
      }
      cancel_booking: {
        Args: { p_booking_id: string }
        Returns: {
          hours_refunded: boolean
        }[]
      }
      claim_woo_pending_purchase: {
        Args: never
        Returns: {
          claimed_count: number
          hours_granted: number
        }[]
      }
      clear_clerk_identity: {
        Args: { p_clerk_user_id: string }
        Returns: {
          business_number: string | null
          card_expiry: string | null
          card_last4: string | null
          clerk_user_id: string | null
          clinic_id: string
          created_at: string | null
          door_code: string | null
          email: string
          full_name: string
          ics_token: string | null
          id: string
          locale: string
          national_id: string | null
          payplus_token_uid: string | null
          phone: string
          profession: string | null
          role: Database["public"]["Enums"]["user_role"]
          status: Database["public"]["Enums"]["user_status"]
          terms_accepted_at: string | null
          terms_version: string | null
          whatsapp_reminders: boolean
        }[]
        SetofOptions: {
          from: "*"
          to: "profiles"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      create_booking: {
        Args: { p_ends_at: string; p_room_id: string; p_starts_at: string }
        Returns: {
          booking_id: string
          hours_charged: number
          hours_remaining: number
        }[]
      }
      create_branch: {
        Args: {
          p_address: string
          p_name: string
          p_phone?: string
          p_waze_url?: string
        }
        Returns: {
          branch_id: string
        }[]
      }
      create_room: {
        Args: {
          p_branch_id: string
          p_capacity?: number
          p_description?: string
          p_equipment?: Json
          p_name: string
          p_room_type: Database["public"]["Enums"]["room_type"][]
        }
        Returns: {
          room_id: string
        }[]
      }
      create_session_initial_payment: {
        Args: { p_subscription_id: string }
        Returns: {
          amount_total: number
          payment_id: string
        }[]
      }
      create_therapist_invite: {
        Args: { p_role?: Database["public"]["Enums"]["user_role"] }
        Returns: {
          expires_at: string
          token: string
        }[]
      }
      current_clinic_id: { Args: never; Returns: string }
      expire_session_holds_and_cancellations: {
        Args: never
        Returns: undefined
      }
      expire_trial_subscriptions: { Args: never; Returns: undefined }
      finalize_overrun_charge: {
        Args: {
          p_payment_id: string
          p_reason?: string
          p_success: boolean
          p_transaction_uid?: string
        }
        Returns: undefined
      }
      finalize_session_renewal: {
        Args: {
          p_invoice_url?: string
          p_method?: Database["public"]["Enums"]["payment_method"]
          p_payment_id: string
          p_reason?: string
          p_success: boolean
          p_transaction_uid?: string
        }
        Returns: undefined
      }
      get_clinic_whatsapp_credentials: {
        Args: { p_clinic_id: string }
        Returns: {
          access_token: string
          enabled: boolean
          hours_before: number
          phone_number_id: string
          sender_phone: string
          template: string
          template_lang: string
          template_name: string
        }[]
      }
      get_clinic_woo_credentials: {
        Args: { p_clinic_id: string }
        Returns: {
          woo_consumer_key: string
          woo_consumer_secret: string
          woo_store_url: string
          woo_webhook_secret: string
        }[]
      }
      grant_bonus_hours: {
        Args: { p_hours: number; p_note: string; p_user_id: string }
        Returns: {
          punch_card_id: string
        }[]
      }
      initiate_session_renewal_payment: {
        Args: { p_subscription_id: string }
        Returns: {
          amount_total: number
          payment_id: string
        }[]
      }
      is_admin: { Args: never; Returns: boolean }
      is_superadmin: { Args: never; Returns: boolean }
      join_clinic_as_therapist: {
        Args: {
          p_email: string
          p_full_name: string
          p_phone: string
          p_slug: string
        }
        Returns: {
          clinic_id: string
        }[]
      }
      link_clerk_identity: {
        Args: { p_clerk_user_id: string; p_email: string }
        Returns: {
          business_number: string | null
          card_expiry: string | null
          card_last4: string | null
          clerk_user_id: string | null
          clinic_id: string
          created_at: string | null
          door_code: string | null
          email: string
          full_name: string
          ics_token: string | null
          id: string
          locale: string
          national_id: string | null
          payplus_token_uid: string | null
          phone: string
          profession: string | null
          role: Database["public"]["Enums"]["user_role"]
          status: Database["public"]["Enums"]["user_status"]
          terms_accepted_at: string | null
          terms_version: string | null
          whatsapp_reminders: boolean
        }[]
        SetofOptions: {
          from: "*"
          to: "profiles"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      materialize_session_bookings: { Args: never; Returns: undefined }
      materialize_subscription_bookings: {
        Args: { p_horizon_days: number; p_subscription_id: string }
        Returns: undefined
      }
      preview_overrun: {
        Args: { p_booking_id: string; p_minutes: number }
        Returns: {
          amount: number
          deposit_available: number
          hours: number
          needs_charge: boolean
          price_per_hour: number
        }[]
      }
      record_overrun: {
        Args: { p_booking_id: string; p_minutes: number; p_note: string }
        Returns: {
          amount: number
          overrun_id: string
          payment_id: string
          source: Database["public"]["Enums"]["overrun_source"]
        }[]
      }
      reject_session: {
        Args: { p_reason: string; p_subscription_id: string }
        Returns: undefined
      }
      request_session: {
        Args: { p_slots: Json; p_start_date?: string }
        Returns: {
          monthly_price: number
          subscription_id: string
          weekly_hours: number
        }[]
      }
      request_subscription_cancellation: {
        Args: { p_subscription_id: string }
        Returns: {
          effective_end_date: string
        }[]
      }
      session_slot_conflicts: {
        Args: {
          p_end_time: string
          p_exclude_subscription_id?: string
          p_horizon_days: number
          p_room_id: string
          p_start_time: string
          p_weekday: number
        }
        Returns: boolean
      }
      signup_clinic: {
        Args: {
          p_clinic_name: string
          p_owner_email: string
          p_owner_full_name: string
          p_owner_phone: string
          p_slug: string
        }
        Returns: {
          clinic_id: string
        }[]
      }
      superadmin_list_clinics: {
        Args: never
        Returns: {
          branches_count: number
          clinic_id: string
          created_at: string
          current_period_end: string
          name: string
          plan: string
          rooms_count: number
          slug: string
          status: Database["public"]["Enums"]["clinic_status"]
          subscription_status: string
          therapists_count: number
        }[]
      }
      superadmin_set_clinic_status: {
        Args: {
          p_clinic_id: string
          p_reason?: string
          p_status: Database["public"]["Enums"]["clinic_status"]
        }
        Returns: undefined
      }
      superadmin_set_plan: {
        Args: {
          p_clinic_id: string
          p_current_period_end?: string
          p_plan: string
          p_status?: string
        }
        Returns: undefined
      }
    }
    Enums: {
      booking_source: "punch_card" | "session" | "admin_comp"
      booking_status:
        | "confirmed"
        | "cancelled_by_user"
        | "cancelled_by_admin"
        | "completed"
        | "no_show"
      clinic_status: "trial" | "active" | "suspended"
      overrun_source: "deposit" | "charge"
      payment_method: "credit_card" | "bit" | "paybox" | "cash" | "other"
      payment_status: "pending" | "paid" | "failed" | "refunded"
      payment_type:
        | "punch_card"
        | "session_initial"
        | "session_recurring"
        | "overrun"
        | "deposit_topup"
      room_type: "talk" | "touch" | "podcast" | "group"
      sub_status:
        | "requested"
        | "rejected"
        | "awaiting_payment"
        | "active"
        | "pending_cancellation"
        | "cancelled"
        | "expired"
      user_role: "owner" | "admin" | "therapist"
      user_status: "active" | "suspended" | "archived"
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
    Enums: {
      booking_source: ["punch_card", "session", "admin_comp"],
      booking_status: [
        "confirmed",
        "cancelled_by_user",
        "cancelled_by_admin",
        "completed",
        "no_show",
      ],
      clinic_status: ["trial", "active", "suspended"],
      overrun_source: ["deposit", "charge"],
      payment_method: ["credit_card", "bit", "paybox", "cash", "other"],
      payment_status: ["pending", "paid", "failed", "refunded"],
      payment_type: [
        "punch_card",
        "session_initial",
        "session_recurring",
        "overrun",
        "deposit_topup",
      ],
      room_type: ["talk", "touch", "podcast", "group"],
      sub_status: [
        "requested",
        "rejected",
        "awaiting_payment",
        "active",
        "pending_cancellation",
        "cancelled",
        "expired",
      ],
      user_role: ["owner", "admin", "therapist"],
      user_status: ["active", "suspended", "archived"],
    },
  },
} as const
