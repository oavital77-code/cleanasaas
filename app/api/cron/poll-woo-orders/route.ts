import { NextResponse } from "next/server";
import { withCronAlert } from "@/lib/cron/guard";
import { pollWooOrdersAllClinics } from "@/lib/woo/poll";

// רשת ביטחון יומית לכל קליניקה שלא הגדירה webhook בחנות שלה (polling, חלון
// 26 שעות). לולאה per-clinic עם try/catch פר-קליניקה — ר' lib/woo/poll.ts.
// המקסימום שכל תוכנית של Vercel מקבלת בלי לשבור את ה-build ב-Hobby; להעלות ב-Pro.
export const maxDuration = 60;

export const GET = withCronAlert("poll-woo-orders", async () => {
  const result = await pollWooOrdersAllClinics(26 * 60);
  return NextResponse.json(result);
});
