import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { toE164Israel } from "@/lib/phone";
import { sendEmail } from "@/lib/email/resend";
import { wooPurchaseReceivedEmail, sessionRenewedEmail } from "@/lib/email/templates";
import type { Database } from "@/lib/supabase/types";

// לוגיקת עיבוד הזמנת Woo של קליניקה בודדת — משותפת בין ה-webhook (push) ובין
// polling (pull). ר' SAASMIGRATIONSPEC §6: processWooOrder נשאר כמעט זהה
// למקור, רק מקבל clinic_id ומסנן לפיו את app_settings/woo_product_tiers/
// woo_pending_purchases/profiles הרלוונטיים.
//
// 🔴 סעיף 9 של SAASMIGRATIONSPEC — הבאג הקונקרטי בקוד המקורי
// (activateSessionFromWooOrder מחפש profiles לפי .eq("phone", ...) בלי שום
// סינון קליניקה): כאן כל שאילתת profiles/app_settings/woo_* מסוננת גם היא
// ב-clinic_id, כך שתשלום שהתקבל בחנות של קליניקה A לעולם לא יתאים לפרופיל
// בקליניקה B, גם אם הטלפון תואם במקרה.
export interface WooOrderPayload {
  id: number;
  status: string;
  billing?: {
    email?: string;
    phone?: string;
  };
  line_items?: Array<{
    product_id: number;
    variation_id?: number;
    quantity: number;
    total: string;
    total_tax?: string;
  }>;
}

function effectiveProductId(item: { product_id: number; variation_id?: number }): number {
  return item.variation_id && item.variation_id !== 0 ? item.variation_id : item.product_id;
}

export const PAID_STATUSES = new Set(["processing", "completed"]);

export async function processWooOrder(
  supabase: SupabaseClient<Database>,
  clinicId: string,
  order: WooOrderPayload,
): Promise<{ ok: boolean; skipped?: string }> {
  if (!order.id) {
    return { ok: false, skipped: "MISSING_ORDER_ID" };
  }

  if (!PAID_STATUSES.has(order.status)) {
    return { ok: true, skipped: "NOT_PAID" };
  }

  const rawPhone = order.billing?.phone;
  const email = order.billing?.email?.trim().toLowerCase() || null;
  const phone = rawPhone ? toE164Israel(rawPhone) : null;
  if (!phone && !email) {
    return { ok: false, skipped: "MISSING_CONTACT_INFO" };
  }

  const lineItems = order.line_items ?? [];
  if (lineItems.length === 0) {
    return { ok: true, skipped: "NO_LINE_ITEMS" };
  }

  const { data: sessionProductSetting } = await supabase
    .from("app_settings")
    .select("value")
    .eq("clinic_id", clinicId)
    .eq("key", "woo_session_product_id")
    .maybeSingle();
  const sessionProductId = typeof sessionProductSetting?.value === "number" ? sessionProductSetting.value : 0;

  let sessionHandled = false;
  if (sessionProductId) {
    const sessionItem = lineItems.find((li) => effectiveProductId(li) === sessionProductId);
    if (sessionItem) {
      const amountTotal = parseFloat(sessionItem.total) + parseFloat(sessionItem.total_tax ?? "0");
      if (Number.isFinite(amountTotal)) {
        await activateSessionFromWooOrder(supabase, clinicId, {
          phone,
          email,
          wooOrderId: order.id,
          amountTotal: Math.round(amountTotal * 100) / 100,
        });
        sessionHandled = true;
      }
    }
  }

  const { data: mappings } = await supabase
    .from("woo_product_tiers")
    .select("woo_product_id, tier_id")
    .eq("clinic_id", clinicId)
    .in(
      "woo_product_id",
      lineItems.map((li) => effectiveProductId(li)),
    );

  if (!mappings || mappings.length === 0) {
    return sessionHandled ? { ok: true } : { ok: true, skipped: "NO_MAPPED_PRODUCTS" };
  }

  const { data: tiers } = await supabase
    .from("punch_card_tiers")
    .select("id, hours")
    .eq("clinic_id", clinicId)
    .in(
      "id",
      mappings.map((m) => m.tier_id),
    );

  const rowsToInsert: {
    clinic_id: string;
    woo_order_id: number;
    tier_id: string;
    phone: string | null;
    email: string | null;
    quantity: number;
    amount_total: number;
  }[] = [];

  for (const item of lineItems) {
    const mapping = mappings.find((m) => m.woo_product_id === effectiveProductId(item));
    if (!mapping) continue;
    const tier = tiers?.find((t) => t.id === mapping.tier_id);
    if (!tier) continue;

    const amountTotal = parseFloat(item.total) + parseFloat(item.total_tax ?? "0");
    if (!Number.isFinite(amountTotal)) continue;

    rowsToInsert.push({
      clinic_id: clinicId,
      woo_order_id: order.id,
      tier_id: mapping.tier_id,
      phone,
      email,
      quantity: item.quantity,
      amount_total: Math.round(amountTotal * 100) / 100,
    });
  }

  if (rowsToInsert.length === 0) {
    return sessionHandled ? { ok: true } : { ok: true, skipped: "NO_MAPPED_PRODUCTS" };
  }

  // אידמפוטנטי מול אותה הזמנה שמתגלה כמה פעמים (webhook כפול, פוליים חופפים).
  // ה-.select() אחרי ה-upsert חיוני: שורה שהתנגשה (כבר קיימת) לא חוזרת
  // ב-RETURNING, אז insertedRows מכיל רק שורות שבאמת נכתבו עכשיו בפעם
  // הראשונה — המייל צריך להישלח פעם אחת בלבד לכל (clinic_id, woo_order_id,
  // tier_id), לא בכל פולינג.
  const { data: insertedRows, error } = await supabase
    .from("woo_pending_purchases")
    .upsert(rowsToInsert, { onConflict: "clinic_id,woo_order_id,tier_id", ignoreDuplicates: true })
    .select("tier_id, quantity");

  if (error) {
    return { ok: false, skipped: "SAVE_FAILED" };
  }

  const newHours = (insertedRows ?? []).reduce((sum, row) => {
    const tier = tiers?.find((t) => t.id === row.tier_id);
    return sum + (tier ? tier.hours * row.quantity : 0);
  }, 0);

  if (email && newHours > 0) {
    const registerUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/login`;
    const { subject, html } = wooPurchaseReceivedEmail({ hours: newHours, registerUrl });
    sendEmail({ to: email, subject, html }).catch(() => {});
  }

  return { ok: true };
}

// ═══ ססיה: מטפל/ת עם חשבון קיים — מותאם ישירות לתשלום הממתין שלו/ה. 🔴 כל
// שאילתת profiles כאן מסוננת clinic_id — זה בדיוק התיקון לבאג spec §9. ═══
async function activateSessionFromWooOrder(
  supabase: SupabaseClient<Database>,
  clinicId: string,
  params: { phone: string | null; email: string | null; wooOrderId: number; amountTotal: number },
) {
  let profile: { id: string; email: string; locale: string } | null = null;

  if (params.phone) {
    const { data } = await supabase
      .from("profiles")
      .select("id, email, locale")
      .eq("clinic_id", clinicId)
      .eq("phone", params.phone)
      .maybeSingle();
    profile = data;
  }
  if (!profile && params.email) {
    // 🔴 לא ilike: `%` ו-`_` בכתובת שמגיעה מההזמנה הם תווים כלליים, ולכן
    // `a_b@x.com` התאים גם ל-`axb@x.com` ו-`%@x.com` לכולם באותה קליניקה.
    // email_lower היא עמודה מחושבת (20260921000002) — התאמה מדויקת, בלי
    // רגישות לרישיות; params.email כבר מגיע ב-lowercase.
    const { data } = await supabase
      .from("profiles")
      .select("id, email, locale")
      .eq("clinic_id", clinicId)
      .eq("email_lower", params.email)
      .maybeSingle();
    profile = data;
  }
  if (!profile) return;

  const transactionUid = `woo-session-${clinicId}-${params.wooOrderId}`;

  const { data: initialPayment } = await supabase
    .from("payments")
    .select("id, amount_total")
    .eq("clinic_id", clinicId)
    .eq("user_id", profile.id)
    .eq("type", "session_initial")
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (initialPayment) {
    if (Math.abs(initialPayment.amount_total - params.amountTotal) > 0.01) return;
    await supabase.rpc("activate_session_payment", {
      p_payment_id: initialPayment.id,
      p_transaction_uid: transactionUid,
      p_method: "other",
    });
    return;
  }

  const { data: renewalPayment } = await supabase
    .from("payments")
    .select("id, amount_total")
    .eq("clinic_id", clinicId)
    .eq("user_id", profile.id)
    .eq("type", "session_recurring")
    .in("status", ["pending", "failed"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!renewalPayment) return;
  if (Math.abs(renewalPayment.amount_total - params.amountTotal) > 0.01) return;

  await supabase.rpc("finalize_session_renewal", {
    p_payment_id: renewalPayment.id,
    p_success: true,
    p_transaction_uid: transactionUid,
  });

  const { subject, html } = sessionRenewedEmail(params.amountTotal, null, profile.locale);
  sendEmail({ to: profile.email, subject, html }).catch(() => {});
}
