import Link from "next/link";
import { requireClinicAdmin } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatInTimeZone } from "date-fns-tz";
import { DEFAULT_TIMEZONE, zonedDateTimeToUtc } from "@/lib/time";

export default async function AdminHomePage() {
  const { profile, clinicId } = await requireClinicAdmin();
  const supabase = await createClient();

  const { data: clinic } = await supabase.from("clinics").select("name, timezone").eq("id", clinicId).single();
  const timezone = clinic?.timezone ?? DEFAULT_TIMEZONE;
  const today = formatInTimeZone(new Date(), timezone, "yyyy-MM-dd");
  const dayStart = zonedDateTimeToUtc(today, "00:00", timezone).toISOString();
  const dayEnd = zonedDateTimeToUtc(today, "23:59", timezone).toISOString();

  const [{ count: todayBookings }, { count: pendingSessions }, { count: therapistsCount }, { data: lowBalanceCards }] =
    await Promise.all([
      supabase
        .from("bookings")
        .select("id", { count: "exact", head: true })
        .eq("clinic_id", clinicId)
        .eq("status", "confirmed")
        .gte("starts_at", dayStart)
        .lte("starts_at", dayEnd),
      supabase
        .from("session_subscriptions")
        .select("id", { count: "exact", head: true })
        .eq("clinic_id", clinicId)
        .eq("status", "requested"),
      supabase.from("profiles").select("id", { count: "exact", head: true }).eq("clinic_id", clinicId).eq("status", "active"),
      supabase.from("punch_cards").select("id").eq("clinic_id", clinicId).eq("active", true).lt("hours_remaining", 2),
    ]);

  const widgets = [
    { label: "הזמנות היום", value: todayBookings ?? 0, href: "/admin/board" },
    { label: "בקשות ססיה ממתינות", value: pendingSessions ?? 0, href: "/admin/sessions" },
    { label: "מטפלים פעילים", value: therapistsCount ?? 0, href: "/admin/therapists" },
    { label: "יתרה נמוכה (מתחת ל-2 שעות)", value: (lowBalanceCards ?? []).length, href: "/admin/therapists" },
  ];

  return (
    <AppShell side="admin" clinicName={clinic?.name} fullName={profile.full_name} locale={profile.locale}>
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
        <h1 className="text-2xl font-semibold">מסך הבית</h1>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {widgets.map((w) => (
            <Link key={w.label} href={w.href}>
              <Card className="shadow-e1 transition-shadow hover:shadow-e2">
                <CardHeader>
                  <CardTitle className="tabular-nums text-3xl">{w.value}</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">{w.label}</CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
