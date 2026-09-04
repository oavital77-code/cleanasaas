"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireClinicAdmin } from "@/lib/auth/guards";

export async function createInviteAction(formData: FormData) {
  await requireClinicAdmin();
  const supabase = await createClient();
  const role = String(formData.get("role") ?? "therapist") as "admin" | "therapist";

  const { error } = await supabase.rpc("create_therapist_invite", { p_role: role });
  if (error) throw new Error(error.message);
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
