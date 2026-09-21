/**
 * map אסינכרוני עם תקרת מקביליות.
 *
 * ה-crons שולחים מייל לכל שורה. סדרתי זה בטוח אבל איטי — 200 מיילים
 * בזה אחר זה עוברים בקלות את `maxDuration` של Vercel, והריצה נקטעת באמצע;
 * `Promise.all` על הכול פותח 200 בקשות בבת אחת ונחסם ב-rate limit של Resend.
 * תקרה קטנה היא האמצע: מהיר מספיק, ועדיין מנומס.
 */
export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await fn(items[index], index);
    }
  });
  await Promise.all(workers);
  return results;
}
