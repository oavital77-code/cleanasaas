"use server";

import { currentUser } from "@clerk/nextjs/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email/resend";
import { therapistJoinedAdminEmail } from "@/lib/email/templates";
import { getAdminEmails } from "@/lib/email/recipients";
import { toE164Israel } from "@/lib/phone";

export type InviteResult = { error?: string };

// נקרא מ-<ClerkSignupForm> אחרי setActive() — ר' app/signup/actions.ts
// להסבר המלא על התבנית.
export async function completeInviteAction(token: string, formData: FormData): Promise<InviteResult> {
  const fullName = String(formData.get("full_name") ?? "").trim();
  const phoneRaw = String(formData.get("phone") ?? "").trim();
  if (!fullName || !phoneRaw) {
    return { error: "צריך למלא את כל השדות" };
  }
  // E.164 לפני שמירה — ר' app/signup/actions.ts.
  const phone = toE164Israel(phoneRaw);
  if (!phone) {
    return { error: "צריך מספר נייד ישראלי תקין, למשל 050-1234567" };
  }

  const email = (await currentUser())?.primaryEmailAddress?.emailAddress;
  if (!email) {
    return { error: "לא הצלחנו לאמת את החשבון. נסו שוב." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .rpc("accept_therapist_invite", {
      p_token: token,
      p_full_name: fullName,
      p_phone: phone,
      p_email: email,
    })
    .single();
  if (error) return { error: translateInviteError(error.message) };

  if (data) {
    notifyAdminsOfNewTherapist(data.clinic_id, token, fullName).catch(() => {});
  }

  return {};
}

// role לא חוזר מ-accept_therapist_invite (רק clinic_id) — נשלף מהזמנה
// עצמה (clinic_invites.role, אותו ערך ש-createInviteAction קבע). service
// role כי אין עדיין session/profile מתאים לקרוא דרך RLS כאן, בדיוק כמו
// בדיקת התוקף של ההזמנה ב-page.tsx.
async function notifyAdminsOfNewTherapist(clinicId: string, token: string, therapistName: string) {
  const admin = createAdminClient();
  const { data: invite } = await admin.from("clinic_invites").select("role").eq("token", token).maybeSingle();
  const role = invite?.role === "admin" ? "admin" : "therapist";

  const supabase = await createClient();
  const adminEmails = await getAdminEmails(supabase, clinicId);
  if (adminEmails.length === 0) return;
  const { subject, html } = therapistJoinedAdminEmail({ therapistName, role });
  await sendEmail({ to: adminEmails, subject, html });
}

function translateInviteError(code: string): string {
  const map: Record<string, string> = {
    INVITE_INVALID: "קישור ההזמנה לא תקף",
    PLAN_LIMIT_THERAPISTS: "הקליניקה הגיעה למספר המטפלים המרבי במסלול שלה",
    ALREADY_REGISTERED: "כבר יש לך חשבון במערכת",
    EMAIL_ALREADY_REGISTERED: "המייל הזה כבר רשום בחשבון אחר. אפשר להיכנס איתו, או לפנות להנהלת הקליניקה.",
  };
  for (const key of Object.keys(map)) {
    if (code.includes(key)) return map[key];
  }
  return "ההצטרפות לא הצליחה. נסו שוב.";
}
