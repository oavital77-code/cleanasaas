import { describe, expect, it } from "vitest";
import { parseSessionPricing, readSessionPricing, sessionMonthlyPrice, hoursInRange } from "./session-pricing";

describe("readSessionPricing", () => {
  it("falls back to the old fixed settings exactly as the database does", () => {
    // כל קליניקה נזרעה ב-5 / 600 — ומתנהגת כמו קודם: 5–5 שעות ב-120.
    expect(readSessionPricing({ session_base_hours: 5, session_base_price: 600 })).toEqual({ minHours: 5, maxHours: 5, pricePerHour: 120 });
    expect(readSessionPricing({})).toEqual({ minHours: 5, maxHours: 5, pricePerHour: 120 });
  });

  it("prefers the range once the clinic has saved one", () => {
    expect(
      readSessionPricing({
        session_base_hours: 5,
        session_base_price: 600,
        session_min_hours: 3,
        session_max_hours: 10,
        session_price_per_hour: 110,
      }),
    ).toEqual({ minHours: 3, maxHours: 10, pricePerHour: 110 });
  });
});

describe("parseSessionPricing", () => {
  it("accepts a range and a price per weekly hour", () => {
    expect(parseSessionPricing({ minHours: "3", maxHours: "10", pricePerHour: "120" })).toEqual({
      ok: true,
      value: { minHours: 3, maxHours: 10, pricePerHour: 120 },
    });
    expect(parseSessionPricing({ minHours: "2.5", maxHours: "2.5", pricePerHour: "99.9" })).toMatchObject({ ok: true });
  });

  it("refuses a range that is upside down, empty, or off the half-hour grid", () => {
    expect(parseSessionPricing({ minHours: "10", maxHours: "3", pricePerHour: "120" }).ok).toBe(false);
    expect(parseSessionPricing({ minHours: "0", maxHours: "3", pricePerHour: "120" }).ok).toBe(false);
    expect(parseSessionPricing({ minHours: "3.25", maxHours: "5", pricePerHour: "120" }).ok).toBe(false);
    expect(parseSessionPricing({ minHours: "3", maxHours: "200", pricePerHour: "120" }).ok).toBe(false);
  });

  it("refuses a price that is not a non-negative number", () => {
    expect(parseSessionPricing({ minHours: "3", maxHours: "5", pricePerHour: "-1" }).ok).toBe(false);
    expect(parseSessionPricing({ minHours: "3", maxHours: "5", pricePerHour: "abc" }).ok).toBe(false);
    expect(parseSessionPricing({ minHours: "3", maxHours: "5", pricePerHour: "" }).ok).toBe(false);
  });
});

describe("sessionMonthlyPrice and hoursInRange", () => {
  it("prices hours × the rate, to the agora — the same sum the database stores", () => {
    expect(sessionMonthlyPrice(7, 120)).toBe(840);
    expect(sessionMonthlyPrice(3.5, 120)).toBe(420);
    expect(sessionMonthlyPrice(3, 33.333)).toBe(100);
  });

  it("allows both ends of the range", () => {
    const range = { minHours: 3, maxHours: 10, pricePerHour: 120 };
    expect(hoursInRange(3, range)).toBe(true);
    expect(hoursInRange(10, range)).toBe(true);
    expect(hoursInRange(2.5, range)).toBe(false);
    expect(hoursInRange(10.5, range)).toBe(false);
  });
});
