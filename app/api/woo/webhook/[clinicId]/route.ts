import { NextResponse } from "next/server";
import { verifyWooWebhook } from "@/lib/woo/verify";
import { createAdminClient } from "@/lib/supabase/admin";
import { processWooOrder, type WooOrderPayload } from "@/lib/woo/process-order";

// כל קליניקה מקבלת URL webhook ייעודי משלה (עם ה-clinic_id שלה בנתיב) —
// כי בעולם רב-דיירי אין עוד סוד גלובלי אחד (WOOCOMMERCE_WEBHOOK_SECRET),
// אלא clinic_payment_settings.woo_webhook_secret פר-קליניקה. ה-clinic_id
// בנתיב הוא רק "לאיזה סוד להשוות מול" — לא מקור סמכות לזהות הקליניקה של
// הנתונים עצמם; processWooOrder עדיין מקבל אותו כפרמטר מפורש ומסנן לפיו.
export async function POST(request: Request, { params }: { params: Promise<{ clinicId: string }> }) {
  const { clinicId } = await params;
  const rawBody = await request.text();

  const supabase = createAdminClient();
  // 🔴 לא select ישיר: woo_webhook_secret מוצפן (bytea) — ר' lib/woo/rest-client.ts.
  const { data: settings } = await supabase.rpc("get_clinic_woo_credentials", { p_clinic_id: clinicId }).maybeSingle();

  if (!settings?.woo_webhook_secret) {
    return NextResponse.json({ error: "WEBHOOK_NOT_CONFIGURED" }, { status: 500 });
  }
  if (!verifyWooWebhook(rawBody, request.headers, settings.woo_webhook_secret)) {
    return NextResponse.json({ error: "INVALID_SIGNATURE" }, { status: 401 });
  }

  let order: WooOrderPayload;
  try {
    order = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "INVALID_PAYLOAD" }, { status: 400 });
  }

  const result = await processWooOrder(supabase, clinicId, order);

  if (!result.ok) {
    return NextResponse.json({ error: result.skipped ?? "PROCESSING_FAILED" }, { status: 400 });
  }
  return NextResponse.json({ ok: true, skipped: result.skipped });
}
