import { describe, expect, it } from "vitest";
import { platformPlanPriceIls, clinicIdFromMoreInfo, CHECKOUT_REFERENCE, PLATFORM_PLAN_DEFAULT_PRICE_ILS } from "./platform-billing";

describe("platformPlanPriceIls", () => {
  it("defaults to the decided price", () => {
    expect(platformPlanPriceIls({})).toBe(209);
    expect(PLATFORM_PLAN_DEFAULT_PRICE_ILS).toBe(209);
  });
  it("lets the environment override it, and ignores garbage", () => {
    expect(platformPlanPriceIls({ PLATFORM_PLAN_PRICE_ILS: "249.9" })).toBe(249.9);
    expect(platformPlanPriceIls({ PLATFORM_PLAN_PRICE_ILS: "abc" })).toBe(209);
    expect(platformPlanPriceIls({ PLATFORM_PLAN_PRICE_ILS: "-5" })).toBe(209);
  });
});

describe("clinicIdFromMoreInfo", () => {
  it("refuses the checkout label PayPlus actually echoes back", () => {
    // 🔴 זה מה שה-callback העביר כ-clinicId: תווית, לא מזהה.
    expect(clinicIdFromMoreInfo(CHECKOUT_REFERENCE)).toBeNull();
    expect(clinicIdFromMoreInfo("Cleana monthly renewal")).toBeNull();
  });

  it("passes a real clinic id through", () => {
    const id = "3f0b6c1e-1f2a-4c3d-9e8f-0a1b2c3d4e5f";
    expect(clinicIdFromMoreInfo(id)).toBe(id);
    expect(clinicIdFromMoreInfo(id.toUpperCase())).toBe(id.toUpperCase());
  });

  it("treats nothing at all as nothing", () => {
    expect(clinicIdFromMoreInfo(null)).toBeNull();
    expect(clinicIdFromMoreInfo(undefined)).toBeNull();
    expect(clinicIdFromMoreInfo("  ")).toBeNull();
  });
});
