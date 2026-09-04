"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type LoginState = { error?: string };

export async function loginAction(_prevState: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) {
    return { error: "נא למלא אימייל וסיסמה" };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    return { error: "פרטי התחברות שגויים" };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "שגיאה בהתחברות" };
  }

  const { data: profile } = await supabase.from("profiles").select("id").eq("id", user.id).maybeSingle();
  redirect(profile ? "/" : "/onboarding");
}

export type ResetRequestState = { sent?: boolean; error?: string };

export async function requestPasswordResetAction(
  _prevState: ResetRequestState,
  formData: FormData,
): Promise<ResetRequestState> {
  const email = String(formData.get("email") ?? "").trim();
  if (!email) return { error: "נא למלא אימייל" };

  const supabase = await createClient();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
  await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${appUrl}/reset-password` });

  // אין הבדל בתשובה בין מייל קיים ללא-קיים — לא לחשוף אילו מיילים רשומים.
  return { sent: true };
}
