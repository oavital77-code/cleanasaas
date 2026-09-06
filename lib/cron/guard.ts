import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email/resend";
import { cronFailedAdminEmail } from "@/lib/email/templates";
import { getSuperadminEmails } from "@/lib/email/recipients";

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
 * 2. **התראה על כישלון**: חריגה או תגובת שגיאה נרשמות ל-console.error וגם
 *    נשלחות במייל לסופר-אדמיני הפלטפורמה (לא לאדמיני קליניקה — כישלון cron
 *    הוא תקלה חוצת-קליניקות, לא של קליניקה ספציפית). אם אין עדיין אף
 *    סופר-אדמין רשום, הרשימה ריקה וההתראה פשוט לא נשלחת (לא זורק).
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
        const detail = body || `HTTP ${response.status}`;
        console.error(`[cron:${jobName}] נכשל: ${detail}`);
        await alertSuperadmins(jobName, detail);
      }
      return response;
    } catch (err) {
      const message = err instanceof Error ? err.message : "UNKNOWN";
      console.error(`[cron:${jobName}] נכשל: ${message}`);
      await alertSuperadmins(jobName, message);
      return NextResponse.json({ error: "CRON_FAILED" }, { status: 500 });
    }
  };
}

async function alertSuperadmins(jobName: string, detail: string) {
  try {
    const supabase = createAdminClient();
    const emails = await getSuperadminEmails(supabase);
    if (emails.length === 0) return;
    const { subject, html } = cronFailedAdminEmail({ jobName, detail });
    await sendEmail({ to: emails, subject, html });
  } catch (err) {
    // התראה על כישלון לא אמורה בעצמה לגרום לכישלון נוסף — נרשם ללוג ותו לא.
    console.error(`[cron:${jobName}] שליחת התראת כישלון נכשלה`, err);
  }
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
