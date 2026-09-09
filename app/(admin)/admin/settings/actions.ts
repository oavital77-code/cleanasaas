"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireClinicAdmin } from "@/lib/auth/guards";
import { getAdminSettingsDict, normalizeLocale } from "@/lib/i18n";
import { sendWhatsAppReminderTemplate } from "@/lib/whatsapp";
import { formatDateHe, formatTimeHe, DEFAULT_TIMEZONE } from "@/lib/time";

// SAASMIGRATIONSPEC §6: מסך "תשלומים וכרטיסיות" — חלק א' (מחירים, ישירות על
// punch_card_tiers/app_settings, לא RPC — אינן בין הטבלאות שדורשות RPC) +
// חלק ב' (שיטת תשלום, clinic_payment_settings, סוד מוגן ב-RLS).

// עורך מדרגות מלא (בקשת המשתמש/ת 09/09): הוספה/הסרה/עריכת שעות, מחיר,
// פיקדון והפעלה — מנהל/ת הקליניקה מגדיר/ה מה שרוצה. המדרגות משמשות את כל
// מסלולי התשלום: חנות Woo (woo_product_tiers ממפה מוצר→מדרגה), הנפקה
// ידנית (admin_issue_punch_card: מזומן/ביט/העברה) והצעות מחיר למטפל/ת.
// שגיאות (שעות כפולות, מדרגה בשימוש) חוזרות כ-?notice= כי הטפסים הם
// server actions רגילים בלי state — הדף מציג את ההודעה.
function tierRedirect(notice?: string): never {
  redirect(notice ? `/admin/settings?notice=${notice}#tiers` : "/admin/settings#tiers");
}

function parseTierFields(formData: FormData) {
  const hours = Number(formData.get("hours"));
  const pricePerHour = Number(formData.get("price_per_hour"));
  const depositHours = Number(formData.get("deposit_hours"));
  const valid =
    Number.isInteger(hours) && hours >= 1 && hours <= 1000 &&
    Number.isFinite(pricePerHour) && pricePerHour >= 0 &&
    Number.isInteger(depositHours) && depositHours >= 0 && depositHours <= hours;
  return { hours, pricePerHour, depositHours, valid };
}

export async function updatePunchCardTierAction(formData: FormData) {
  const { clinicId } = await requireClinicAdmin();
  const supabase = await createClient();

  const id = String(formData.get("id") ?? "");
  const { hours, pricePerHour, depositHours, valid } = parseTierFields(formData);
  if (!id || !valid) tierRedirect("tier_invalid");

  const { error } = await supabase
    .from("punch_card_tiers")
    .update({ hours, price_per_hour: pricePerHour, deposit_hours: depositHours, active: formData.get("active") === "on" })
    .eq("id", id)
    .eq("clinic_id", clinicId);
  if (error) tierRedirect(error.code === "23505" ? "tier_hours_taken" : "tier_error");

  revalidatePath("/admin/settings");
  tierRedirect();
}

export async function addPunchCardTierAction(formData: FormData) {
  const { clinicId } = await requireClinicAdmin();
  const supabase = await createClient();

  const { hours, pricePerHour, depositHours, valid } = parseTierFields(formData);
  if (!valid) tierRedirect("tier_invalid");

  const { data: last } = await supabase
    .from("punch_card_tiers")
    .select("sort_order")
    .eq("clinic_id", clinicId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { error } = await supabase.from("punch_card_tiers").insert({
    clinic_id: clinicId,
    hours,
    price_per_hour: pricePerHour,
    deposit_hours: depositHours,
    active: true,
    sort_order: (last?.sort_order ?? -1) + 1,
  });
  if (error) tierRedirect(error.code === "23505" ? "tier_hours_taken" : "tier_error");

  revalidatePath("/admin/settings");
  tierRedirect();
}

// מחיקה — רק כשאין כרטיסיות על המדרגה (FK RESTRICT מ-punch_cards.tier_id)
// ואין מיפוי מוצר Woo אליה. אחרת: השבתה (active=false) — המדרגה נעלמת
// מהמטפלים/ות ומההנפקה הידנית, אבל ההיסטוריה של הכרטיסיות נשמרת.
export async function deletePunchCardTierAction(formData: FormData) {
  const { clinicId } = await requireClinicAdmin();
  const supabase = await createClient();
  const id = String(formData.get("id") ?? "");
  if (!id) tierRedirect("tier_invalid");

  const [{ count: cards }, { count: wooMappings }] = await Promise.all([
    supabase.from("punch_cards").select("id", { count: "exact", head: true }).eq("tier_id", id),
    supabase.from("woo_product_tiers").select("tier_id", { count: "exact", head: true }).eq("tier_id", id),
  ]);

  if ((cards ?? 0) > 0 || (wooMappings ?? 0) > 0) {
    await supabase.from("punch_card_tiers").update({ active: false }).eq("id", id).eq("clinic_id", clinicId);
    revalidatePath("/admin/settings");
    tierRedirect("tier_deactivated_in_use");
  }

  const { error } = await supabase.from("punch_card_tiers").delete().eq("id", id).eq("clinic_id", clinicId);
  if (error) tierRedirect("tier_error");

  revalidatePath("/admin/settings");
  tierRedirect("tier_deleted");
}

// מודל ססיה (מנוי חודשי) הוא אופציונלי לקליניקה — אותו דגל בדיוק
// (clinics.sessions_enabled) שה-onboarding מציב, ו-request_session בודק
// (SESSIONS_NOT_ENABLED). כשכבוי: המטפלים/ות לא רואים/ות בקשת ססיה,
// ומחירי הססיה מוסתרים כאן.
export async function toggleSessionsEnabledAction(formData: FormData) {
  const { clinicId } = await requireClinicAdmin();
  const supabase = await createClient();
  const enabled = formData.get("sessions_enabled") === "on";

  await supabase.from("clinics").update({ sessions_enabled: enabled }).eq("id", clinicId);
  revalidatePath("/admin/settings");
  revalidatePath("/sessions");
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

  const hoursBefore = Number(formData.get("hours_before"));
  const template = String(formData.get("template") ?? "").trim();
  const templateLang = String(formData.get("template_lang") ?? "").trim();

  const { error } = await supabase.rpc("admin_set_clinic_whatsapp_settings", {
    p_enabled: formData.get("enabled") === "on",
    p_phone_number_id: String(formData.get("phone_number_id") ?? "").trim() || undefined,
    p_access_token: String(formData.get("access_token") ?? "").trim() || undefined,
    p_sender_phone: String(formData.get("sender_phone") ?? "").trim() || undefined,
    p_hours_before: Number.isInteger(hoursBefore) && hoursBefore >= 1 && hoursBefore <= 72 ? hoursBefore : undefined,
    p_template: template || undefined,
    p_template_name: String(formData.get("template_name") ?? "").trim() || undefined,
    p_template_lang: /^[a-z]{2}(_[A-Z]{2})?$/.test(templateLang) ? templateLang : undefined,
  });
  if (error) throw new Error(error.message);

  revalidatePath("/admin/settings");
  revalidatePath("/admin/reminders");
}

export type WhatsAppTestState = { message?: string; ok?: boolean };

// שליחת הודעת בדיקה (התבנית המאושרת, עם ערכי דוגמה) לטלפון של האדמין/ית
// עצמו/ה — מוודא Phone Number ID + טוקן + שם/שפת תבנית מול Meta לפני
// שמטפל/ת אמיתי/ת תלוי/ה בזה. createAdminClient כי get_clinic_whatsapp_credentials
// מפוענח רק ל-service_role; ההרשאה נבדקת קודם ב-requireClinicAdmin,
// וה-clinicId מגיע ממנו (לא מהטופס).
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
  if (!creds?.access_token || !creds.phone_number_id || !creds.template_name) {
    return { ok: false, message: t.whatsappNotConfigured };
  }

  const now = new Date();
  const tz = clinic?.timezone ?? DEFAULT_TIMEZONE;
  const result = await sendWhatsAppReminderTemplate(
    {
      phoneNumberId: creds.phone_number_id,
      accessToken: creds.access_token,
      templateName: creds.template_name,
      templateLang: creds.template_lang,
    },
    profile.phone,
    {
      name: profile.full_name,
      clinic: clinic?.name ?? "",
      date: formatDateHe(now, tz),
      time: formatTimeHe(now, tz),
      room: "Test",
      branch: "Test",
    },
  );
  return result.ok ? { ok: true, message: t.whatsappTestSent } : { ok: false, message: t.whatsappTestFailed(result.error) };
}
