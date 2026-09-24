import Link from "next/link";
import { requireTherapistProfile } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { formatCurrencyILS, formatDateHe } from "@/lib/time";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { requestCancellationAction } from "./actions";
import { getPurchaseDict, getCommonDict, getSessionsDict, normalizeLocale } from "@/lib/i18n";
import { PaymentInstructions } from "@/components/payment-instructions";
import { PAYMENT_INSTRUCTIONS_KEY, readPaymentInstructions } from "@/lib/payment-instructions";

const STATUS_TONE: Record<string, string> = {
  requested: "bg-warning-bg text-warning-fg",
  rejected: "bg-danger-bg text-danger",
  awaiting_payment: "bg-info-bg text-info-fg",
  active: "bg-success-bg text-success-fg",
  pending_cancellation: "bg-warning-bg text-warning-fg",
  cancelled: "bg-subtle text-muted-foreground",
  expired: "bg-subtle text-muted-foreground",
};

export default async function SessionsPage() {
  const { userId, profile } = await requireTherapistProfile();
  const supabase = await createClient();
  const locale = normalizeLocale(profile.locale);
  const t = getSessionsDict(locale);
  const c = getCommonDict(locale);
  const p = getPurchaseDict(locale);

  const [{ data: clinic }, { data: subscriptions }, { data: instructionsRow }] = await Promise.all([
    supabase.from("clinics").select("name, sessions_enabled").eq("id", profile.clinic_id).single(),
    supabase
      .from("session_subscriptions")
      .select("*, session_slots(weekday, start_time, end_time, rooms(name))")
      .eq("user_id", userId)
      .order("created_at", { ascending: false }),
    supabase
      .from("app_settings")
      .select("value")
      .eq("clinic_id", profile.clinic_id)
      .eq("key", PAYMENT_INSTRUCTIONS_KEY)
      .maybeSingle(),
  ]);
  const instructions = readPaymentInstructions(instructionsRow?.value);

  const isAdmin = profile.role === "owner" || profile.role === "admin";
  const hasOpenSubscription = (subscriptions ?? []).some((s) =>
    ["requested", "awaiting_payment", "active", "pending_cancellation"].includes(s.status),
  );

  return (
    <AppShell side="app" clinicName={clinic?.name} fullName={profile.full_name} locale={profile.locale} isAdmin={isAdmin}>
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold">{t.title}</h1>
          {clinic?.sessions_enabled && !hasOpenSubscription && (
            <Button asChild>
              <Link href="/sessions/new">{t.newRequest}</Link>
            </Button>
          )}
        </div>

        {!clinic?.sessions_enabled && <p className="text-muted-foreground">{t.notEnabled}</p>}

        {(subscriptions ?? []).length === 0 && clinic?.sessions_enabled && (
          <p className="text-muted-foreground">{t.empty}</p>
        )}

        {(subscriptions ?? []).map((s) => (
          <Card key={s.id} className="shadow-e1">
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle className="text-base font-medium">
                {t.weeklyHoursPrice(s.weekly_hours, formatCurrencyILS(s.monthly_price))}
              </CardTitle>
              <span className={`rounded-pill px-2.5 py-1 text-xs font-medium ${STATUS_TONE[s.status] ?? "bg-subtle"}`}>
                {c.sessionStatus[s.status] ?? s.status}
              </span>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 text-sm">
              <ul className="flex flex-col gap-1 text-muted-foreground">
                {(s.session_slots as { weekday: number; start_time: string; end_time: string; rooms: { name?: string } | null }[]).map(
                  (slot, i) => (
                    <li key={i}>
                      {c.weekdayWithPrefix(slot.weekday)} · {slot.start_time.slice(0, 5)}–{slot.end_time.slice(0, 5)} ·{" "}
                      {slot.rooms?.name}
                    </li>
                  ),
                )}
              </ul>

              {s.status === "rejected" && s.rejection_reason && (
                <p className="text-danger">{t.rejectionReason(s.rejection_reason)}</p>
              )}
              {s.next_billing_date && <p>{t.nextBilling(formatDateHe(new Date(s.next_billing_date)))}</p>}
              {s.effective_end_date && <p>{t.activeUntil(formatDateHe(new Date(s.effective_end_date)))}</p>}

              {s.status === "awaiting_payment" && (
                <div className="flex flex-col gap-2">
                  <p>{t.awaitingPayment}</p>
                  <PaymentInstructions text={instructions} title={p.howToPayTitle} fallback={p.howToPayFallback} />
                </div>
              )}

              {s.status === "active" && (
                <form action={requestCancellationAction} className="w-fit">
                  <input type="hidden" name="subscription_id" value={s.id} />
                  <Button type="submit" size="sm" variant="destructive">
                    {t.requestCancellation}
                  </Button>
                </form>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </AppShell>
  );
}
