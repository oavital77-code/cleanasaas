import { describe, expect, it } from "vitest";
import { parseLeadInput } from "./lead-input";

const good = { name: "  נועה לוי ", phone: "052-123-4567", email: " Noa@Clinic.co.il ", clinicName: "קליניקת המרכז", message: "מעוניינת לשמוע עוד", website: "" };

describe("parseLeadInput", () => {
  it("accepts a filled form and normalizes what it stores", () => {
    const result = parseLeadInput(good);
    expect(result).toEqual({
      ok: true,
      value: {
        name: "נועה לוי",
        phone: "+972521234567",
        email: "noa@clinic.co.il",
        clinicName: "קליניקת המרכז",
        message: "מעוניינת לשמוע עוד",
      },
    });
  });

  it("needs only a name and a phone", () => {
    const result = parseLeadInput({ name: "דן", phone: "0501234567", email: "", clinicName: "", message: "", website: "" });
    expect(result).toMatchObject({ ok: true, value: { email: null, clinicName: null, message: null } });
  });

  it("refuses a missing name or phone", () => {
    expect(parseLeadInput({ ...good, name: "  " })).toEqual({ ok: false, reason: "missing" });
    expect(parseLeadInput({ ...good, phone: "" })).toEqual({ ok: false, reason: "missing" });
  });

  it("refuses a phone that is not a real Israeli number", () => {
    expect(parseLeadInput({ ...good, phone: "12345" })).toEqual({ ok: false, reason: "phone" });
    expect(parseLeadInput({ ...good, phone: "לא טלפון" })).toEqual({ ok: false, reason: "phone" });
  });

  it("refuses an email that was typed but is not an address", () => {
    expect(parseLeadInput({ ...good, email: "noa@" })).toEqual({ ok: false, reason: "email" });
    expect(parseLeadInput({ ...good, email: "noa.clinic.co.il" })).toEqual({ ok: false, reason: "email" });
  });

  // שדה מלכודת: אדם לא רואה אותו ולכן לא ממלא אותו. בוט ממלא כל שדה.
  it("silently drops a submission that filled the honeypot", () => {
    expect(parseLeadInput({ ...good, website: "http://spam.example" })).toEqual({ ok: false, reason: "bot" });
  });

  it("trims very long input instead of storing a wall of text", () => {
    const result = parseLeadInput({ ...good, message: "א".repeat(5000) });
    expect(result.ok && result.value.message).toHaveLength(2000);
  });

  it("never throws, whatever the form sends", () => {
    for (const v of [null, undefined, 123, {}, []]) {
      expect(() => parseLeadInput({ name: v, phone: v, email: v, clinicName: v, message: v, website: v })).not.toThrow();
    }
  });
});
