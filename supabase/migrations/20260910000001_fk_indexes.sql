-- אינדקסים על מפתחות זרים בלי אינדקס (Supabase advisor: unindexed_foreign_keys, 27).
-- בלי אינדקס, כל join או ON DELETE CASCADE על הטבלה המפנה הוא סריקה מלאה —
-- לא מורגש ב-2 קליניקות, מורגש ב-100. כולם if not exists, בטוח להריץ שוב.
create index if not exists audit_log_actor_id_idx on audit_log (actor_id);
create index if not exists availability_events_room_id_idx on availability_events (room_id);
create index if not exists bookings_cancelled_by_idx on bookings (cancelled_by);
create index if not exists bookings_punch_card_id_idx on bookings (punch_card_id);
create index if not exists bookings_subscription_id_idx on bookings (subscription_id);
create index if not exists clinic_invites_created_by_idx on clinic_invites (created_by);
create index if not exists clinic_invites_used_by_idx on clinic_invites (used_by);
create index if not exists clinic_payment_settings_updated_by_idx on clinic_payment_settings (updated_by);
create index if not exists clinic_whatsapp_settings_updated_by_idx on clinic_whatsapp_settings (updated_by);
create index if not exists overrun_charges_booking_id_idx on overrun_charges (booking_id);
create index if not exists overrun_charges_payment_id_idx on overrun_charges (payment_id);
create index if not exists overrun_charges_recorded_by_idx on overrun_charges (recorded_by);
create index if not exists overrun_charges_user_id_idx on overrun_charges (user_id);
create index if not exists payments_punch_card_id_idx on payments (punch_card_id);
create index if not exists payments_subscription_id_idx on payments (subscription_id);
create index if not exists platform_audit_log_clinic_id_idx on platform_audit_log (clinic_id);
create index if not exists platform_subscriptions_plan_idx on platform_subscriptions (plan);
create index if not exists punch_cards_tier_id_idx on punch_cards (tier_id);
create index if not exists room_blocks_created_by_idx on room_blocks (created_by);
create index if not exists session_slots_subscription_id_idx on session_slots (subscription_id);
create index if not exists session_subscriptions_reviewed_by_idx on session_subscriptions (reviewed_by);
create index if not exists session_subscriptions_user_id_idx on session_subscriptions (user_id);
create index if not exists therapist_admin_notes_clinic_id_idx on therapist_admin_notes (clinic_id);
create index if not exists therapist_admin_notes_updated_by_idx on therapist_admin_notes (updated_by);
create index if not exists woo_pending_purchases_claimed_by_idx on woo_pending_purchases (claimed_by);
create index if not exists woo_pending_purchases_tier_id_idx on woo_pending_purchases (tier_id);
create index if not exists woo_product_tiers_tier_id_idx on woo_product_tiers (tier_id);
