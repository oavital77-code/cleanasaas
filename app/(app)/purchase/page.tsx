import { requireTherapistProfile } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { formatCurrencyILS, formatDateHe } from "@/lib/time";
import { AppShell } from "@/components/app-shell";
import { PaymentInstructions } from "@/components/payment-instructions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { getPurchaseDict, normalizeLocale } from "@/lib/i18n";
import { PAYMENT_INSTRUCTIONS_KEY, readPaymentInstructions } from "@/lib/payment-instructions";

// CLEANASITEMAPANDDESIGN §2 מסך 4. מצב ידני (24.9.2026): אין כאן תשלום.
// המטפל/ת רואה את המדרגות שהקליניקה הגדירה ואת הוראות התשלום שלה, משלם/ת
// לקליניקה ישירות, והקליניקה מנפיקה את הכרטיסייה מהכרטיס שלו/ה
// (admin_issue_punch_card) — ואז היא מופיעה כאן למעלה.
export default async function PurchasePage() {
  const { userId, profile } = await requireTherapistProfile();
  const supabase = await createClient();
  const t = getPurchaseDict(normalizeLocale(profile.locale));

  const [{ data: clinic }, { data: tiers }, { data: settingsRows }, { data: cards }] = await Promise.all([
    supabase.from("clinics").select("name").eq("id", profile.clinic_id).single(),
    supabase.from("punch_card_tiers").select("*").eq("clinic_id", profile.clinic_id).eq("active", true).order("sort_order"),
    supabase
      .from("app_settings")
      .select("key, value")
      .eq("clinic_id", profile.clinic_id)
      .in("key", ["vat_rate", PAYMENT_INSTRUCTIONS_KEY]),
    supabase
      .from("punch_cards")
      .select("id, hours_remaining, expires_at, active")
      .eq("user_id", userId)
      .eq("active", true)
      .order("expires_at"),
  ]);

  const settings = Object.fromEntries((settingsRows ?? []).map((r) => [r.key, r.value]));
  const vatRate = typeof settings.vat_rate === "number" ? settings.vat_rate : 0.18;
  const instructions = readPaymentInstructions(settings[PAYMENT_INSTRUCTIONS_KEY]);
  const isAdmin = profile.role === "owner" || profile.role === "admin";

  return (
    <AppShell side="app" clinicName={clinic?.name} fullName={profile.full_name} locale={profile.locale} isAdmin={isAdmin}>
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-8">
        <h1 className="text-2xl font-semibold">{t.title}</h1>

        {cards && cards.length > 0 && (
          <Card className="shadow-e1">
            <CardHeader>
              <CardTitle className="text-base font-medium">{t.myActiveCards}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              {cards.map((card) => (
                <div key={card.id} className="flex items-center justify-between text-sm">
                  <span className="tabular-nums">{t.hoursLeft(Number(card.hours_remaining))}</span>
                  <span className="text-muted-foreground">{t.validUntil(formatDateHe(new Date(card.expires_at)))}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          {(tiers ?? []).map((tier) => {
            const beforeVat = tier.hours * tier.price_per_hour;
            const total = beforeVat * (1 + vatRate);
            return (
              <Card key={tier.id} className="shadow-e1">
                <CardHeader>
                  <CardTitle className="text-lg">{t.tierHours(tier.hours)}</CardTitle>
                  <CardDescription>{t.perHourBeforeVat(formatCurrencyILS(tier.price_per_hour))}</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-1">
                  <p className="tabular-nums text-2xl font-semibold">{formatCurrencyILS(total)}</p>
                  <p className="text-xs text-muted-foreground">{t.totalWithVat}</p>
                  {tier.deposit_hours > 0 && (
                    <p className="text-xs text-muted-foreground">{t.includesDeposit(tier.deposit_hours)}</p>
                  )}
                </CardContent>
              </Card>
            );
          })}
          {(!tiers || tiers.length === 0) && <p className="text-sm text-muted-foreground">{t.noTiers}</p>}
        </div>

        <div className="flex flex-col gap-2">
          <PaymentInstructions text={instructions} title={t.howToPayTitle} fallback={t.howToPayFallback} />
          <p className="text-xs text-muted-foreground">{t.afterPayment}</p>
        </div>
      </div>
    </AppShell>
  );
}
