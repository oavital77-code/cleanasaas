import { describe, expect, it } from "vitest";
import { platformPlanPriceIls, PLATFORM_PLAN_DEFAULT_PRICE_ILS } from "./platform-billing";

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
