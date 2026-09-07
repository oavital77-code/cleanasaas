import { requireTherapistProfile } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { formatCurrencyILS, formatDateHe } from "@/lib/time";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ClaimButton } from "./claim-button";
import { getPurchaseDict, normalizeLocale } from "@/lib/i18n";

// CLEANASITEMAPANDDESIGN §2 מסך 4 — [לאפיון תשלום]: התשלום עצמו קורה
// תמיד בחנות ה-Woo של הקליניקה (CLAUDE.md סעיף 6), לא כאן. המסך הזה רק
// מציג את מדרגות המחיר שהאדמין הגדיר (/admin/settings) ומפנה החוצה לחנות.
export default async function PurchasePage() {
  const { userId, profile } = await requireTherapistProfile();
  const supabase = await createClient();
  const t = getPurchaseDict(normalizeLocale(profile.locale));

  const [{ data: clinic }, { data: tiers }, { data: paymentSettings }, { data: vatSetting }, { data: cards }] =
    await Promise.all([
      supabase.from("clinics").select("name").eq("id", profile.clinic_id).single(),
      supabase.from("punch_card_tiers").select("*").eq("clinic_id", profile.clinic_id).eq("active", true).order("sort_order"),
      supabase.from("clinic_payment_settings").select("woo_store_url").eq("clinic_id", profile.clinic_id).maybeSingle(),
      supabase.from("app_settings").select("value").eq("clinic_id", profile.clinic_id).eq("key", "vat_rate").maybeSingle(),
      supabase
        .from("punch_cards")
        .select("id, hours_remaining, expires_at, active")
        .eq("user_id", userId)
        .eq("active", true)
        .order("expires_at"),
    ]);

  const vatRate = typeof vatSetting?.value === "number" ? vatSetting.value : 0.18;
  const isAdmin = profile.role === "owner" || profile.role === "admin";
  const storeUrl = paymentSettings?.woo_store_url;

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
                <CardContent className="flex flex-col gap-3">
                  <p className="tabular-nums text-2xl font-semibold">{formatCurrencyILS(total)}</p>
                  {tier.deposit_hours > 0 && (
                    <p className="text-xs text-muted-foreground">{t.includesDeposit(tier.deposit_hours)}</p>
                  )}
                  <Button asChild disabled={!storeUrl}>
                    <a href={storeUrl ?? "#"} target="_blank" rel="noreferrer">
                      {storeUrl ? t.buyInStore : t.storeNotConfigured}
                    </a>
                  </Button>
                </CardContent>
              </Card>
            );
          })}
          {(!tiers || tiers.length === 0) && <p className="text-sm text-muted-foreground">{t.noTiers}</p>}
        </div>

        <Card className="shadow-e1">
          <CardHeader>
            <CardTitle className="text-base font-medium">{t.alreadyPaidTitle}</CardTitle>
            <CardDescription>{t.alreadyPaidDescription}</CardDescription>
          </CardHeader>
          <CardContent>
            <ClaimButton />
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
