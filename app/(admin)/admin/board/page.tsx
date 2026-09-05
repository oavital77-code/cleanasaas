import Link from "next/link";
import { requireClinicAdmin } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { formatInTimeZone } from "date-fns-tz";
import { he } from "date-fns/locale";
import { DEFAULT_TIMEZONE, zonedDateTimeToUtc } from "@/lib/time";
import { addDays, weekDays, monthGrid, isSameMonth, startOfWeek, buildDaySlots, SLOT_MINUTES } from "@/lib/calendar";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronRight, ChevronLeft, X } from "lucide-react";
import { adminCancelBookingAction } from "./actions";
import { AssignForm } from "./assign-form";

type View = "day" | "week" | "month";
const HEB_WEEKDAYS = ["א׳", "ב׳", "ג׳", "ד׳", "ה׳", "ו׳", "ש׳"];

function viewHref(view: View, date: string, room?: string) {
  const params = new URLSearchParams({ view, date });
  if (view === "week" && room) params.set("room", room);
  return `/admin/board?${params.toString()}`;
}

export default async function AdminBoardPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; room?: string; time?: string; view?: string }>;
}) {
  const { profile, clinicId } = await requireClinicAdmin();
  const supabase = await createClient();
  const { date: dateParam, room: roomParam, time: timeParam, view: viewParam } = await searchParams;

  const [{ data: clinic }, { data: rooms }, { data: users }] = await Promise.all([
    supabase.from("clinics").select("name, timezone").eq("id", clinicId).single(),
    supabase.from("rooms").select("id, name").eq("clinic_id", clinicId).eq("active", true).order("sort_order"),
    supabase.from("profiles").select("id, full_name").eq("clinic_id", clinicId).eq("status", "active").order("full_name"),
  ]);

  const timezone = clinic?.timezone ?? DEFAULT_TIMEZONE;
  const today = formatInTimeZone(new Date(), timezone, "yyyy-MM-dd");
  const date = dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? dateParam : today;
  const view: View = viewParam === "week" || viewParam === "month" ? viewParam : "day";
  const selectedRoomId = roomParam && (rooms ?? []).some((r) => r.id === roomParam) ? roomParam : rooms?.[0]?.id;

  return (
    <AppShell side="admin" clinicName={clinic?.name} fullName={profile.full_name}>
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold">לוח מלא</h1>
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
          <MonthView date={date} today={today} timezone={timezone} clinicId={clinicId} />
        ) : view === "week" ? (
          <WeekView date={date} today={today} timezone={timezone} rooms={rooms} selectedRoomId={selectedRoomId!} clinicId={clinicId} />
        ) : (
          <DayView date={date} today={today} timezone={timezone} rooms={rooms} clinicId={clinicId} />
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

type BookingRow = {
  id: string;
  room_id: string;
  starts_at: string;
  ends_at: string;
  profiles: { full_name?: string } | null;
};
type BlockRow = { id: string; room_id: string; starts_at: string; ends_at: string; reason: string };

function BoardCell({
  roomId,
  date,
  slot,
  slotStart,
  slotEnd,
  bookings,
  blocks,
}: {
  roomId: string;
  date: string;
  slot: string;
  slotStart: Date;
  slotEnd: Date;
  bookings: BookingRow[];
  blocks: BlockRow[];
}) {
  const booking = bookings.find((b) => b.room_id === roomId && new Date(b.starts_at) < slotEnd && new Date(b.ends_at) > slotStart);
  const block = blocks.find((b) => b.room_id === roomId && new Date(b.starts_at) < slotEnd && new Date(b.ends_at) > slotStart);

  if (booking) {
    return (
      <td className="p-1">
        <div className="flex h-8 items-center justify-between gap-1 rounded-field bg-violet-100 px-2 text-xs text-violet-700">
          <span className="min-w-0 truncate">{booking.profiles?.full_name}</span>
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
      <td className="p-1" title={block.reason}>
        <div className="flex h-8 items-center justify-center rounded-field bg-subtle text-xs text-muted-foreground">חסום</div>
      </td>
    );
  }
  return (
    <td className="p-1">
      <Link
        href={`/admin/board?date=${date}&room=${roomId}&time=${slot}#assign`}
        className="flex h-8 items-center justify-center rounded-field border border-success-border bg-success-bg text-xs text-success-fg hover:bg-success/20"
      >
        פנוי
      </Link>
    </td>
  );
}

async function DayView({
  date,
  today,
  timezone,
  rooms,
  clinicId,
}: {
  date: string;
  today: string;
  timezone: string;
  rooms: { id: string; name: string }[];
  clinicId: string;
}) {
  const supabase = await createClient();
  const dayStart = zonedDateTimeToUtc(date, "00:00", timezone);
  const dayEnd = zonedDateTimeToUtc(addDays(date, 1), "00:00", timezone);

  const [{ data: bookings }, { data: blocks }] = await Promise.all([
    supabase
      .from("bookings")
      .select("id, room_id, starts_at, ends_at, profiles(full_name)")
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

  const slots = buildDaySlots();

  return (
    <>
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium tabular-nums">
          {formatInTimeZone(zonedDateTimeToUtc(date, "12:00", timezone), timezone, "EEEE, dd/MM/yyyy", { locale: he })}
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
                return (
                  <tr key={slot} className="border-b border-border last:border-0">
                    <td className="tabular-nums p-2 text-xs text-muted-foreground">{slot}</td>
                    {rooms.map((r) => (
                      <BoardCell
                        key={r.id}
                        roomId={r.id}
                        date={date}
                        slot={slot}
                        slotStart={slotStart}
                        slotEnd={slotEnd}
                        bookings={(bookings ?? []) as BookingRow[]}
                        blocks={(blocks ?? []) as BlockRow[]}
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

async function WeekView({
  date,
  today,
  timezone,
  rooms,
  selectedRoomId,
  clinicId,
}: {
  date: string;
  today: string;
  timezone: string;
  rooms: { id: string; name: string }[];
  selectedRoomId: string;
  clinicId: string;
}) {
  const supabase = await createClient();
  const days = weekDays(date);
  const rangeStart = zonedDateTimeToUtc(days[0], "00:00", timezone);
  const rangeEnd = zonedDateTimeToUtc(addDays(days[6], 1), "00:00", timezone);

  const [{ data: bookings }, { data: blocks }] = await Promise.all([
    supabase
      .from("bookings")
      .select("id, room_id, starts_at, ends_at, profiles(full_name)")
      .eq("clinic_id", clinicId)
      .eq("room_id", selectedRoomId)
      .eq("status", "confirmed")
      .lt("starts_at", rangeEnd.toISOString())
      .gt("ends_at", rangeStart.toISOString()),
    supabase
      .from("room_blocks")
      .select("id, room_id, starts_at, ends_at, reason")
      .eq("clinic_id", clinicId)
      .eq("room_id", selectedRoomId)
      .lt("starts_at", rangeEnd.toISOString())
      .gt("ends_at", rangeStart.toISOString()),
  ]);

  const slots = buildDaySlots();

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-sm font-medium tabular-nums">
          {formatInTimeZone(zonedDateTimeToUtc(days[0], "12:00", timezone), timezone, "dd/MM")} –{" "}
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
              r.id === selectedRoomId ? "border-violet-500 bg-violet-500 text-white" : "border-border-strong bg-surface hover:bg-subtle"
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
                    return (
                      <BoardCell
                        key={d}
                        roomId={selectedRoomId}
                        date={d}
                        slot={slot}
                        slotStart={slotStart}
                        slotEnd={slotEnd}
                        bookings={(bookings ?? []) as BookingRow[]}
                        blocks={(blocks ?? []) as BlockRow[]}
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
  clinicId,
}: {
  date: string;
  today: string;
  timezone: string;
  clinicId: string;
}) {
  const supabase = await createClient();
  const weeks = monthGrid(date);
  const rangeStart = zonedDateTimeToUtc(weeks[0][0], "00:00", timezone);
  const rangeEnd = zonedDateTimeToUtc(addDays(weeks[weeks.length - 1][6], 1), "00:00", timezone);

  const { data: bookings } = await supabase
    .from("bookings")
    .select("starts_at")
    .eq("clinic_id", clinicId)
    .eq("status", "confirmed")
    .lt("starts_at", rangeEnd.toISOString())
    .gt("starts_at", rangeStart.toISOString());

  const countByDay = new Map<string, number>();
  for (const b of bookings ?? []) {
    const d = formatInTimeZone(new Date(b.starts_at), timezone, "yyyy-MM-dd");
    countByDay.set(d, (countByDay.get(d) ?? 0) + 1);
  }

  return (
    <>
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">
          {formatInTimeZone(zonedDateTimeToUtc(`${date.slice(0, 7)}-01`, "12:00", timezone), timezone, "MMMM yyyy", { locale: he })}
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
                    return (
                      <td key={d} className="h-16 w-[14%] p-1 align-top">
                        <Link
                          href={viewHref("day", d)}
                          className={`flex h-full flex-col gap-1 rounded-field p-1.5 hover:bg-subtle ${
                            d === today ? "bg-violet-50" : ""
                          } ${!inMonth ? "opacity-40" : ""}`}
                        >
                          <span className="tabular-nums text-xs font-medium">{d.slice(8, 10)}</span>
                          {count > 0 && <span className="text-[10px] text-muted-foreground">{count} הזמנות</span>}
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
