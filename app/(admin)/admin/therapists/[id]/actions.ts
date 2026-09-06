"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireClinicAdmin } from "@/lib/auth/guards";

export async function updateRoleStatusAction(formData: FormData) {
  const { clinicId } = await requireClinicAdmin();
  const userId = String(formData.get("user_id") ?? "");
  const role = String(formData.get("role") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!userId || !role || !status) return;

  const supabase = await createClient();
  await supabase
    .from("profiles")
    .update({ role: role as "owner" | "admin" | "therapist", status: status as "active" | "suspended" | "archived" })
    .eq("id", userId)
    .eq("clinic_id", clinicId);

  revalidatePath(`/admin/therapists/${userId}`);
  revalidatePath("/admin/therapists");
}

export async function updateAdminNoteAction(formData: FormData) {
  const { clinicId, userId: adminId } = await requireClinicAdmin();
  const userId = String(formData.get("user_id") ?? "");
  const note = String(formData.get("note") ?? "");
  if (!userId) return;

  const supabase = await createClient();
  await supabase
    .from("therapist_admin_notes")
    .upsert({ user_id: userId, clinic_id: clinicId, note, updated_by: adminId }, { onConflict: "user_id" });

  revalidatePath(`/admin/therapists/${userId}`);
}

export async function grantBonusHoursAction(formData: FormData) {
  await requireClinicAdmin();
  const userId = String(formData.get("user_id") ?? "");
  const hours = Number(formData.get("hours"));
  const note = String(formData.get("note") ?? "");
  if (!userId || !Number.isFinite(hours) || hours <= 0) return;

  const supabase = await createClient();
  const { error } = await supabase.rpc("grant_bonus_hours", { p_user_id: userId, p_hours: hours, p_note: note });
  if (error) {
    if (error.message.includes("BONUS_HOURS_CAP_EXCEEDED")) throw new Error("אין אפשרות להעניק יותר מ-20 שעות בפעולה אחת");
    if (error.message.includes("BONUS_HOURS_BLOCKED_DURING_TRIAL")) throw new Error("לא ניתן להעניק שעות מתנה בזמן תקופת ניסיון");
    throw new Error(error.message);
  }

  revalidatePath(`/admin/therapists/${userId}`);
}

export async function adjustPunchCardHoursAction(formData: FormData) {
  await requireClinicAdmin();
  const userId = String(formData.get("user_id") ?? "");
  const cardId = String(formData.get("card_id") ?? "");
  const delta = Number(formData.get("delta"));
  const note = String(formData.get("note") ?? "");
  if (!cardId || !Number.isFinite(delta) || delta === 0) return;

  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_adjust_punch_card_hours", { p_card_id: cardId, p_hours_delta: delta, p_note: note || "" });
  if (error) throw new Error(error.message);

  revalidatePath(`/admin/therapists/${userId}`);
}

export async function completeDepositAction(formData: FormData) {
  await requireClinicAdmin();
  const userId = String(formData.get("user_id") ?? "");
  const cardId = String(formData.get("card_id") ?? "");
  if (!cardId) return;

  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_complete_deposit", { p_punch_card_id: cardId });
  if (error) throw new Error(error.message);

  revalidatePath(`/admin/therapists/${userId}`);
}
