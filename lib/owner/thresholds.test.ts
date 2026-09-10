import { describe, expect, it } from "vitest";
import { ladder, THRESHOLDS } from "./thresholds";

describe("purchase ladder", () => {
  it("is sorted by the user count it triggers at", () => {
    const ats = THRESHOLDS.map((t) => t.at);
    expect(ats).toEqual([...ats].sort((a, b) => a - b));
  });

  it("splits what is due from what is next, and sums the due monthly cost", () => {
    const zero = ladder(0);
    expect(zero.due).toEqual([]);
    expect(zero.next?.at).toBe(1);
    expect(zero.monthlyDueUsd).toBe(0);

    const twenty = ladder(20);
    expect(twenty.due.map((t) => t.service)).toEqual(["Supabase", "Resend", "Vercel"]);
    expect(twenty.next?.at).toBe(50);
    expect(twenty.monthlyDueUsd).toBe(65);

    const hundred = ladder(100);
    expect(hundred.due.length).toBe(7);
    expect(hundred.next?.at).toBe(250);
  });
});
