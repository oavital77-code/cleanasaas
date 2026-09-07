"use server";

import { currentUser } from "@clerk/nextjs/server";
import { createClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/email/resend";
import { therapistJoinedAdminEmail } from "@/lib/email/templates";
import { getAdminEmails } from "@/lib/email/recipients";
import { toE164Israel } from "@/lib/phone";

export type JoinResult = { error?: string };

// נקרא מ-<ClerkSignupForm> אחרי setActive() — ר' app/signup/actions.ts
// להסבר המלא על התבנית (session פעיל לפני שה-RPC יכול לקרוא
// auth.jwt()->>'sub', והאימייל מ-currentUser() ולא משדה טופס).
//
// 🔴 קישור פתוח/קבוע — לכן role תמיד 'therapist' בקוד עצמו (RPC), אף פעם
// לא מקבל role כפרמטר מהלקוח. הזמנת אדמין/ית ממשיכה אך ורק דרך
// /admin/therapists (create_therapist_invite, טוקן חד-פעמי).
export async function completeJoinAction(slug: string, formData: FormData): Promise<JoinResult> {
  const fullName = String(formData.get("full_name") ?? "").trim();
  const phoneRaw = String(formData.get("phone") ?? "").trim();
  if (!fullName || !phoneRaw) {
    return { error: "נא למלא את כל השדות" };
  }
  // E.164 לפני שמירה — ר' app/signup/actions.ts.
  const phone = toE164Israel(phoneRaw);
  if (!phone) {
    return { error: "מספר טלפון לא תקין — נייד ישראלי (05X-XXXXXXX)" };
  }

  const email = (await currentUser())?.primaryEmailAddress?.emailAddress;
  if (!email) {
    return { error: "שגיאה באימות החשבון — נסה/י שוב" };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .rpc("join_clinic_as_therapist", {
      p_slug: slug,
      p_full_name: fullName,
      p_phone: phone,
      p_email: email,
    })
    .single();
  if (error) return { error: translateJoinError(error.message) };

  if (data) {
    notifyAdminsOfNewTherapist(supabase, data.clinic_id, fullName).catch(() => {});
  }

  return {};
}

async function notifyAdminsOfNewTherapist(supabase: Awaited<ReturnType<typeof createClient>>, clinicId: string, therapistName: string) {
  const adminEmails = await getAdminEmails(supabase, clinicId);
  if (adminEmails.length === 0) return;
  const { subject, html } = therapistJoinedAdminEmail({ therapistName, role: "therapist" });
  await sendEmail({ to: adminEmails, subject, html });
}

function translateJoinError(code: string): string {
  const map: Record<string, string> = {
    CLINIC_NOT_FOUND: "הקישור לא תקין",
    CLINIC_NOT_PUBLISHED: "הקליניקה טרם פתחה הרשמה",
    CLINIC_SUSPENDED: "הקליניקה מושעית זמנית",
    PLAN_LIMIT_THERAPISTS: "הגיע למספר המטפלים המקסימלי בתוכנית של הקליניקה",
    ALREADY_REGISTERED: "כבר יש לך חשבון במערכת",
  };
  for (const key of Object.keys(map)) {
    if (code.includes(key)) return map[key];
  }
  return "שגיאה בהצטרפות";
}
