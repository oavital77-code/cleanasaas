"use server";

import { currentUser } from "@clerk/nextjs/server";
import { createClient } from "@/lib/supabase/server";

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
  const phone = String(formData.get("phone") ?? "").trim();
  if (!fullName || !phone) {
    return { error: "נא למלא את כל השדות" };
  }

  const email = (await currentUser())?.primaryEmailAddress?.emailAddress;
  if (!email) {
    return { error: "שגיאה באימות החשבון — נסה/י שוב" };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("join_clinic_as_therapist", {
    p_slug: slug,
    p_full_name: fullName,
    p_phone: phone,
    p_email: email,
  });
  if (error) return { error: translateJoinError(error.message) };
  return {};
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
