"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireClinicAdmin } from "@/lib/auth/guards";
import { sendEmail } from "@/lib/email/resend";
import { sessionApprovedEmail, sessionRejectedEmail } from "@/lib/email/templates";
import { getAdminSessionsDict, normalizeLocale } from "@/lib/i18n";
import { PAYMENT_INSTRUCTIONS_KEY, readPaymentInstructions } from "@/lib/payment-instructions";

export async function approveSessionAction(formData: FormData) {
  const { clinicId } = await requireClinicAdmin();
  const subscriptionId = String(formData.get("subscription_id") ?? "");
  const termRaw = formData.get("term_months");
  const termMonths = termRaw ? Number(termRaw) : undefined;
  if (!subscriptionId) return;

  const supabase = await createClient();
  const { error } = await supabase.rpc("approve_session", { p_subscription_id: subscriptionId, p_term_months: termMonths });
  if (error) throw new Error(error.message);

  notifyTherapistOfApproval(supabase, clinicId, subscriptionId).catch(() => {});
  revalidatePath("/admin/sessions");
}

const PAYMENT_METHODS = ["cash", "bit", "paybox", "credit_card", "other"] as const;
type PaymentMethod = (typeof PAYMENT_METHODS)[number];

/**
 * מצב ידני: המטפל/ת משלם/ת לקליניקה ישירות, ובעל/ת הקליניקה רושם/ת את זה
 * כאן. תשלום ראשון פותח ססיה שממתינה; תשלום על ססיה פעילה דוחה את מועד
 * החיוב בחודש (admin_record_session_payment, 20260924000002).
 */
export async function recordSessionPaymentAction(formData: FormData) {
  await requireClinicAdmin();
  const subscriptionId = String(formData.get("subscription_id") ?? "");
  const methodRaw = String(formData.get("method") ?? "cash");
  const method: PaymentMethod = (PAYMENT_METHODS as readonly string[]).includes(methodRaw) ? (methodRaw as PaymentMethod) : "cash";
  const note = String(formData.get("note") ?? "").trim();
  if (!subscriptionId) return;

  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_record_session_payment", {
    p_subscription_id: subscriptionId,
    p_method: method,
    p_note: note || undefined,
  });
  if (error) throw new Error(error.message);

  revalidatePath("/admin/sessions");
  revalidatePath("/admin/payments");
}

export async function rejectSessionAction(formData: FormData) {
  const { profile } = await requireClinicAdmin();
  const subscriptionId = String(formData.get("subscription_id") ?? "");
  // הסיבה נשמרת ב-DB ומוצגת למטפל/ת — ברירת המחדל לפי שפת האדמין שדוחה.
  const reason =
    String(formData.get("reason") ?? "").trim() || getAdminSessionsDict(normalizeLocale(profile.locale)).reasonNotGiven;
  if (!subscriptionId) return;

  const supabase = await createClient();
  await supabase.rpc("reject_session", { p_subscription_id: subscriptionId, p_reason: reason });

  notifyTherapistOfRejection(supabase, subscriptionId, reason).catch(() => {});
  revalidatePath("/admin/sessions");
}

// מצב ידני (24.9.2026): אין לינק לתשלום. המייל אומר למטפל/ת לשלם לקליניקה
// ומצרף את הוראות התשלום שהיא כתבה בהגדרות. נשלח תמיד — קודם הוא נשלח רק
// אם הוגדרה חנות Woo, כך שבקליניקה בלי חנות המטפל/ת לא ידע/ה שאושר/ה.
export async function notifyTherapistOfApproval(
  supabase: Awaited<ReturnType<typeof createClient>>,
  clinicId: string,
  subscriptionId: string,
) {
  const [{ data: sub }, { data: instructionsRow }] = await Promise.all([
    supabase.from("session_subscriptions").select("user_id").eq("id", subscriptionId).maybeSingle(),
    supabase.from("app_settings").select("value").eq("clinic_id", clinicId).eq("key", PAYMENT_INSTRUCTIONS_KEY).maybeSingle(),
  ]);
  if (!sub) return;

  const { data: profile } = await supabase.from("profiles").select("email, locale").eq("id", sub.user_id).maybeSingle();
  if (!profile) return;

  const { subject, html } = sessionApprovedEmail({
    instructions: readPaymentInstructions(instructionsRow?.value),
    locale: profile.locale,
  });
  await sendEmail({ to: profile.email, subject, html });
}

async function notifyTherapistOfRejection(
  supabase: Awaited<ReturnType<typeof createClient>>,
  subscriptionId: string,
  reason: string,
) {
  const { data: sub } = await supabase.from("session_subscriptions").select("user_id").eq("id", subscriptionId).maybeSingle();
  if (!sub) return;

  const { data: profile } = await supabase.from("profiles").select("email, locale").eq("id", sub.user_id).maybeSingle();
  if (!profile) return;

  const { subject, html } = sessionRejectedEmail(reason, profile.locale);
  await sendEmail({ to: profile.email, subject, html });
}
