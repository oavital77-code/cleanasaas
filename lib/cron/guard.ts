import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";

/**
 * עוטף route handler של cron ועושה שני דברים:
 *
 * 1. 🔴 **אימות**: ה-routes האלה רצים עם service role (createAdminClient) —
 *    כלומר עוקפים RLS וכותבים על פני *כל* הקליניקות. בלי אימות, כל אדם
 *    באינטרנט יכול לקרוא ל-GET /api/cron/send-reminders ולסמן את כל
 *    התזכורות כ"נשלחו" (כך שאף מטפל/ת לא יקבל/תקבל תזכורת), להריץ שוב
 *    ושוב את materialize-sessions (כתיבה כבדה חוצת-קליניקות), או לשרוף את
 *    מכסת ה-API של WooCommerce דרך poll-woo-orders. Vercel Cron שולח
 *    `Authorization: Bearer $CRON_SECRET` בכל הפעלה — כאן זה נאכף.
 *
 *    ⚠️ בלי `CRON_SECRET` ב-env ה-routes מחזירים 503 ולא רצים (fail closed
 *    במכוון — עדיף cron שלא רץ ומתריע, מאשר endpoint פתוח לעולם).
 *
 * 2. **התראה על כישלון**: חריגה או תגובת שגיאה נרשמות ל-console.error.
 *    TODO: לחבר להתראת מייל לאדמיני-פלטפורמה כש-lib/email יועבר (ר' PROGRESS.md).
 */
export function withCronAlert(jobName: string, handler: () => Promise<NextResponse>) {
  return async function GET(request: Request) {
    const secret = process.env.CRON_SECRET;
    if (!secret) {
      console.error(`[cron:${jobName}] CRON_SECRET לא מוגדר — הבקשה נדחתה`);
      return NextResponse.json({ error: "CRON_NOT_CONFIGURED" }, { status: 503 });
    }
    if (!isAuthorized(request.headers.get("authorization"), secret)) {
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }

    try {
      const response = await handler();
      if (response.status >= 400) {
        const body = await response.clone().text();
        console.error(`[cron:${jobName}] נכשל: ${body || `HTTP ${response.status}`}`);
      }
      return response;
    } catch (err) {
      const message = err instanceof Error ? err.message : "UNKNOWN";
      console.error(`[cron:${jobName}] נכשל: ${message}`);
      return NextResponse.json({ error: "CRON_FAILED" }, { status: 500 });
    }
  };
}

/**
 * השוואה בזמן קבוע. עוברים דרך SHA-256 כדי ש-timingSafeEqual יקבל תמיד שני
 * buffers באותו אורך — כך גם *אורך* הסוד לא דולף דרך זמן התגובה.
 */
function isAuthorized(header: string | null, secret: string): boolean {
  if (!header) return false;
  const provided = createHash("sha256").update(header).digest();
  const expected = createHash("sha256").update(`Bearer ${secret}`).digest();
  return timingSafeEqual(provided, expected);
}
