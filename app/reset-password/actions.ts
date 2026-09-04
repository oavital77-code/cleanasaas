"use server";

import { createClient } from "@/lib/supabase/server";

export type SetPasswordState = { error?: string; success?: boolean };

// הקישור במייל האיפוס יוצר session זמני (recovery) לפני שהמשתמש/ת מגיע/ה
// לכאן — supabase.auth.updateUser עובד מולו כרגיל.
export async function setNewPasswordAction(_prevState: SetPasswordState, formData: FormData): Promise<SetPasswordState> {
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  if (password.length < 8) return { error: "הסיסמה חייבת להיות באורך 8 תווים לפחות" };
  if (password !== confirm) return { error: "הסיסמאות לא תואמות" };

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: "הקישור פג תוקף — בקשו קישור איפוס חדש" };

  return { success: true };
}
