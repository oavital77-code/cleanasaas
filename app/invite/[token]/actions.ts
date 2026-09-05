"use server";

import { currentUser } from "@clerk/nextjs/server";
import { createClient } from "@/lib/supabase/server";

export type InviteResult = { error?: string };

// נקרא מ-<ClerkSignupForm> אחרי setActive() — ר' app/signup/actions.ts
// להסבר המלא על התבנית.
export async function completeInviteAction(token: string, formData: FormData): Promise<InviteResult> {
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
  const { error } = await supabase.rpc("accept_therapist_invite", {
    p_token: token,
    p_full_name: fullName,
    p_phone: phone,
    p_email: email,
  });
  if (error) return { error: translateInviteError(error.message) };
  return {};
}

function translateInviteError(code: string): string {
  const map: Record<string, string> = {
    INVITE_INVALID: "קישור ההזמנה לא תקף",
    PLAN_LIMIT_THERAPISTS: "הגיע למספר המטפלים המקסימלי בתוכנית של הקליניקה",
    ALREADY_REGISTERED: "כבר יש לך חשבון במערכת",
  };
  for (const key of Object.keys(map)) {
    if (code.includes(key)) return map[key];
  }
  return "שגיאה בהצטרפות";
}
