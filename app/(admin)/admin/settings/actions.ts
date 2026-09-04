"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireClinicAdmin } from "@/lib/auth/guards";

// SAASMIGRATIONSPEC §6: מסך "תשלומים וכרטיסיות" — חלק א' (מחירים, ישירות על
// punch_card_tiers/app_settings, לא RPC — אינן בין הטבלאות שדורשות RPC) +
// חלק ב' (שיטת תשלום, clinic_payment_settings, סוד מוגן ב-RLS).

export async function updatePunchCardTierAction(formData: FormData) {
  const { clinicId } = await requireClinicAdmin();
  const supabase = await createClient();

  const id = String(formData.get("id") ?? "");
  const pricePerHour = Number(formData.get("price_per_hour"));
  const depositHours = Number(formData.get("deposit_hours"));
  if (!id || !Number.isFinite(pricePerHour)) return;

  await supabase
    .from("punch_card_tiers")
    .update({ price_per_hour: pricePerHour, deposit_hours: Number.isFinite(depositHours) ? depositHours : 0 })
    .eq("id", id)
    .eq("clinic_id", clinicId);

  revalidatePath("/admin/settings");
}

export async function updateSessionPricingAction(formData: FormData) {
  const { clinicId } = await requireClinicAdmin();
  const supabase = await createClient();

  const basePrice = Number(formData.get("session_base_price"));
  const baseHours = Number(formData.get("session_base_hours"));

  await supabase
    .from("app_settings")
    .upsert(
      [
        { clinic_id: clinicId, key: "session_base_price", value: basePrice },
        { clinic_id: clinicId, key: "session_base_hours", value: baseHours },
      ],
      { onConflict: "clinic_id,key" },
    );

  revalidatePath("/admin/settings");
}

export async function updatePaymentSettingsAction(formData: FormData) {
  const { clinicId, userId } = await requireClinicAdmin();
  const supabase = await createClient();

  const storeUrl = String(formData.get("woo_store_url") ?? "").trim();
  const consumerKey = String(formData.get("woo_consumer_key") ?? "").trim();
  const consumerSecret = String(formData.get("woo_consumer_secret") ?? "").trim();
  const webhookSecret = String(formData.get("woo_webhook_secret") ?? "").trim();
  const sessionProductId = Number(formData.get("woo_session_product_id"));

  const update: Record<string, string | null> = {};
  if (storeUrl) update.woo_store_url = storeUrl;
  if (consumerKey) update.woo_consumer_key = consumerKey;
  if (consumerSecret) update.woo_consumer_secret = consumerSecret;
  if (webhookSecret) update.woo_webhook_secret = webhookSecret;

  await supabase.from("clinic_payment_settings").upsert(
    { clinic_id: clinicId, ...update, updated_by: userId },
    { onConflict: "clinic_id" },
  );

  if (Number.isFinite(sessionProductId)) {
    await supabase
      .from("app_settings")
      .upsert(
        { clinic_id: clinicId, key: "woo_session_product_id", value: sessionProductId },
        { onConflict: "clinic_id,key" },
      );
  }

  revalidatePath("/admin/settings");
}
