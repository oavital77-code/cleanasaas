import { requireClinicAdmin } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updatePunchCardTierAction, updateSessionPricingAction, updatePaymentSettingsAction, updateClinicHoursAction } from "./actions";

export default async function AdminSettingsPage() {
  const { profile, clinicId } = await requireClinicAdmin();
  const supabase = await createClient();

  const [{ data: tiers }, { data: settingsRows }, { data: paymentSettings }, { data: clinic }] = await Promise.all([
    supabase.from("punch_card_tiers").select("*").eq("clinic_id", clinicId).order("sort_order"),
    supabase.from("app_settings").select("key, value").eq("clinic_id", clinicId),
    supabase.from("clinic_payment_settings").select("*").eq("clinic_id", clinicId).maybeSingle(),
    supabase.from("clinics").select("name, open_hour, close_hour").eq("id", clinicId).single(),
  ]);

  const settings = Object.fromEntries((settingsRows ?? []).map((r) => [r.key, r.value]));
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";

  return (
    <AppShell side="admin" clinicName={clinic?.name} fullName={profile.full_name} locale={profile.locale}>
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-8">
        <h1 className="text-2xl font-semibold">הגדרות</h1>

        <Card className="shadow-e1">
          <CardHeader>
            <CardTitle className="text-base font-medium">מדרגות כרטיסייה</CardTitle>
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
                  <span className="text-sm text-muted-foreground sm:w-16 sm:pb-2">{tier.hours} שעות</span>
                  <div className="flex flex-col gap-1">
                    <Label className="text-xs">₪/שעה</Label>
                    <Input name="price_per_hour" type="number" step="0.01" defaultValue={tier.price_per_hour} className="w-full sm:w-28" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label className="text-xs">פיקדון (שעות)</Label>
                    <Input name="deposit_hours" type="number" defaultValue={tier.deposit_hours} className="w-full sm:w-24" />
                  </div>
                  <Button type="submit" size="sm" variant="outline" className="w-full sm:w-auto">
                    שמירה
                  </Button>
                </form>
              ))}
            </div>

            <div className="border-t border-border pt-4">
              <h3 className="mb-3 text-sm font-medium">ססיה (מנוי חודשי קבוע)</h3>
              <form action={updateSessionPricingAction} className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
                <div className="flex flex-col gap-1">
                  <Label className="text-xs">שעות שבועיות קבועות</Label>
                  <Input name="session_base_hours" type="number" defaultValue={Number(settings.session_base_hours ?? 5)} className="w-full sm:w-24" />
                </div>
                <div className="flex flex-col gap-1">
                  <Label className="text-xs">מחיר חודשי (₪)</Label>
                  <Input name="session_base_price" type="number" defaultValue={Number(settings.session_base_price ?? 600)} className="w-full sm:w-28" />
                </div>
                <Button type="submit" size="sm" variant="outline" className="w-full sm:w-auto">
                  שמירה
                </Button>
              </form>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-e1">
          <CardHeader>
            <CardTitle className="text-base font-medium">שעות פעילות</CardTitle>
            <CardDescription>הטווח שמוצג בלוח הזמנים (/schedule) וב-לוח המלא (/admin/board).</CardDescription>
          </CardHeader>
          <CardContent>
            <form action={updateClinicHoursAction} className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
              <div className="flex flex-col gap-1">
                <Label htmlFor="open_hour" className="text-xs">
                  שעת פתיחה
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
                  שעת סגירה
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
                שמירה
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="shadow-e1">
          <CardHeader>
            <CardTitle className="text-base font-medium">שיטת תשלום — WooCommerce</CardTitle>
            <CardDescription>
              חברו את החנות שלכם. כתובת ה-webhook הייעודית שלכם:{" "}
              <code dir="ltr" className="break-all rounded bg-muted px-1 py-0.5 text-xs">
                {appUrl}/api/woo/webhook/{clinicId}
              </code>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form action={updatePaymentSettingsAction} className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="woo_store_url">כתובת החנות</Label>
                <Input id="woo_store_url" name="woo_store_url" dir="ltr" defaultValue={paymentSettings?.woo_store_url ?? ""} placeholder="https://shop.example.com" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="woo_consumer_key">Consumer Key</Label>
                <Input id="woo_consumer_key" name="woo_consumer_key" dir="ltr" placeholder={paymentSettings?.woo_consumer_key ? "•••• מוגדר" : ""} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="woo_consumer_secret">Consumer Secret</Label>
                <Input id="woo_consumer_secret" name="woo_consumer_secret" type="password" dir="ltr" placeholder={paymentSettings?.woo_consumer_secret ? "•••• מוגדר" : ""} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="woo_webhook_secret">Webhook Secret (אופציונלי — אם לא מוגדר, נעבוד ב-polling)</Label>
                <Input id="woo_webhook_secret" name="woo_webhook_secret" type="password" dir="ltr" placeholder={paymentSettings?.woo_webhook_secret ? "•••• מוגדר" : ""} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="woo_session_product_id">Product ID של מוצר הססיה בחנות (0 אם אין מודל ססיה)</Label>
                <Input id="woo_session_product_id" name="woo_session_product_id" type="number" dir="ltr" defaultValue={Number(settings.woo_session_product_id ?? 0)} />
              </div>
              <Button type="submit" className="w-fit">
                שמירה
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
