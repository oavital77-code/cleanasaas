"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireClinicAdmin } from "@/lib/auth/guards";
import { getAdminSettingsDict, normalizeLocale } from "@/lib/i18n";
import { isWhatsAppProvider, renderReminderTemplate, sendWhatsAppText } from "@/lib/whatsapp";
import { formatDateHe, formatTimeHe, DEFAULT_TIMEZONE } from "@/lib/time";

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

// clinics.open_hour/close_hour — לא ברשימת הכתיבה-הישירה-האסורה של
// CLAUDE.md (רק bookings/punch_cards/session_subscriptions), ואותה תבנית
// בדיוק כמו toggleClinicPublishedAction הקיים (admin/therapists/actions.ts):
// update ישיר, scoped ב-.eq("id", clinicId) מ-requireClinicAdmin.
export async function updateClinicHoursAction(formData: FormData) {
  const { clinicId } = await requireClinicAdmin();
  const supabase = await createClient();

  const openHour = Number(formData.get("open_hour"));
  const closeHour = Number(formData.get("close_hour"));
  if (!Number.isInteger(openHour) || !Number.isInteger(closeHour)) return;
  if (openHour < 0 || openHour >= 24 || closeHour <= openHour || closeHour > 24) return;

  await supabase.from("clinics").update({ open_hour: openHour, close_hour: closeHour }).eq("id", clinicId);
  revalidatePath("/admin/settings");
  revalidatePath("/schedule");
  revalidatePath("/admin/board");
}

// 🔴 לא upsert ישיר: woo_consumer_secret/woo_webhook_secret מוצפנים
// (bytea, pgcrypto) — ההצפנה עצמה חייבת לקרות בתוך admin_set_clinic_woo_secrets
// (יש לה גישה למפתח ב-vault.decrypted_secrets, שהאפליקציה לעולם לא רואה).
// שדה ריק (לא הוזן מחדש) → null → הפונקציה שומרת על הערך הקיים, בדיוק
// כמו הסמנטיקה הקודמת (`if (consumerSecret) update....`).
export async function updatePaymentSettingsAction(formData: FormData) {
  await requireClinicAdmin();
  const supabase = await createClient();

  const storeUrl = String(formData.get("woo_store_url") ?? "").trim();
  const consumerKey = String(formData.get("woo_consumer_key") ?? "").trim();
  const consumerSecret = String(formData.get("woo_consumer_secret") ?? "").trim();
  const webhookSecret = String(formData.get("woo_webhook_secret") ?? "").trim();
  const sessionProductId = Number(formData.get("woo_session_product_id"));

  const { error } = await supabase.rpc("admin_set_clinic_woo_secrets", {
    p_woo_store_url: storeUrl || undefined,
    p_woo_consumer_key: consumerKey || undefined,
    p_woo_consumer_secret: consumerSecret || undefined,
    p_woo_webhook_secret: webhookSecret || undefined,
    p_woo_session_product_id: Number.isFinite(sessionProductId) ? sessionProductId : undefined,
  });
  if (error) throw new Error(error.message);

  revalidatePath("/admin/settings");
}

// 🔴 אותה תבנית כמו Woo: הטוקן מוצפן בתוך admin_set_clinic_whatsapp_settings
// (migration 20260906000007) — לא upsert ישיר. שדה ריק → undefined → הפונקציה
// שומרת על הערך הקיים. enabled מועבר תמיד במפורש (checkbox).
export async function updateWhatsAppSettingsAction(formData: FormData) {
  await requireClinicAdmin();
  const supabase = await createClient();

  const providerRaw = String(formData.get("provider") ?? "green_api");
  const hoursBefore = Number(formData.get("hours_before"));
  const template = String(formData.get("template") ?? "").trim();

  const { error } = await supabase.rpc("admin_set_clinic_whatsapp_settings", {
    p_enabled: formData.get("enabled") === "on",
    p_provider: isWhatsAppProvider(providerRaw) ? providerRaw : "green_api",
    p_instance_id: String(formData.get("instance_id") ?? "").trim() || undefined,
    p_api_url: String(formData.get("api_url") ?? "").trim() || undefined,
    p_api_token: String(formData.get("api_token") ?? "").trim() || undefined,
    p_sender_phone: String(formData.get("sender_phone") ?? "").trim() || undefined,
    p_hours_before: Number.isInteger(hoursBefore) && hoursBefore >= 1 && hoursBefore <= 72 ? hoursBefore : undefined,
    p_template: template || undefined,
  });
  if (error) throw new Error(error.message);

  revalidatePath("/admin/settings");
}

export type WhatsAppTestState = { message?: string; ok?: boolean };

// שליחת הודעת בדיקה לטלפון של האדמין/ית עצמו/ה — הדרך היחידה לוודא שה-QR
// אכן מקושר ושהטוקן תקין, לפני שמטפל/ת אמיתי/ת מקבל/ת (או לא) תזכורת.
// createAdminClient כי get_clinic_whatsapp_credentials מפוענח רק
// ל-service_role; ההרשאה נבדקת קודם ב-requireClinicAdmin, וה-clinicId
// מגיע ממנו (לא מהטופס).
export async function sendWhatsAppTestAction(): Promise<WhatsAppTestState> {
  const { profile, clinicId } = await requireClinicAdmin();
  const t = getAdminSettingsDict(normalizeLocale(profile.locale));
  if (!profile.phone) return { ok: false, message: t.whatsappNoPhone };

  const admin = createAdminClient();
  const [{ data: credsRows }, { data: clinic }] = await Promise.all([
    admin.rpc("get_clinic_whatsapp_credentials", { p_clinic_id: clinicId }),
    admin.from("clinics").select("name, timezone").eq("id", clinicId).maybeSingle(),
  ]);
  const creds = credsRows?.[0];
  if (!creds?.api_token || !isWhatsAppProvider(creds.provider) || (creds.provider === "green_api" && !creds.instance_id)) {
    return { ok: false, message: t.whatsappNotConfigured };
  }

  const now = new Date();
  const tz = clinic?.timezone ?? DEFAULT_TIMEZONE;
  const text = renderReminderTemplate(creds.template, {
    name: profile.full_name,
    date: formatDateHe(now, tz),
    time: formatTimeHe(now, tz),
    room: "Test",
    branch: "Test",
    clinic: clinic?.name ?? "",
  });

  const result = await sendWhatsAppText(
    { provider: creds.provider, instanceId: creds.instance_id, apiUrl: creds.api_url, apiToken: creds.api_token },
    profile.phone,
    text,
  );
  return result.ok ? { ok: true, message: t.whatsappTestSent } : { ok: false, message: t.whatsappTestFailed(result.error) };
}
