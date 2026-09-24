import { requireClinicAdmin } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  updatePunchCardTierAction,
  addPunchCardTierAction,
  deletePunchCardTierAction,
  toggleSessionsEnabledAction,
  updateSessionPricingAction,
  updatePaymentInstructionsAction,
  updateClinicHoursAction,
  updateHolidayPolicyAction,
  updateWhatsAppSettingsAction,
} from "./actions";
import { WhatsAppTestButton } from "./whatsapp-test-button";
import { suggestedMetaTemplateBody } from "@/lib/whatsapp";
import { getAdminSettingsDict, normalizeLocale } from "@/lib/i18n";
import { PAYMENT_INSTRUCTIONS_KEY, PAYMENT_INSTRUCTIONS_MAX, readPaymentInstructions } from "@/lib/payment-instructions";
import { SESSION_KEYS, readSessionPricing, sessionMonthlyPrice } from "@/lib/session-pricing";
import { formatCurrencyILS } from "@/lib/time";
import { Trash2 } from "lucide-react";

export default async function AdminSettingsPage({ searchParams }: { searchParams: Promise<{ notice?: string }> }) {
  const { profile, clinicId } = await requireClinicAdmin();
  const supabase = await createClient();
  const t = getAdminSettingsDict(normalizeLocale(profile.locale));
  const { notice } = await searchParams;
  // ההודעה מוצגת ליד הטופס ששלח אותה: tier_* בכרטיסיות, pricing_* במודל הססיה.
  const noticeText = notice ? t.tierNotices[notice] : undefined;
  const tierNotice = notice?.startsWith("tier_") ? noticeText : undefined;
  const pricingNotice = notice?.startsWith("pricing_") ? noticeText : undefined;
  const instructionsNotice =
    notice === "instructions_saved" ? t.instructionsSaved : notice === "instructions_error" ? t.instructionsError : undefined;

  const [{ data: tiers }, { data: settingsRows }, { data: clinic }, { data: whatsapp }] =
    await Promise.all([
      supabase.from("punch_card_tiers").select("*").eq("clinic_id", clinicId).order("sort_order"),
      supabase.from("app_settings").select("key, value").eq("clinic_id", clinicId),
      supabase
        .from("clinics")
        .select("name, open_hour, close_hour, sessions_enabled, block_holidays, block_holiday_eves, block_chol_hamoed")
        .eq("id", clinicId)
        .single(),
      // api_token הוא bytea מוצפן — נשלף רק כדי להציג "מוגדר"; לעולם לא מפוענח כאן.
      supabase
        .from("clinic_whatsapp_settings")
        .select("enabled, phone_number_id, api_token, sender_phone, hours_before, template, template_name, template_lang")
        .eq("clinic_id", clinicId)
        .maybeSingle(),
    ]);

  const settings = Object.fromEntries((settingsRows ?? []).map((r) => [r.key, r.value]));
  const paymentInstructions = readPaymentInstructions(settings[PAYMENT_INSTRUCTIONS_KEY]) ?? "";
  const sessionPricing = readSessionPricing(settings);

  return (
    <AppShell side="admin" clinicName={clinic?.name} fullName={profile.full_name} locale={profile.locale}>
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-8">
        <h1 className="text-2xl font-semibold">{t.title}</h1>

        <Card id="tiers" className="shadow-e1 scroll-mt-4">
          <CardHeader>
            <CardTitle className="text-base font-medium">{t.tiersTitle}</CardTitle>
            <CardDescription>{t.tiersDescription}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {tierNotice && (
              <p
                className={`rounded-field px-3 py-2 text-sm ${
                  notice === "tier_deleted" ? "bg-success-bg text-success-fg" : "bg-warning-bg text-warning-fg"
                }`}
              >
                {tierNotice}
              </p>
            )}

            <div className="hidden text-xs text-muted-foreground sm:grid sm:grid-cols-[6rem_7rem_6rem_5rem_1fr] sm:gap-3">
              <span>{t.tierHoursLabel}</span>
              <span>{t.pricePerHour}</span>
              <span>{t.depositHours}</span>
              <span>{t.tierActive}</span>
              <span />
            </div>
            <div className="flex flex-col gap-2">
              {(tiers ?? []).length === 0 && <p className="text-sm text-muted-foreground">{t.noTiers}</p>}
              {(tiers ?? []).map((tier) => (
                <div key={tier.id} className="flex flex-col gap-2 border-b border-border pb-3 last:border-0 sm:flex-row sm:items-end sm:gap-3">
                  <form
                    id={`tier-${tier.id}`}
                    action={updatePunchCardTierAction}
                    className="grid flex-1 grid-cols-2 gap-3 sm:grid-cols-[6rem_7rem_6rem_5rem_auto] sm:items-end"
                  >
                    <input type="hidden" name="id" value={tier.id} />
                    <div className="flex flex-col gap-1">
                      <Label className="text-xs sm:hidden">{t.tierHoursLabel}</Label>
                      <Input name="hours" type="number" min={1} max={1000} defaultValue={tier.hours} required />
                    </div>
                    <div className="flex flex-col gap-1">
                      <Label className="text-xs sm:hidden">{t.pricePerHour}</Label>
                      <Input name="price_per_hour" type="number" step="0.01" min={0} defaultValue={tier.price_per_hour} required />
                    </div>
                    <div className="flex flex-col gap-1">
                      <Label className="text-xs sm:hidden">{t.depositHours}</Label>
                      <Input name="deposit_hours" type="number" min={0} defaultValue={tier.deposit_hours} />
                    </div>
                    <label className="flex items-center gap-2 pb-2 text-sm">
                      <input type="checkbox" name="active" defaultChecked={tier.active ?? true} className="size-4 accent-violet-500" />
                      <span className="sm:hidden">{t.tierActive}</span>
                    </label>
                    <div className="col-span-2 flex items-center gap-2 sm:col-span-1">
                      <Button type="submit" size="sm" variant="outline" className="flex-1 sm:flex-none">
                        {t.save}
                      </Button>
                      <Button
                        type="submit"
                        size="sm"
                        variant="ghost"
                        formAction={deletePunchCardTierAction}
                        className="text-muted-foreground hover:text-danger"
                        title={t.deleteTier}
                        aria-label={t.deleteTier}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </form>
                </div>
              ))}
            </div>

            <form
              action={addPunchCardTierAction}
              className="grid grid-cols-2 gap-3 border-t border-border pt-4 sm:grid-cols-[6rem_7rem_6rem_auto] sm:items-end"
            >
              <div className="flex flex-col gap-1">
                <Label className="text-xs">{t.tierHoursLabel}</Label>
                <Input name="hours" type="number" min={1} max={1000} placeholder="10" required />
              </div>
              <div className="flex flex-col gap-1">
                <Label className="text-xs">{t.pricePerHour}</Label>
                <Input name="price_per_hour" type="number" step="0.01" min={0} placeholder="55" required />
              </div>
              <div className="flex flex-col gap-1">
                <Label className="text-xs">{t.depositHours}</Label>
                <Input name="deposit_hours" type="number" min={0} defaultValue={0} />
              </div>
              <Button type="submit" size="sm" className="col-span-2 sm:col-span-1">
                {t.addTier}
              </Button>
            </form>
            <p className="text-xs text-muted-foreground">{t.tiersPaymentNote}</p>
          </CardContent>
        </Card>

        <Card id="sessions" className="shadow-e1 scroll-mt-4">
          <CardHeader>
            <CardTitle className="text-base font-medium">{t.sessionModelTitle}</CardTitle>
            <CardDescription>{t.sessionModelDescription}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {pricingNotice && (
              <p
                className={`rounded-field px-3 py-2 text-sm ${
                  notice === "pricing_saved" ? "bg-success-bg text-success-fg" : "bg-warning-bg text-warning-fg"
                }`}
              >
                {pricingNotice}
              </p>
            )}
            <form action={toggleSessionsEnabledAction} className="flex flex-wrap items-center gap-3">
              <input type="hidden" name="sessions_enabled" value={clinic?.sessions_enabled ? "off" : "on"} />
              <Button type="submit" size="sm" variant={clinic?.sessions_enabled ? "outline" : "default"}>
                {clinic?.sessions_enabled ? t.sessionsDisable : t.sessionsEnable}
              </Button>
              <span className={`text-sm ${clinic?.sessions_enabled ? "text-success" : "text-muted-foreground"}`}>
                {clinic?.sessions_enabled ? t.sessionsOn : t.sessionsOff}
              </span>
            </form>

            {clinic?.sessions_enabled && (
              <div className="border-t border-border pt-4">
                <h3 className="mb-1 text-sm font-medium">{t.sessionPricingTitle}</h3>
                <p className="mb-3 text-xs text-muted-foreground">{t.sessionPricingDescription}</p>
                <form action={updateSessionPricingAction} className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
                  <div className="flex flex-col gap-1">
                    <Label className="text-xs">{t.sessionMinHours}</Label>
                    <Input name={SESSION_KEYS.minHours} type="number" min={0.5} max={168} step={0.5} required defaultValue={sessionPricing.minHours} className="w-full sm:w-28" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label className="text-xs">{t.sessionMaxHours}</Label>
                    <Input name={SESSION_KEYS.maxHours} type="number" min={0.5} max={168} step={0.5} required defaultValue={sessionPricing.maxHours} className="w-full sm:w-28" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label className="text-xs">{t.sessionPricePerHour}</Label>
                    <Input name={SESSION_KEYS.pricePerHour} type="number" min={0} step="0.01" required defaultValue={sessionPricing.pricePerHour} className="w-full sm:w-32" />
                  </div>
                  <Button type="submit" size="sm" variant="outline" className="w-full sm:w-auto">
                    {t.save}
                  </Button>
                </form>
                <p className="mt-2 text-xs tabular-nums text-muted-foreground">
                  {t.sessionPricingExample(
                    sessionPricing.maxHours,
                    formatCurrencyILS(sessionMonthlyPrice(sessionPricing.maxHours, sessionPricing.pricePerHour)),
                  )}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-e1">
          <CardHeader>
            <CardTitle className="text-base font-medium">{t.hoursTitle}</CardTitle>
            <CardDescription>{t.hoursDescription}</CardDescription>
          </CardHeader>
          <CardContent>
            <form action={updateClinicHoursAction} className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
              <div className="flex flex-col gap-1">
                <Label htmlFor="open_hour" className="text-xs">
                  {t.openHour}
                </Label>
                <Input
                  id="open_hour"
                  name="open_hour"
                  type="number"
                  min={0}
                  max={23}
                  defaultValue={clinic?.open_hour ?? 8}
                  className="w-full sm:w-24"
                />
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor="close_hour" className="text-xs">
                  {t.closeHour}
                </Label>
                <Input
                  id="close_hour"
                  name="close_hour"
                  type="number"
                  min={1}
                  max={24}
                  defaultValue={clinic?.close_hour ?? 22}
                  className="w-full sm:w-24"
                />
              </div>
              <Button type="submit" size="sm" variant="outline" className="w-full sm:w-auto">
                {t.save}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="shadow-e1">
          <CardHeader>
            <CardTitle className="text-base font-medium">{t.holidaysTitle}</CardTitle>
            <CardDescription>{t.holidaysDescription}</CardDescription>
          </CardHeader>
          <CardContent>
            <form action={updateHolidayPolicyAction} className="flex flex-col gap-3">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="block_holidays" defaultChecked={clinic?.block_holidays ?? true} className="size-4 accent-violet-500" />
                {t.blockHolidays}
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="block_holiday_eves" defaultChecked={clinic?.block_holiday_eves ?? false} className="size-4 accent-violet-500" />
                {t.blockHolidayEves}
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="block_chol_hamoed" defaultChecked={clinic?.block_chol_hamoed ?? false} className="size-4 accent-violet-500" />
                {t.blockCholHamoed}
              </label>
              <p className="text-xs text-muted-foreground">{t.holidaysNote}</p>
              <Button type="submit" size="sm" className="w-fit">
                {t.save}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card id="payments" className="shadow-e1 scroll-mt-4">
          <CardHeader>
            <CardTitle className="text-base font-medium">{t.paymentsTitle}</CardTitle>
            <CardDescription>{t.paymentsDescription}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {instructionsNotice && (
              <p
                className={`rounded-field px-3 py-2 text-sm ${
                  notice === "instructions_saved" ? "bg-success-bg text-success-fg" : "bg-warning-bg text-warning-fg"
                }`}
              >
                {instructionsNotice}
              </p>
            )}
            <form action={updatePaymentInstructionsAction} className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="payment_instructions">{t.paymentInstructionsLabel}</Label>
                <textarea
                  id="payment_instructions"
                  name="payment_instructions"
                  rows={4}
                  maxLength={PAYMENT_INSTRUCTIONS_MAX}
                  defaultValue={paymentInstructions}
                  placeholder={t.paymentInstructionsPlaceholder}
                  className="w-full rounded-field border border-border-strong bg-surface px-3 py-2 text-base transition-colors placeholder:text-text-muted focus-visible:border-violet-500 focus-visible:outline-none focus-visible:[box-shadow:var(--focus-ring)] md:text-[14.5px]"
                />
                <p className="text-xs text-muted-foreground">{t.paymentInstructionsHint}</p>
              </div>
              <Button type="submit" className="w-fit">
                {t.save}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="shadow-e1">
          <CardHeader>
            <CardTitle className="text-base font-medium">{t.whatsappTitle}</CardTitle>
            <CardDescription>{t.whatsappDescription}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
            <form action={updateWhatsAppSettingsAction} className="flex flex-col gap-3">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="enabled" defaultChecked={whatsapp?.enabled ?? false} className="size-4 accent-violet-500" />
                {t.whatsappEnabled}
              </label>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="wa_phone_number_id">{t.whatsappPhoneNumberId}</Label>
                  <Input id="wa_phone_number_id" name="phone_number_id" dir="ltr" defaultValue={whatsapp?.phone_number_id ?? ""} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="wa_access_token">{t.whatsappToken}</Label>
                  <Input id="wa_access_token" name="access_token" type="password" dir="ltr" placeholder={whatsapp?.api_token ? t.configuredPlaceholder : ""} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="wa_template_name">{t.whatsappTemplateName}</Label>
                  <Input id="wa_template_name" name="template_name" dir="ltr" defaultValue={whatsapp?.template_name ?? ""} placeholder="booking_reminder" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="wa_template_lang">{t.whatsappTemplateLang}</Label>
                  <Input id="wa_template_lang" name="template_lang" dir="ltr" defaultValue={whatsapp?.template_lang ?? "he"} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="wa_sender_phone">{t.whatsappSenderPhone}</Label>
                  <Input id="wa_sender_phone" name="sender_phone" dir="ltr" defaultValue={whatsapp?.sender_phone ?? ""} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="wa_hours_before">{t.whatsappHoursBefore}</Label>
                  <Input
                    id="wa_hours_before"
                    name="hours_before"
                    type="number"
                    min={1}
                    max={72}
                    defaultValue={whatsapp?.hours_before ?? 24}
                  />
                </div>
              </div>
              <div className="flex flex-col gap-1.5 rounded-field bg-subtle p-3 text-xs text-muted-foreground">
                <p>{t.whatsappMetaTemplateHelp}</p>
                <code dir="rtl" className="block rounded bg-surface px-2 py-1.5 text-foreground">
                  {suggestedMetaTemplateBody("he")}
                </code>
                <code dir="ltr" className="block rounded bg-surface px-2 py-1.5 text-foreground">
                  {suggestedMetaTemplateBody("en")}
                </code>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="wa_template">{t.whatsappTemplate}</Label>
                <textarea
                  id="wa_template"
                  name="template"
                  rows={3}
                  defaultValue={whatsapp?.template ?? ""}
                  placeholder="שלום {name}, תזכורת להזמנה שלך ב-{clinic}: {date} בשעה {time}, {room} ({branch})."
                  className="rounded-field border border-border-strong bg-surface p-3 text-base focus-visible:border-violet-500 focus-visible:outline-none focus-visible:[box-shadow:var(--focus-ring)] md:text-sm"
                />
                <p className="text-xs text-muted-foreground" dir="ltr">
                  {t.whatsappTemplateHelp}
                </p>
              </div>
              <p className="text-xs text-muted-foreground">{t.whatsappCronNote}</p>
              <Button type="submit" className="w-fit">
                {t.save}
              </Button>
            </form>
            <div className="border-t border-border pt-4">
              <WhatsAppTestButton />
            </div>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
