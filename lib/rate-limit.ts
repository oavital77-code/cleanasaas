import "server-only";

/**
 * מגבלת קצב לחלון קבוע, בזיכרון התהליך — ל-endpoints שכל אחד באינטרנט יכול
 * לקרוא להם ושכל קריאה אליהם עולה משהו (ה-callback של PayPlus: כל גוף שמתקבל
 * הוא שאילתה ל-PayPlus עם המפתחות שלנו).
 *
 * "בזיכרון" ב-serverless = לכל instance חם בנפרד, כלומר רצפה ולא תקרה: מבול
 * מ-IP אחד נעצר באותו instance; זה מספיק כדי שקריאה אחת בשנייה לא תהפוך
 * לאלף. הרשימה מנוקה בכל פנייה כדי שלא תגדל בלי סוף.
 */
export type RateLimitResult = { ok: true } | { ok: false; retryAfterSeconds: number };

const buckets = new Map<string, { windowIndex: number; count: number }>();

export function checkRateLimit(input: {
  scope: string;
  identifier: string;
  limit: number;
  windowMs: number;
  now?: Date;
}): RateLimitResult {
  const nowMs = (input.now ?? new Date()).getTime();
  const windowIndex = Math.floor(nowMs / input.windowMs);
  const key = `${input.scope}:${input.identifier}`;

  for (const [k, b] of buckets) if (b.windowIndex < windowIndex) buckets.delete(k);

  const bucket = buckets.get(key);
  const count = bucket && bucket.windowIndex === windowIndex ? bucket.count + 1 : 1;
  buckets.set(key, { windowIndex, count });
  if (count <= input.limit) return { ok: true };

  const windowEnd = (windowIndex + 1) * input.windowMs;
  return { ok: false, retryAfterSeconds: Math.max(1, Math.ceil((windowEnd - nowMs) / 1000)) };
}

/** ה-IP של הקורא כפי ש-Vercel מעביר אותו (ה-hop הראשון ב-x-forwarded-for). */
export function clientIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return headers.get("x-real-ip")?.trim() || "unknown";
}
