import { requireClinicAdmin } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  updatePunchCardTierAction,
  updateSessionPricingAction,
  updatePaymentSettingsAction,
  createInviteAction,
} from "./actions";

export default async function AdminSettingsPage() {
  const { clinicId } = await requireClinicAdmin();
  const supabase = await createClient();

  const [{ data: tiers }, { data: settingsRows }, { data: paymentSettings }, { data: invites }] = await Promise.all([
    supabase.from("punch_card_tiers").select("*").eq("clinic_id", clinicId).order("sort_order"),
    supabase.from("app_settings").select("key, value").eq("clinic_id", clinicId),
    supabase.from("clinic_payment_settings").select("*").eq("clinic_id", clinicId).maybeSingle(),
    supabase
      .from("clinic_invites")
      .select("token, role, created_at, expires_at, used_at")
      .eq("clinic_id", clinicId)
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  const settings = Object.fromEntries((settingsRows ?? []).map((r) => [r.key, r.value]));
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-10 p-8">
      <h1 className="text-2xl font-semibold">תשלומים וכרטיסיות</h1>

      {/* חלק א' — מחירים */}
      <section className="flex flex-col gap-4 rounded-lg border p-5">
        <h2 className="font-medium">מדרגות כרטיסייה</h2>
        <div className="flex flex-col gap-2">
          {(tiers ?? []).map((tier) => (
            <form
              key={tier.id}
              action={updatePunchCardTierAction}
              className="flex flex-wrap items-end gap-3 border-b pb-2 last:border-0"
            >
              <input type="hidden" name="id" value={tier.id} />
              <span className="w-16 text-sm text-muted-foreground">{tier.hours} שעות</span>
              <div className="flex flex-col gap-1">
                <Label className="text-xs">₪/שעה</Label>
                <Input name="price_per_hour" type="number" step="0.01" defaultValue={tier.price_per_hour} className="w-28" />
              </div>
              <div className="flex flex-col gap-1">
                <Label className="text-xs">פיקדון (שעות)</Label>
                <Input name="deposit_hours" type="number" defaultValue={tier.deposit_hours} className="w-24" />
              </div>
              <Button type="submit" size="sm" variant="outline">
                שמירה
              </Button>
            </form>
          ))}
        </div>

        <h2 className="mt-4 font-medium">ססיה (מנוי חודשי קבוע)</h2>
        <form action={updateSessionPricingAction} className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1">
            <Label className="text-xs">שעות שבועיות קבועות</Label>
            <Input name="session_base_hours" type="number" defaultValue={Number(settings.session_base_hours ?? 5)} className="w-24" />
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-xs">מחיר חודשי (₪)</Label>
            <Input name="session_base_price" type="number" defaultValue={Number(settings.session_base_price ?? 600)} className="w-28" />
          </div>
          <Button type="submit" size="sm" variant="outline">
            שמירה
          </Button>
        </form>
      </section>

      {/* חלק ב' — שיטת תשלום (WooCommerce) */}
      <section className="flex flex-col gap-4 rounded-lg border p-5">
        <h2 className="font-medium">שיטת תשלום — WooCommerce</h2>
        <p className="text-sm text-muted-foreground">
          חברו את החנות שלכם. כתובת ה-webhook הייעודית שלכם:{" "}
          <code dir="ltr" className="rounded bg-muted px-1 py-0.5 text-xs">
            {appUrl}/api/woo/webhook/{clinicId}
          </code>
        </p>
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
      </section>

      {/* הזמנת מטפלים */}
      <section className="flex flex-col gap-4 rounded-lg border p-5">
        <h2 className="font-medium">הזמנת מטפלים</h2>
        <form action={createInviteAction} className="flex items-end gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="role">תפקיד</Label>
            <select id="role" name="role" className="h-10 rounded-md border border-input bg-background px-3">
              <option value="therapist">מטפל/ת</option>
              <option value="admin">אדמין/ית</option>
            </select>
          </div>
          <Button type="submit">יצירת קישור הזמנה</Button>
        </form>
        <ul className="flex flex-col gap-1 text-sm">
          {(invites ?? []).map((inv) => (
            <li key={inv.token} className="flex items-center justify-between gap-3 text-muted-foreground">
              <code dir="ltr" className="truncate text-xs">
                {appUrl}/invite/{inv.token}
              </code>
              <span>{inv.used_at ? "נוצל" : new Date(inv.expires_at) < new Date() ? "פג תוקף" : "פעיל"}</span>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
