import { formatInTimeZone, toZonedTime } from "date-fns-tz";
import { he } from "date-fns/locale";

// ברירת מחדל בלבד — כל קליניקה קובעת אזור זמן משלה ב-clinics.timezone
// (SAASMIGRATIONSPEC §1: "קליניקה עתידית מחוץ לישראל צריכה לעבוד עם אזור
// זמן משלה; כל lib/time/* מקבל את זה כפרמטר"). לעולם לא hardcode ב-RPC/UI —
// תמיד להעביר את ה-timezone שנטען מ-clinics עבור הקליניקה הרלוונטית.
export const DEFAULT_TIMEZONE = "Asia/Jerusalem";
export const BUFFER_MINUTES = 5;
export const BOOKING_BLOCK_MINUTES = 30;

/**
 * "כניסה בפועל" / "פינוי" — תצוגה בלבד. חישובי חפיפה תמיד על starts_at/ends_at
 * המקוריים (נעשה ב-DB, ר' baclinica-spec.md §3.6).
 */
export function accessWindow(startsAt: Date, endsAt: Date) {
  return {
    accessStart: new Date(startsAt.getTime() - BUFFER_MINUTES * 60_000),
    accessEnd: new Date(endsAt.getTime() - BUFFER_MINUTES * 60_000),
  };
}

export function isAlignedTo30Minutes(date: Date, timezone: string = DEFAULT_TIMEZONE) {
  const zoned = toZonedTime(date, timezone);
  return zoned.getMinutes() % BOOKING_BLOCK_MINUTES === 0 && zoned.getSeconds() === 0;
}

export function formatDateHe(date: Date, timezone: string = DEFAULT_TIMEZONE) {
  return formatInTimeZone(date, timezone, "dd/MM/yyyy", { locale: he });
}

export function formatTimeHe(date: Date, timezone: string = DEFAULT_TIMEZONE) {
  return formatInTimeZone(date, timezone, "HH:mm", { locale: he });
}

export function formatDateTimeHe(date: Date, timezone: string = DEFAULT_TIMEZONE) {
  return formatInTimeZone(date, timezone, "dd/MM/yyyy HH:mm", { locale: he });
}

/** "עכשיו פחות X ימים", כ-ISO — עזר ל-queries. */
export function isoDaysAgo(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString();
}

/** תבנית ₪ תואמת CLAUDE.md: Intl.NumberFormat('he-IL'), תמיד עם סימן המטבע. */
export function formatCurrencyILS(amount: number): string {
  return new Intl.NumberFormat("he-IL", { style: "currency", currency: "ILS", maximumFractionDigits: 0 }).format(
    amount,
  );
}
