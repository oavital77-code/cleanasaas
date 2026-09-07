"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireClinicAdmin } from "@/lib/auth/guards";
import { notifyTherapistOfApproval } from "@/app/(admin)/admin/sessions/actions";
import { getAdminSessionsDict, normalizeLocale } from "@/lib/i18n";

export type AdminCreateSessionState = { error?: string };

// 🔴 CLAUDE.md #5: admin_create_session היא ססיה חופשית לגמרי — בלי בדיקת
// התנגשות, ישר ל-awaiting_payment (מדלגת רק על שלב "requested"; התשלום
// עצמו לעולם לא מדולג). לכן אותו מייל בדיוק כמו אישור בקשה רגילה
// (notifyTherapistOfApproval) — גם כאן יש לינק לתשלום אמיתי בחנות ה-Woo.
export async function adminCreateSessionAction(
  _prev: AdminCreateSessionState,
  formData: FormData,
): Promise<AdminCreateSessionState> {
  const { clinicId, profile } = await requireClinicAdmin();
  const supabase = await createClient();
  const t = getAdminSessionsDict(normalizeLocale(profile.locale));

  const userId = String(formData.get("user_id") ?? "");
  const slotsRaw = String(formData.get("slots") ?? "[]");
  const startDate = String(formData.get("start_date") ?? "") || undefined;
  const termRaw = formData.get("term_months");
  const termMonths = termRaw ? Number(termRaw) : undefined;

  if (!userId) return { error: t.chooseTherapist };

  let slots: unknown;
  try {
    slots = JSON.parse(slotsRaw);
  } catch {
    return { error: t.invalidSlots };
  }

  const { data, error } = await supabase
    .rpc("admin_create_session", {
      p_user_id: userId,
      p_slots: slots as never,
      p_start_date: startDate,
      p_term_months: termMonths,
    })
    .single();

  if (error) {
    return { error: error.message.includes("USER_SUSPENDED") ? t.therapistSuspended : t.createError };
  }

  if (data) {
    notifyTherapistOfApproval(supabase, clinicId, data.subscription_id).catch(() => {});
  }

  revalidatePath("/admin/sessions");
  redirect("/admin/sessions");
}
