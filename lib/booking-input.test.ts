import { describe, expect, it } from "vitest";
import { parseBookingInput } from "./booking-input";

const good = { roomId: "3f0b6c1e-1f2a-4c3d-9e8f-0a1b2c3d4e5f", date: "2026-04-20", startTime: "09:00", durationHours: "1" };

describe("parseBookingInput", () => {
  it("accepts a well-formed booking", () => {
    const result = parseBookingInput(good);
    expect(result).toEqual({
      ok: true,
      value: { roomId: good.roomId, date: "2026-04-20", startTime: "09:00", durationHours: 1 },
    });
  });

  it("reports a missing field rather than an invalid one", () => {
    for (const key of ["roomId", "date", "startTime"] as const) {
      expect(parseBookingInput({ ...good, [key]: "" })).toEqual({ ok: false, reason: "missing" });
    }
  });

  // אלה בדיוק ארבעת הקלטים ש-createBookingAction זרק עליהם RangeError.
  it("rejects a non-numeric duration instead of producing NaN", () => {
    expect(parseBookingInput({ ...good, durationHours: "abc" })).toEqual({ ok: false, reason: "invalid" });
  });

  it("rejects a date that is not a real calendar day", () => {
    expect(parseBookingInput({ ...good, date: "2026-13-45" })).toEqual({ ok: false, reason: "invalid" });
    expect(parseBookingInput({ ...good, date: "2026-02-30" })).toEqual({ ok: false, reason: "invalid" });
  });

  it("rejects an impossible time", () => {
    expect(parseBookingInput({ ...good, startTime: "99:99" })).toEqual({ ok: false, reason: "invalid" });
    expect(parseBookingInput({ ...good, startTime: "24:00" })).toEqual({ ok: false, reason: "invalid" });
  });

  it("rejects a duration that overflows the date arithmetic", () => {
    expect(parseBookingInput({ ...good, durationHours: "1e400" })).toEqual({ ok: false, reason: "invalid" });
    expect(parseBookingInput({ ...good, durationHours: "-1" })).toEqual({ ok: false, reason: "invalid" });
    expect(parseBookingInput({ ...good, durationHours: "0" })).toEqual({ ok: false, reason: "invalid" });
    expect(parseBookingInput({ ...good, durationHours: "99" })).toEqual({ ok: false, reason: "invalid" });
  });

  it("rejects a duration off the half-hour grid the form offers", () => {
    expect(parseBookingInput({ ...good, durationHours: "1.25" })).toEqual({ ok: false, reason: "invalid" });
    expect(parseBookingInput({ ...good, durationHours: "2.5" })).toEqual({ ok: true, value: expect.anything() });
  });

  it("rejects a room id that is not a uuid", () => {
    expect(parseBookingInput({ ...good, roomId: "not-a-uuid" })).toEqual({ ok: false, reason: "invalid" });
  });

  it("defaults a duration that was never sent, and drops seconds from the time", () => {
    expect(parseBookingInput({ ...good, durationHours: null })).toMatchObject({ ok: true });
    expect(parseBookingInput({ ...good, startTime: "09:30:00" })).toMatchObject({
      ok: true,
      value: { startTime: "09:30" },
    });
  });

  it("never throws, whatever the form sends", () => {
    const junk = ["", " ", "null", "undefined", "NaN", "Infinity", "0x10", "١٢", "9e9", "  1  "];
    for (const v of junk) {
      expect(() => parseBookingInput({ ...good, durationHours: v, startTime: v, date: v, roomId: v })).not.toThrow();
    }
  });
});
