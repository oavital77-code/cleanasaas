import { notFound } from "next/navigation";
import { requireClinicAdmin } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { formatCurrencyILS, formatDateHe, formatDateTimeHe } from "@/lib/time";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import {
  updateRoleStatusAction,
  updateAdminNoteAction,
  grantBonusHoursAction,
  adjustPunchCardHoursAction,
  completeDepositAction,
} from "./actions";
import { getAdminTherapistDetailDict, getCommonDict, normalizeLocale } from "@/lib/i18n";
import { IssueCardForm } from "./issue-card-form";
import { BookingRowActions } from "./booking-row-actions";

// לפני התיקון הוצג כאן ה-enum הגולמי מה-DB (confirmed/cancelled_by_user/…) —
// אדמין לא היה מבחין בקלות אילו הזמנות בוטלו. עכשיו תווית + צבע.
const BOOKING_STATUS_TONE: Record<string, string> = {
  confirmed: "bg-success-bg text-success-fg",
  cancelled_by_user: "bg-danger-bg text-danger",
  cancelled_by_admin: "bg-danger-bg text-danger",
  completed: "bg-subtle text-muted-foreground",
  no_show: "bg-warning-bg text-warning-fg",
};

export default async function TherapistDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { profile, clinicId } = await requireClinicAdmin();
  const supabase = await createClient();
  const locale = normalizeLocale(profile.locale);
  const t = getAdminTherapistDetailDict(locale);
  const c = getCommonDict(locale);

  const [
    { data: clinic },
    { data: target },
    { data: cards },
    { data: bookings },
    { data: payments },
    { data: subscriptions },
    { data: note },
    { data: tiers },
    { data: vatSetting },
    { data: overruns },
  ] = await Promise.all([
    supabase.from("clinics").select("name").eq("id", clinicId).single(),
    supabase.from("profiles").select("*").eq("id", id).eq("clinic_id", clinicId).maybeSingle(),
    supabase.from("punch_cards").select("*").eq("user_id", id).order("expires_at", { ascending: false }),
    supabase.from("bookings").select("id, starts_at, status, rooms(name)").eq("user_id", id).order("starts_at", { ascending: false }).limit(10),
    supabase.from("payments").select("id, type, status, amount_total, created_at").eq("user_id", id).order("created_at", { ascending: false }).limit(10),
    supabase.from("session_subscriptions").select("id, status, weekly_hours, monthly_price").eq("user_id", id).order("created_at", { ascending: false }),
    supabase.from("therapist_admin_notes").select("note").eq("user_id", id).maybeSingle(),
    supabase.from("punch_card_tiers").select("id, hours, price_per_hour, deposit_hours").eq("clinic_id", clinicId).eq("active", true).order("sort_order"),
    supabase.from("app_settings").select("value").eq("clinic_id", clinicId).eq("key", "vat_rate").maybeSingle(),
    supabase.from("overrun_charges").select("id, minutes, amount, source, note, created_at").eq("user_id", id).order("created_at", { ascending: false }).limit(10),
  ]);

  if (!target) notFound();

  const vatRate = typeof vatSetting?.value === "number" ? vatSetting.value : 0.18;
  const tierOptions = (tiers ?? []).map((tier) => ({
    id: tier.id,
    hours: tier.hours,
    totalLabel: formatCurrencyILS((tier.hours + tier.deposit_hours) * tier.price_per_hour * (1 + vatRate)),
  }));
  const now = new Date();

  return (
    <AppShell side="admin" clinicName={clinic?.name} fullName={profile.full_name} locale={profile.locale}>
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
        <div>
          <h1 className="text-2xl font-semibold">{target.full_name}</h1>
          <p className="text-sm text-muted-foreground" dir="ltr">
            {target.phone} · {target.email}
          </p>
        </div>

        <Card className="shadow-e1">
          <CardHeader>
            <CardTitle className="text-base font-medium">{t.roleStatusTitle}</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={updateRoleStatusAction} className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
              <input type="hidden" name="user_id" value={target.id} />
              <div className="flex flex-col gap-1">
                <Label className="text-xs">{t.role}</Label>
                <Select name="role" defaultValue={target.role} className="sm:w-auto">
                  <option value="therapist">{c.role.therapist}</option>
                  <option value="admin">{c.role.admin}</option>
                  <option value="owner">{c.role.owner}</option>
                </Select>
              </div>
              <div className="flex flex-col gap-1">
                <Label className="text-xs">{t.status}</Label>
                <Select name="status" defaultValue={target.status} className="sm:w-auto">
                  <option value="active">{c.profileStatus.active}</option>
                  <option value="suspended">{c.profileStatus.suspended}</option>
                  <option value="archived">{c.profileStatus.archived}</option>
                </Select>
              </div>
              <Button type="submit" size="sm" variant="outline" className="w-full sm:w-auto">
                {t.save}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="shadow-e1">
          <CardHeader>
            <CardTitle className="text-base font-medium">{t.punchCardsTitle}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {(cards ?? []).map((card) => (
              <div key={card.id} className="flex flex-col gap-2 border-b border-border pb-3 text-sm last:border-0">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="tabular-nums">
                    {t.cardSummary(Number(card.hours_remaining), Number(card.deposit_remaining), Number(card.deposit_amount))}
                  </span>
                  <span className="text-muted-foreground">
                    {card.active ? t.cardActive : t.cardInactive} · {t.until(formatDateHe(new Date(card.expires_at)))}
                  </span>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end">
                  <form action={adjustPunchCardHoursAction} className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end">
                    <input type="hidden" name="user_id" value={target.id} />
                    <input type="hidden" name="card_id" value={card.id} />
                    <Input name="delta" type="number" step="0.5" placeholder={t.deltaPlaceholder} className="w-full sm:w-28" />
                    <Input name="note" placeholder={t.notePlaceholder} className="w-full sm:w-32" />
                    <Button type="submit" size="sm" variant="outline" className="w-full sm:w-auto">
                      {t.updateBalance}
                    </Button>
                  </form>
                  {card.deposit_remaining < card.deposit_amount && (
                    <form action={completeDepositAction}>
                      <input type="hidden" name="user_id" value={target.id} />
                      <input type="hidden" name="card_id" value={card.id} />
                      <Button type="submit" size="sm" variant="outline" className="w-full sm:w-auto">
                        {t.completeDeposit}
                      </Button>
                    </form>
                  )}
                </div>
              </div>
            ))}
            {(!cards || cards.length === 0) && <p className="text-sm text-muted-foreground">{t.noCards}</p>}

            <div className="flex flex-col gap-2 border-t border-border pt-4">
              <p className="text-sm font-medium">{t.issueCardTitle}</p>
              <p className="text-xs text-muted-foreground">{t.issueCardDescription}</p>
              <IssueCardForm userId={target.id} tiers={tierOptions} />
            </div>

            <form
              action={grantBonusHoursAction}
              className="flex flex-col gap-2 border-t border-border pt-4 sm:flex-row sm:flex-wrap sm:items-end"
            >
              <input type="hidden" name="user_id" value={target.id} />
              <div className="flex flex-col gap-1">
                <Label className="text-xs">{t.bonusHours}</Label>
                <Input name="hours" type="number" step="0.5" min="0.5" className="w-full sm:w-24" />
              </div>
              <Input name="note" placeholder={t.reasonPlaceholder} className="w-full sm:w-40" />
              <Button type="submit" size="sm" className="w-full sm:w-auto">
                {t.grantHours}
              </Button>
            </form>
          </CardContent>
        </Card>

        {subscriptions && subscriptions.length > 0 && (
          <Card className="shadow-e1">
            <CardHeader>
              <CardTitle className="text-base font-medium">{t.sessionsTitle}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2 text-sm">
              {subscriptions.map((s) => (
                <div key={s.id} className="flex flex-wrap items-center justify-between gap-2">
                  <span>{t.sessionSummary(s.weekly_hours, formatCurrencyILS(s.monthly_price))}</span>
                  <span className="text-muted-foreground">{c.sessionStatusShort[s.status] ?? s.status}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        <Card className="shadow-e1">
          <CardHeader>
            <CardTitle className="text-base font-medium">{t.recentBookingsTitle}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 text-sm">
            {(bookings ?? []).map((b) => {
              const actionable = b.status === "confirmed" && new Date(b.starts_at) <= now;
              return (
                <div key={b.id} className="flex flex-col gap-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span>
                      {(b.rooms as { name?: string } | null)?.name} · {formatDateTimeHe(new Date(b.starts_at))}
                    </span>
                    <span className={`rounded-pill px-2.5 py-1 text-xs font-medium ${BOOKING_STATUS_TONE[b.status] ?? "bg-subtle"}`}>
                      {t.bookingStatus[b.status] ?? b.status}
                    </span>
                  </div>
                  {actionable && <BookingRowActions bookingId={b.id} userId={target.id} />}
                </div>
              );
            })}
            {(!bookings || bookings.length === 0) && <p className="text-muted-foreground">{t.noBookings}</p>}
          </CardContent>
        </Card>

        {overruns && overruns.length > 0 && (
          <Card className="shadow-e1">
            <CardHeader>
              <CardTitle className="text-base font-medium">{t.overrunsTitle}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2 text-sm">
              {overruns.map((o) => (
                <div key={o.id} className="flex flex-wrap items-center justify-between gap-2">
                  <span>{t.overrunSummary(o.minutes, formatCurrencyILS(Number(o.amount)), o.source)}</span>
                  <span className="text-xs text-muted-foreground">
                    {o.note ? `${o.note} · ` : ""}
                    {formatDateTimeHe(new Date(o.created_at ?? "1970-01-01T00:00:00Z"))}
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        <Card className="shadow-e1">
          <CardHeader>
            <CardTitle className="text-base font-medium">{t.recentPaymentsTitle}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-sm">
            {(payments ?? []).map((p) => (
              <div key={p.id} className="flex flex-wrap items-center justify-between gap-2">
                <span>{c.paymentType[p.type] ?? p.type}</span>
                <span className="flex items-center gap-2">
                  <span className="tabular-nums">{formatCurrencyILS(p.amount_total)}</span>
                  <span className="text-muted-foreground">{c.paymentStatus[p.status] ?? p.status}</span>
                </span>
              </div>
            ))}
            {(!payments || payments.length === 0) && <p className="text-muted-foreground">{t.noPayments}</p>}
          </CardContent>
        </Card>

        <Card className="shadow-e1">
          <CardHeader>
            <CardTitle className="text-base font-medium">{t.adminNoteTitle}</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={updateAdminNoteAction} className="flex flex-col gap-3">
              <input type="hidden" name="user_id" value={target.id} />
              <textarea
                name="note"
                defaultValue={note?.note ?? ""}
                rows={3}
                // text-base עד md — אותו כלל של iOS כמו ב-Input/Select.
                className="rounded-field border border-border-strong bg-surface p-3 text-base focus-visible:border-violet-500 focus-visible:outline-none focus-visible:[box-shadow:var(--focus-ring)] md:text-sm"
              />
              <Button type="submit" size="sm" variant="outline" className="w-fit">
                {t.saveNote}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
