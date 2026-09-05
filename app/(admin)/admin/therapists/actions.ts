"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireClinicAdmin } from "@/lib/auth/guards";

// קישור ההצטרפות הפומבי (/join/[slug]) פעיל רק כשהקליניקה "מפורסמת" —
// כך אדמין יכול להכין הכל (סניפים/חדרים/תמחור) לפני שהוא נגיש לציבור.
// role תמיד therapist בקישור הזה (ר' join_clinic_as_therapist) — הפעלה/
// כיבוי כאן לא נוגעת בהרשאות, רק בזמינות ההרשמה העצמית.
export async function toggleClinicPublishedAction(formData: FormData) {
  const { clinicId } = await requireClinicAdmin();
  const supabase = await createClient();
  const published = formData.get("published") === "on";

  await supabase.from("clinics").update({ published }).eq("id", clinicId);
  revalidatePath("/admin/therapists");
}

export async function createInviteAction(formData: FormData) {
  await requireClinicAdmin();
  const supabase = await createClient();
  const role = String(formData.get("role") ?? "therapist") as "admin" | "therapist";

  const { error } = await supabase.rpc("create_therapist_invite", { p_role: role });
  if (error) throw new Error(error.message);
  revalidatePath("/admin/therapists");
}

// clinic_invites לא ברשימת הכתיבה-הישירה-האסורה של CLAUDE.md (רק
// bookings/punch_cards/session_subscriptions) — RLS ייעודי
// (admin_manage_invites) כבר מגביל מחיקה לאדמין ולקליניקה שלו/ה בלבד.
export async function revokeInviteAction(formData: FormData) {
  const { clinicId } = await requireClinicAdmin();
  const supabase = await createClient();
  const token = String(formData.get("token") ?? "");
  if (!token) return;

  await supabase.from("clinic_invites").delete().eq("token", token).eq("clinic_id", clinicId);
  revalidatePath("/admin/therapists");
}

// ניקוי — מסיר מהרשימה קישורים שכבר נוצלו או שפג תוקפם, בלי לגעת בפעילים.
export async function clearUsedInvitesAction() {
  const { clinicId } = await requireClinicAdmin();
  const supabase = await createClient();

  await supabase
    .from("clinic_invites")
    .delete()
    .eq("clinic_id", clinicId)
    .or(`used_at.not.is.null,expires_at.lt.${new Date().toISOString()}`);
  revalidatePath("/admin/therapists");
}

// שולח מייל איפוס סיסמה סטנדרטי של Supabase Auth לכתובת המטפל/ת — לא
// חושף/משנה סיסמה בעצמו, רק מתחיל את אותה זרימה כמו "שכחתי סיסמה".
export async function adminResetPasswordAction(formData: FormData) {
  await requireClinicAdmin();
  const email = String(formData.get("email") ?? "");
  if (!email) return;

  const supabase = await createClient();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
  await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${appUrl}/reset-password` });
}
