import Link from "next/link";
import { requireTherapistProfile } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { formatCurrencyILS, formatDateHe } from "@/lib/time";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { requestCancellationAction } from "./actions";

const STATUS_LABEL: Record<string, { label: string; tone: string }> = {
  requested: { label: "ממתין לאישור אדמין", tone: "bg-warning-bg text-warning-fg" },
  rejected: { label: "נדחה", tone: "bg-danger-bg text-danger" },
  awaiting_payment: { label: "ממתין לתשלום", tone: "bg-info-bg text-info-fg" },
  active: { label: "פעיל", tone: "bg-success-bg text-success-fg" },
  pending_cancellation: { label: "בביטול — פעיל עד סוף התקופה", tone: "bg-warning-bg text-warning-fg" },
  cancelled: { label: "בוטל", tone: "bg-subtle text-muted-foreground" },
  expired: { label: "פג תוקף", tone: "bg-subtle text-muted-foreground" },
};

const WEEKDAYS = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];

export default async function SessionsPage() {
  const { userId, profile } = await requireTherapistProfile();
  const supabase = await createClient();

  const [{ data: clinic }, { data: subscriptions }, { data: paymentSettings }] = await Promise.all([
    supabase.from("clinics").select("name, sessions_enabled").eq("id", profile.clinic_id).single(),
    supabase
      .from("session_subscriptions")
      .select("*, session_slots(weekday, start_time, end_time, rooms(name))")
      .eq("user_id", userId)
      .order("created_at", { ascending: false }),
    supabase.from("clinic_payment_settings").select("woo_store_url").eq("clinic_id", profile.clinic_id).maybeSingle(),
  ]);

  const isAdmin = profile.role === "owner" || profile.role === "admin";
  const hasOpenSubscription = (subscriptions ?? []).some((s) =>
    ["requested", "awaiting_payment", "active", "pending_cancellation"].includes(s.status),
  );

  return (
    <AppShell side="app" clinicName={clinic?.name} fullName={profile.full_name} isAdmin={isAdmin}>
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold">הססיות שלי</h1>
          {clinic?.sessions_enabled && !hasOpenSubscription && (
            <Button asChild>
              <Link href="/sessions/new">בקשת ססיה חדשה</Link>
            </Button>
          )}
        </div>

        {!clinic?.sessions_enabled && (
          <p className="text-muted-foreground">מודל ססיה לא פעיל בקליניקה שלכם.</p>
        )}

        {(subscriptions ?? []).length === 0 && clinic?.sessions_enabled && (
          <p className="text-muted-foreground">אין עדיין בקשת/מנוי ססיה.</p>
        )}

        {(subscriptions ?? []).map((s) => {
          const status = STATUS_LABEL[s.status] ?? { label: s.status, tone: "bg-subtle" };
          return (
            <Card key={s.id} className="shadow-e1">
              <CardHeader className="flex-row items-center justify-between space-y-0">
                <CardTitle className="text-base font-medium">
                  {s.weekly_hours} שעות שבועיות · {formatCurrencyILS(s.monthly_price)}/חודש
                </CardTitle>
                <span className={`rounded-pill px-2.5 py-1 text-xs font-medium ${status.tone}`}>{status.label}</span>
              </CardHeader>
              <CardContent className="flex flex-col gap-3 text-sm">
                <ul className="flex flex-col gap-1 text-muted-foreground">
                  {(s.session_slots as { weekday: number; start_time: string; end_time: string; rooms: { name?: string } | null }[]).map(
                    (slot, i) => (
                      <li key={i}>
                        יום {WEEKDAYS[slot.weekday]} · {slot.start_time.slice(0, 5)}–{slot.end_time.slice(0, 5)} ·{" "}
                        {slot.rooms?.name}
                      </li>
                    ),
                  )}
                </ul>

                {s.status === "rejected" && s.rejection_reason && (
                  <p className="text-danger">סיבת דחייה: {s.rejection_reason}</p>
                )}
                {s.next_billing_date && <p>חיוב הבא: {formatDateHe(new Date(s.next_billing_date))}</p>}
                {s.effective_end_date && <p>פעיל עד: {formatDateHe(new Date(s.effective_end_date))}</p>}

                {s.status === "awaiting_payment" && (
                  <Button asChild size="sm" className="w-fit">
                    <a href={paymentSettings?.woo_store_url ?? "#"} target="_blank" rel="noreferrer">
                      לתשלום בחנות
                    </a>
                  </Button>
                )}

                {s.status === "active" && (
                  <form action={requestCancellationAction} className="w-fit">
                    <input type="hidden" name="subscription_id" value={s.id} />
                    <Button type="submit" size="sm" variant="destructive">
                      בקשת ביטול מנוי
                    </Button>
                  </form>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </AppShell>
  );
}
