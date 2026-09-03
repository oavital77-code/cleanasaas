import "server-only";
import { NextResponse } from "next/server";

/**
 * עוטף route handler של cron: כישלון (חריגה, או תגובת {error, status>=400})
 * נרשם ל-console.error כרגע. TODO: לחבר שוב להתראת מייל לאדמיני-פלטפורמה
 * ברגע ש-lib/email מועבר לריפו הזה (עדיין לא בוצע — ר' PROGRESS.md).
 */
export function withCronAlert(jobName: string, handler: () => Promise<NextResponse>) {
  return async function GET() {
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
