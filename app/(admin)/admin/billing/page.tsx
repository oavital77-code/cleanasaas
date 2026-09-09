import { Check } from "lucide-react";
import { requireClinicAdmin } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatCurrencyILS, formatDateHe } from "@/lib/time";
import { getAdminBillingDict, normalizeLocale } from "@/lib/i18n";
import { platformBillingAvailability, platformPlanPriceIls } from "@/lib/platform-billing";
import { cancelPlatformSubscriptionAction, startPlatformCheckoutAction } from "./actions";
import { CancelSubscription } from "./cancel-subscription";

const DAY = 86_400_000;
const daysLeft = (until: Date) => Math.max(0, Math.ceil((until.getTime() - Date.now()) / DAY));

const STATUS_TONE: Record<string, string> = {
  succeeded: "bg-success-bg text-success-fg",
  failed: "bg-danger-bg text-danger",
  refunded: "bg-subtle text-muted-foreground",
};

export default async function AdminBillingPage({ searchParams }: { searchParams: Promise<{ returned?: string }> }) {
  const { profile, clinicId } = await requireClinicAdmin();
  const supabase = await createClient();
  const locale = normalizeLocale(profile.locale);
  const t = getAdminBillingDict(locale);
  const { returned } = await searchParams;

  const [{ data: clinic }, { data: sub }, { data: payments }] = await Promise.all([
    supabase.from("clinics").select("name, status").eq("id", clinicId).single(),
    supabase.from("platform_subscriptions").select("*").eq("clinic_id", clinicId).maybeSingle(),
    supabase
      .from("platform_payments")
      .select("id, amount, status, paid_at, created_at")
      .eq("clinic_id", clinicId)
      .order("created_at", { ascending: false })
      .limit(24),
  ]);

  const availability = platformBillingAvailability();
  const price = formatCurrencyILS(platformPlanPriceIls());
  const periodEnd = sub?.current_period_end ? new Date(sub.current_period_end) : null;
  const graceEnd = sub?.grace_ends_at ? new Date(sub.grace_ends_at) : null;
  const clinicSuspended = clinic?.status === "suspended";

  // מצב אחד, במילים — מאותם שדות שה-RPCs מזיזים.
  const headline = (() => {
    if (!sub) return { title: t.state.suspended, hint: t.state.suspendedHint, tone: "warn" as const, activate: true, cancel: false };
    if (sub.status === "active" && sub.cancel_at_period_end)
      return { title: t.state.canceling(periodEnd ? formatDateHe(periodEnd) : ""), hint: t.state.cancelingHint, tone: "neutral" as const, activate: true, cancel: false };
    if (sub.status === "active")
      return { title: t.state.active(periodEnd ? formatDateHe(periodEnd) : ""), hint: t.state.activeHint, tone: "ok" as const, activate: false, cancel: true };
    if (sub.status === "trialing")
      return { title: t.state.trialing(periodEnd ? daysLeft(periodEnd) : 0), hint: t.state.trialingHint, tone: "info" as const, activate: true, cancel: false };
    if (sub.status === "past_due" && !clinicSuspended)
      return { title: t.state.pastDue(graceEnd ? daysLeft(graceEnd) : 0), hint: t.state.pastDueHint, tone: "warn" as const, activate: true, cancel: false };
    if (sub.status === "canceled" && !clinicSuspended)
      return { title: t.state.canceled, hint: t.state.suspendedHint, tone: "neutral" as const, activate: true, cancel: false };
    return { title: t.state.suspended, hint: t.state.suspendedHint, tone: "warn" as const, activate: true, cancel: false };
  })();

  const toneClass = {
    ok: "bg-success-bg text-success-fg",
    info: "bg-primary/10 text-primary",
    warn: "bg-warning-bg text-warning-fg",
    neutral: "bg-subtle text-muted-foreground",
  }[headline.tone];

  return (
    <AppShell side="admin" clinicName={clinic?.name} fullName={profile.full_name} locale={profile.locale}>
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        <h1 className="text-2xl font-semibold">{t.title}</h1>

        {returned && (
          <p role="status" className="rounded-md border border-border bg-subtle px-4 py-3 text-sm">
            {t.returned[returned] ?? (returned === "not_configured" ? t.notConfigured : t.error)}
          </p>
        )}

        <Card className="shadow-e2 relative overflow-hidden">
          <div aria-hidden className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-primary via-primary/60 to-primary" />
          <CardHeader className="pb-2">
            <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex flex-col gap-1">
                <CardTitle className="text-2xl font-semibold">{t.planName}</CardTitle>
                <p className="flex flex-wrap items-baseline gap-x-2" dir="ltr">
                  <span className="text-4xl font-semibold tabular-nums tracking-tight">{price}</span>
                  <span className="text-sm text-muted-foreground">{t.perMonth("").trim()}</span>
                  <span className="text-xs text-muted-foreground">· {t.inclVat}</span>
                </p>
              </div>
              <span className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-medium ${toneClass}`}>{headline.title}</span>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
            <p className="text-sm text-muted-foreground">{headline.hint}</p>

            <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {t.included.map((line) => (
                <li key={line} className="flex items-start gap-2.5 text-sm">
                  <span className="mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <Check className="size-3" aria-hidden />
                  </span>
                  <span>{line}</span>
                </li>
              ))}
            </ul>

            <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
              {headline.activate && (
                <form action={startPlatformCheckoutAction}>
                  <Button type="submit" size="lg" disabled={!availability.ok} className="w-full font-medium sm:w-auto">
                    {sub?.status === "active" || sub?.status === "canceled" ? t.reactivate : t.activate}
                  </Button>
                </form>
              )}
              {headline.cancel && (
                <CancelSubscription
                  action={cancelPlatformSubscriptionAction}
                  labels={{ cancel: t.cancel, confirm: t.cancelConfirm, yes: t.confirmCancel, keep: t.keep }}
                />
              )}
            </div>
            {headline.activate && <p className="text-xs text-muted-foreground">{availability.ok ? t.securePayment : t.notConfigured}</p>}
          </CardContent>
        </Card>

        <Card className="shadow-e1 overflow-hidden p-0">
          <CardHeader>
            <CardTitle className="text-base font-medium">{t.history}</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {(payments ?? []).length === 0 ? (
              <p className="px-6 pb-6 text-sm text-muted-foreground">{t.noHistory}</p>
            ) : (
              <table className="w-full text-sm">
                <tbody>
                  {(payments ?? []).map((p) => (
                    <tr key={p.id} className="border-t border-border">
                      <td className="p-3 text-muted-foreground">{formatDateHe(new Date(p.paid_at ?? p.created_at))}</td>
                      <td className="tabular-nums p-3 font-medium" dir="ltr">{formatCurrencyILS(Number(p.amount))}</td>
                      <td className="p-3">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs ${STATUS_TONE[p.status] ?? ""}`}>{t.paymentStatus[p.status] ?? p.status}</span>
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
