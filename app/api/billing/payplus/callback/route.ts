import { NextResponse } from "next/server";
import { mergeVerifiedWithHints, parseTransaction, payplusConfig, verifyCallbackSignature } from "@/lib/payplus";
import { checkRateLimit, clientIp } from "@/lib/rate-limit";
import { applyPlatformPayment, clinicIdFromMoreInfo, verifyPlatformTransaction } from "@/lib/platform-billing";
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

  // כל גוף שמתקבל עולה שאילתה ל-PayPlus — מבול הוא החשבון שלהם והמכסה שלנו.
  // PayPlus עצמה שולחת כמה ביום, ומנסה שוב אחר כך על 429.
  const limit = checkRateLimit({ scope: "payplus-callback", identifier: clientIp(request.headers), limit: 120, windowMs: 60_000 });
  if (!limit.ok) {
    return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } });
  }

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

  // רק מה ש-PayPlus אישרה נחשב; הגוף משלים מזהים שהתשובה השמיטה, ואת מזהה
  // הקליניקה — רק אם PayPlus חתמה על הגוף (ר' mergeVerifiedWithHints).
  const transaction = mergeVerifiedWithHints(verified.transaction, hinted, { signed: hash !== null });

  const outcome = await applyPlatformPayment(transaction, verified.raw);
  // מייל לבעלי הקליניקה — אחרי ההחלטה, ולעולם לא מפיל אותה. more_info הוא
  // תווית ("Cleana monthly"), לא מזהה, ולכן כמעט תמיד null כאן — וה-fallback
  // מוצא את הקליניקה לפי transaction_uid, מהשורה ש-platform_apply_payment רשם.
  await notifyPlatformPaymentOutcome(
    { clinicId: clinicIdFromMoreInfo(transaction.moreInfo), transactionUid: transaction.transactionUid },
    outcome,
  );
  return NextResponse.json({ outcome });
}

