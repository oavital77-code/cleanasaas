import Link from "next/link";
import { requireClinicAdmin } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { formatInTimeZone } from "date-fns-tz";
import { DEFAULT_TIMEZONE, zonedDateTimeToUtc } from "@/lib/time";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronRight, ChevronLeft, X } from "lucide-react";
import { adminCancelBookingAction } from "./actions";
import { AssignForm } from "./assign-form";

const DAY_START_HOUR = 8;
const DAY_END_HOUR = 22;
const SLOT_MINUTES = 30;

function buildSlots(): string[] {
  const slots: string[] = [];
  for (let m = DAY_START_HOUR * 60; m < DAY_END_HOUR * 60; m += SLOT_MINUTES) {
    slots.push(`${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`);
  }
  return slots;
}

function addDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export default async function AdminBoardPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; room?: string; time?: string }>;
}) {
  const { profile, clinicId } = await requireClinicAdmin();
  const supabase = await createClient();
  const { date: dateParam, room: roomParam, time: timeParam } = await searchParams;

  const [{ data: clinic }, { data: rooms }, { data: users }] = await Promise.all([
    supabase.from("clinics").select("name, timezone").eq("id", clinicId).single(),
    supabase.from("rooms").select("id, name").eq("clinic_id", clinicId).eq("active", true).order("sort_order"),
    supabase.from("profiles").select("id, full_name").eq("clinic_id", clinicId).eq("status", "active").order("full_name"),
  ]);

  const timezone = clinic?.timezone ?? DEFAULT_TIMEZONE;
  const today = formatInTimeZone(new Date(), timezone, "yyyy-MM-dd");
  const date = dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? dateParam : today;

  const dayStart = zonedDateTimeToUtc(date, "00:00", timezone);
  const dayEnd = zonedDateTimeToUtc(addDays(date, 1), "00:00", timezone);

  const [{ data: bookings }, { data: blocks }] = await Promise.all([
    supabase
      .from("bookings")
      .select("id, room_id, starts_at, ends_at, source, profiles(full_name)")
      .eq("clinic_id", clinicId)
      .eq("status", "confirmed")
      .lt("starts_at", dayEnd.toISOString())
      .gt("ends_at", dayStart.toISOString()),
    supabase
      .from("room_blocks")
      .select("id, room_id, starts_at, ends_at, reason")
      .eq("clinic_id", clinicId)
      .lt("starts_at", dayEnd.toISOString())
      .gt("ends_at", dayStart.toISOString()),
  ]);

  const slots = buildSlots();

  return (
    <AppShell side="admin" clinicName={clinic?.name} fullName={profile.full_name}>
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">לוח מלא</h1>
          <div className="flex items-center gap-1">
            <Button asChild variant="outline" size="icon">
              <Link href={`/admin/board?date=${addDays(date, -1)}`} aria-label="יום קודם">
                <ChevronRight className="size-4" />
              </Link>
            </Button>
            <span className="min-w-28 text-center text-sm font-medium tabular-nums">
              {formatInTimeZone(zonedDateTimeToUtc(date, "12:00", timezone), timezone, "EEEE, dd/MM/yyyy")}
            </span>
            <Button asChild variant="outline" size="icon">
              <Link href={`/admin/board?date=${addDays(date, 1)}`} aria-label="יום הבא">
                <ChevronLeft className="size-4" />
              </Link>
            </Button>
          </div>
        </div>

        {!rooms || rooms.length === 0 ? (
          <p className="text-muted-foreground">אין עדיין חדרים פעילים בקליניקה.</p>
        ) : (
          <Card className="shadow-e1 overflow-hidden p-0">
            <CardContent className="overflow-x-auto p-0">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted">
                    <th className="w-16 p-2 text-xs font-normal text-muted-foreground">שעה</th>
                    {rooms.map((r) => (
                      <th key={r.id} className="p-2 text-center font-medium">
                        {r.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {slots.map((slot) => {
                    const slotStart = zonedDateTimeToUtc(date, slot, timezone);
                    const slotEnd = new Date(slotStart.getTime() + SLOT_MINUTES * 60_000);
                    return (
                      <tr key={slot} className="border-b border-border last:border-0">
                        <td className="tabular-nums p-2 text-xs text-muted-foreground">{slot}</td>
                        {rooms.map((r) => {
                          const booking = (bookings ?? []).find(
                            (b) => b.room_id === r.id && new Date(b.starts_at) < slotEnd && new Date(b.ends_at) > slotStart,
                          );
                          const block = (blocks ?? []).find(
                            (b) => b.room_id === r.id && new Date(b.starts_at) < slotEnd && new Date(b.ends_at) > slotStart,
                          );
                          if (booking) {
                            return (
                              <td key={r.id} className="p-1">
                                <div className="flex h-8 items-center justify-between gap-1 rounded-field bg-violet-100 px-2 text-xs text-violet-700">
                                  <span className="truncate">{(booking.profiles as { full_name?: string } | null)?.full_name}</span>
                                  <form action={adminCancelBookingAction}>
                                    <input type="hidden" name="booking_id" value={booking.id} />
                                    <button type="submit" className="shrink-0 text-violet-500 hover:text-danger" title="ביטול">
                                      <X className="size-3.5" />
                                    </button>
                                  </form>
                                </div>
                              </td>
                            );
                          }
                          if (block) {
                            return (
                              <td key={r.id} className="p-1" title={block.reason}>
                                <div className="flex h-8 items-center justify-center rounded-field bg-subtle text-xs text-muted-foreground">
                                  חסום
                                </div>
                              </td>
                            );
                          }
                          return (
                            <td key={r.id} className="p-1">
                              <Link
                                href={`/admin/board?date=${date}&room=${r.id}&time=${slot}#assign`}
                                className="flex h-8 items-center justify-center rounded-field border border-success-border bg-success-bg text-xs text-success-fg hover:bg-success/20"
                              >
                                פנוי
                              </Link>
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </CardContent>
          </Card>
        )}

        <Card id="assign" className="shadow-e1 scroll-mt-6">
          <CardHeader>
            <CardTitle className="text-base font-medium">שיבוץ ידני</CardTitle>
          </CardHeader>
          <CardContent>
            {users && users.length > 0 && rooms && rooms.length > 0 ? (
              <AssignForm rooms={rooms} users={users} initialRoomId={roomParam} initialDate={date} initialTime={timeParam} />
            ) : (
              <p className="text-muted-foreground">צריך לפחות מטפל/ת אחד/ת וחדר פעיל אחד כדי לשבץ.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
