import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  createRecurringCheckout,
  fetchTransaction,
  payplusConfig,
  stopRecurring,
  type CallbackTransaction,
  type PayPlusConfig,
} from "@/lib/payplus";

/**
 * תשלום הקליניקה לפלטפורמה. מסלול בתשלום אחד (PROGRESS.md §5): המחיר מגיע
 * מהסביבה עם ברירת מחדל של ההחלטה מ-8.9.2026, שקלים כולל מע"מ — אותו מספר
 * מוצג לאדמין ונשלח ל-PayPlus, ממקור אחד.
 *
 * הלוגיקה העסקית עצמה — מי שילם, מה נפתח, מתי נסגר — יושבת ב-DB
 * (platform_apply_payment ושות'), כמו כל זרימה עסקית כאן. הקובץ הזה הוא
 * הדבק בין PayPlus לאותן RPCs.
 */
export const PLATFORM_PLAN_DEFAULT_PRICE_ILS = 209;

export function platformPlanPriceIls(env: Record<string, string | undefined> = process.env): number {
  const raw = env.PLATFORM_PLAN_PRICE_ILS;
  const n = raw ? Number(raw) : NaN;
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : PLATFORM_PLAN_DEFAULT_PRICE_ILS;
}

export function platformBillingAvailability(): { ok: true; cfg: PayPlusConfig; priceIls: number } | { ok: false; reason: "not_configured" } {
  const cfg = payplusConfig();
  if (!cfg) return { ok: false, reason: "not_configured" };
  return { ok: true, cfg, priceIls: platformPlanPriceIls() };
}

export function appOrigin(): string {
  return (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/+$/, "");
}

/** פותח דף תשלום ל-PayPlus. הקריאה ל-platform_start_checkout נעשית ע"י הקורא (עם ה-session של האדמין). */
export async function createPlatformCheckout(
  cfg: PayPlusConfig,
  input: { clinicId: string; clinicName: string; ownerName: string; ownerEmail: string; ownerPhone?: string | null; priceIls: number; locale: "he" | "en" },
  fetchImpl?: typeof fetch,
) {
  const base = appOrigin();
  const description = input.locale === "he" ? `Cleana — מנוי חודשי, ${input.clinicName}` : `Cleana — monthly subscription, ${input.clinicName}`;
  return createRecurringCheckout(
    cfg,
    {
      clinicId: input.clinicId,
      amountIls: input.priceIls,
      description,
      customer: { name: input.ownerName, email: input.ownerEmail, phone: input.ownerPhone },
      urls: {
        success: `${base}/admin/billing?returned=success`,
        failure: `${base}/admin/billing?returned=failure`,
        cancel: `${base}/admin/billing?returned=cancel`,
        callback: `${base}/api/billing/payplus/callback`,
      },
    },
    fetchImpl,
  );
}

/** מאמת עסקה מול PayPlus עם המפתחות שלנו. null = PayPlus לא מכירה אותה (זיוף). */
export async function verifyPlatformTransaction(transactionUid: string, fetchImpl?: typeof fetch) {
  const cfg = payplusConfig();
  if (!cfg) return null;
  return fetchTransaction(cfg, transactionUid, fetchImpl);
}

export type ApplyOutcome = "activated" | "payment_failed" | "failed_ignored" | "duplicate" | "unknown_clinic" | "amount_mismatch";

/** service role → platform_apply_payment. הפונקציה ב-DB היא האמת; כאן רק מעבירים. */
export async function applyPlatformPayment(verified: CallbackTransaction, raw: unknown): Promise<ApplyOutcome> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("platform_apply_payment", {
    p_clinic_id: verified.moreInfo,
    p_transaction_uid: verified.transactionUid ?? "",
    p_status_code: verified.statusCode ?? "",
    p_amount: verified.amount,
    p_expected_amount: platformPlanPriceIls(),
    p_page_request_uid: verified.pageRequestUid,
    p_recurring_uid: verified.recurringUid,
    p_customer_uid: verified.customerUid,
    p_raw: raw === undefined ? null : (JSON.parse(JSON.stringify(raw)) as never),
  });
  if (error) throw new Error(`platform_apply_payment: ${error.message}`);
  return (data ?? "failed_ignored") as ApplyOutcome;
}

/** עוצר את הוראת הקבע ב-PayPlus. הקורא מסמן את הביטול ב-DB רק אם זה הצליח. */
export async function stopPlatformRecurring(recurringUid: string, fetchImpl?: typeof fetch): Promise<void> {
  const cfg = payplusConfig();
  if (!cfg) throw new Error("PAYPLUS_NOT_CONFIGURED");
  await stopRecurring(cfg, recurringUid, fetchImpl);
}
