import { formatInTimeZone } from "date-fns-tz";
import { zonedDateTimeToUtc } from "@/lib/time";

/**
 * חודש של דוח — "2026-09" ב-URL — והגבולות שלו ב-UTC לשאילתות.
 *
 * הגבולות הם חצות *בשעון הקליניקה*. הדוח הקודם חישב את תחילת החודש
 * בשעון השרת (UTC ב-Vercel), כך שתשלום שנרשם ב-1 לחודש ב-01:00 בישראל נספר
 * בחודש הקודם.
 */
export interface ReportMonth {
  key: string;
  startIso: string;
  endIso: string;
  prevKey: string;
  /** null כשהחודש הבא עוד לא התחיל. */
  nextKey: string | null;
}

const KEY = /^(\d{4})-(0[1-9]|1[0-2])$/;

function shift(key: string, months: number): string {
  const [y, m] = key.split("-").map(Number);
  const index = y * 12 + (m - 1) + months;
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, "0")}`;
}

export function reportMonth(param: string | undefined, now: Date, timezone: string): ReportMonth {
  const current = formatInTimeZone(now, timezone, "yyyy-MM");
  const key = param && KEY.test(param) && param <= current ? param : current;
  const next = shift(key, 1);
  return {
    key,
    startIso: zonedDateTimeToUtc(`${key}-01`, "00:00", timezone).toISOString(),
    endIso: zonedDateTimeToUtc(`${next}-01`, "00:00", timezone).toISOString(),
    prevKey: shift(key, -1),
    nextKey: next <= current ? next : null,
  };
}
