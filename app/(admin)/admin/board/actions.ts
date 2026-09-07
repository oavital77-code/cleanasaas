"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireClinicAdmin } from "@/lib/auth/guards";
import { zonedDateTimeToUtc, DEFAULT_TIMEZONE } from "@/lib/time";
import { getAdminBoardDict, getCommonDict, normalizeLocale, translateRpcError } from "@/lib/i18n";

export type RoomBlockState = { error?: string };

// חסימת חדר — admin_create_room_block (migration 20260907000002): מסרב
// לחפיפה עם הזמנה מאושרת (BLOCK_OVERLAPS_BOOKING) — האדמין מבטל קודם במודע.
export async function createRoomBlockAction(_prev: RoomBlockState, formData: FormData): Promise<RoomBlockState> {
  const { clinicId, profile } = await requireClinicAdmin();
  const locale = normalizeLocale(profile.locale);
  const t = getAdminBoardDict(locale);
  const supabase = await createClient();

  const roomId = String(formData.get("room_id") ?? "");
  const date = String(formData.get("date") ?? "");
  const startTime = String(formData.get("start_time") ?? "");
  const endDate = String(formData.get("end_date") ?? "") || date;
  const endTime = String(formData.get("end_time") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();
  if (!roomId || !date || !startTime || !endTime) return { error: getCommonDict(locale).fillAllFields };

  const { data: clinic } = await supabase.from("clinics").select("timezone").eq("id", clinicId).maybeSingle();
  const timezone = clinic?.timezone ?? DEFAULT_TIMEZONE;
  const startsAt = zonedDateTimeToUtc(date, startTime, timezone);
  const endsAt = zonedDateTimeToUtc(endDate, endTime, timezone);

  const { error } = await supabase.rpc("admin_create_room_block", {
    p_room_id: roomId,
    p_starts_at: startsAt.toISOString(),
    p_ends_at: endsAt.toISOString(),
    p_reason: reason,
  });
  if (error) return { error: translateRpcError(locale, error.message, t.blockError) };

  revalidatePath("/admin/board");
  revalidatePath("/schedule");
  return {};
}

export async function deleteRoomBlockAction(formData: FormData) {
  await requireClinicAdmin();
  const blockId = String(formData.get("block_id") ?? "");
  if (!blockId) return;

  const supabase = await createClient();
  await supabase.rpc("admin_delete_room_block", { p_block_id: blockId });
  revalidatePath("/admin/board");
  revalidatePath("/schedule");
}

export async function adminCancelBookingAction(formData: FormData) {
  await requireClinicAdmin();
  const bookingId = String(formData.get("booking_id") ?? "");
  const refundHours = formData.get("refund_hours") === "on";
  if (!bookingId) return;

  const supabase = await createClient();
  await supabase.rpc("admin_cancel_booking", { p_booking_id: bookingId, p_refund_hours: refundHours });
  revalidatePath("/admin/board");
}

export type AssignState = { error?: string };

export async function adminAssignBookingAction(_prev: AssignState, formData: FormData): Promise<AssignState> {
  const { clinicId, profile } = await requireClinicAdmin();
  const supabase = await createClient();
  const locale = normalizeLocale(profile.locale);
  const t = getAdminBoardDict(locale);

  const userId = String(formData.get("user_id") ?? "");
  const roomId = String(formData.get("room_id") ?? "");
  const date = String(formData.get("date") ?? "");
  const startTime = String(formData.get("start_time") ?? "");
  const durationHours = Number(formData.get("duration_hours") ?? 1);
  const note = String(formData.get("note") ?? "");
  if (!userId || !roomId || !date || !startTime) return { error: getCommonDict(locale).fillAllFields };

  const { data: clinic } = await supabase.from("clinics").select("timezone").eq("id", clinicId).maybeSingle();
  const timezone = clinic?.timezone ?? DEFAULT_TIMEZONE;
  const startsAt = zonedDateTimeToUtc(date, startTime, timezone);
  const endsAt = new Date(startsAt.getTime() + durationHours * 60 * 60_000);

  const { error } = await supabase.rpc("admin_create_booking", {
    p_user_id: userId,
    p_room_id: roomId,
    p_starts_at: startsAt.toISOString(),
    p_ends_at: endsAt.toISOString(),
    p_note: note || undefined,
  });
  if (error) {
    return { error: error.message.includes("ROOM_TAKEN") ? t.slotTaken : t.assignError };
  }

  revalidatePath("/admin/board");
  return {};
}
