/**
 * CSV לייצוא דוחות — כזה ש-Excel בעברית פותח נכון.
 *
 * שלושה דברים שקל לפספס:
 * 1. BOM (U+FEFF) בתחילת הקובץ. בלעדיו Excel מניח קידוד מקומי ומציג עברית
 *    כג'יבריש.
 * 2. CRLF בין שורות, ומירכאות סביב כל תא עם פסיק, מירכאה או ירידת שורה.
 * 3. 🔴 הזרקת נוסחאות: טקסט חופשי (שם מטפל/ת, הערה) שמתחיל ב-= + - @ נפתח
 *    ב-Excel כנוסחה — =HYPERLINK או גרוע מזה. תא טקסט כזה מקבל גרש בהתחלה
 *    (ההמלצה של OWASP). מספרים — גם שליליים — לא נוגעים בהם.
 */
export type CsvCell = string | number | null | undefined;

const FORMULA_START = /^[=+\-@\t\r]/;

function cell(value: CsvCell): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "";
  let text = value;
  if (FORMULA_START.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(header: string[], rows: CsvCell[][]): string {
  const lines = [header, ...rows].map((row) => row.map(cell).join(","));
  return `﻿${lines.join("\r\n")}\r\n`;
}
