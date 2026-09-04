"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { zonedDateTimeToUtc, DEFAULT_TIMEZONE } from "@/lib/time";

export type BookingState = { error?: string; success?: boolean };

async function getClinicTimezone(supabase: Awaited<ReturnType<typeof createClient>>): Promise<string> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return DEFAULT_TIMEZONE;
  const { data: profile } = await supabase.from("profiles").select("clinic_id").eq("id", user.id).maybeSingle();
  if (!profile) return DEFAULT_TIMEZONE;
  const { data: clinic } = await supabase.from("clinics").select("timezone").eq("id", profile.clinic_id).maybeSingle();
  return clinic?.timezone ?? DEFAULT_TIMEZONE;
}

export async function createBookingAction(_prevState: BookingState, formData: FormData): Promise<BookingState> {
  const supabase = await createClient();
  const roomId = String(formData.get("room_id") ?? "");
  const date = String(formData.get("date") ?? "");
  const startTime = String(formData.get("start_time") ?? "");
  const durationHours = Number(formData.get("duration_hours") ?? 1);

  if (!roomId || !date || !startTime) {
    return { error: "נא למלא את כל השדות" };
  }

  const timezone = await getClinicTimezone(supabase);
  const startsAt = zonedDateTimeToUtc(date, startTime, timezone);
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
  revalidatePath("/bookings");
  return { success: true };
}

/** הזמנה ישירה ממשבצת פתוחה בלוח הזמנים — אותה RPC, בלי useActionState. */
export async function bookSlotAction(formData: FormData) {
  const supabase = await createClient();
  const roomId = String(formData.get("room_id") ?? "");
  const date = String(formData.get("date") ?? "");
  const startTime = String(formData.get("start_time") ?? "");
  const durationHours = Number(formData.get("duration_hours") ?? 1);
  if (!roomId || !date || !startTime) return;

  const timezone = await getClinicTimezone(supabase);
  const startsAt = zonedDateTimeToUtc(date, startTime, timezone);
  const endsAt = new Date(startsAt.getTime() + durationHours * 60 * 60_000);

  await supabase.rpc("create_booking", {
    p_room_id: roomId,
    p_starts_at: startsAt.toISOString(),
    p_ends_at: endsAt.toISOString(),
  });

  revalidatePath("/schedule");
  revalidatePath("/bookings");
}

export async function cancelBookingAction(formData: FormData) {
  const supabase = await createClient();
  const bookingId = String(formData.get("booking_id") ?? "");
  if (!bookingId) return;
  await supabase.rpc("cancel_booking", { p_booking_id: bookingId });
  revalidatePath("/schedule");
  revalidatePath("/bookings");
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
