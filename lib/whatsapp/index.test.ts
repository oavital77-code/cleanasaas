import { describe, expect, it } from "vitest";
import { buildWaMeLink, renderReminderTemplate, suggestedMetaTemplateBody, toWhatsAppDigits, REMINDER_TEMPLATE_PARAMS } from "./index";

const vars = { name: "דנה", clinic: "בקליניקה", date: "08/09/2026", time: "10:00", room: "חדר 3", branch: "תל אביב" };

describe("renderReminderTemplate", () => {
  it("ממלא את כל המשתנים", () => {
    const out = renderReminderTemplate("שלום {name}, {date} בשעה {time}, {room} ({branch}) — {clinic}", vars);
    expect(out).toBe("שלום דנה, 08/09/2026 בשעה 10:00, חדר 3 (תל אביב) — בקליניקה");
  });

  it("משאיר placeholders לא מוכרים כמו שהם ולא נשבר על חזרות", () => {
    expect(renderReminderTemplate("{name} {name} {unknown}", { ...vars, name: "א" })).toBe("א א {unknown}");
  });
});

describe("toWhatsAppDigits / buildWaMeLink", () => {
  it("מוריד + ותווים לא-ספרתיים", () => {
    expect(toWhatsAppDigits("+972-50-123 4567")).toBe("972501234567");
  });

  it("בונה קישור wa.me עם הטקסט מקודד", () => {
    const link = buildWaMeLink("+972501234567", "שלום דנה, 10:00");
    expect(link.startsWith("https://wa.me/972501234567?text=")).toBe(true);
    expect(decodeURIComponent(link.split("text=")[1])).toBe("שלום דנה, 10:00");
  });
});

describe("Meta template contract", () => {
  it("גוף התבנית המומלץ מכיל {{1}}…{{6}} — בדיוק כמספר הפרמטרים שנשלחים", () => {
    for (const lang of ["he", "en"] as const) {
      const body = suggestedMetaTemplateBody(lang);
      REMINDER_TEMPLATE_PARAMS.forEach((_, i) => expect(body).toContain(`{{${i + 1}}}`));
      expect(body).not.toContain(`{{${REMINDER_TEMPLATE_PARAMS.length + 1}}}`);
    }
  });
});
