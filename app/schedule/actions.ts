"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type BookingState = { error?: string; success?: boolean };

export async function createBookingAction(_prevState: BookingState, formData: FormData): Promise<BookingState> {
  const supabase = await createClient();
  const roomId = String(formData.get("room_id") ?? "");
  const date = String(formData.get("date") ?? "");
  const startTime = String(formData.get("start_time") ?? "");
  const durationHours = Number(formData.get("duration_hours") ?? 1);

  if (!roomId || !date || !startTime) {
    return { error: "נא למלא את כל השדות" };
  }

  const startsAt = new Date(`${date}T${startTime}:00`);
  const endsAt = new Date(startsAt.getTime() + durationHours * 60 * 60_000);

  const { error } = await supabase.rpc("create_booking", {
    p_room_id: roomId,
    p_starts_at: startsAt.toISOString(),
    p_ends_at: endsAt.toISOString(),
  });

  if (error) {
    return { error: translateBookingError(error.message) };
  }

  revalidatePath("/schedule");
  return { success: true };
}

export async function cancelBookingAction(formData: FormData) {
  const supabase = await createClient();
  const bookingId = String(formData.get("booking_id") ?? "");
  if (!bookingId) return;
  await supabase.rpc("cancel_booking", { p_booking_id: bookingId });
  revalidatePath("/schedule");
}

function translateBookingError(code: string): string {
  const map: Record<string, string> = {
    NO_CREDIT: "אין יתרת שעות בתוקף",
    INSUFFICIENT_HOURS: "היתרה קטנה מהמבוקש",
    DEPOSIT_DEPLETED: "הפיקדון חסר — נדרשת השלמה",
    ROOM_TAKEN: "המשבצת נתפסה זה עתה",
    ROOM_UNAVAILABLE: "החדר חסום או לא פעיל",
    SELF_OVERLAP: "יש לך כבר הזמנה בשעה הזו",
    TOO_FAR_AHEAD: "מעבר לטווח ההזמנה המותר",
    TOO_FAR_PAST: "לא ניתן להזמין רחוק כל כך בעבר",
    INVALID_SLOT: "השעה חייבת להיות מיושרת ל-30 דקות",
    BOOKING_PASSED: "המועד עבר",
    USER_SUSPENDED: "החשבון מושעה",
    CLINIC_SUSPENDED: "הקליניקה מושעית זמנית",
  };
  for (const key of Object.keys(map)) {
    if (code.includes(key)) return map[key];
  }
  return "שגיאה בהזמנה";
}
