import { describe, expect, it } from "vitest";
import { buildTemplateCsv, detectColumns, parseCsv, parseTherapistRows } from "./therapists";

describe("detectColumns", () => {
  it("מזהה כותרות בעברית ובאנגלית, בכל סדר, עם רווחים/BOM", () => {
    expect(detectColumns(["﻿אימייל ", "Phone Number", "שם מלא", "שעות", "מקצוע"])).toEqual({
      email: 0,
      phone: 1,
      full_name: 2,
      hours: 3,
      profession: 4,
    });
  });

  it("לוקח את העמודה הראשונה כשיש כפילות ומתעלם מכותרות לא מוכרות", () => {
    expect(detectColumns(["name", "שם", "הערות"])).toEqual({ full_name: 0 });
  });
});

describe("parseTherapistRows", () => {
  it("מנרמל טלפון ל-E.164 (גם מספר Excel בלי אפס מוביל), אימייל ל-lowercase, שעות ריקות = 0", () => {
    const res = parseTherapistRows([
      ["שם מלא", "טלפון", "אימייל", "שעות"],
      ["דנה", 525550123, "Dana@Example.com", ""],
      ["יוסי", "052-111-2222", "yossi@example.com", "12.5"],
    ]);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.validCount).toBe(2);
    expect(res.rows[0]).toMatchObject({ line: 2, phone: "+972525550123", email: "dana@example.com", hours: 0, errors: [] });
    expect(res.rows[1]).toMatchObject({ line: 3, phone: "+972521112222", hours: 12.5 });
  });

  it("מסמן שגיאות פר שורה בלי להפיל את השאר, כולל כפילות בתוך הקובץ", () => {
    const res = parseTherapistRows([
      ["name", "phone", "email", "hours"],
      ["", "0521234567", "a@example.com", "5"],
      ["ב", "12345", "not-an-email", "-1"],
      ["ג", "0521234568", "c@example.com", ""],
      ["ד", "0521234568", "d@example.com", ""],
    ]);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.rows[0].errors).toEqual(["NAME_REQUIRED"]);
    expect(res.rows[1].errors).toEqual(["PHONE_INVALID", "EMAIL_INVALID", "HOURS_INVALID"]);
    expect(res.rows[2].errors).toEqual([]);
    expect(res.rows[3].errors).toEqual(["DUPLICATE_IN_FILE"]);
    expect(res.validCount).toBe(1);
  });

  it("מחזיר MISSING_COLUMNS כשחסרה עמודת חובה, ו-EMPTY_FILE על קובץ ריק", () => {
    expect(parseTherapistRows([["שם", "שעות"], ["א", "1"]])).toEqual({ ok: false, error: "MISSING_COLUMNS", missing: ["phone", "email"] });
    expect(parseTherapistRows([[], [null, ""]])).toEqual({ ok: false, error: "EMPTY_FILE" });
  });

  it("מדלג על שורות ריקות ושומר את מספר השורה המקורי בקובץ", () => {
    const res = parseTherapistRows([["שם", "טלפון", "אימייל"], ["", "", ""], ["א", "0521234567", "a@example.com"]]);
    expect(res.ok && res.rows[0].line).toBe(3);
  });
});

describe("parseCsv", () => {
  it("מטפל ב-BOM, מרכאות עם פסיקים ומרכאות כפולות, ו-CRLF", () => {
    const rows = parseCsv('﻿שם,טלפון\r\n"כהן, דנה","052-1234567"\r\n"א ""ב""",x\r\n');
    expect(rows).toEqual([
      ["שם", "טלפון"],
      ["כהן, דנה", "052-1234567"],
      ['א "ב"', "x"],
    ]);
  });

  it("מזהה נקודה-פסיק כמפריד (Excel בעברית)", () => {
    expect(parseCsv("שם;טלפון\nא;052")).toEqual([
      ["שם", "טלפון"],
      ["א", "052"],
    ]);
  });
});

describe("buildTemplateCsv", () => {
  it("התבנית נפתחת חזרה בפרסר שלנו ומזוהה במלואה", () => {
    const rows = parseCsv(buildTemplateCsv());
    const res = parseTherapistRows(rows);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.validCount).toBe(2);
    expect(res.rows[0].profession).toBe("פסיכולוגית");
  });
});
