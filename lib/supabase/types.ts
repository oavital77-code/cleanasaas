// טיפוסי DB — ידניים בשלב זה (אין עדיין פרויקט Supabase מחובר להריץ מולו
// `supabase gen types typescript`). מכסה את הטבלאות שבהן משתמש קוד ה-lib
// וה-actions כרגע. יש להחליף בקובץ שנוצר אוטומטית ברגע שיש פרויקט Supabase
// אמיתי מחובר (supabase gen types typescript --project-id <id> > lib/supabase/types.ts) —
// אל תוסיפו עוד טבלאות/עמודות כאן ידנית לאחר מכן.

export type Database = {
  public: {
    Tables: {
      clinics: {
        Row: {
          id: string;
          name: string;
          slug: string;
          status: "trial" | "active" | "suspended";
          timezone: string;
          sessions_enabled: boolean;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["clinics"]["Row"]>;
        Update: Partial<Database["public"]["Tables"]["clinics"]["Row"]>;
      };
      profiles: {
        Row: {
          id: string;
          clinic_id: string;
          role: "owner" | "admin" | "therapist";
          status: "active" | "suspended" | "archived";
          full_name: string;
          phone: string;
          email: string;
          national_id: string | null;
          profession: string | null;
          business_number: string | null;
          door_code: string | null;
          terms_accepted_at: string | null;
          terms_version: string | null;
          payplus_token_uid: string | null;
          card_last4: string | null;
          card_expiry: string | null;
          ics_token: string;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["profiles"]["Row"]>;
        Update: Partial<Database["public"]["Tables"]["profiles"]["Row"]>;
      };
      branches: {
        Row: {
          id: string;
          clinic_id: string;
          name: string;
          address: string;
          waze_url: string | null;
          phone: string | null;
          active: boolean;
          sort_order: number;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["branches"]["Row"]>;
        Update: Partial<Database["public"]["Tables"]["branches"]["Row"]>;
      };
      rooms: {
        Row: {
          id: string;
          clinic_id: string;
          branch_id: string;
          name: string;
          room_type: ("talk" | "touch" | "podcast" | "group")[];
          capacity: number;
          description: string | null;
          equipment: unknown;
          images: string[];
          active: boolean;
          sort_order: number;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["rooms"]["Row"]>;
        Update: Partial<Database["public"]["Tables"]["rooms"]["Row"]>;
      };
      punch_card_tiers: {
        Row: {
          id: string;
          clinic_id: string;
          hours: number;
          price_per_hour: number;
          deposit_hours: number;
          active: boolean;
          sort_order: number;
        };
        Insert: Partial<Database["public"]["Tables"]["punch_card_tiers"]["Row"]>;
        Update: Partial<Database["public"]["Tables"]["punch_card_tiers"]["Row"]>;
      };
      punch_cards: {
        Row: {
          id: string;
          clinic_id: string;
          user_id: string;
          tier_id: string | null;
          hours_purchased: number;
          hours_remaining: number;
          price_per_hour: number;
          deposit_amount: number;
          deposit_remaining: number;
          purchased_at: string;
          expires_at: string;
          active: boolean;
        };
        Insert: Partial<Database["public"]["Tables"]["punch_cards"]["Row"]>;
        Update: Partial<Database["public"]["Tables"]["punch_cards"]["Row"]>;
      };
      bookings: {
        Row: {
          id: string;
          clinic_id: string;
          user_id: string;
          room_id: string;
          source: "punch_card" | "session" | "admin_comp";
          punch_card_id: string | null;
          subscription_id: string | null;
          starts_at: string;
          ends_at: string;
          hours_charged: number;
          status: "confirmed" | "cancelled_by_user" | "cancelled_by_admin" | "completed" | "no_show";
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["bookings"]["Row"]>;
        Update: Partial<Database["public"]["Tables"]["bookings"]["Row"]>;
      };
      session_subscriptions: {
        Row: {
          id: string;
          clinic_id: string;
          user_id: string;
          status: "requested" | "rejected" | "awaiting_payment" | "active" | "pending_cancellation" | "cancelled" | "expired";
          weekly_hours: number;
          monthly_price: number;
          start_date: string | null;
          next_billing_date: string | null;
          effective_end_date: string | null;
        };
        Insert: Partial<Database["public"]["Tables"]["session_subscriptions"]["Row"]>;
        Update: Partial<Database["public"]["Tables"]["session_subscriptions"]["Row"]>;
      };
      app_settings: {
        Row: { id: string; clinic_id: string; key: string; value: unknown; updated_at: string };
        Insert: Partial<Database["public"]["Tables"]["app_settings"]["Row"]>;
        Update: Partial<Database["public"]["Tables"]["app_settings"]["Row"]>;
      };
      clinic_payment_settings: {
        Row: {
          clinic_id: string;
          woo_store_url: string | null;
          woo_consumer_key: string | null;
          woo_consumer_secret: string | null;
          woo_webhook_secret: string | null;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: Partial<Database["public"]["Tables"]["clinic_payment_settings"]["Row"]>;
        Update: Partial<Database["public"]["Tables"]["clinic_payment_settings"]["Row"]>;
      };
      woo_product_tiers: {
        Row: { clinic_id: string; woo_product_id: number; tier_id: string; created_at: string };
        Insert: Partial<Database["public"]["Tables"]["woo_product_tiers"]["Row"]>;
        Update: Partial<Database["public"]["Tables"]["woo_product_tiers"]["Row"]>;
      };
      woo_pending_purchases: {
        Row: {
          id: string;
          clinic_id: string;
          woo_order_id: number;
          tier_id: string;
          phone: string | null;
          email: string | null;
          quantity: number;
          amount_total: number;
          status: "pending" | "claimed" | "expired";
        };
        Insert: Partial<Database["public"]["Tables"]["woo_pending_purchases"]["Row"]>;
        Update: Partial<Database["public"]["Tables"]["woo_pending_purchases"]["Row"]>;
      };
      platform_subscriptions: {
        Row: {
          clinic_id: string;
          plan: string;
          status: string;
          current_period_end: string | null;
        };
        Insert: Partial<Database["public"]["Tables"]["platform_subscriptions"]["Row"]>;
        Update: Partial<Database["public"]["Tables"]["platform_subscriptions"]["Row"]>;
      };
      clinic_invites: {
        Row: {
          token: string;
          clinic_id: string;
          role: "admin" | "therapist";
          created_by: string | null;
          created_at: string;
          expires_at: string;
          used_at: string | null;
          used_by: string | null;
        };
        Insert: Partial<Database["public"]["Tables"]["clinic_invites"]["Row"]>;
        Update: Partial<Database["public"]["Tables"]["clinic_invites"]["Row"]>;
      };
    };
  };
};
