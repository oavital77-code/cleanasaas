"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

async function requireSuperadmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data } = await supabase.from("platform_admins").select("user_id").eq("user_id", user.id).maybeSingle();
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
