import { describe, expect, it } from "vitest";
import { toCsv } from "./csv";

describe("toCsv", () => {
  it("starts with a BOM so Excel reads Hebrew as UTF-8, and uses CRLF", () => {
    const csv = toCsv(["שם", "סכום"], [["נועה לוי", 708]]);
    expect(csv.startsWith("﻿")).toBe(true);
    expect(csv).toBe("﻿שם,סכום\r\nנועה לוי,708\r\n");
  });

  it("quotes cells with commas, quotes or line breaks", () => {
    const csv = toCsv(["a"], [['לוי, נועה'], ['אמר "שלום"'], ["שורה\nשנייה"]]);
    expect(csv).toContain('"לוי, נועה"');
    expect(csv).toContain('"אמר ""שלום"""');
    expect(csv).toContain('"שורה\nשנייה"');
  });

  // 🔴 שם מטפל/ת הוא טקסט חופשי. תא שמתחיל ב-= נפתח ב-Excel כנוסחה.
  it("neutralises text that Excel would run as a formula", () => {
    const csv = toCsv(["name"], [["=HYPERLINK(\"http://x\")"], ["+1"], ["-cmd"], ["@SUM(A1)"]]);
    expect(csv).not.toMatch(/\r\n=|\r\n\+|\r\n-|\r\n@/);
    expect(csv).toContain("'=HYPERLINK");
  });

  it("leaves real numbers alone, negative ones included, and blanks empty cells", () => {
    expect(toCsv(["n"], [[-5], [3.5], [null], [undefined]])).toBe("﻿n\r\n-5\r\n3.5\r\n\r\n\r\n");
  });
});
