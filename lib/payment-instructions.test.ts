import { describe, expect, it } from "vitest";
import { PAYMENT_INSTRUCTIONS_MAX, readPaymentInstructions, normalizePaymentInstructions } from "./payment-instructions";

describe("payment instructions", () => {
  it("reads the text stored in app_settings, and nothing else", () => {
    expect(readPaymentInstructions("ביט ל-050-1234567")).toBe("ביט ל-050-1234567");
    expect(readPaymentInstructions("   ")).toBeNull();
    expect(readPaymentInstructions(null)).toBeNull();
    expect(readPaymentInstructions(undefined)).toBeNull();
    expect(readPaymentInstructions(42)).toBeNull();
    expect(readPaymentInstructions({ text: "x" })).toBeNull();
  });

  it("normalises what the clinic types: trimmed, line endings kept, capped", () => {
    expect(normalizePaymentInstructions("  ביט\r\nאו העברה  ")).toBe("ביט\nאו העברה");
    expect(normalizePaymentInstructions(null)).toBe("");
    expect(normalizePaymentInstructions("א".repeat(PAYMENT_INSTRUCTIONS_MAX + 50))).toHaveLength(PAYMENT_INSTRUCTIONS_MAX);
  });
});
