import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  chargeToken,
  createTokenCheckout,
  fetchTransaction,
  listTokens,
  payplusConfig,
  PayPlusError,
  type CallbackTransaction,
  type PayPlusConfig,
} from "@/lib/payplus";

/**
 * תשלום הקליניקה לפלטפורמה. מסלול בתשלום אחד (PROGRESS.md §5): המחיר מגיע
 * מהסביבה עם ברירת מחדל של ההחלטה מ-8.9.2026, שקלים כולל מע"מ — אותו מספר
 * מוצג לאדמין ונשלח ל-PayPlus, ממקור אחד.
 *
 * החידושים שלנו: התשלום הראשון (דף תשלום) שומר את הכרטיס כטוקן, ו-
 * chargePlatformRenewals מחייב אותו בסוף כל תקופה, לכל היותר פעם ביום —
 * מודול הוראות הקבע של PayPlus לא מופעל על המסוף (ר' מיגרציה 20260909000004).
 *
 * הלוגיקה העסקית עצמה — מי שילם, מה נפתח, מתי נסגר — יושבת ב-DB
 * (platform_apply_payment ושות'), כמו כל זרימה עסקית כאן. הקובץ הזה הוא
 * הדבק בין PayPlus לאותן RPCs.
 */
export const PLATFORM_PLAN_DEFAULT_PRICE_ILS = 209;

/** מה ש-PayPlus מציגה כ-more_info (עד 19 תווים — תווית, לא מזהה). */
export const CHECKOUT_REFERENCE = "Cleana monthly";

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
  input: { clinicName: string; ownerName: string; ownerEmail: string; ownerPhone?: string | null; priceIls: number; locale: "he" | "en" },
  fetchImpl?: typeof fetch,
) {
  const base = appOrigin();
  const description = input.locale === "he" ? `Cleana — מנוי חודשי, ${input.clinicName}` : `Cleana — monthly subscription, ${input.clinicName}`;
  return createTokenCheckout(
    cfg,
    {
      reference: CHECKOUT_REFERENCE,
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

/**
 * service role → platform_apply_payment. הפונקציה ב-DB היא האמת; כאן רק
 * מעבירים — ומשלימים טוקן דרך Token/List כשתשלום create_token מאומת הגיע
 * בלעדיו (אינטגרציות מדווחות על שני המקרים).
 */
export async function applyPlatformPayment(
  verified: CallbackTransaction,
  raw: unknown,
  opts: { clinicId?: string | null; fetchImpl?: typeof fetch } = {},
): Promise<ApplyOutcome> {
  const supabase = createAdminClient();
  const succeeded = verified.statusCode === "000";
  const tokenUid = verified.tokenUid ?? (succeeded ? await tokenFromPayPlus(verified, opts.fetchImpl) : null);
  const { data, error } = await supabase.rpc("platform_apply_payment", {
    p_clinic_id: opts.clinicId ?? null,
    p_transaction_uid: verified.transactionUid ?? "",
    p_status_code: verified.statusCode ?? "",
    p_amount: verified.amount,
    p_expected_amount: platformPlanPriceIls(),
    p_page_request_uid: verified.pageRequestUid,
    p_token_uid: tokenUid,
    p_customer_uid: verified.customerUid,
    p_terminal_uid: verified.terminalUid,
    p_cashier_uid: verified.cashierUid,
    p_raw: raw === undefined ? null : (JSON.parse(JSON.stringify(raw)) as never),
  });
  if (error) throw new Error(`platform_apply_payment: ${error.message}`);
  return (data ?? "failed_ignored") as ApplyOutcome;
}

async function tokenFromPayPlus(verified: CallbackTransaction, fetchImpl?: typeof fetch): Promise<string | null> {
  const cfg = payplusConfig();
  const terminalUid = cfg?.terminalUid ?? verified.terminalUid;
  if (!cfg || !terminalUid || !verified.customerUid) return null;
  try {
    const tokens = await listTokens(cfg, { terminalUid, customerUid: verified.customerUid }, fetchImpl);
    return tokens[tokens.length - 1] ?? null;
  } catch (err) {
    console.error("[platform-billing] Token/List failed", err instanceof PayPlusError ? err.body : err);
    return null;
  }
}

export type RenewalSummary = { charged: number; declined: number; errors: number; noToken: number };

/**
 * מחייב כל כרטיס שמור שתקופתו נגמרה, ובחסד אחרי סירוב — שוב פעם ביום עד
 * סוף החסד. ה-DB "תופס" את השורות (platform_claim_due_renewals חותמת
 * last_charge_attempt_at באותה פקודה), כך ששתי ריצות חופפות לא מחייבות פעמיים.
 */
export async function chargePlatformRenewals(
  now: Date = new Date(),
  deps: { fetchImpl?: typeof fetch; onOutcome?: (clinicId: string, outcome: ApplyOutcome) => Promise<void> } = {},
): Promise<RenewalSummary> {
  const summary: RenewalSummary = { charged: 0, declined: 0, errors: 0, noToken: 0 };
  const availability = platformBillingAvailability();
  if (!availability.ok) return summary;
  const { cfg, priceIls } = availability;

  const supabase = createAdminClient();
  const { data: due, error } = await supabase.rpc("platform_claim_due_renewals", { p_now: now.toISOString() });
  if (error) throw new Error(`platform_claim_due_renewals: ${error.message}`);

  for (const row of due ?? []) {
    const terminalUid = cfg.terminalUid ?? row.terminal_uid;
    const cashierUid = cfg.cashierUid ?? row.cashier_uid;
    if (!row.token_uid || !terminalUid || !cashierUid) {
      summary.noToken++;
      continue; // רשת הביטחון של "חידוש שלא אושר" ב-platform_billing_lifecycle
    }
    try {
      const charge = await chargeToken(
        cfg,
        {
          terminalUid,
          cashierUid,
          tokenUid: row.token_uid,
          customerUid: row.customer_uid,
          amountIls: priceIls,
          description: `${CHECKOUT_REFERENCE} renewal`,
        },
        deps.fetchImpl,
      );
      const outcome = await applyPlatformPayment(charge.transaction, charge.raw, { clinicId: row.clinic_id, fetchImpl: deps.fetchImpl });
      if (outcome === "activated") summary.charged++;
      else summary.declined++;
      await deps.onOutcome?.(row.clinic_id, outcome);
    } catch (err) {
      summary.errors++;
      console.error("[platform-billing] renewal charge failed", row.clinic_id, err instanceof PayPlusError ? err.body : err);
    }
  }
  return summary;
}
