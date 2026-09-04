"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireClinicAdmin } from "@/lib/auth/guards";

// branches/rooms אינן בין הטבלאות שדורשות RPC (רק bookings/punch_cards/
// session_subscriptions, ר' CLAUDE.md #1) — כתיבה ישירה מספיקה, מוגנת RLS.

export async function addBranchAction(formData: FormData) {
  await requireClinicAdmin();
  const supabase = await createClient();
  const name = String(formData.get("name") ?? "").trim();
  const address = String(formData.get("address") ?? "").trim();
  if (!name || !address) return;

  await supabase.rpc("create_branch", { p_name: name, p_address: address });
  revalidatePath("/admin/rooms");
}

export async function updateBranchAction(formData: FormData) {
  const { clinicId } = await requireClinicAdmin();
  const supabase = await createClient();
  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const address = String(formData.get("address") ?? "").trim();
  const active = formData.get("active") === "on";
  if (!id || !name || !address) return;

  await supabase.from("branches").update({ name, address, active }).eq("id", id).eq("clinic_id", clinicId);
  revalidatePath("/admin/rooms");
}

export async function addRoomAction(formData: FormData) {
  await requireClinicAdmin();
  const supabase = await createClient();
  const branchId = String(formData.get("branch_id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const capacity = Number(formData.get("capacity") ?? 2);
  if (!branchId || !name) return;

  const { error } = await supabase.rpc("create_room", {
    p_branch_id: branchId,
    p_name: name,
    p_room_type: ["talk"],
    p_capacity: Number.isFinite(capacity) ? capacity : 2,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/admin/rooms");
}

export async function updateRoomAction(formData: FormData) {
  const { clinicId } = await requireClinicAdmin();
  const supabase = await createClient();
  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const capacity = Number(formData.get("capacity") ?? 2);
  const description = String(formData.get("description") ?? "").trim();
  const active = formData.get("active") === "on";
  if (!id || !name) return;

  await supabase
    .from("rooms")
    .update({ name, capacity: Number.isFinite(capacity) ? capacity : 2, description: description || null, active })
    .eq("id", id)
    .eq("clinic_id", clinicId);
  revalidatePath("/admin/rooms");
}
