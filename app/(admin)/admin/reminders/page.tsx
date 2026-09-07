import Link from "next/link";
import { requireClinicAdmin } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { formatDateHe, formatTimeHe, DEFAULT_TIMEZONE } from "@/lib/time";
import { formatIsraeliPhoneDisplay } from "@/lib/phone";
import { buildWaMeLink, renderReminderTemplate } from "@/lib/whatsapp";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MessageCircle } from "lucide-react";
import { getAdminRemindersDict, normalizeLocale } from "@/lib/i18n";
import { markReminderSentAction } from "./actions";

const DEFAULT_TEMPLATE = "שלום {name}, תזכורת להזמנה שלך ב-{clinic}: {date} בשעה {time}, {room} ({branch}).";
const WINDOWS = [24, 48, 72];

// המסלול החצי-ידני לתזכורות WhatsApp (אפס סיכון חסימה): רשימת ההזמנות
// הקרובות, כפתור wa.me שפותח את ההודעה מוכנה בוואטסאפ של המנהל/ת (השליחה
// מהטלפון האמיתי), וסימון "נשלח" שמונע כפילות מול השליחה האוטומטית (Meta).
// 🔴 טלפונים של מטפלים/ות מוצגים לאדמין בלבד (RLS: is_admin + clinic).
export default async function AdminRemindersPage({ searchParams }: { searchParams: Promise<{ hours?: string }> }) {
  const { profile, clinicId } = await requireClinicAdmin();
  const supabase = await createClient();
  const { hours: hoursParam } = await searchParams;
  const locale = normalizeLocale(profile.locale);
  const t = getAdminRemindersDict(locale);

  const [{ data: clinic }, { data: settings }] = await Promise.all([
    supabase.from("clinics").select("name, timezone").eq("id", clinicId).single(),
    supabase.from("clinic_whatsapp_settings").select("template, hours_before").eq("clinic_id", clinicId).maybeSingle(),
  ]);
  const timezone = clinic?.timezone ?? DEFAULT_TIMEZONE;
  const requested = Number(hoursParam);
  const hours = WINDOWS.includes(requested) ? requested : (settings?.hours_before ?? 24);
  const template = settings?.template?.trim() || DEFAULT_TEMPLATE;
  const now = new Date();
  const windowEnd = new Date(now.getTime() + hours * 60 * 60_000);

  const { data: bookings, error } = await supabase
    .from("bookings")
    .select(
      "id, starts_at, ends_at, reminder_sent_at, whatsapp_reminder_sent_at, profiles!bookings_user_id_fkey(full_name, phone, whatsapp_reminders), rooms(name, branches(name))",
    )
    .eq("clinic_id", clinicId)
    .eq("status", "confirmed")
    .gt("starts_at", now.toISOString())
    .lte("starts_at", windowEnd.toISOString())
    .order("starts_at");
  if (error) console.error("admin/reminders bookings query failed:", error);

  // הסימון (whatsapp_reminder_sent_at) זהה לשליחה אוטומטית וידנית בכוונה —
  // מה שחשוב ל-cron הוא "נשלח". ההבחנה נמצאת ב-audit_log (provider).
  type Row = NonNullable<typeof bookings>[number];
  const rows = (bookings ?? []).map((b: Row) => {
    const p = b.profiles as { full_name?: string; phone?: string | null; whatsapp_reminders?: boolean } | null;
    const room = b.rooms as { name?: string; branches?: { name?: string } | null } | null;
    const startsAt = new Date(b.starts_at);
    const text = renderReminderTemplate(template, {
      name: p?.full_name ?? "",
      clinic: clinic?.name ?? "",
      date: formatDateHe(startsAt, timezone),
      time: formatTimeHe(startsAt, timezone),
      room: room?.name ?? "",
      branch: room?.branches?.name ?? "",
    });
    return {
      id: b.id,
      when: `${formatDateHe(startsAt, timezone)} ${formatTimeHe(startsAt, timezone)}`,
      therapist: p?.full_name ?? "",
      phone: p?.phone ?? null,
      optedOut: p?.whatsapp_reminders === false,
      room: [room?.name, room?.branches?.name].filter(Boolean).join(" · "),
      whatsappSent: Boolean(b.whatsapp_reminder_sent_at),
      emailSent: Boolean(b.reminder_sent_at),
      waLink: p?.phone ? buildWaMeLink(p.phone, text) : null,
    };
  });

  return (
    <AppShell side="admin" clinicName={clinic?.name} fullName={profile.full_name} locale={profile.locale}>
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold">{t.title}</h1>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">{t.windowLabel}</span>
            <div className="flex overflow-hidden rounded-button border border-border-strong">
              {WINDOWS.map((h) => (
                <Link
                  key={h}
                  href={`/admin/reminders?hours=${h}`}
                  className={`px-3 py-1.5 text-sm font-medium ${hours === h ? "bg-violet-500 text-white" : "bg-surface hover:bg-subtle"}`}
                >
                  {t.windowHours(h)}
                </Link>
              ))}
            </div>
          </div>
        </div>

        <Card className="shadow-e1">
          <CardHeader>
            <CardTitle className="text-base font-medium">{t.title}</CardTitle>
            <CardDescription>{t.description}</CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto p-0">
            {!settings?.template && <p className="px-6 pb-3 text-xs text-muted-foreground">{t.templateMissing}</p>}
            {rows.length === 0 ? (
              <p className="px-6 pb-6 text-sm text-muted-foreground">{t.empty}</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-muted">
                  <tr>
                    <th className="p-3 text-start font-medium">{t.colTime}</th>
                    <th className="p-3 text-start font-medium">{t.colTherapist}</th>
                    <th className="hidden p-3 text-start font-medium sm:table-cell">{t.colRoom}</th>
                    <th className="p-3 text-start font-medium">{t.colStatus}</th>
                    <th className="p-3 font-medium" />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} className="border-t border-border">
                      <td className="tabular-nums p-3 whitespace-nowrap">{r.when}</td>
                      <td className="p-3">
                        <div className="font-medium">{r.therapist}</div>
                        {r.phone && (
                          <div className="text-xs text-muted-foreground" dir="ltr">
                            {formatIsraeliPhoneDisplay(r.phone)}
                          </div>
                        )}
                      </td>
                      <td className="hidden p-3 sm:table-cell">{r.room}</td>
                      <td className="p-3">
                        <div className="flex flex-wrap gap-1">
                          {r.whatsappSent && (
                            <span className="rounded-pill bg-success-bg px-2 py-0.5 text-xs font-medium text-success-fg">{t.sent}</span>
                          )}
                          {r.emailSent && (
                            <span className="rounded-pill bg-subtle px-2 py-0.5 text-xs text-muted-foreground">{t.emailSent}</span>
                          )}
                          {r.optedOut && (
                            <span className="rounded-pill bg-warning-bg px-2 py-0.5 text-xs text-warning-fg">{t.optedOut}</span>
                          )}
                          {!r.phone && <span className="rounded-pill bg-danger-bg px-2 py-0.5 text-xs text-danger">{t.noPhone}</span>}
                        </div>
                      </td>
                      <td className="p-3">
                        {!r.whatsappSent && !r.optedOut && r.waLink && (
                          <div className="flex flex-wrap items-center gap-2">
                            <Button asChild size="sm">
                              <a href={r.waLink} target="_blank" rel="noreferrer">
                                <MessageCircle className="size-4" />
                                {t.openWhatsApp}
                              </a>
                            </Button>
                            <form action={markReminderSentAction}>
                              <input type="hidden" name="booking_id" value={r.id} />
                              <Button type="submit" size="sm" variant="outline">
                                {t.markSent}
                              </Button>
                            </form>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
