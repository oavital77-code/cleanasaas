import Link from "next/link";
import { requireClinicAdmin } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { formatInTimeZone } from "date-fns-tz";
import { DEFAULT_TIMEZONE, formatDateHe, formatTimeHe, zonedDateTimeToUtc } from "@/lib/time";
import { getAdminHomeDict, getCommonDict, normalizeLocale } from "@/lib/i18n";

// מסך הבית של האדמין/ית — לא רק מספרים. משוב המשתמש/ת (10/09): "לפרט
// יותר, נגיד מטפל שנגמרת לו הכרטיסייה עם יתרה של פחות משעתיים — תרשום את
// השמות". לכן כל אריח מוביל לרשימה עם שמות ופעולה, במקום מספר בודד.
//
// אדמין/ית רואה/ה שמות של כל המטפלים/ות בקליניקה שלה/ו — חוק #3 ב-CLAUDE.md
// אוסר חשיפת מטפל/ת למטפל/ת אחר/ת, לא לאדמין/ית (וכל השאילתות כאן מסוננות
// ב-clinic_id + RLS).

const LOW_BALANCE_HOURS = 2;
const EXPIRY_WARNING_DAYS = 30;

export default async function AdminHomePage() {
  const { profile, clinicId } = await requireClinicAdmin();
  const supabase = await createClient();
  const locale = normalizeLocale(profile.locale);
  const t = getAdminHomeDict(locale);
  const c = getCommonDict(locale);

  const { data: clinic } = await supabase.from("clinics").select("name, timezone").eq("id", clinicId).single();
  const timezone = clinic?.timezone ?? DEFAULT_TIMEZONE;
  const now = new Date();
  const today = formatInTimeZone(now, timezone, "yyyy-MM-dd");
  const dayStart = zonedDateTimeToUtc(today, "00:00", timezone).toISOString();
  const dayEnd = zonedDateTimeToUtc(today, "23:59", timezone).toISOString();
  const nowIso = now.toISOString();

  const [{ data: todayBookings }, { data: pendingSessions }, { data: therapists }, { data: cards }] = await Promise.all([
    supabase
      .from("bookings")
      // profiles!bookings_user_id_fkey — לטבלה יש גם cancelled_by ל-profiles,
      // אז embed לא-מפורש דו-משמעי (אותה תבנית כמו ב-/admin/board).
      .select("id, starts_at, ends_at, source, room_id, user_id, rooms(name), profiles!bookings_user_id_fkey(full_name)")
      .eq("clinic_id", clinicId)
      .eq("status", "confirmed")
      .gte("starts_at", dayStart)
      .lte("starts_at", dayEnd)
      .order("starts_at"),
    supabase
      .from("session_subscriptions")
      .select("id, user_id, weekly_hours, requested_at, profiles!session_subscriptions_user_id_fkey(full_name)")
      .eq("clinic_id", clinicId)
      .eq("status", "requested")
      .order("requested_at"),
    supabase
      .from("profiles")
      .select("id, full_name, role, clerk_user_id")
      .eq("clinic_id", clinicId)
      .eq("status", "active")
      .order("full_name"),
    supabase
      .from("punch_cards")
      .select("user_id, hours_remaining, expires_at")
      .eq("clinic_id", clinicId)
      .eq("active", true)
      .gt("expires_at", nowIso),
  ]);

  // יתרה נמוכה נמדדת **פר מטפל/ת** ולא פר כרטיסייה: שתי כרטיסיות כמעט-ריקות
  // של אותה מטפלת הן התראה אחת, והסכום שלהן הוא מה שנשאר לה בפועל.
  const nameById = new Map((therapists ?? []).map((p) => [p.id, p.full_name]));
  const totals = new Map<string, { hours: number; nextExpiry: string | null }>();
  for (const card of cards ?? []) {
    const prev = totals.get(card.user_id) ?? { hours: 0, nextExpiry: null };
    const nextExpiry =
      Number(card.hours_remaining) > 0 && (!prev.nextExpiry || card.expires_at < prev.nextExpiry)
        ? card.expires_at
        : prev.nextExpiry;
    totals.set(card.user_id, { hours: prev.hours + Number(card.hours_remaining), nextExpiry });
  }

  const lowBalance = [...totals.entries()]
    .filter(([userId, v]) => v.hours < LOW_BALANCE_HOURS && nameById.has(userId))
    .map(([userId, v]) => ({ userId, name: nameById.get(userId)!, hours: v.hours }))
    .sort((a, b) => a.hours - b.hours);

  const expiryCutoff = new Date(now.getTime() + EXPIRY_WARNING_DAYS * 86400000).toISOString();
  const expiringSoon = [...totals.entries()]
    .filter(([userId, v]) => v.hours > 0 && v.nextExpiry !== null && v.nextExpiry <= expiryCutoff && nameById.has(userId))
    .map(([userId, v]) => ({ userId, name: nameById.get(userId)!, hours: v.hours, expiresAt: v.nextExpiry! }))
    .sort((a, b) => a.expiresAt.localeCompare(b.expiresAt));

  const notSignedUp = (therapists ?? []).filter((p) => !p.clerk_user_id);
  const bookings = todayBookings ?? [];
  const sessions = pendingSessions ?? [];

  const widgets = [
    { label: t.todayBookings, value: bookings.length, href: "/admin/board" },
    { label: t.pendingSessions, value: sessions.length, href: "/admin/sessions", alert: sessions.length > 0 },
    { label: t.activeTherapists, value: (therapists ?? []).length, href: "/admin/therapists" },
    { label: t.lowBalance, value: lowBalance.length, href: "/admin/therapists", alert: lowBalance.length > 0 },
  ];

  return (
    <AppShell side="admin" clinicName={clinic?.name} fullName={profile.full_name} locale={profile.locale}>
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
        <div>
          <h1 className="text-2xl font-semibold">{t.title}</h1>
          <p className="text-muted-foreground">{t.todayIs(formatDateHe(now, timezone))}</p>
        </div>

        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {widgets.map((w) => (
            <Link key={w.label} href={w.href}>
              <Card className="h-full shadow-e1 transition-shadow hover:shadow-e2">
                <CardHeader>
                  <CardTitle className={`tabular-nums text-3xl ${w.alert ? "text-danger" : ""}`}>{w.value}</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">{w.label}</CardContent>
              </Card>
            </Link>
          ))}
        </div>

        <Card className="shadow-e1">
          <CardHeader>
            <CardTitle className="text-base font-medium">{t.todayTitle}</CardTitle>
            <CardDescription>{t.todayDescription}</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {bookings.length === 0 ? (
              <p className="px-6 pb-6 text-sm text-muted-foreground">{t.todayEmpty}</p>
            ) : (
              <ul className="flex flex-col">
                {bookings.map((b) => (
                  <li key={b.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-border px-6 py-3 text-sm">
                    <span className="tabular-nums font-medium">
                      {formatTimeHe(new Date(b.starts_at), timezone)}–{formatTimeHe(new Date(b.ends_at), timezone)}
                    </span>
                    <Link href={`/admin/therapists/${b.user_id}`} className="font-medium text-violet-600 hover:underline">
                      {(b.profiles as { full_name?: string } | null)?.full_name ?? "—"}
                    </Link>
                    <span className="text-muted-foreground">{(b.rooms as { name?: string } | null)?.name ?? "—"}</span>
                    {b.source !== "punch_card" && (
                      <span className="rounded-pill bg-subtle px-2 py-0.5 text-xs text-muted-foreground">
                        {c.bookingSource[b.source] ?? b.source}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="shadow-e1">
            <CardHeader>
              <CardTitle className="text-base font-medium">{t.lowBalanceTitle}</CardTitle>
              <CardDescription>{t.lowBalanceDescription(LOW_BALANCE_HOURS)}</CardDescription>
            </CardHeader>
            <CardContent>
              {lowBalance.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t.lowBalanceEmpty}</p>
              ) : (
                <ul className="flex flex-col gap-2 text-sm">
                  {lowBalance.map((r) => (
                    <li key={r.userId} className="flex items-center justify-between gap-3">
                      <Link href={`/admin/therapists/${r.userId}`} className="font-medium text-violet-600 hover:underline">
                        {r.name}
                      </Link>
                      <span className={`tabular-nums ${r.hours <= 0 ? "text-danger" : "text-muted-foreground"}`}>
                        {t.hoursLeft(r.hours)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-e1">
            <CardHeader>
              <CardTitle className="text-base font-medium">{t.pendingSessionsTitle}</CardTitle>
              <CardDescription>{t.pendingSessionsDescription}</CardDescription>
            </CardHeader>
            <CardContent>
              {sessions.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t.pendingSessionsEmpty}</p>
              ) : (
                <ul className="flex flex-col gap-2 text-sm">
                  {sessions.map((s) => (
                    <li key={s.id} className="flex items-center justify-between gap-3">
                      <Link href="/admin/sessions" className="font-medium text-violet-600 hover:underline">
                        {(s.profiles as { full_name?: string } | null)?.full_name ?? "—"}
                      </Link>
                      <span className="tabular-nums text-muted-foreground">{t.weeklyHours(Number(s.weekly_hours))}</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {expiringSoon.length > 0 && (
            <Card className="shadow-e1">
              <CardHeader>
                <CardTitle className="text-base font-medium">{t.expiringTitle}</CardTitle>
                <CardDescription>{t.expiringDescription(EXPIRY_WARNING_DAYS)}</CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="flex flex-col gap-2 text-sm">
                  {expiringSoon.map((r) => (
                    <li key={r.userId} className="flex items-center justify-between gap-3">
                      <Link href={`/admin/therapists/${r.userId}`} className="font-medium text-violet-600 hover:underline">
                        {r.name}
                      </Link>
                      <span className="tabular-nums text-muted-foreground">
                        {t.hoursLeft(r.hours)} · {formatDateHe(new Date(r.expiresAt), timezone)}
                      </span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {notSignedUp.length > 0 && (
            <Card className="shadow-e1">
              <CardHeader>
                <CardTitle className="text-base font-medium">{t.notSignedUpTitle}</CardTitle>
                <CardDescription>{t.notSignedUpDescription}</CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="flex flex-col gap-2 text-sm">
                  {notSignedUp.map((p) => (
                    <li key={p.id}>
                      <Link href={`/admin/therapists/${p.id}`} className="font-medium text-violet-600 hover:underline">
                        {p.full_name}
                      </Link>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </AppShell>
  );
}
