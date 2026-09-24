import Link from "next/link";
import { requireClinicAdmin } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { formatCurrencyILS, formatDateHe } from "@/lib/time";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { approveSessionAction, recordSessionPaymentAction, rejectSessionAction } from "./actions";
import { getAdminSessionsDict, getAdminTherapistDetailDict, getCommonDict, normalizeLocale } from "@/lib/i18n";

const STATUS_TONE: Record<string, string> = {
  requested: "bg-warning-bg text-warning-fg",
  rejected: "bg-danger-bg text-danger",
  awaiting_payment: "bg-info-bg text-info-fg",
  active: "bg-success-bg text-success-fg",
  pending_cancellation: "bg-warning-bg text-warning-fg",
  cancelled: "bg-subtle text-muted-foreground",
  expired: "bg-subtle text-muted-foreground",
};

export default async function AdminSessionsPage() {
  const { profile, clinicId } = await requireClinicAdmin();
  const supabase = await createClient();
  const locale = normalizeLocale(profile.locale);
  const t = getAdminSessionsDict(locale);
  const c = getCommonDict(locale);
  // אותה רשימת אמצעי תשלום כמו בהנפקת כרטיסייה ידנית בכרטיס המטפל/ת.
  const methods = getAdminTherapistDetailDict(locale).paymentMethods;

  const [{ data: clinic }, { data: subscriptions, error: subscriptionsError }] = await Promise.all([
    supabase.from("clinics").select("name").eq("id", clinicId).single(),
    supabase
      .from("session_subscriptions")
      // profiles!session_subscriptions_user_id_fkey — לטבלה יש גם reviewed_by
      // שמצביע ל-profiles, אז embed לא-מפורש דו-משמעי (ר' אותה בעיה ב-
      // admin/board עם bookings.user_id/cancelled_by).
      .select(
        "*, profiles!session_subscriptions_user_id_fkey(full_name), session_slots(weekday, start_time, end_time, rooms(name))",
      )
      .eq("clinic_id", clinicId)
      .order("created_at", { ascending: false })
      .limit(40),
  ]);
  if (subscriptionsError) console.error("admin/sessions subscriptions query failed:", subscriptionsError);

  const queue = (subscriptions ?? []).filter((s) => s.status === "requested");
  const rest = (subscriptions ?? []).filter((s) => s.status !== "requested");

  // מה admin_record_session_payment מקבל: ממתינה → תשלום ראשון; פעילה (או
  // שפגה אחרי ששולמה) → החודש הבא. ססיה שפגה בלי ששולמה אף פעם — לא.
  const payable = (s: NonNullable<typeof subscriptions>[number]) =>
    s.status === "awaiting_payment" ||
    s.status === "active" ||
    s.status === "pending_cancellation" ||
    (s.status === "expired" && s.next_billing_date !== null);

  function RecordPaymentForm({ s }: { s: NonNullable<typeof subscriptions>[number] }) {
    return (
      <form action={recordSessionPaymentAction} className="flex flex-wrap items-end gap-2">
        <input type="hidden" name="subscription_id" value={s.id} />
        <Select name="method" aria-label={t.paymentMethod} defaultValue="bit" className="flex-1 md:h-9 sm:flex-none">
          {Object.entries(methods).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
        <Button type="submit" size="sm" variant={s.status === "awaiting_payment" ? "default" : "outline"}>
          {s.status === "awaiting_payment" ? t.recordPayment : t.recordRenewal}
        </Button>
      </form>
    );
  }

  function SlotList({ s }: { s: NonNullable<typeof subscriptions>[number] }) {
    return (
      <ul className="flex flex-col gap-0.5 text-xs text-muted-foreground">
        {(s.session_slots as { weekday: number; start_time: string; end_time: string; rooms: { name?: string } | null }[]).map(
          (slot, i) => (
            <li key={i}>
              {c.weekdayWithPrefix(slot.weekday)} · {slot.start_time.slice(0, 5)}–{slot.end_time.slice(0, 5)} · {slot.rooms?.name}
            </li>
          ),
        )}
      </ul>
    );
  }

  return (
    <AppShell side="admin" clinicName={clinic?.name} fullName={profile.full_name} locale={profile.locale}>
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-8">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">{t.title}</h1>
          <Button asChild variant="outline">
            <Link href="/admin/sessions/new">{t.createFree}</Link>
          </Button>
        </div>

        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-medium text-muted-foreground">{t.pendingApproval}</h2>
          {queue.length === 0 && <p className="text-sm text-muted-foreground">{t.noPending}</p>}
          {queue.map((s) => (
            <Card key={s.id} className="shadow-e1">
              <CardHeader>
                <CardTitle className="text-base font-medium">
                  {t.requestSummary(
                    (s.profiles as { full_name?: string } | null)?.full_name ?? "",
                    s.weekly_hours,
                    formatCurrencyILS(s.monthly_price),
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                <SlotList s={s} />
                {s.start_date && (
                  <p className="text-xs text-muted-foreground">{t.requestedStart(formatDateHe(new Date(s.start_date)))}</p>
                )}
                <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
                  <form action={approveSessionAction} className="flex flex-wrap items-end gap-2">
                    <input type="hidden" name="subscription_id" value={s.id} />
                    <Select name="term_months" className="flex-1 md:h-9 sm:flex-none">
                      <option value="">{t.noCommitment}</option>
                      <option value="1">{t.oneMonth}</option>
                      <option value="3">{t.months(3)}</option>
                      <option value="6">{t.months(6)}</option>
                      <option value="12">{t.oneYear}</option>
                    </Select>
                    <Button type="submit" size="sm">
                      {t.approve}
                    </Button>
                  </form>
                  <form action={rejectSessionAction} className="flex flex-wrap items-end gap-2">
                    <input type="hidden" name="subscription_id" value={s.id} />
                    <Input name="reason" placeholder={t.rejectReasonPlaceholder} className="w-full sm:h-9 sm:w-40" />
                    <Button type="submit" size="sm" variant="destructive">
                      {t.reject}
                    </Button>
                  </form>
                </div>
              </CardContent>
            </Card>
          ))}
        </section>

        {rest.length > 0 && (
          <section className="flex flex-col gap-3">
            <h2 className="text-sm font-medium text-muted-foreground">{t.otherSessions}</h2>
            {rest.map((s) => (
              <Card key={s.id} className="shadow-e1">
                <CardContent className="flex flex-col gap-3 p-4 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <span>{t.restSummary((s.profiles as { full_name?: string } | null)?.full_name ?? "", s.weekly_hours)}</span>
                    <span className={`rounded-pill px-2.5 py-1 text-xs font-medium ${STATUS_TONE[s.status] ?? "bg-subtle"}`}>
                      {c.sessionStatusShort[s.status] ?? s.status}
                    </span>
                  </div>
                  {s.status === "awaiting_payment" && <p className="text-xs text-muted-foreground">{t.awaitingPaymentHint}</p>}
                  {payable(s) && (
                    <div className="flex flex-col gap-2 border-t border-border pt-3 sm:flex-row sm:items-end sm:justify-between">
                      <div className="flex flex-col gap-0.5 text-xs text-muted-foreground">
                        <span>{t.amountDue(formatCurrencyILS(s.monthly_price))}</span>
                        {s.next_billing_date && <span>{t.paidUntil(formatDateHe(new Date(s.next_billing_date)))}</span>}
                      </div>
                      <RecordPaymentForm s={s} />
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </section>
        )}
      </div>
    </AppShell>
  );
}
