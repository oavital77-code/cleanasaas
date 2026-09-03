"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type SignupState = { error?: string; needsConfirmation?: boolean };

// שלב 1 של ההרשמה (SAASMIGRATIONSPEC §5): פרטי החשבון + פרטי העסק הבסיסיים
// נאספים כאן, אבל clinics+profiles נוצרים רק ב-signup_clinic (RPC), שרצה רק
// אחרי שיש auth.uid() אמיתי. פרטי הקליניקה/owner נשמרים זמנית ב-user
// metadata כדי לשרוד גם זרימת "אימות מייל לפני login" (auth.uid() עדיין לא
// קיים באותו רגע) — /onboarding משלים את signup_clinic ברגע שיש session.
export async function signupAction(_prevState: SignupState, formData: FormData): Promise<SignupState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const clinicName = String(formData.get("clinic_name") ?? "").trim();
  const slug = String(formData.get("slug") ?? "").trim().toLowerCase();
  const ownerFullName = String(formData.get("owner_full_name") ?? "").trim();
  const ownerPhone = String(formData.get("owner_phone") ?? "").trim();

  if (!email || !password || !clinicName || !slug || !ownerFullName || !ownerPhone) {
    return { error: "נא למלא את כל השדות" };
  }
  if (!/^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$/.test(slug)) {
    return { error: "כתובת (slug) לא תקינה — אותיות לועזיות קטנות, ספרות ומקף בלבד" };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        pending_clinic_name: clinicName,
        pending_slug: slug,
        pending_owner_full_name: ownerFullName,
        pending_owner_phone: ownerPhone,
      },
    },
  });

  if (error) {
    return { error: error.message };
  }

  if (!data.session) {
    return { needsConfirmation: true };
  }

  redirect("/onboarding");
}
