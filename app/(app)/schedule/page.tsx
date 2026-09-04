import Link from "next/link";
import { requireTherapistProfile } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { formatInTimeZone } from "date-fns-tz";
import { DEFAULT_TIMEZONE, zonedDateTimeToUtc } from "@/lib/time";
import { BookingForm } from "./booking-form";
import { bookSlotAction, cancelBookingAction } from "./actions";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronRight, ChevronLeft, X } from "lucide-react";

// לוח יום — CLEANASITEMAPANDDESIGN §2 מסך 2: תצוגת יום/שבוע של זמינות
// חדרים לפי public_availability (בלי לחשוף מי תפס משבצת — חוק #3 ב-
// CLAUDE.md), לחיצה על משבצת פתוחה יוצרת הזמנה ישירות. שעות הפעילות
// (08:00–22:00) הן ברירת מחדל קבועה בקוד כרגע — אין עדיין שדה "שעות
// פעילות" ב-clinics/branches (מסומן [לאפיון] במסמך התכולה, לא נבנה עדיין).
const DAY_START_HOUR = 8;
const DAY_END_HOUR = 22;
const SLOT_MINUTES = 30;

function buildSlots(): string[] {
  const slots: string[] = [];
  for (let m = DAY_START_HOUR * 60; m < DAY_END_HOUR * 60; m += SLOT_MINUTES) {
    const h = Math.floor(m / 60)
      .toString()
      .padStart(2, "0");
    const mm = (m % 60).toString().padStart(2, "0");
    slots.push(`${h}:${mm}`);
  }
  return slots;
}

function addDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export default async function SchedulePage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const { userId, profile } = await requireTherapistProfile();
  const supabase = await createClient();
  const { date: dateParam } = await searchParams;

  const [{ data: rooms }, { data: clinic }] = await Promise.all([
    supabase.from("rooms").select("id, name").eq("active", true).order("sort_order"),
    supabase.from("clinics").select("name, timezone").eq("id", profile.clinic_id).single(),
  ]);

  const timezone = clinic?.timezone ?? DEFAULT_TIMEZONE;
  const today = formatInTimeZone(new Date(), timezone, "yyyy-MM-dd");
  const date = dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? dateParam : today;

  const dayStart = zonedDateTimeToUtc(date, "00:00", timezone);
  const dayEnd = zonedDateTimeToUtc(addDays(date, 1), "00:00", timezone);

  const [{ data: availability }, { data: myBookings }] = await Promise.all([
    supabase
      .from("public_availability")
      .select("room_id, starts_at, ends_at, kind")
      .lt("starts_at", dayEnd.toISOString())
      .gt("ends_at", dayStart.toISOString()),
    // ההזמנות של עצמי בלבד — כדי לאפשר ביטול ישיר מהלוח, בלי לחשוף מי תפס
    // משבצות אחרות (חוק #3). מבוסס על bookings (לא public_availability),
    // ש-RLS שלה כבר מגבילה ל-user_id = עצמי או אדמין.
    supabase
      .from("bookings")
      .select("id, room_id, starts_at, ends_at, source")
      .eq("user_id", userId)
      .eq("status", "confirmed")
      .lt("starts_at", dayEnd.toISOString())
      .gt("ends_at", dayStart.toISOString()),
  ]);

  const slots = buildSlots();
  const now = new Date();
  const isAdmin = profile.role === "owner" || profile.role === "admin";

  return (
    <AppShell side="app" clinicName={clinic?.name} fullName={profile.full_name} isAdmin={isAdmin}>
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">לוח זמנים</h1>
          <div className="flex items-center gap-1">
            <Button asChild variant="outline" size="icon">
              <Link href={`/schedule?date=${addDays(date, -1)}`} aria-label="יום קודם">
                <ChevronRight className="size-4" />
              </Link>
            </Button>
            <span className="min-w-28 text-center text-sm font-medium tabular-nums">
              {formatInTimeZone(zonedDateTimeToUtc(date, "12:00", timezone), timezone, "EEEE, dd/MM/yyyy")}
            </span>
            <Button asChild variant="outline" size="icon">
              <Link href={`/schedule?date=${addDays(date, 1)}`} aria-label="יום הבא">
                <ChevronLeft className="size-4" />
              </Link>
            </Button>
            {date !== today && (
              <Button asChild variant="ghost" size="sm">
                <Link href="/schedule">היום</Link>
              </Button>
            )}
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
                    const isPast = slotEnd <= now;
                    return (
                      <tr key={slot} className="border-b border-border last:border-0">
                        <td className="tabular-nums p-2 text-xs text-muted-foreground">{slot}</td>
                        {rooms.map((r) => {
                          const mine = (myBookings ?? []).find(
                            (b) =>
                              b.room_id === r.id &&
                              new Date(b.starts_at) < slotEnd &&
                              new Date(b.ends_at) > slotStart,
                          );
                          const overlap = (availability ?? []).find(
                            (a) =>
                              a.room_id === r.id &&
                              new Date(a.starts_at as string) < slotEnd &&
                              new Date(a.ends_at as string) > slotStart,
                          );
                          if (isPast) {
                            return <td key={r.id} className="bg-subtle/50 p-1" />;
                          }
                          // ההזמנה שלי — לפני הבדיקה הכללית, כדי לאפשר ביטול
                          // ישיר מהלוח (ולא רק דרך /bookings).
                          if (mine) {
                            const cancellable = mine.source !== "session";
                            return (
                              <td key={r.id} className="p-1">
                                <div className="flex h-8 items-center justify-between gap-1 rounded-field bg-violet-100 px-2 text-xs text-violet-700">
                                  <span className="truncate">שלך</span>
                                  {cancellable && (
                                    <form action={cancelBookingAction}>
                                      <input type="hidden" name="booking_id" value={mine.id} />
                                      <button type="submit" className="shrink-0 text-violet-500 hover:text-danger" title="ביטול">
                                        <X className="size-3.5" />
                                      </button>
                                    </form>
                                  )}
                                </div>
                              </td>
                            );
                          }
                          if (overlap) {
                            return (
                              <td key={r.id} className="p-1">
                                <div className="flex h-8 items-center justify-center rounded-field bg-subtle text-xs text-muted-foreground">
                                  {overlap.kind === "booked" ? "תפוס" : "חסום"}
                                </div>
                              </td>
                            );
                          }
                          return (
                            <td key={r.id} className="p-1">
                              <form action={bookSlotAction}>
                                <input type="hidden" name="room_id" value={r.id} />
                                <input type="hidden" name="date" value={date} />
                                <input type="hidden" name="start_time" value={slot} />
                                <input type="hidden" name="duration_hours" value="1" />
                                <button
                                  type="submit"
                                  className="flex h-8 w-full items-center justify-center rounded-field border border-success-border bg-success-bg text-xs text-success-fg hover:bg-success/20"
                                >
                                  פנוי
                                </button>
                              </form>
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

        <Card className="shadow-e1">
          <CardHeader>
            <CardTitle className="text-base font-medium">הזמנה ידנית (משך מותאם אישית)</CardTitle>
          </CardHeader>
          <CardContent>
            {rooms && rooms.length > 0 ? (
              <BookingForm rooms={rooms} />
            ) : (
              <p className="text-muted-foreground">אין עדיין חדרים פעילים בקליניקה.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
