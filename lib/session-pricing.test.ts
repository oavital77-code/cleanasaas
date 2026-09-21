import { describe, expect, it } from "vitest";
import { parseSessionPricing } from "./session-pricing";

describe("parseSessionPricing", () => {
  it("accepts the values the form offers", () => {
    expect(parseSessionPricing({ baseHours: "5", basePrice: "600" })).toEqual({ ok: true, value: { baseHours: 5, basePrice: 600 } });
    expect(parseSessionPricing({ baseHours: "1", basePrice: "0" })).toEqual({ ok: true, value: { baseHours: 1, basePrice: 0 } });
  });

  // 🔴 בלי הבדיקות האלה Number(...) החזיר NaN/שלילי והם נכתבו כמחיר בפועל.
  it("refuses a price that is not a number", () => {
    expect(parseSessionPricing({ baseHours: "5", basePrice: "abc" }).ok).toBe(false);
    expect(parseSessionPricing({ baseHours: "5", basePrice: "" }).ok).toBe(false);
    expect(parseSessionPricing({ baseHours: "5", basePrice: null }).ok).toBe(false);
  });

  it("refuses a negative price and negative or zero hours", () => {
    expect(parseSessionPricing({ baseHours: "5", basePrice: "-100" }).ok).toBe(false);
    expect(parseSessionPricing({ baseHours: "-1", basePrice: "600" }).ok).toBe(false);
    expect(parseSessionPricing({ baseHours: "0", basePrice: "600" }).ok).toBe(false);
  });

  it("refuses fractional hours and absurd magnitudes", () => {
    expect(parseSessionPricing({ baseHours: "5.5", basePrice: "600" }).ok).toBe(false);
    expect(parseSessionPricing({ baseHours: "5", basePrice: "1e400" }).ok).toBe(false);
    expect(parseSessionPricing({ baseHours: "100000", basePrice: "600" }).ok).toBe(false);
  });

  it("accepts a price with agorot", () => {
    expect(parseSessionPricing({ baseHours: "5", basePrice: "599.9" })).toEqual({ ok: true, value: { baseHours: 5, basePrice: 599.9 } });
  });
});
