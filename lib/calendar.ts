// עזרי תאריכים טהורים (בלי timezone/DB) לתצוגות יום/שבוע/חודש ב-/schedule
// וב-/admin/board. כל תאריך הוא מחרוזת "YYYY-MM-DD" ביומן האזרחי — ההמרה
// לשעון הקליניקה בפועל (zonedDateTimeToUtc) קורית בקוד הקורא, לא כאן.
export const DAY_START_HOUR = 8;
export const DAY_END_HOUR = 22;
export const SLOT_MINUTES = 30;

export function buildDaySlots(): string[] {
  const slots: string[] = [];
  for (let m = DAY_START_HOUR * 60; m < DAY_END_HOUR * 60; m += SLOT_MINUTES) {
    const h = Math.floor(m / 60)
      .toString()
      .padStart(2, "0");
    const mm = (m % 60).toString().padStart(2, "0");
    slots.push(`${h}:${mm}`);
  }
  return slots;
}

export function addDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** ראשון בשבוע של dateStr (0 = ראשון, מוסכמה ישראלית — לא שני כמו ISO). */
export function startOfWeek(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return addDays(dateStr, -date.getUTCDay());
}

export function weekDays(dateStr: string): string[] {
  const start = startOfWeek(dateStr);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

/** רשת חודש מלאה — כולל ימים משלים משבועות קודם/הבא, כדי שכל שבוע יהיה מלא. */
export function monthGrid(dateStr: string): string[][] {
  const [y, m] = dateStr.split("-").map(Number);
  const firstOfMonth = `${y}-${String(m).padStart(2, "0")}-01`;
  const gridStart = startOfWeek(firstOfMonth);

  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const lastOfMonth = `${y}-${String(m).padStart(2, "0")}-${String(daysInMonth).padStart(2, "0")}`;
  const lastWeekStart = startOfWeek(lastOfMonth);
  const gridEnd = addDays(lastWeekStart, 6);

  const weeks: string[][] = [];
  let cursor = gridStart;
  while (cursor <= gridEnd) {
    weeks.push(Array.from({ length: 7 }, (_, i) => addDays(cursor, i)));
    cursor = addDays(cursor, 7);
  }
  return weeks;
}

export function isSameMonth(dateStr: string, refDateStr: string): boolean {
  return dateStr.slice(0, 7) === refDateStr.slice(0, 7);
}
