"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireClinicAdmin } from "@/lib/auth/guards";
import {
  IMAGE_BUCKET,
  MAX_ROOM_IMAGES,
  clinicImagePath,
  imageExtensionFor,
  pathBelongsToClinic,
  roomImagePath,
} from "@/lib/storage/images";

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

// ---------------------------------------------------------------------------
// תמונות (בקשת המשתמש/ת 09/09) — ר' lib/storage/images.ts.
// ה-storage נכתב דרך service role אחרי requireClinicAdmin (הנתיב נבנה
// מ-clinicId של ה-guard, לא מהטופס), וה-DB (rooms.images / clinics.image_path)
// דרך ה-client הרגיל תחת RLS. הודעות שגיאה חוזרות כ-?notice= כמו ב-settings.
// ---------------------------------------------------------------------------
function roomsRedirect(notice?: string): never {
  redirect(notice ? `/admin/rooms?notice=${notice}` : "/admin/rooms");
}

async function uploadImage(path: string, file: File): Promise<boolean> {
  const admin = createAdminClient();
  const { error } = await admin.storage
    .from(IMAGE_BUCKET)
    .upload(path, Buffer.from(await file.arrayBuffer()), { contentType: file.type, upsert: false });
  return !error;
}

export async function uploadRoomImageAction(formData: FormData) {
  const { clinicId } = await requireClinicAdmin();
  const supabase = await createClient();
  const roomId = String(formData.get("room_id") ?? "");
  const file = formData.get("file");
  if (!roomId || !(file instanceof File)) roomsRedirect("image_invalid");

  const ext = imageExtensionFor(file);
  if (!ext) roomsRedirect("image_invalid");

  const { data: room } = await supabase.from("rooms").select("images").eq("id", roomId).eq("clinic_id", clinicId).maybeSingle();
  if (!room) roomsRedirect("image_invalid");
  const images = room.images ?? [];
  if (images.length >= MAX_ROOM_IMAGES) roomsRedirect("image_limit");

  const path = roomImagePath(clinicId, roomId, ext);
  if (!(await uploadImage(path, file))) roomsRedirect("image_failed");

  await supabase.from("rooms").update({ images: [...images, path] }).eq("id", roomId).eq("clinic_id", clinicId);
  revalidatePath("/admin/rooms");
  revalidatePath("/schedule");
  revalidatePath("/admin/board");
  roomsRedirect();
}

export async function deleteRoomImageAction(formData: FormData) {
  const { clinicId } = await requireClinicAdmin();
  const supabase = await createClient();
  const roomId = String(formData.get("room_id") ?? "");
  const path = String(formData.get("path") ?? "");
  if (!roomId || !path || !pathBelongsToClinic(path, clinicId)) roomsRedirect("image_invalid");

  const { data: room } = await supabase.from("rooms").select("images").eq("id", roomId).eq("clinic_id", clinicId).maybeSingle();
  if (!room) roomsRedirect("image_invalid");

  await supabase
    .from("rooms")
    .update({ images: (room.images ?? []).filter((p) => p !== path) })
    .eq("id", roomId)
    .eq("clinic_id", clinicId);
  await createAdminClient().storage.from(IMAGE_BUCKET).remove([path]);
  revalidatePath("/admin/rooms");
  revalidatePath("/schedule");
  revalidatePath("/admin/board");
  roomsRedirect();
}

export async function uploadClinicImageAction(formData: FormData) {
  const { clinicId } = await requireClinicAdmin();
  const supabase = await createClient();
  const file = formData.get("file");
  if (!(file instanceof File)) roomsRedirect("image_invalid");
  const ext = imageExtensionFor(file);
  if (!ext) roomsRedirect("image_invalid");

  const { data: clinic } = await supabase.from("clinics").select("image_path").eq("id", clinicId).single();
  const path = clinicImagePath(clinicId, ext);
  if (!(await uploadImage(path, file))) roomsRedirect("image_failed");

  await supabase.from("clinics").update({ image_path: path }).eq("id", clinicId);
  if (clinic?.image_path && pathBelongsToClinic(clinic.image_path, clinicId)) {
    await createAdminClient().storage.from(IMAGE_BUCKET).remove([clinic.image_path]);
  }
  revalidatePath("/", "layout");
  roomsRedirect();
}

export async function deleteClinicImageAction() {
  const { clinicId } = await requireClinicAdmin();
  const supabase = await createClient();
  const { data: clinic } = await supabase.from("clinics").select("image_path").eq("id", clinicId).single();
  await supabase.from("clinics").update({ image_path: null }).eq("id", clinicId);
  if (clinic?.image_path && pathBelongsToClinic(clinic.image_path, clinicId)) {
    await createAdminClient().storage.from(IMAGE_BUCKET).remove([clinic.image_path]);
  }
  revalidatePath("/", "layout");
  roomsRedirect();
}
