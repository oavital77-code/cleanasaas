import { requireClinicAdmin } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  updatePunchCardTierAction,
  updateSessionPricingAction,
  updatePaymentSettingsAction,
  updateClinicHoursAction,
  updateWhatsAppSettingsAction,
} from "./actions";
import { WhatsAppTestButton } from "./whatsapp-test-button";
import { Select } from "@/components/ui/select";
import { getAdminSettingsDict, normalizeLocale } from "@/lib/i18n";

export default async function AdminSettingsPage() {
  const { profile, clinicId } = await requireClinicAdmin();
  const supabase = await createClient();
  const t = getAdminSettingsDict(normalizeLocale(profile.locale));

  const [{ data: tiers }, { data: settingsRows }, { data: paymentSettings }, { data: clinic }, { data: whatsapp }] =
    await Promise.all([
      supabase.from("punch_card_tiers").select("*").eq("clinic_id", clinicId).order("sort_order"),
      supabase.from("app_settings").select("key, value").eq("clinic_id", clinicId),
      supabase.from("clinic_payment_settings").select("*").eq("clinic_id", clinicId).maybeSingle(),
      supabase.from("clinics").select("name, open_hour, close_hour").eq("id", clinicId).single(),
      // api_token הוא bytea מוצפן — נשלף רק כדי להציג "מוגדר"; לעולם לא מפוענח כאן.
      supabase
        .from("clinic_whatsapp_settings")
        .select("enabled, provider, instance_id, api_url, api_token, sender_phone, hours_before, template")
        .eq("clinic_id", clinicId)
        .maybeSingle(),
    ]);

  const settings = Object.fromEntries((settingsRows ?? []).map((r) => [r.key, r.value]));
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";

  return (
    <AppShell side="admin" clinicName={clinic?.name} fullName={profile.full_name} locale={profile.locale}>
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-8">
        <h1 className="text-2xl font-semibold">{t.title}</h1>

        <Card className="shadow-e1">
          <CardHeader>
            <CardTitle className="text-base font-medium">{t.tiersTitle}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              {(tiers ?? []).map((tier) => (
                <form
                  key={tier.id}
                  action={updatePunchCardTierAction}
                  className="flex flex-col gap-3 border-b border-border pb-3 last:border-0 sm:flex-row sm:flex-wrap sm:items-end"
                >
                  <input type="hidden" name="id" value={tier.id} />
                  <span className="text-sm text-muted-foreground sm:w-16 sm:pb-2">{t.tierHours(tier.hours)}</span>
                  <div className="flex flex-col gap-1">
                    <Label className="text-xs">{t.pricePerHour}</Label>
                    <Input name="price_per_hour" type="number" step="0.01" defaultValue={tier.price_per_hour} className="w-full sm:w-28" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label className="text-xs">{t.depositHours}</Label>
                    <Input name="deposit_hours" type="number" defaultValue={tier.deposit_hours} className="w-full sm:w-24" />
                  </div>
                  <Button type="submit" size="sm" variant="outline" className="w-full sm:w-auto">
                    {t.save}
                  </Button>
                </form>
              ))}
            </div>

            <div className="border-t border-border pt-4">
              <h3 className="mb-3 text-sm font-medium">{t.sessionPricingTitle}</h3>
              <form action={updateSessionPricingAction} className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
                <div className="flex flex-col gap-1">
                  <Label className="text-xs">{t.sessionBaseHours}</Label>
                  <Input name="session_base_hours" type="number" defaultValue={Number(settings.session_base_hours ?? 5)} className="w-full sm:w-24" />
                </div>
                <div className="flex flex-col gap-1">
                  <Label className="text-xs">{t.sessionBasePrice}</Label>
                  <Input name="session_base_price" type="number" defaultValue={Number(settings.session_base_price ?? 600)} className="w-full sm:w-28" />
                </div>
                <Button type="submit" size="sm" variant="outline" className="w-full sm:w-auto">
                  {t.save}
                </Button>
              </form>
            </div>
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
            <CardTitle className="text-base font-medium">{t.wooTitle}</CardTitle>
            <CardDescription>
              {t.wooDescriptionPrefix}{" "}
              <code dir="ltr" className="break-all rounded bg-muted px-1 py-0.5 text-xs">
                {appUrl}/api/woo/webhook/{clinicId}
              </code>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form action={updatePaymentSettingsAction} className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="woo_store_url">{t.storeUrl}</Label>
                <Input id="woo_store_url" name="woo_store_url" dir="ltr" defaultValue={paymentSettings?.woo_store_url ?? ""} placeholder="https://shop.example.com" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="woo_consumer_key">Consumer Key</Label>
                <Input id="woo_consumer_key" name="woo_consumer_key" dir="ltr" placeholder={paymentSettings?.woo_consumer_key ? t.configuredPlaceholder : ""} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="woo_consumer_secret">Consumer Secret</Label>
                <Input id="woo_consumer_secret" name="woo_consumer_secret" type="password" dir="ltr" placeholder={paymentSettings?.woo_consumer_secret ? t.configuredPlaceholder : ""} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="woo_webhook_secret">{t.webhookSecretLabel}</Label>
                <Input id="woo_webhook_secret" name="woo_webhook_secret" type="password" dir="ltr" placeholder={paymentSettings?.woo_webhook_secret ? t.configuredPlaceholder : ""} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="woo_session_product_id">{t.sessionProductIdLabel}</Label>
                <Input id="woo_session_product_id" name="woo_session_product_id" type="number" dir="ltr" defaultValue={Number(settings.woo_session_product_id ?? 0)} />
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
                  <Label htmlFor="wa_provider">{t.whatsappProvider}</Label>
                  <Select id="wa_provider" name="provider" defaultValue={whatsapp?.provider ?? "green_api"}>
                    <option value="green_api">Green API</option>
                    <option value="whapi">Whapi</option>
                  </Select>
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
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="wa_instance_id">{t.whatsappInstanceId}</Label>
                  <Input id="wa_instance_id" name="instance_id" dir="ltr" defaultValue={whatsapp?.instance_id ?? ""} placeholder="Green API only" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="wa_api_url">API URL</Label>
                  <Input id="wa_api_url" name="api_url" dir="ltr" defaultValue={whatsapp?.api_url ?? ""} placeholder="https://7103.api.greenapi.com" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="wa_api_token">{t.whatsappToken}</Label>
                  <Input id="wa_api_token" name="api_token" type="password" dir="ltr" placeholder={whatsapp?.api_token ? t.configuredPlaceholder : ""} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="wa_sender_phone">{t.whatsappSenderPhone}</Label>
                  <Input id="wa_sender_phone" name="sender_phone" dir="ltr" defaultValue={whatsapp?.sender_phone ?? profile.phone} />
                </div>
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
