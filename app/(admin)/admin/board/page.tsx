import Link from "next/link";
import { requireClinicAdmin } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { formatInTimeZone } from "date-fns-tz";
import { DEFAULT_TIMEZONE, zonedDateTimeToUtc } from "@/lib/time";
import { addDays, weekDays, monthGrid, isSameMonth, startOfWeek, buildDaySlots, SLOT_MINUTES, DAY_START_HOUR, DAY_END_HOUR } from "@/lib/calendar";
import { AppShell } from "@/components/app-shell";
import { RealtimeAvailabilityRefresh } from "@/components/realtime-availability-refresh";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronRight, ChevronLeft } from "lucide-react";
import { AssignForm } from "./assign-form";
import { AdminSlotGrid, type AdminCellState, type GridColumn } from "./admin-slot-grid";
import { type Locale, dateFnsLocale, getAdminBoardDict, getCommonDict, getScheduleDict, normalizeLocale } from "@/lib/i18n";

type View = "day" | "week" | "month";

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
  const locale = normalizeLocale(profile.locale);
  const t = getAdminBoardDict(locale);
  const s = getScheduleDict(locale);
  const c = getCommonDict(locale);

  const [{ data: clinic }, { data: rooms }, { data: users }] = await Promise.all([
    supabase.from("clinics").select("name, timezone, open_hour, close_hour").eq("id", clinicId).single(),
    supabase.from("rooms").select("id, name").eq("clinic_id", clinicId).eq("active", true).order("sort_order"),
    supabase.from("profiles").select("id, full_name").eq("clinic_id", clinicId).eq("status", "active").order("full_name"),
  ]);

  const timezone = clinic?.timezone ?? DEFAULT_TIMEZONE;
  const openHour = clinic?.open_hour ?? DAY_START_HOUR;
  const closeHour = clinic?.close_hour ?? DAY_END_HOUR;
  const today = formatInTimeZone(new Date(), timezone, "yyyy-MM-dd");
  const date = dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? dateParam : today;
  const view: View = viewParam === "week" || viewParam === "month" ? viewParam : "day";
  const selectedRoomId = roomParam && (rooms ?? []).some((r) => r.id === roomParam) ? roomParam : rooms?.[0]?.id;

  return (
    <AppShell side="admin" clinicName={clinic?.name} fullName={profile.full_name} locale={profile.locale}>
      <RealtimeAvailabilityRefresh clinicId={clinicId} />
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold">{t.title}</h1>
          <div className="flex overflow-hidden rounded-button border border-border-strong">
            {(["day", "week", "month"] as View[]).map((v) => (
              <Link
                key={v}
                href={viewHref(v, date, selectedRoomId)}
                className={`px-3 py-1.5 text-sm font-medium ${
                  view === v ? "bg-violet-500 text-white" : "bg-surface hover:bg-subtle"
                }`}
              >
                {s.view[v]}
              </Link>
            ))}
          </div>
        </div>

        {!rooms || rooms.length === 0 ? (
          <p className="text-muted-foreground">{c.noRoomsYet}</p>
        ) : view === "month" ? (
          <MonthView date={date} today={today} timezone={timezone} clinicId={clinicId} locale={locale} />
        ) : view === "week" ? (
          <WeekView
            date={date}
            today={today}
            timezone={timezone}
            rooms={rooms}
            selectedRoomId={selectedRoomId!}
            clinicId={clinicId}
            users={users ?? []}
            openHour={openHour}
            closeHour={closeHour}
            locale={locale}
          />
        ) : (
          <DayView
            date={date}
            today={today}
            timezone={timezone}
            rooms={rooms}
            clinicId={clinicId}
            users={users ?? []}
            openHour={openHour}
            closeHour={closeHour}
            locale={locale}
          />
        )}

        <Card id="assign" className="shadow-e1 scroll-mt-6">
          <CardHeader>
            <CardTitle className="text-base font-medium">{t.manualAssignTitle}</CardTitle>
          </CardHeader>
          <CardContent>
            {users && users.length > 0 && rooms && rooms.length > 0 ? (
              <AssignForm rooms={rooms} users={users} initialRoomId={roomParam} initialDate={date} initialTime={timeParam} />
            ) : (
              <p className="text-muted-foreground">{t.needTherapistAndRoom}</p>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}

function DayNav({ view, date, today, room, locale }: { view: View; date: string; today: string; room?: string; locale: Locale }) {
  const s = getScheduleDict(locale);
  let prev: string, next: string, label: string, isCurrent: boolean;
  if (view === "week") {
    prev = addDays(date, -7);
    next = addDays(date, 7);
    label = s.view.week;
    isCurrent = startOfWeek(date) === startOfWeek(today);
  } else if (view === "month") {
    const [y, m] = date.split("-").map(Number);
    prev = `${m === 1 ? y - 1 : y}-${String(m === 1 ? 12 : m - 1).padStart(2, "0")}-01`;
    next = `${m === 12 ? y + 1 : y}-${String(m === 12 ? 1 : m + 1).padStart(2, "0")}-01`;
    label = s.view.month;
    isCurrent = date.slice(0, 7) === today.slice(0, 7);
  } else {
    prev = addDays(date, -1);
    next = addDays(date, 1);
    label = s.view.day;
    isCurrent = date === today;
  }
  const PrevIcon = locale === "he" ? ChevronRight : ChevronLeft;
  const NextIcon = locale === "he" ? ChevronLeft : ChevronRight;
  return (
    <div className="flex items-center gap-1">
      <Button asChild variant="outline" size="icon">
        <Link href={viewHref(view, prev, room)} aria-label={s.prevAria(label)}>
          <PrevIcon className="size-4" />
        </Link>
      </Button>
      <Button asChild variant="outline" size="icon">
        <Link href={viewHref(view, next, room)} aria-label={s.nextAria(label)}>
          <NextIcon className="size-4" />
        </Link>
      </Button>
      {!isCurrent && (
        <Button asChild variant="ghost" size="sm">
          <Link href={viewHref(view, today, room)}>{s.today}</Link>
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

// מקביל ל-buildCellStates ב-/schedule, בשביל AdminSlotGrid — עמודה = חדר
// (DayView) או יום (WeekView), בדיוק כמו בצד המטפל/ת.
function buildAdminCellStates(
  columns: { roomId: string; date: string }[],
  slots: string[],
  timezone: string,
  bookings: BookingRow[],
  blocks: BlockRow[],
): AdminCellState[][] {
  return columns.map((col) =>
    slots.map((slot) => {
      const slotStart = zonedDateTimeToUtc(col.date, slot, timezone);
      const slotEnd = new Date(slotStart.getTime() + SLOT_MINUTES * 60_000);

      const booking = bookings.find(
        (b) => b.room_id === col.roomId && new Date(b.starts_at) < slotEnd && new Date(b.ends_at) > slotStart,
      );
      if (booking) return { status: "booked", bookingId: booking.id, label: booking.profiles?.full_name ?? "" };

      const block = blocks.find(
        (b) => b.room_id === col.roomId && new Date(b.starts_at) < slotEnd && new Date(b.ends_at) > slotStart,
      );
      if (block) return { status: "blocked", reason: block.reason };

      return { status: "available" };
    }),
  );
}

async function DayView({
  date,
  today,
  timezone,
  rooms,
  clinicId,
  users,
  openHour,
  closeHour,
  locale,
}: {
  date: string;
  today: string;
  timezone: string;
  rooms: { id: string; name: string }[];
  clinicId: string;
  users: { id: string; full_name: string }[];
  openHour: number;
  closeHour: number;
  locale: Locale;
}) {
  const supabase = await createClient();
  const dayStart = zonedDateTimeToUtc(date, "00:00", timezone);
  const dayEnd = zonedDateTimeToUtc(addDays(date, 1), "00:00", timezone);

  // 🔴 profiles!bookings_user_id_fkey ולא profiles() סתם: ל-bookings יש שתי
  // foreign keys ל-profiles (user_id ו-cancelled_by). embed לא-מפורש כזה
  // גורם ל-PostgREST להחזיר שגיאת "more than one relationship was found"
  // — וזו בדיוק הסיבה שהלוח הראה "פנוי" בכל מקום למרות הזמנות קיימות
  // בפועל: ה-error הוחזר אבל לא נבדק, data היה null, ותאי ה-UI קראו את
  // זה כ"אין הזמנות" בלי לזרוק שגיאה גלויה.
  const [{ data: bookings, error: bookingsError }, { data: blocks }] = await Promise.all([
    supabase
      .from("bookings")
      .select("id, room_id, starts_at, ends_at, profiles!bookings_user_id_fkey(full_name)")
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
  if (bookingsError) console.error("admin/board DayView bookings query failed:", bookingsError);

  const slots = buildDaySlots(openHour, closeHour);

  return (
    <>
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium tabular-nums">
          {formatInTimeZone(zonedDateTimeToUtc(date, "12:00", timezone), timezone, "EEEE, dd/MM/yyyy", {
            locale: dateFnsLocale(locale),
          })}
        </span>
        <DayNav view="day" date={date} today={today} locale={locale} />
      </div>

      <Card className="shadow-e1 overflow-hidden p-0">
        {/* בלי overflow כאן: AdminSlotGrid מנהל תיבת גלילה משלו לשני הצירים,
            וזה מה שמאפשר לשורת הכותרת ולעמודת השעה להיות sticky. עוד
            scroll container עוטף היה שובר את זה. */}
        <CardContent className="p-0">
          <AdminSlotGrid
            slots={slots}
            columns={rooms.map((r): GridColumn => ({ key: r.id, roomId: r.id, date, header: r.name }))}
            cells={buildAdminCellStates(
              rooms.map((r) => ({ roomId: r.id, date })),
              slots,
              timezone,
              (bookings ?? []) as BookingRow[],
              (blocks ?? []) as BlockRow[],
            )}
            users={users}
          />
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
  users,
  openHour,
  closeHour,
  locale,
}: {
  date: string;
  today: string;
  timezone: string;
  rooms: { id: string; name: string }[];
  selectedRoomId: string;
  clinicId: string;
  users: { id: string; full_name: string }[];
  openHour: number;
  closeHour: number;
  locale: Locale;
}) {
  const supabase = await createClient();
  const c = getCommonDict(locale);
  const days = weekDays(date);
  const rangeStart = zonedDateTimeToUtc(days[0], "00:00", timezone);
  const rangeEnd = zonedDateTimeToUtc(addDays(days[6], 1), "00:00", timezone);

  const [{ data: bookings, error: bookingsError }, { data: blocks }] = await Promise.all([
    supabase
      .from("bookings")
      // profiles!bookings_user_id_fkey — ר' הערה ב-DayView: embed לא-מפורש
      // ל-profiles מ-bookings דו-משמעי (יש גם cancelled_by), וה-error שחוזר
      // ממנו לא נבדק בעבר.
      .select("id, room_id, starts_at, ends_at, profiles!bookings_user_id_fkey(full_name)")
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
  if (bookingsError) console.error("admin/board WeekView bookings query failed:", bookingsError);

  const slots = buildDaySlots(openHour, closeHour);

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-sm font-medium tabular-nums">
          {formatInTimeZone(zonedDateTimeToUtc(days[0], "12:00", timezone), timezone, "dd/MM")} –{" "}
          {formatInTimeZone(zonedDateTimeToUtc(days[6], "12:00", timezone), timezone, "dd/MM/yyyy")}
        </span>
        <DayNav view="week" date={date} today={today} room={selectedRoomId} locale={locale} />
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
        {/* בלי overflow כאן — ר' הערה ב-DayView: תיבת הגלילה שייכת ל-AdminSlotGrid. */}
        <CardContent className="p-0">
          <AdminSlotGrid
            slots={slots}
            columns={days.map(
              (d, i): GridColumn => ({
                key: d,
                roomId: selectedRoomId,
                date: d,
                header: `${c.weekdaysShort[i]} · ${d.slice(8, 10)}/${d.slice(5, 7)}`,
              }),
            )}
            cells={buildAdminCellStates(
              days.map((d) => ({ roomId: selectedRoomId, date: d })),
              slots,
              timezone,
              (bookings ?? []) as BookingRow[],
              (blocks ?? []) as BlockRow[],
            )}
            users={users}
          />
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
  locale,
}: {
  date: string;
  today: string;
  timezone: string;
  clinicId: string;
  locale: Locale;
}) {
  const supabase = await createClient();
  const t = getAdminBoardDict(locale);
  const c = getCommonDict(locale);
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
          {formatInTimeZone(zonedDateTimeToUtc(`${date.slice(0, 7)}-01`, "12:00", timezone), timezone, "MMMM yyyy", {
            locale: dateFnsLocale(locale),
          })}
        </span>
        <DayNav view="month" date={date} today={today} locale={locale} />
      </div>

      <Card className="shadow-e1 overflow-hidden p-0">
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-border bg-muted">
                {c.weekdaysShort.map((d) => (
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
                          {count > 0 && <span className="text-[10px] text-muted-foreground">{t.bookingsCount(count)}</span>}
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
