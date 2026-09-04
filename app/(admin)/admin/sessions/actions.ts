"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireClinicAdmin } from "@/lib/auth/guards";

export async function approveSessionAction(formData: FormData) {
  await requireClinicAdmin();
  const subscriptionId = String(formData.get("subscription_id") ?? "");
  const termRaw = formData.get("term_months");
  const termMonths = termRaw ? Number(termRaw) : undefined;
  if (!subscriptionId) return;

  const supabase = await createClient();
  const { error } = await supabase.rpc("approve_session", { p_subscription_id: subscriptionId, p_term_months: termMonths });
  if (error) throw new Error(error.message);
  revalidatePath("/admin/sessions");
}

export async function rejectSessionAction(formData: FormData) {
  await requireClinicAdmin();
  const subscriptionId = String(formData.get("subscription_id") ?? "");
  const reason = String(formData.get("reason") ?? "לא צוין");
  if (!subscriptionId) return;

  const supabase = await createClient();
  await supabase.rpc("reject_session", { p_subscription_id: subscriptionId, p_reason: reason });
  revalidatePath("/admin/sessions");
}
