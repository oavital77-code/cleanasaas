import { NextResponse } from "next/server";
import { parseTransaction, payplusConfig, verifyCallbackSignature } from "@/lib/payplus";
import { applyPlatformPayment, verifyPlatformTransaction } from "@/lib/platform-billing";
import { notifyPlatformPaymentOutcome } from "@/lib/platform-billing-emails";

export const dynamic = "force-dynamic";

// PayPlus מדווחת שחיוב קרה. לא מאמינים למילה עד ש-PayPlus, כשנשאלת ישירות עם
// המפתחות שלנו, אומרת אותו דבר — כך גוף מזויף יכול לכל היותר לגרום לנו
// לשאול על מזהה עסקה ש-PayPlus לא מכירה.
//
// החתימה (hash) היא שער ראשון וזול; נדרשת כשהיא נשלחת. האימות מול PayPlus
// הוא מה שמחליט. תמיד 200 אחרי שההודעה הובנה, מה שלא נחליט עליה: לא-2xx
// גורם ל-PayPlus לנסות שוב, וכפילות/זיוף אינם דבר שניסיון חוזר מתקן.
//
// ה-route ציבורי במכוון (אין session של PayPlus) — /api מוחרג מ-clerkMiddleware.
export async function POST(request: Request) {
  const cfg = payplusConfig();
  if (!cfg) return NextResponse.json({ error: "BILLING_NOT_CONFIGURED" }, { status: 503 });

  const rawBody = await request.text();
  const hash = request.headers.get("hash");
  if (hash !== null && !verifyCallbackSignature(rawBody, { hash, userAgent: request.headers.get("user-agent") }, cfg.secretKey)) {
    return NextResponse.json({ error: "BAD_SIGNATURE" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
  }

  const hinted = parseTransaction(body);
  if (!hinted.transactionUid) return NextResponse.json({ error: "NO_TRANSACTION" }, { status: 400 });

  const verified = await verifyPlatformTransaction(hinted.transactionUid);
  if (!verified) return NextResponse.json({ ok: false, reason: "unverified" });

  const transaction = {
    ...verified.transaction,
    moreInfo: verified.transaction.moreInfo ?? hinted.moreInfo,
    pageRequestUid: verified.transaction.pageRequestUid ?? hinted.pageRequestUid,
    recurringUid: verified.transaction.recurringUid ?? hinted.recurringUid,
  };

  const outcome = await applyPlatformPayment(transaction, verified.raw);
  // מייל לבעלי הקליניקה — אחרי ההחלטה, ולעולם לא מפיל אותה.
  await notifyPlatformPaymentOutcome(transaction.moreInfo, outcome);
  return NextResponse.json({ outcome });
}
