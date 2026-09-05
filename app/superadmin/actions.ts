"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAuthState } from "@/lib/auth/guards";

// 🔴 לא supabase.auth.getUser() ישירות: ב-client של מצב Clerk (accessToken)
// כל גישה ל-supabase.auth.* זורקת — ר' lib/auth/guards.ts.
async function requireSuperadmin() {
  const supabase = await createClient();
  const { userId } = await getAuthState();
  if (!userId) redirect("/login");
  const { data } = await supabase.from("platform_admins").select("user_id").eq("user_id", userId).maybeSingle();
  if (!data) redirect("/");
  return supabase;
}

export async function setClinicStatusAction(formData: FormData) {
  const supabase = await requireSuperadmin();
  const clinicId = String(formData.get("clinic_id") ?? "");
  const status = String(formData.get("status") ?? "") as "trial" | "active" | "suspended";
  if (!clinicId || !status) return;

  const { error } = await supabase.rpc("superadmin_set_clinic_status", { p_clinic_id: clinicId, p_status: status });
  if (error) throw new Error(error.message);
  revalidatePath("/superadmin");
}
