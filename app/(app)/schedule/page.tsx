import Link from "next/link";
import { requireTherapistProfile } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { formatInTimeZone } from "date-fns-tz";
import { DEFAULT_TIMEZONE, zonedDateTimeToUtc } from "@/lib/time";
import { addDays, weekDays, monthGrid, isSameMonth, startOfWeek, buildDaySlots, SLOT_MINUTES, DAY_START_HOUR, DAY_END_HOUR } from "@/lib/calendar";
import { BookingForm } from "./booking-form";
import { SlotGrid, type CellState, type GridColumn } from "./slot-grid";
import { AppShell } from "@/components/app-shell";
import { RealtimeAvailabilityRefresh } from "@/components/realtime-availability-refresh";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronRight, ChevronLeft } from "lucide-react";
import { type Locale, dateFnsLocale, getCommonDict, getScheduleDict, normalizeLocale } from "@/lib/i18n";

// לוח זמנים — CLEANASITEMAPANDDESIGN §2 מסך 2: תצוגת יום/שבוע/חודש של
// זמינות חדרים לפי public_availability (בלי לחשוף מי תפס משבצת — חוק #3
// ב-CLAUDE.md), לחיצה על משבצת פתוחה יוצרת הזמנה ישירות. שעות הפעילות
// מגיעות מ-clinics.open_hour/close_hour (per-clinic, לא קבוע בקוד).
type View = "day" | "week" | "month";

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
  const locale = normalizeLocale(profile.locale);
  const t = getScheduleDict(locale);
  const c = getCommonDict(locale);

  const [{ data: rooms }, { data: clinic }] = await Promise.all([
    supabase.from("rooms").select("id, name").eq("active", true).order("sort_order"),
    supabase.from("clinics").select("name, timezone, open_hour, close_hour").eq("id", profile.clinic_id).single(),
  ]);

  const timezone = clinic?.timezone ?? DEFAULT_TIMEZONE;
  const openHour = clinic?.open_hour ?? DAY_START_HOUR;
  const closeHour = clinic?.close_hour ?? DAY_END_HOUR;
  const today = formatInTimeZone(new Date(), timezone, "yyyy-MM-dd");
  const date = dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? dateParam : today;
  const view: View = viewParam === "week" || viewParam === "month" ? viewParam : "day";
  const isAdmin = profile.role === "owner" || profile.role === "admin";
  const now = new Date();

  const selectedRoomId = roomParam && (rooms ?? []).some((r) => r.id === roomParam) ? roomParam : rooms?.[0]?.id;

  return (
    <AppShell side="app" clinicName={clinic?.name} fullName={profile.full_name} locale={profile.locale} isAdmin={isAdmin}>
      <RealtimeAvailabilityRefresh clinicId={profile.clinic_id} />
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
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
                {t.view[v]}
              </Link>
            ))}
          </div>
        </div>

        {!rooms || rooms.length === 0 ? (
          <p className="text-muted-foreground">{c.noRoomsYet}</p>
        ) : view === "month" ? (
          <MonthView date={date} today={today} timezone={timezone} userId={userId} locale={locale} />
        ) : view === "week" ? (
          <WeekView
            date={date}
            today={today}
            timezone={timezone}
            rooms={rooms}
            selectedRoomId={selectedRoomId!}
            userId={userId}
            now={now}
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
            userId={userId}
            now={now}
            openHour={openHour}
            closeHour={closeHour}
            locale={locale}
          />
        )}

        {view === "day" && (
          <Card className="shadow-e1">
            <CardHeader>
              <CardTitle className="text-base font-medium">{t.manualBookingTitle}</CardTitle>
            </CardHeader>
            <CardContent>
              {rooms && rooms.length > 0 ? (
                <BookingForm rooms={rooms} />
              ) : (
                <p className="text-muted-foreground">{c.noRoomsYet}</p>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </AppShell>
  );
}

function DayNav({ view, date, today, room, locale }: { view: View; date: string; today: string; room?: string; locale: Locale }) {
  const t = getScheduleDict(locale);
  let prev: string, next: string, label: string, isCurrent: boolean;
  if (view === "week") {
    prev = addDays(date, -7);
    next = addDays(date, 7);
    label = t.view.week;
    isCurrent = startOfWeek(date) === startOfWeek(today);
  } else if (view === "month") {
    const [y, m] = date.split("-").map(Number);
    prev = `${m === 1 ? y - 1 : y}-${String(m === 1 ? 12 : m - 1).padStart(2, "0")}-01`;
    next = `${m === 12 ? y + 1 : y}-${String(m === 12 ? 1 : m + 1).padStart(2, "0")}-01`;
    label = t.view.month;
    isCurrent = date.slice(0, 7) === today.slice(0, 7);
  } else {
    prev = addDays(date, -1);
    next = addDays(date, 1);
    label = t.view.day;
    isCurrent = date === today;
  }
  // החצים מצביעים לכיוון "אחורה/קדימה" בכיוון הקריאה: ב-RTL "קודם" הוא
  // ימינה, ב-LTR — שמאלה.
  const PrevIcon = locale === "he" ? ChevronRight : ChevronLeft;
  const NextIcon = locale === "he" ? ChevronLeft : ChevronRight;
  return (
    <div className="flex items-center gap-1">
      <Button asChild variant="outline" size="icon">
        <Link href={viewHref(view, prev, room)} aria-label={t.prevAria(label)}>
          <PrevIcon className="size-4" />
        </Link>
      </Button>
      <Button asChild variant="outline" size="icon">
        <Link href={viewHref(view, next, room)} aria-label={t.nextAria(label)}>
          <NextIcon className="size-4" />
        </Link>
      </Button>
      {!isCurrent && (
        <Button asChild variant="ghost" size="sm">
          <Link href={viewHref(view, today, room)}>{t.today}</Link>
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
  openHour,
  closeHour,
  locale,
}: {
  date: string;
  today: string;
  timezone: string;
  rooms: { id: string; name: string }[];
  userId: string;
  now: Date;
  openHour: number;
  closeHour: number;
  locale: Locale;
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
        {/* בלי overflow כאן — ר' הערה ב-WeekView: תיבת הגלילה שייכת ל-SlotGrid. */}
        <CardContent className="p-0">
          <SlotGrid
            slots={slots}
            columns={rooms.map((r): GridColumn => ({ key: r.id, roomId: r.id, date, header: r.name }))}
            cells={buildCellStates(
              rooms.map((r) => ({ roomId: r.id, date })),
              slots,
              timezone,
              now,
              availability ?? [],
              myBookings ?? [],
            )}
          />
        </CardContent>
      </Card>
    </>
  );
}

// בונה את מטריצת מצב התאים (עמודה × שורת-שעה) עבור SlotGrid, מתוך אותם
// availability/myBookings ש-DayView/WeekView כבר שולפים. משותף לשני
// התצוגות — ההבדל היחיד הוא מה מייצג "עמודה" (חדר קבוע ביום אחד, או יום
// קבוע לחדר אחד בשבוע).
function buildCellStates(
  columns: { roomId: string; date: string }[],
  slots: string[],
  timezone: string,
  now: Date,
  availability: { room_id: string | null; starts_at: string | null; ends_at: string | null; kind: string | null }[],
  myBookings: { id: string; room_id: string; starts_at: string; ends_at: string; source: string }[],
): CellState[][] {
  return columns.map((col) =>
    slots.map((slot) => {
      const slotStart = zonedDateTimeToUtc(col.date, slot, timezone);
      const slotEnd = new Date(slotStart.getTime() + SLOT_MINUTES * 60_000);
      if (slotEnd <= now) return { status: "past" };

      const mine = myBookings.find(
        (b) => b.room_id === col.roomId && new Date(b.starts_at) < slotEnd && new Date(b.ends_at) > slotStart,
      );
      if (mine) return { status: "mine", bookingId: mine.id, cancellable: mine.source !== "session" };

      const overlap = availability.find(
        (a) =>
          a.room_id === col.roomId &&
          new Date(a.starts_at as string) < slotEnd &&
          new Date(a.ends_at as string) > slotStart,
      );
      if (overlap) return { status: overlap.kind === "booked" ? "taken" : "blocked" };

      return { status: "available" };
    }),
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
  openHour,
  closeHour,
  locale,
}: {
  date: string;
  today: string;
  timezone: string;
  rooms: { id: string; name: string }[];
  selectedRoomId: string;
  userId: string;
  now: Date;
  openHour: number;
  closeHour: number;
  locale: Locale;
}) {
  const supabase = await createClient();
  const c = getCommonDict(locale);
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

  const slots = buildDaySlots(openHour, closeHour);

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-sm font-medium tabular-nums">
          {formatInTimeZone(zonedDateTimeToUtc(weekStart, "12:00", timezone), timezone, "dd/MM")} –{" "}
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
        {/* בלי overflow כאן: SlotGrid מנהל תיבת גלילה משלו לשני הצירים,
            וזה מה שמאפשר לשורת הכותרת ולעמודת השעה להיות sticky. עוד
            scroll container עוטף היה שובר את זה. */}
        <CardContent className="p-0">
          <SlotGrid
            slots={slots}
            columns={days.map(
              (d, i): GridColumn => ({
                key: d,
                roomId: selectedRoomId,
                date: d,
                header: `${c.weekdaysShort[i]} · ${d.slice(8, 10)}/${d.slice(5, 7)}`,
              }),
            )}
            cells={buildCellStates(
              days.map((d) => ({ roomId: selectedRoomId, date: d })),
              slots,
              timezone,
              now,
              availability ?? [],
              myBookings ?? [],
            )}
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
  userId,
  locale,
}: {
  date: string;
  today: string;
  timezone: string;
  userId: string;
  locale: Locale;
}) {
  const supabase = await createClient();
  const t = getScheduleDict(locale);
  const c = getCommonDict(locale);
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
                            {isMine && <span className="size-1.5 rounded-full bg-violet-500" title={t.youHaveBooking} />}
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
