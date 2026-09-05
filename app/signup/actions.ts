"use server";

import { currentUser } from "@clerk/nextjs/server";
import { createClient } from "@/lib/supabase/server";

export type SignupResult = { error?: string };

// נקרא מ-<ClerkSignupForm> אחרי setActive() — כלומר יש כבר session פעיל של
// Clerk ברגע שהפונקציה הזו רצה, ו-signup_clinic (RPC) קוראת את הזהות דרך
// auth.jwt()->>'sub'. האימייל מגיע מ-currentUser() (Backend API מאומת של
// Clerk) ולא משדה טופס — זהה לעיקרון של link_clerk_identity().
export async function completeSignupClinicAction(formData: FormData): Promise<SignupResult> {
  const clinicName = String(formData.get("clinic_name") ?? "").trim();
  const slug = String(formData.get("slug") ?? "").trim().toLowerCase();
  const ownerFullName = String(formData.get("owner_full_name") ?? "").trim();
  const ownerPhone = String(formData.get("owner_phone") ?? "").trim();

  if (!clinicName || !slug || !ownerFullName || !ownerPhone) {
    return { error: "נא למלא את כל השדות" };
  }
  if (!/^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$/.test(slug)) {
    return { error: "כתובת (slug) לא תקינה — אותיות לועזיות קטנות, ספרות ומקף בלבד" };
  }

  const email = (await currentUser())?.primaryEmailAddress?.emailAddress;
  if (!email) {
    return { error: "שגיאה באימות החשבון — נסה/י שוב" };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("signup_clinic", {
    p_clinic_name: clinicName,
    p_slug: slug,
    p_owner_full_name: ownerFullName,
    p_owner_phone: ownerPhone,
    p_owner_email: email,
  });

  if (error) return { error: translateSignupError(error.message) };
  return {};
}

function translateSignupError(code: string): string {
  const map: Record<string, string> = {
    SLUG_TAKEN: "הכתובת (slug) הזו כבר תפוסה — נסה/י אחרת",
    INVALID_SLUG: "כתובת (slug) לא תקינה",
    INVALID_INPUT: "נא למלא את כל השדות",
    ALREADY_REGISTERED: "כבר יש לך חשבון במערכת",
  };
  for (const key of Object.keys(map)) {
    if (code.includes(key)) return map[key];
  }
  return "שגיאה ביצירת הקליניקה";
}
