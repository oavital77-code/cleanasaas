"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireClinicAdmin } from "@/lib/auth/guards";

export type AdminCreateSessionState = { error?: string };

// 🔴 CLAUDE.md #5: admin_create_session היא ססיה חופשית לגמרי — בלי בדיקת
// התנגשות, ישר ל-awaiting_payment (מדלגת רק על שלב "requested"; התשלום
// עצמו לעולם לא מדולג).
export async function adminCreateSessionAction(
  _prev: AdminCreateSessionState,
  formData: FormData,
): Promise<AdminCreateSessionState> {
  await requireClinicAdmin();
  const supabase = await createClient();

  const userId = String(formData.get("user_id") ?? "");
  const slotsRaw = String(formData.get("slots") ?? "[]");
  const startDate = String(formData.get("start_date") ?? "") || undefined;
  const termRaw = formData.get("term_months");
  const termMonths = termRaw ? Number(termRaw) : undefined;

  if (!userId) return { error: "יש לבחור מטפל/ת" };

  let slots: unknown;
  try {
    slots = JSON.parse(slotsRaw);
  } catch {
    return { error: "משבצות לא תקינות" };
  }

  const { error } = await supabase.rpc("admin_create_session", {
    p_user_id: userId,
    p_slots: slots as never,
    p_start_date: startDate,
    p_term_months: termMonths,
  });

  if (error) {
    return { error: error.message.includes("USER_SUSPENDED") ? "המטפל/ת מושעה" : "שגיאה בקביעת הססיה" };
  }

  revalidatePath("/admin/sessions");
  redirect("/admin/sessions");
}
