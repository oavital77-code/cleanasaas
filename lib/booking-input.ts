/**
 * ולידציה של פרטי הזמנה שמגיעים מטופס — לפני כל חשבון תאריכים.
 *
 * 🔴 בלי זה, `Number(formData.get("duration_hours"))` מחזיר NaN על כל קלט
 * שאינו מספר, ו-`new Date(NaN).toISOString()` זורק RangeError שאיש לא תופס:
 * ה-Server Action מת ב-500 במקום להחזיר הודעה מתורגמת. אותו דבר קורה על
 * תאריך שאינו יום אמיתי בלוח השנה, על שעה בלתי אפשרית, ועל משך שגולש מטווח
 * ה-Date. ר' createBookingAction ו-adminAssignBookingAction.
 */

/** הטווח שהטפסים מציעים (0.5–8, קפיצות חצי שעה); השרת מרשה עד 12 לשיבוץ אדמין. */
const MIN_HOURS = 0.5;
const MAX_HOURS = 12;
const HOUR_STEP = 0.5;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME = /^([01]\d|2[0-3]):([0-5]\d)(?::[0-5]\d)?$/;

export interface BookingInput {
  roomId: string;
  date: string;
  startTime: string;
  durationHours: number;
}

export type BookingInputResult =
  | { ok: true; value: BookingInput }
  /** "missing" — שדה חובה ריק (הודעת "נא למלא את כל השדות"); "invalid" — נשלח משהו, והוא לא תקין. */
  | { ok: false; reason: "missing" | "invalid" };

/** "2026-02-30" עובר את ה-regex אבל אינו יום קיים — Date מגלגל אותו ל-02/03. */
function isRealCalendarDay(value: string): boolean {
  const m = DATE.exec(value);
  if (!m) return false;
  const [, y, mo, d] = m;
  const date = new Date(Date.UTC(Number(y), Number(mo) - 1, Number(d)));
  return (
    date.getUTCFullYear() === Number(y) && date.getUTCMonth() === Number(mo) - 1 && date.getUTCDate() === Number(d)
  );
}

/** Number("") הוא 0 ו-Number(" ") הוא 0 — לכן המרה מפורשת ולא Number() עירום. */
function parseHours(raw: string): number | null {
  const trimmed = raw.trim();
  if (!/^\d+(?:\.\d+)?$/.test(trimmed)) return null;
  const n = Number(trimmed);
  if (!Number.isFinite(n) || n < MIN_HOURS || n > MAX_HOURS) return null;
  // כפולה של חצי שעה, בלי להיתקל בשגיאות נקודה צפה (1.5 % 0.5 !== 0 בחלק מהמקרים).
  if (Math.round(n / HOUR_STEP) * HOUR_STEP !== n) return null;
  return n;
}

export function parseBookingInput(raw: {
  roomId: unknown;
  date: unknown;
  startTime: unknown;
  durationHours: unknown;
}): BookingInputResult {
  const roomId = String(raw.roomId ?? "").trim();
  const date = String(raw.date ?? "").trim();
  const startTime = String(raw.startTime ?? "").trim();
  if (!roomId || !date || !startTime) return { ok: false, reason: "missing" };

  if (!UUID.test(roomId)) return { ok: false, reason: "invalid" };
  if (!isRealCalendarDay(date)) return { ok: false, reason: "invalid" };

  const time = TIME.exec(startTime);
  if (!time) return { ok: false, reason: "invalid" };

  // שדה שלא נשלח כלל = שעה אחת, בדיוק כמו ברירת המחדל של הטופס.
  const durationHours = raw.durationHours === null || raw.durationHours === undefined ? 1 : parseHours(String(raw.durationHours));
  if (durationHours === null) return { ok: false, reason: "invalid" };

  return { ok: true, value: { roomId, date, startTime: `${time[1]}:${time[2]}`, durationHours } };
}
