import Link from "next/link";
import { requireTherapistProfile } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { formatInTimeZone } from "date-fns-tz";
import { DEFAULT_TIMEZONE, zonedDateTimeToUtc } from "@/lib/time";
import { addDays, weekDays, monthGrid, isSameMonth, startOfWeek, buildDaySlots, SLOT_MINUTES } from "@/lib/calendar";
import { BookingForm } from "./booking-form";
import { bookSlotAction, cancelBookingAction } from "./actions";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronRight, ChevronLeft, X } from "lucide-react";

// לוח זמנים — CLEANASITEMAPANDDESIGN §2 מסך 2: תצוגת יום/שבוע/חודש של
// זמינות חדרים לפי public_availability (בלי לחשוף מי תפס משבצת — חוק #3
// ב-CLAUDE.md), לחיצה על משבצת פתוחה יוצרת הזמנה ישירות. שעות הפעילות
// (08:00–22:00) הן ברירת מחדל קבועה בקוד כרגע — אין עדיין שדה "שעות
// פעילות" ב-clinics/branches (מסומן [לאפיון] במסמך התכולה, לא נבנה עדיין).
type View = "day" | "week" | "month";
const HEB_WEEKDAYS = ["א׳", "ב׳", "ג׳", "ד׳", "ה׳", "ו׳", "ש׳"];

function viewHref(view: View, date: string, room?: string) {
  const params = new URLSearchParams({ view, date });
  if (view === "week" && room) params.set("room", room);
  return `/schedule?${params.toString()}`;
}

export default async function SchedulePage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; view?: string; room?: string }>;
}) {
  const { userId, profile } = await requireTherapistProfile();
  const supabase = await createClient();
  const { date: dateParam, view: viewParam, room: roomParam } = await searchParams;

  const [{ data: rooms }, { data: clinic }] = await Promise.all([
    supabase.from("rooms").select("id, name").eq("active", true).order("sort_order"),
    supabase.from("clinics").select("name, timezone").eq("id", profile.clinic_id).single(),
  ]);

  const timezone = clinic?.timezone ?? DEFAULT_TIMEZONE;
  const today = formatInTimeZone(new Date(), timezone, "yyyy-MM-dd");
  const date = dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? dateParam : today;
  const view: View = viewParam === "week" || viewParam === "month" ? viewParam : "day";
  const isAdmin = profile.role === "owner" || profile.role === "admin";
  const now = new Date();

  const selectedRoomId = roomParam && (rooms ?? []).some((r) => r.id === roomParam) ? roomParam : rooms?.[0]?.id;

  return (
    <AppShell side="app" clinicName={clinic?.name} fullName={profile.full_name} isAdmin={isAdmin}>
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold">לוח זמנים</h1>
          <div className="flex overflow-hidden rounded-button border border-border-strong">
            {(["day", "week", "month"] as View[]).map((v) => (
              <Link
                key={v}
                href={viewHref(v, date, selectedRoomId)}
                className={`px-3 py-1.5 text-sm font-medium ${
                  view === v ? "bg-violet-500 text-white" : "bg-surface hover:bg-subtle"
                }`}
              >
                {v === "day" ? "יום" : v === "week" ? "שבוע" : "חודש"}
              </Link>
            ))}
          </div>
        </div>

        {!rooms || rooms.length === 0 ? (
          <p className="text-muted-foreground">אין עדיין חדרים פעילים בקליניקה.</p>
        ) : view === "month" ? (
          <MonthView date={date} today={today} timezone={timezone} userId={userId} />
        ) : view === "week" ? (
          <WeekView
            date={date}
            today={today}
            timezone={timezone}
            rooms={rooms}
            selectedRoomId={selectedRoomId!}
            userId={userId}
            now={now}
          />
        ) : (
          <DayView date={date} today={today} timezone={timezone} rooms={rooms} userId={userId} now={now} />
        )}

        {view === "day" && (
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
        )}
      </div>
    </AppShell>
  );
}

function DayNav({ view, date, today, room }: { view: View; date: string; today: string; room?: string }) {
  let prev: string, next: string, label: string, isCurrent: boolean;
  if (view === "week") {
    prev = addDays(date, -7);
    next = addDays(date, 7);
    label = "שבוע";
    isCurrent = startOfWeek(date) === startOfWeek(today);
  } else if (view === "month") {
    const [y, m] = date.split("-").map(Number);
    prev = `${m === 1 ? y - 1 : y}-${String(m === 1 ? 12 : m - 1).padStart(2, "0")}-01`;
    next = `${m === 12 ? y + 1 : y}-${String(m === 12 ? 1 : m + 1).padStart(2, "0")}-01`;
    label = "חודש";
    isCurrent = date.slice(0, 7) === today.slice(0, 7);
  } else {
    prev = addDays(date, -1);
    next = addDays(date, 1);
    label = "יום";
    isCurrent = date === today;
  }
  return (
    <div className="flex items-center gap-1">
      <Button asChild variant="outline" size="icon">
        <Link href={viewHref(view, prev, room)} aria-label={`${label} קודם`}>
          <ChevronRight className="size-4" />
        </Link>
      </Button>
      <Button asChild variant="outline" size="icon">
        <Link href={viewHref(view, next, room)} aria-label={`${label} הבא`}>
          <ChevronLeft className="size-4" />
        </Link>
      </Button>
      {!isCurrent && (
        <Button asChild variant="ghost" size="sm">
          <Link href={viewHref(view, today, room)}>היום</Link>
        </Button>
      )}
    </div>
  );
}

async function DayView({
  date,
  today,
  timezone,
  rooms,
  userId,
  now,
}: {
  date: string;
  today: string;
  timezone: string;
  rooms: { id: string; name: string }[];
  userId: string;
  now: Date;
}) {
  const supabase = await createClient();
  const dayStart = zonedDateTimeToUtc(date, "00:00", timezone);
  const dayEnd = zonedDateTimeToUtc(addDays(date, 1), "00:00", timezone);

  const [{ data: availability }, { data: myBookings }] = await Promise.all([
    supabase
      .from("public_availability")
      .select("room_id, starts_at, ends_at, kind")
      .lt("starts_at", dayEnd.toISOString())
      .gt("ends_at", dayStart.toISOString()),
    supabase
      .from("bookings")
      .select("id, room_id, starts_at, ends_at, source")
      .eq("user_id", userId)
      .eq("status", "confirmed")
      .lt("starts_at", dayEnd.toISOString())
      .gt("ends_at", dayStart.toISOString()),
  ]);

  const slots = buildDaySlots();

  return (
    <>
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium tabular-nums">
          {formatInTimeZone(zonedDateTimeToUtc(date, "12:00", timezone), timezone, "EEEE, dd/MM/yyyy")}
        </span>
        <DayNav view="day" date={date} today={today} />
      </div>

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
                    {rooms.map((r) => (
                      <SlotCell
                        key={r.id}
                        roomId={r.id}
                        date={date}
                        slot={slot}
                        slotStart={slotStart}
                        slotEnd={slotEnd}
                        isPast={isPast}
                        availability={availability ?? []}
                        myBookings={myBookings ?? []}
                      />
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </>
  );
}

function SlotCell({
  roomId,
  date,
  slot,
  slotStart,
  slotEnd,
  isPast,
  availability,
  myBookings,
}: {
  roomId: string;
  date: string;
  slot: string;
  slotStart: Date;
  slotEnd: Date;
  isPast: boolean;
  availability: { room_id: string | null; starts_at: string | null; ends_at: string | null; kind: string | null }[];
  myBookings: { id: string; room_id: string; starts_at: string; ends_at: string; source: string }[];
}) {
  const mine = myBookings.find(
    (b) => b.room_id === roomId && new Date(b.starts_at) < slotEnd && new Date(b.ends_at) > slotStart,
  );
  const overlap = availability.find(
    (a) =>
      a.room_id === roomId &&
      new Date(a.starts_at as string) < slotEnd &&
      new Date(a.ends_at as string) > slotStart,
  );

  if (isPast) return <td className="bg-subtle/50 p-1" />;

  // ההזמנה שלי — לפני הבדיקה הכללית, כדי לאפשר ביטול ישיר מהלוח (ולא רק
  // דרך /bookings).
  if (mine) {
    const cancellable = mine.source !== "session";
    return (
      <td className="p-1">
        <div className="flex h-8 items-center justify-between gap-1 rounded-field bg-violet-100 px-2 text-xs text-violet-700">
          <span className="min-w-0 truncate">שלך</span>
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
      <td className="p-1">
        <div className="flex h-8 items-center justify-center rounded-field bg-subtle text-xs text-muted-foreground">
          {overlap.kind === "booked" ? "תפוס" : "חסום"}
        </div>
      </td>
    );
  }

  return (
    <td className="p-1">
      <form action={bookSlotAction}>
        <input type="hidden" name="room_id" value={roomId} />
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
}

async function WeekView({
  date,
  today,
  timezone,
  rooms,
  selectedRoomId,
  userId,
  now,
}: {
  date: string;
  today: string;
  timezone: string;
  rooms: { id: string; name: string }[];
  selectedRoomId: string;
  userId: string;
  now: Date;
}) {
  const supabase = await createClient();
  const days = weekDays(date);
  const weekStart = days[0];
  const weekEnd = addDays(days[6], 1);
  const rangeStart = zonedDateTimeToUtc(weekStart, "00:00", timezone);
  const rangeEnd = zonedDateTimeToUtc(weekEnd, "00:00", timezone);

  const [{ data: availability }, { data: myBookings }] = await Promise.all([
    supabase
      .from("public_availability")
      .select("room_id, starts_at, ends_at, kind")
      .eq("room_id", selectedRoomId)
      .lt("starts_at", rangeEnd.toISOString())
      .gt("ends_at", rangeStart.toISOString()),
    supabase
      .from("bookings")
      .select("id, room_id, starts_at, ends_at, source")
      .eq("user_id", userId)
      .eq("status", "confirmed")
      .lt("starts_at", rangeEnd.toISOString())
      .gt("ends_at", rangeStart.toISOString()),
  ]);

  const slots = buildDaySlots();

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-sm font-medium tabular-nums">
          {formatInTimeZone(zonedDateTimeToUtc(weekStart, "12:00", timezone), timezone, "dd/MM")} –{" "}
          {formatInTimeZone(zonedDateTimeToUtc(days[6], "12:00", timezone), timezone, "dd/MM/yyyy")}
        </span>
        <DayNav view="week" date={date} today={today} room={selectedRoomId} />
      </div>

      <div className="flex flex-wrap gap-1.5">
        {rooms.map((r) => (
          <Link
            key={r.id}
            href={viewHref("week", date, r.id)}
            className={`rounded-pill border px-3 py-1 text-xs font-medium ${
              r.id === selectedRoomId
                ? "border-violet-500 bg-violet-500 text-white"
                : "border-border-strong bg-surface hover:bg-subtle"
            }`}
          >
            {r.name}
          </Link>
        ))}
      </div>

      <Card className="shadow-e1 overflow-hidden p-0">
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-border bg-muted">
                <th className="w-16 p-2 text-xs font-normal text-muted-foreground">שעה</th>
                {days.map((d, i) => (
                  <th key={d} className="p-2 text-center font-medium">
                    <Link href={viewHref("day", d)} className="hover:underline">
                      {HEB_WEEKDAYS[i]} · {d.slice(8, 10)}/{d.slice(5, 7)}
                    </Link>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {slots.map((slot) => (
                <tr key={slot} className="border-b border-border last:border-0">
                  <td className="tabular-nums p-2 text-xs text-muted-foreground">{slot}</td>
                  {days.map((d) => {
                    const slotStart = zonedDateTimeToUtc(d, slot, timezone);
                    const slotEnd = new Date(slotStart.getTime() + SLOT_MINUTES * 60_000);
                    const isPast = slotEnd <= now;
                    return (
                      <SlotCell
                        key={d}
                        roomId={selectedRoomId}
                        date={d}
                        slot={slot}
                        slotStart={slotStart}
                        slotEnd={slotEnd}
                        isPast={isPast}
                        availability={availability ?? []}
                        myBookings={myBookings ?? []}
                      />
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </>
  );
}

async function MonthView({
  date,
  today,
  timezone,
  userId,
}: {
  date: string;
  today: string;
  timezone: string;
  userId: string;
}) {
  const supabase = await createClient();
  const weeks = monthGrid(date);
  const gridStart = weeks[0][0];
  const gridEnd = addDays(weeks[weeks.length - 1][6], 1);
  const rangeStart = zonedDateTimeToUtc(gridStart, "00:00", timezone);
  const rangeEnd = zonedDateTimeToUtc(gridEnd, "00:00", timezone);

  const [{ data: booked }, { data: myBookings }] = await Promise.all([
    supabase
      .from("public_availability")
      .select("starts_at")
      .eq("kind", "booked")
      .lt("starts_at", rangeEnd.toISOString())
      .gt("starts_at", rangeStart.toISOString()),
    supabase
      .from("bookings")
      .select("starts_at")
      .eq("user_id", userId)
      .eq("status", "confirmed")
      .lt("starts_at", rangeEnd.toISOString())
      .gt("starts_at", rangeStart.toISOString()),
  ]);

  const countByDay = new Map<string, number>();
  for (const b of booked ?? []) {
    if (!b.starts_at) continue;
    const d = formatInTimeZone(new Date(b.starts_at), timezone, "yyyy-MM-dd");
    countByDay.set(d, (countByDay.get(d) ?? 0) + 1);
  }
  const mineByDay = new Set(
    (myBookings ?? []).map((b) => formatInTimeZone(new Date(b.starts_at), timezone, "yyyy-MM-dd")),
  );

  return (
    <>
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">
          {formatInTimeZone(zonedDateTimeToUtc(`${date.slice(0, 7)}-01`, "12:00", timezone), timezone, "MMMM yyyy")}
        </span>
        <DayNav view="month" date={date} today={today} />
      </div>

      <Card className="shadow-e1 overflow-hidden p-0">
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-border bg-muted">
                {HEB_WEEKDAYS.map((d) => (
                  <th key={d} className="p-2 text-center text-xs font-normal text-muted-foreground">
                    {d}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {weeks.map((week) => (
                <tr key={week[0]} className="border-b border-border last:border-0">
                  {week.map((d) => {
                    const inMonth = isSameMonth(d, date);
                    const count = countByDay.get(d) ?? 0;
                    const isMine = mineByDay.has(d);
                    return (
                      <td key={d} className="h-16 w-[14%] p-1 align-top">
                        <Link
                          href={viewHref("day", d)}
                          className={`flex h-full flex-col gap-1 rounded-field p-1.5 hover:bg-subtle ${
                            d === today ? "bg-violet-50" : ""
                          } ${!inMonth ? "opacity-40" : ""}`}
                        >
                          <span className="tabular-nums text-xs font-medium">{d.slice(8, 10)}</span>
                          <div className="flex flex-wrap gap-1">
                            {isMine && <span className="size-1.5 rounded-full bg-violet-500" title="יש לך הזמנה" />}
                            {count > 0 && <span className="text-[10px] text-muted-foreground">{count}</span>}
                          </div>
                        </Link>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </>
  );
}
