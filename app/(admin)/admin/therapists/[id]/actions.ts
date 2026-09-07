"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireClinicAdmin } from "@/lib/auth/guards";
import { getAdminTherapistDetailDict, normalizeLocale, translateRpcError } from "@/lib/i18n";
import { formatCurrencyILS } from "@/lib/time";

export type IssueCardState = { error?: string; message?: string };

// הנפקת כרטיסייה ידנית (מזומן/bit/העברה) — admin_issue_punch_card
// (migration 20260907000002). לא upsert ישיר על punch_cards/payments
// (CLAUDE.md #1). מדרגה → מחיר מחירון (או סכום ידני להנחה); "מותאם" →
// שעות + סכום חובה.
export async function issuePunchCardAction(_prev: IssueCardState, formData: FormData): Promise<IssueCardState> {
  const { profile } = await requireClinicAdmin();
  const locale = normalizeLocale(profile.locale);
  const t = getAdminTherapistDetailDict(locale);
  const supabase = await createClient();

  const userId = String(formData.get("user_id") ?? "");
  const tierId = String(formData.get("tier_id") ?? "");
  const hoursRaw = formData.get("hours");
  const amountRaw = formData.get("amount_total");
  const method = String(formData.get("method") ?? "cash");
  const note = String(formData.get("note") ?? "").trim();
  if (!userId) return { error: t.issueCardError };

  const hours = hoursRaw ? Number(hoursRaw) : undefined;
  const amount = amountRaw !== null && String(amountRaw).trim() !== "" ? Number(amountRaw) : undefined;
  const validMethods = ["cash", "bit", "paybox", "credit_card", "other"] as const;
  type Method = (typeof validMethods)[number];
  const safeMethod: Method = (validMethods as readonly string[]).includes(method) ? (method as Method) : "cash";

  const { data, error } = await supabase
    .rpc("admin_issue_punch_card", {
      p_user_id: userId,
      p_tier_id: tierId || undefined,
      p_hours: tierId ? undefined : hours,
      p_amount_total: amount,
      p_method: safeMethod,
      p_note: note || undefined,
    })
    .single();

  if (error) return { error: translateRpcError(locale, error.message, t.issueCardError) };

  revalidatePath(`/admin/therapists/${userId}`);
  revalidatePath("/admin/payments");
  return { message: t.issueCardDone(Number(data.hours), formatCurrencyILS(Number(data.amount_total))) };
}

// סימון הושלם / לא הגיע/ה — admin_set_booking_status. שגיאות (למשל
// הזמנה שעוד לא התחילה) נזרקות — הכפתור מוצג רק להזמנות שכבר התחילו.
export async function setBookingStatusAction(formData: FormData) {
  const { profile } = await requireClinicAdmin();
  const bookingId = String(formData.get("booking_id") ?? "");
  const userId = String(formData.get("user_id") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!bookingId || (status !== "completed" && status !== "no_show")) return;

  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_set_booking_status", { p_booking_id: bookingId, p_status: status });
  if (error) throw new Error(translateRpcError(normalizeLocale(profile.locale), error.message, error.message));

  revalidatePath(`/admin/therapists/${userId}`);
  revalidatePath("/admin/board");
}

export type OverrunState = { error?: string; message?: string };

// רישום חריגת זמן — record_overrun (קיים מהיום הראשון, לא היה לו UI):
// מנכה מהפיקדון אם יש, אחרת יוצר payment 'overrun' ממתין.
export async function recordOverrunAction(_prev: OverrunState, formData: FormData): Promise<OverrunState> {
  const { profile } = await requireClinicAdmin();
  const locale = normalizeLocale(profile.locale);
  const t = getAdminTherapistDetailDict(locale);
  const bookingId = String(formData.get("booking_id") ?? "");
  const userId = String(formData.get("user_id") ?? "");
  const minutes = Number(formData.get("minutes"));
  const note = String(formData.get("note") ?? "").trim();
  if (!bookingId || !Number.isInteger(minutes) || minutes <= 0) return { error: t.overrunError };

  const supabase = await createClient();
  const { data, error } = await supabase
    .rpc("record_overrun", { p_booking_id: bookingId, p_minutes: minutes, p_note: note || "" })
    .single();
  if (error) return { error: translateRpcError(locale, error.message, t.overrunError) };

  revalidatePath(`/admin/therapists/${userId}`);
  revalidatePath("/admin/payments");
  return { message: t.overrunDone(formatCurrencyILS(Number(data.amount)), data.source) };
}

export async function updateRoleStatusAction(formData: FormData) {
  const { clinicId } = await requireClinicAdmin();
  const userId = String(formData.get("user_id") ?? "");
  const role = String(formData.get("role") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!userId || !role || !status) return;

  const supabase = await createClient();
  await supabase
    .from("profiles")
    .update({ role: role as "owner" | "admin" | "therapist", status: status as "active" | "suspended" | "archived" })
    .eq("id", userId)
    .eq("clinic_id", clinicId);

  revalidatePath(`/admin/therapists/${userId}`);
  revalidatePath("/admin/therapists");
}

export async function updateAdminNoteAction(formData: FormData) {
  const { clinicId, userId: adminId } = await requireClinicAdmin();
  const userId = String(formData.get("user_id") ?? "");
  const note = String(formData.get("note") ?? "");
  if (!userId) return;

  const supabase = await createClient();
  await supabase
    .from("therapist_admin_notes")
    .upsert({ user_id: userId, clinic_id: clinicId, note, updated_by: adminId }, { onConflict: "user_id" });

  revalidatePath(`/admin/therapists/${userId}`);
}

export async function grantBonusHoursAction(formData: FormData) {
  const { profile } = await requireClinicAdmin();
  const userId = String(formData.get("user_id") ?? "");
  const hours = Number(formData.get("hours"));
  const note = String(formData.get("note") ?? "");
  if (!userId || !Number.isFinite(hours) || hours <= 0) return;

  const supabase = await createClient();
  const { error } = await supabase.rpc("grant_bonus_hours", { p_user_id: userId, p_hours: hours, p_note: note });
  if (error) {
    // BONUS_HOURS_CAP_EXCEEDED / BONUS_HOURS_BLOCKED_DURING_TRIAL — מתורגמים
    // דרך המילון המשותף; קוד לא מוכר נזרק כמו שהוא.
    throw new Error(translateRpcError(normalizeLocale(profile.locale), error.message, error.message));
  }

  revalidatePath(`/admin/therapists/${userId}`);
}

export async function adjustPunchCardHoursAction(formData: FormData) {
  await requireClinicAdmin();
  const userId = String(formData.get("user_id") ?? "");
  const cardId = String(formData.get("card_id") ?? "");
  const delta = Number(formData.get("delta"));
  const note = String(formData.get("note") ?? "");
  if (!cardId || !Number.isFinite(delta) || delta === 0) return;

  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_adjust_punch_card_hours", { p_card_id: cardId, p_hours_delta: delta, p_note: note || "" });
  if (error) throw new Error(error.message);

  revalidatePath(`/admin/therapists/${userId}`);
}

export async function completeDepositAction(formData: FormData) {
  await requireClinicAdmin();
  const userId = String(formData.get("user_id") ?? "");
  const cardId = String(formData.get("card_id") ?? "");
  if (!cardId) return;

  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_complete_deposit", { p_punch_card_id: cardId });
  if (error) throw new Error(error.message);

  revalidatePath(`/admin/therapists/${userId}`);
}
