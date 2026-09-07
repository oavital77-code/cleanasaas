"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getAuthState } from "@/lib/auth/guards";
import { zonedDateTimeToUtc, accessWindow, DEFAULT_TIMEZONE } from "@/lib/time";
import { sendEmail } from "@/lib/email/resend";
import { bookingConfirmedEmail, bookingCancelledEmail } from "@/lib/email/templates";
import { generateSingleEventIcs } from "@/lib/ics";
import { getCommonDict, getScheduleDict, normalizeLocale, translateRpcError } from "@/lib/i18n";

export type BookingState = { error?: string; success?: boolean };

// 🔴 לא supabase.auth.getUser() ישירות: ב-client של מצב Clerk (accessToken)
// כל גישה ל-supabase.auth.* זורקת — ר' lib/auth/guards.ts.
async function getClinicTimezone(supabase: Awaited<ReturnType<typeof createClient>>): Promise<string> {
  const { profile } = await getAuthState();
  if (!profile) return DEFAULT_TIMEZONE;
  const { data: clinic } = await supabase.from("clinics").select("timezone").eq("id", profile.clinic_id).maybeSingle();
  return clinic?.timezone ?? DEFAULT_TIMEZONE;
}

export async function createBookingAction(_prevState: BookingState, formData: FormData): Promise<BookingState> {
  const supabase = await createClient();
  const { profile } = await getAuthState();
  const locale = normalizeLocale(profile?.locale);
  const roomId = String(formData.get("room_id") ?? "");
  const date = String(formData.get("date") ?? "");
  const startTime = String(formData.get("start_time") ?? "");
  const durationHours = Number(formData.get("duration_hours") ?? 1);

  if (!roomId || !date || !startTime) {
    return { error: getCommonDict(locale).fillAllFields };
  }

  const timezone = await getClinicTimezone(supabase);
  const startsAt = zonedDateTimeToUtc(date, startTime, timezone);
  const endsAt = new Date(startsAt.getTime() + durationHours * 60 * 60_000);

  const { data, error } = await supabase
    .rpc("create_booking", {
      p_room_id: roomId,
      p_starts_at: startsAt.toISOString(),
      p_ends_at: endsAt.toISOString(),
    })
    .single();

  if (error) {
    return { error: translateRpcError(locale, error.message, getScheduleDict(locale).bookingError) };
  }

  // מייל אישור אסינכרוני, מחוץ לזרימת ה-RPC — כישלון שליחה לא אמור לבטל
  // הזמנה שכבר אושרה בפועל.
  sendBookingConfirmation(supabase, roomId, startsAt, endsAt, timezone, data?.booking_id).catch(() => {});

  revalidatePath("/schedule");
  revalidatePath("/bookings");
  return { success: true };
}

async function sendBookingConfirmation(
  supabase: Awaited<ReturnType<typeof createClient>>,
  roomId: string,
  startsAt: Date,
  endsAt: Date,
  timezone: string,
  bookingId?: string,
) {
  const { profile } = await getAuthState();
  if (!profile) return;

  const { data: room } = await supabase.from("rooms").select("name, branch_id").eq("id", roomId).maybeSingle();
  if (!room) return;
  const { data: branch } = await supabase.from("branches").select("name").eq("id", room.branch_id).maybeSingle();

  const { accessStart, accessEnd } = accessWindow(startsAt, endsAt);
  const { subject, html } = bookingConfirmedEmail({
    roomName: room.name,
    branchName: branch?.name ?? "",
    startsAt,
    endsAt,
    accessStart,
    accessEnd,
    timezone,
    locale: profile.locale,
  });

  const ics = bookingId
    ? generateSingleEventIcs({
        uid: `booking-${bookingId}@cleana`,
        summary: `Cleana — ${room.name}`,
        location: `${room.name}, ${branch?.name ?? ""}`,
        startsAt,
        endsAt,
      })
    : null;

  await sendEmail({
    to: profile.email,
    subject,
    html,
    attachments: ics ? [{ filename: "booking.ics", content: Buffer.from(ics).toString("base64") }] : undefined,
  });
}

export async function cancelBookingAction(formData: FormData) {
  const supabase = await createClient();
  const bookingId = String(formData.get("booking_id") ?? "");
  if (!bookingId) return;

  const { data: booking } = await supabase.from("bookings").select("room_id, starts_at").eq("id", bookingId).maybeSingle();

  const { data, error } = await supabase.rpc("cancel_booking", { p_booking_id: bookingId }).single();

  if (!error && booking) {
    sendCancellationEmail(supabase, booking.room_id, new Date(booking.starts_at), data?.hours_refunded ?? false).catch(
      () => {},
    );
  }

  revalidatePath("/schedule");
  revalidatePath("/bookings");
}

async function sendCancellationEmail(
  supabase: Awaited<ReturnType<typeof createClient>>,
  roomId: string,
  startsAt: Date,
  hoursRefunded: boolean,
) {
  const { profile } = await getAuthState();
  if (!profile) return;

  const { data: room } = await supabase.from("rooms").select("name").eq("id", roomId).maybeSingle();
  if (!room) return;

  const { subject, html } = bookingCancelledEmail({ roomName: room.name, startsAt, hoursRefunded, locale: profile.locale });
  await sendEmail({ to: profile.email, subject, html });
}
