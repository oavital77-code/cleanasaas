"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireClinicAdmin } from "@/lib/auth/guards";
import { zonedDateTimeToUtc, DEFAULT_TIMEZONE } from "@/lib/time";

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
  const { clinicId } = await requireClinicAdmin();
  const supabase = await createClient();

  const userId = String(formData.get("user_id") ?? "");
  const roomId = String(formData.get("room_id") ?? "");
  const date = String(formData.get("date") ?? "");
  const startTime = String(formData.get("start_time") ?? "");
  const durationHours = Number(formData.get("duration_hours") ?? 1);
  const note = String(formData.get("note") ?? "");
  if (!userId || !roomId || !date || !startTime) return { error: "נא למלא את כל השדות" };

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
    return { error: error.message.includes("ROOM_TAKEN") ? "המשבצת תפוסה" : "שגיאה בשיבוץ" };
  }

  revalidatePath("/admin/board");
  return {};
}
