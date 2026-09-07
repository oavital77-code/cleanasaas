import { requireClinicAdmin } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { formatCurrencyILS } from "@/lib/time";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getAdminReportsDict, normalizeLocale } from "@/lib/i18n";

// דוח בסיסי — ספירות/סכומים לחודש הנוכחי. לא אנליטיקס/גרפים (מחוץ להיקף
// הנוכחי, ר' PROGRESS.md).
export default async function AdminReportsPage() {
  const { profile, clinicId } = await requireClinicAdmin();
  const supabase = await createClient();
  const t = getAdminReportsDict(normalizeLocale(profile.locale));

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const [{ data: clinic }, { data: paidPayments }, { data: cardsThisMonth }, { count: bookingsThisMonth }, { count: activeSessions }, { count: activeTherapists }] =
    await Promise.all([
      supabase.from("clinics").select("name").eq("id", clinicId).single(),
      supabase
        .from("payments")
        .select("amount_total")
        .eq("clinic_id", clinicId)
        .eq("status", "paid")
        .gte("paid_at", monthStart.toISOString()),
      supabase
        .from("punch_cards")
        .select("hours_purchased")
        .eq("clinic_id", clinicId)
        .gte("purchased_at", monthStart.toISOString()),
      supabase
        .from("bookings")
        .select("id", { count: "exact", head: true })
        .eq("clinic_id", clinicId)
        .gte("created_at", monthStart.toISOString()),
      supabase.from("session_subscriptions").select("id", { count: "exact", head: true }).eq("clinic_id", clinicId).eq("status", "active"),
      supabase.from("profiles").select("id", { count: "exact", head: true }).eq("clinic_id", clinicId).eq("status", "active"),
    ]);

  const revenue = (paidPayments ?? []).reduce((sum, p) => sum + Number(p.amount_total), 0);
  const hoursSold = (cardsThisMonth ?? []).reduce((sum, c) => sum + Number(c.hours_purchased), 0);

  const stats = [
    { label: t.revenueThisMonth, value: formatCurrencyILS(revenue) },
    { label: t.hoursSoldThisMonth, value: hoursSold },
    { label: t.bookingsThisMonth, value: bookingsThisMonth ?? 0 },
    { label: t.activeSessions, value: activeSessions ?? 0 },
    { label: t.activeTherapists, value: activeTherapists ?? 0 },
  ];

  return (
    <AppShell side="admin" clinicName={clinic?.name} fullName={profile.full_name} locale={profile.locale}>
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        <h1 className="text-2xl font-semibold">{t.title}</h1>
        <div className="grid gap-4 sm:grid-cols-2">
          {stats.map((s) => (
            <Card key={s.label} className="shadow-e1">
              <CardHeader>
                <CardTitle className="tabular-nums text-2xl">{s.value}</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">{s.label}</CardContent>
            </Card>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
