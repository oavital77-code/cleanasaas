// ייבוא מטפלים/ות מקובץ Excel/CSV (בקשת המשתמש/ת 09/09) — החלק הטהור:
// זיהוי כותרות (עברית/אנגלית, בלי תלות בסדר העמודות), ניקוי ערכים
// ובדיקת תקינות שורה-שורה. אין כאן I/O ואין DB — הכל נבדק ב-unit tests.
// הפורמט שאנחנו מנחים בו את המנהל/ת (ר' /admin/therapists/import):
//
//   שם מלא | טלפון | אימייל | שעות (אופציונלי) | מקצוע (אופציונלי)
//
// שורה ראשונה = כותרות. עמודות בכל סדר; עמודות נוספות מתעלמים מהן.

import { toE164Israel } from "@/lib/phone";

export type ImportField = "full_name" | "phone" | "email" | "hours" | "profession";

export type ParsedTherapistRow = {
  // מספר השורה בקובץ (1 = הכותרת, אז הנתונים מתחילים מ-2) — לתצוגה בלבד.
  line: number;
  full_name: string;
  phone: string;
  email: string;
  hours: number;
  profession: string | null;
  errors: ImportRowError[];
};

export type ImportRowError = "NAME_REQUIRED" | "PHONE_INVALID" | "EMAIL_INVALID" | "HOURS_INVALID" | "DUPLICATE_IN_FILE";

export type ImportParseResult =
  | { ok: true; rows: ParsedTherapistRow[]; validCount: number }
  | { ok: false; error: "EMPTY_FILE" | "MISSING_COLUMNS"; missing?: ImportField[] };

export const REQUIRED_FIELDS: ImportField[] = ["full_name", "phone", "email"];
export const MAX_IMPORT_ROWS = 500;

// כינויי כותרות — כל דבר סביר שמנהל/ת יכתוב/תכתוב בראש העמודה.
const HEADER_ALIASES: Record<ImportField, string[]> = {
  full_name: ["שם מלא", "שם", "שם המטפל", "שם המטפלת", "שם מטפל", "מטפל", "מטפלת", "full name", "fullname", "name", "therapist", "therapist name"],
  phone: ["טלפון", "נייד", "טלפון נייד", "מספר טלפון", "פלאפון", "whatsapp", "וואטסאפ", "phone", "mobile", "phone number", "cell", "tel"],
  email: ["אימייל", "מייל", "דואר אלקטרוני", "דוא\"ל", "דואל", "email", "e-mail", "mail", "email address"],
  hours: ["שעות", "יתרת שעות", "שעות בכרטיסייה", "יתרה", "כרטיסייה", "hours", "balance", "remaining hours", "punch card", "credit"],
  profession: ["מקצוע", "תחום", "התמחות", "תפקיד", "profession", "specialty", "speciality", "occupation", "title"],
};

function normalizeHeader(raw: unknown): string {
  return String(raw ?? "")
    .toLowerCase()
    .replace(/[‏‎﻿]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

const ALIAS_LOOKUP: Map<string, ImportField> = new Map(
  (Object.keys(HEADER_ALIASES) as ImportField[]).flatMap((field) =>
    HEADER_ALIASES[field].map((alias) => [normalizeHeader(alias), field] as const),
  ),
);

export function detectColumns(headerRow: unknown[]): Partial<Record<ImportField, number>> {
  const map: Partial<Record<ImportField, number>> = {};
  headerRow.forEach((cell, idx) => {
    const field = ALIAS_LOOKUP.get(normalizeHeader(cell));
    if (field && map[field] === undefined) map[field] = idx;
  });
  return map;
}

function cellText(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "number") return Number.isInteger(v) ? String(v) : String(v);
  if (v instanceof Date) return "";
  return String(v).replace(/[‏‎﻿]/g, "").trim();
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// מספר טלפון מתא Excel לפעמים מגיע כמספר (האפס המוביל נבלע: 525550123) —
// toE164Israel מטפל בזה (מקבל 5XXXXXXXX). מספרים לא-ישראליים כרגע נדחים,
// בדיוק כמו בטופס ההרשמה (lib/phone.ts).
export function parseTherapistRows(rows: unknown[][]): ImportParseResult {
  const nonEmpty = rows.filter((r) => Array.isArray(r) && r.some((c) => cellText(c) !== ""));
  if (nonEmpty.length === 0) return { ok: false, error: "EMPTY_FILE" };

  const columns = detectColumns(nonEmpty[0]);
  const missing = REQUIRED_FIELDS.filter((f) => columns[f] === undefined);
  if (missing.length > 0) return { ok: false, error: "MISSING_COLUMNS", missing };

  const seenEmails = new Set<string>();
  const seenPhones = new Set<string>();
  const parsed: ParsedTherapistRow[] = [];

  // rows[0] הוא הכותרת; מספר השורה בקובץ מתבסס על האינדקס המקורי (כולל
  // שורות ריקות שדילגנו עליהן) כדי שהמנהל/ת ימצא/תמצא את השורה ב-Excel.
  rows.forEach((raw, idx) => {
    if (idx === 0 || !Array.isArray(raw) || !raw.some((c) => cellText(c) !== "")) return;
    if (parsed.length >= MAX_IMPORT_ROWS) return;

    const get = (f: ImportField) => (columns[f] === undefined ? "" : cellText(raw[columns[f]!]));
    const errors: ImportRowError[] = [];

    const full_name = get("full_name");
    if (!full_name) errors.push("NAME_REQUIRED");

    const phoneRaw = get("phone");
    const phone = phoneRaw ? toE164Israel(phoneRaw) : null;
    if (!phone) errors.push("PHONE_INVALID");

    const email = get("email").toLowerCase();
    if (!EMAIL_RE.test(email)) errors.push("EMAIL_INVALID");

    const hoursRaw = get("hours");
    const hours = hoursRaw === "" ? 0 : Number(hoursRaw.replace(",", "."));
    if (!Number.isFinite(hours) || hours < 0 || hours > 1000) errors.push("HOURS_INVALID");

    const profession = get("profession") || null;

    if (errors.length === 0) {
      if (seenEmails.has(email) || seenPhones.has(phone!)) errors.push("DUPLICATE_IN_FILE");
      seenEmails.add(email);
      seenPhones.add(phone!);
    }

    parsed.push({
      line: idx + 1,
      full_name,
      phone: phone ?? phoneRaw,
      email,
      hours: Number.isFinite(hours) ? hours : 0,
      profession,
      errors,
    });
  });

  return { ok: true, rows: parsed, validCount: parsed.filter((r) => r.errors.length === 0).length };
}

// CSV קטן (Excel "שמירה בשם CSV UTF-8", Google Sheets "הורדה כ-CSV"):
// מטפל ב-BOM, מרכאות כפולות (כולל "" בתוך שדה), פסיק או נקודה-פסיק
// כמפריד (Excel בעברית/אירופה שומר לפעמים עם ;), ו-\r\n.
export function parseCsv(text: string): string[][] {
  const src = text.replace(/^﻿/, "");
  const firstLine = src.split(/\r?\n/, 1)[0] ?? "";
  const delimiter = (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ";" : ",";

  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
    } else if (ch === delimiter) {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += ch;
    }
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

// תבנית להורדה — UTF-8 עם BOM כדי ש-Excel יפתח עברית נכון.
export const TEMPLATE_HEADERS = ["שם מלא", "טלפון", "מייל", "שעות", "מקצוע"] as const;
export const TEMPLATE_EXAMPLE_ROWS = [
  ["דנה כהן", "052-1234567", "dana@example.com", "10", "פסיכולוגית"],
  ["יוסי לוי", "0541234567", "yossi@example.com", "", "מטפל זוגי"],
];

export function buildTemplateCsv(): string {
  const lines = [TEMPLATE_HEADERS.join(","), ...TEMPLATE_EXAMPLE_ROWS.map((r) => r.join(","))];
  return "﻿" + lines.join("\r\n") + "\r\n";
}
