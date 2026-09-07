import { describe, expect, it } from "vitest";
import { isWhatsAppProvider, renderReminderTemplate } from "./index";

describe("renderReminderTemplate", () => {
  it("ממלא את כל המשתנים", () => {
    const out = renderReminderTemplate("שלום {name}, {date} בשעה {time}, {room} ({branch}) — {clinic}", {
      name: "דנה",
      date: "08/09/2026",
      time: "10:00",
      room: "חדר 3",
      branch: "תל אביב",
      clinic: "בקליניקה",
    });
    expect(out).toBe("שלום דנה, 08/09/2026 בשעה 10:00, חדר 3 (תל אביב) — בקליניקה");
  });

  it("משאיר placeholders לא מוכרים כמו שהם ולא נשבר על חזרות", () => {
    const out = renderReminderTemplate("{name} {name} {unknown}", {
      name: "א",
      date: "",
      time: "",
      room: "",
      branch: "",
      clinic: "",
    });
    expect(out).toBe("א א {unknown}");
  });
});

describe("isWhatsAppProvider", () => {
  it("מקבל רק את שני הספקים הנתמכים", () => {
    expect(isWhatsAppProvider("green_api")).toBe(true);
    expect(isWhatsAppProvider("whapi")).toBe(true);
    expect(isWhatsAppProvider("meta")).toBe(false);
  });
});
