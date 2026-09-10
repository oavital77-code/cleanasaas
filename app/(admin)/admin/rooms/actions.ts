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
  isClinicImagePath,
  isImageExt,
  isRoomImagePath,
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
// תמונות — ר' lib/storage/images.ts להסבר המלא על הזרימה.
//
// 🔴 הקובץ עצמו לא עובר כאן. הדפדפן מכווץ, מבקש signed upload URL (הפעולות
// הראשונות למטה — בלי גוף כבד), מעלה ישירות ל-Supabase, ואז שולח את הנתיב
// בלבד ל-attach*. זה מה שתיקן את ה-"server-side exception" בהעלאה מהנייד:
// גוף בקשה לפונקציית Vercel מוגבל ל-~4.5MB ונדחה לפני שהפעולה רצה.
// ---------------------------------------------------------------------------

export type UploadTicket = { path: string; token: string; error?: never } | { error: string; path?: never; token?: never };

async function signedUploadTicket(path: string): Promise<UploadTicket> {
  const { data, error } = await createAdminClient().storage.from(IMAGE_BUCKET).createSignedUploadUrl(path);
  if (error || !data) return { error: "UPLOAD_URL_FAILED" };
  return { path: data.path, token: data.token };
}

export async function createRoomImageUploadUrlAction(roomId: string, ext: string): Promise<UploadTicket> {
  const { clinicId } = await requireClinicAdmin();
  if (!isImageExt(ext)) return { error: "IMAGE_INVALID" };

  const supabase = await createClient();
  const { data: room } = await supabase.from("rooms").select("images").eq("id", roomId).eq("clinic_id", clinicId).maybeSingle();
  if (!room) return { error: "IMAGE_INVALID" };
  if ((room.images ?? []).length >= MAX_ROOM_IMAGES) return { error: "IMAGE_LIMIT" };

  return signedUploadTicket(roomImagePath(clinicId, roomId, ext));
}

// נקרא אחרי שההעלאה הישירה הצליחה. הנתיב נבדק מול הקליניקה **והחדר** — הוא
// חוזר מהלקוח, אז לא סומכים עליו: רק נתיב שאנחנו בעצמנו היינו מייצרים.
export async function attachRoomImageAction(roomId: string, path: string): Promise<{ error?: string }> {
  const { clinicId } = await requireClinicAdmin();
  if (!isRoomImagePath(path, clinicId, roomId)) return { error: "IMAGE_INVALID" };

  const supabase = await createClient();
  const { data: room } = await supabase.from("rooms").select("images").eq("id", roomId).eq("clinic_id", clinicId).maybeSingle();
  if (!room) return { error: "IMAGE_INVALID" };
  const images = room.images ?? [];
  if (images.includes(path)) return {};
  if (images.length >= MAX_ROOM_IMAGES) return { error: "IMAGE_LIMIT" };

  const { error } = await supabase.from("rooms").update({ images: [...images, path] }).eq("id", roomId).eq("clinic_id", clinicId);
  if (error) return { error: "IMAGE_FAILED" };

  revalidatePath("/admin/rooms");
  revalidatePath("/schedule");
  revalidatePath("/admin/board");
  return {};
}

export async function deleteRoomImageAction(formData: FormData) {
  const { clinicId } = await requireClinicAdmin();
  const supabase = await createClient();
  const roomId = String(formData.get("room_id") ?? "");
  const path = String(formData.get("path") ?? "");
  if (!roomId || !isRoomImagePath(path, clinicId, roomId)) roomsRedirect("image_invalid");

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

export async function createClinicImageUploadUrlAction(ext: string): Promise<UploadTicket> {
  const { clinicId } = await requireClinicAdmin();
  if (!isImageExt(ext)) return { error: "IMAGE_INVALID" };
  return signedUploadTicket(clinicImagePath(clinicId, ext));
}

export async function attachClinicImageAction(path: string): Promise<{ error?: string }> {
  const { clinicId } = await requireClinicAdmin();
  if (!isClinicImagePath(path, clinicId)) return { error: "IMAGE_INVALID" };

  const supabase = await createClient();
  const { data: clinic } = await supabase.from("clinics").select("image_path").eq("id", clinicId).single();
  const { error } = await supabase.from("clinics").update({ image_path: path }).eq("id", clinicId);
  if (error) return { error: "IMAGE_FAILED" };

  // התמונה הקודמת נמחקת רק אחרי שהחדשה נשמרה — כך שכשל באמצע לא משאיר
  // קליניקה בלי תמונה בכלל.
  if (clinic?.image_path && clinic.image_path !== path && pathBelongsToClinic(clinic.image_path, clinicId)) {
    await createAdminClient().storage.from(IMAGE_BUCKET).remove([clinic.image_path]);
  }
  revalidatePath("/", "layout");
  return {};
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

function roomsRedirect(notice?: string): never {
  redirect(notice ? `/admin/rooms?notice=${notice}` : "/admin/rooms");
}
