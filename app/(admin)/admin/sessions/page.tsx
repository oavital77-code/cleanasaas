import Link from "next/link";
import { requireClinicAdmin } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { formatCurrencyILS, formatDateHe } from "@/lib/time";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { approveSessionAction, rejectSessionAction } from "./actions";

const WEEKDAYS = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];

const STATUS_LABEL: Record<string, { label: string; tone: string }> = {
  requested: { label: "ממתין לאישור", tone: "bg-warning-bg text-warning-fg" },
  rejected: { label: "נדחה", tone: "bg-danger-bg text-danger" },
  awaiting_payment: { label: "ממתין לתשלום", tone: "bg-info-bg text-info-fg" },
  active: { label: "פעיל", tone: "bg-success-bg text-success-fg" },
  pending_cancellation: { label: "בביטול", tone: "bg-warning-bg text-warning-fg" },
  cancelled: { label: "בוטל", tone: "bg-subtle text-muted-foreground" },
  expired: { label: "פג תוקף", tone: "bg-subtle text-muted-foreground" },
};

export default async function AdminSessionsPage() {
  const { profile, clinicId } = await requireClinicAdmin();
  const supabase = await createClient();

  const [{ data: clinic }, { data: subscriptions }] = await Promise.all([
    supabase.from("clinics").select("name").eq("id", clinicId).single(),
    supabase
      .from("session_subscriptions")
      .select("*, profiles(full_name), session_slots(weekday, start_time, end_time, rooms(name))")
      .eq("clinic_id", clinicId)
      .order("created_at", { ascending: false })
      .limit(40),
  ]);

  const queue = (subscriptions ?? []).filter((s) => s.status === "requested");
  const rest = (subscriptions ?? []).filter((s) => s.status !== "requested");

  function SlotList({ s }: { s: NonNullable<typeof subscriptions>[number] }) {
    return (
      <ul className="flex flex-col gap-0.5 text-xs text-muted-foreground">
        {(s.session_slots as { weekday: number; start_time: string; end_time: string; rooms: { name?: string } | null }[]).map(
          (slot, i) => (
            <li key={i}>
              יום {WEEKDAYS[slot.weekday]} · {slot.start_time.slice(0, 5)}–{slot.end_time.slice(0, 5)} · {slot.rooms?.name}
            </li>
          ),
        )}
      </ul>
    );
  }

  return (
    <AppShell side="admin" clinicName={clinic?.name} fullName={profile.full_name}>
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-8">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">בקשות ססיה</h1>
          <Button asChild variant="outline">
            <Link href="/admin/sessions/new">קביעת ססיה חופשית</Link>
          </Button>
        </div>

        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-medium text-muted-foreground">ממתינות לאישור</h2>
          {queue.length === 0 && <p className="text-sm text-muted-foreground">אין בקשות ממתינות.</p>}
          {queue.map((s) => (
            <Card key={s.id} className="shadow-e1">
              <CardHeader>
                <CardTitle className="text-base font-medium">
                  {(s.profiles as { full_name?: string } | null)?.full_name} — {s.weekly_hours} שעות ·{" "}
                  {formatCurrencyILS(s.monthly_price)}/חודש
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                <SlotList s={s} />
                {s.start_date && <p className="text-xs text-muted-foreground">תאריך התחלה מבוקש: {formatDateHe(new Date(s.start_date))}</p>}
                <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
                  <form action={approveSessionAction} className="flex flex-wrap items-end gap-2">
                    <input type="hidden" name="subscription_id" value={s.id} />
                    <Select name="term_months" className="flex-1 md:h-9 sm:flex-none">
                      <option value="">ללא התחייבות</option>
                      <option value="1">חודש</option>
                      <option value="3">3 חודשים</option>
                      <option value="6">6 חודשים</option>
                      <option value="12">שנה</option>
                    </Select>
                    <Button type="submit" size="sm">
                      אישור
                    </Button>
                  </form>
                  <form action={rejectSessionAction} className="flex flex-wrap items-end gap-2">
                    <input type="hidden" name="subscription_id" value={s.id} />
                    <Input name="reason" placeholder="סיבת דחייה" className="w-full sm:h-9 sm:w-40" />
                    <Button type="submit" size="sm" variant="destructive">
                      דחייה
                    </Button>
                  </form>
                </div>
              </CardContent>
            </Card>
          ))}
        </section>

        {rest.length > 0 && (
          <section className="flex flex-col gap-3">
            <h2 className="text-sm font-medium text-muted-foreground">שאר הססיות</h2>
            {rest.map((s) => {
              const status = STATUS_LABEL[s.status] ?? { label: s.status, tone: "bg-subtle" };
              return (
                <Card key={s.id} className="shadow-e1">
                  <CardContent className="flex items-center justify-between p-4 text-sm">
                    <span>
                      {(s.profiles as { full_name?: string } | null)?.full_name} — {s.weekly_hours} שעות
                    </span>
                    <span className={`rounded-pill px-2.5 py-1 text-xs font-medium ${status.tone}`}>{status.label}</span>
                  </CardContent>
                </Card>
              );
            })}
          </section>
        )}
      </div>
    </AppShell>
  );
}
