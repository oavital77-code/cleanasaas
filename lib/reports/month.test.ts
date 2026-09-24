import { describe, expect, it } from "vitest";
import { reportMonth } from "./month";

const TZ = "Asia/Jerusalem";

describe("reportMonth", () => {
  it("defaults to the current month in the clinic's timezone", () => {
    // 30.9 23:30 UTC is already 1.10 in Jerusalem.
    const m = reportMonth(undefined, new Date("2026-09-30T23:30:00Z"), TZ);
    expect(m.key).toBe("2026-10");
  });

  it("starts and ends the month at local midnight, not UTC midnight", () => {
    const m = reportMonth("2026-09", new Date("2026-09-15T12:00:00Z"), TZ);
    // Jerusalem is UTC+3 in September: 1.9 00:00 local = 31.8 21:00 UTC.
    expect(m.startIso).toBe("2026-08-31T21:00:00.000Z");
    // 1.10 00:00 local, still summer time = 30.9 21:00 UTC.
    expect(m.endIso).toBe("2026-09-30T21:00:00.000Z");
  });

  it("links to the previous month, and to the next one only if it is not in the future", () => {
    const now = new Date("2026-09-15T12:00:00Z");
    expect(reportMonth("2026-09", now, TZ)).toMatchObject({ prevKey: "2026-08", nextKey: null });
    expect(reportMonth("2026-01", now, TZ)).toMatchObject({ prevKey: "2025-12", nextKey: "2026-02" });
  });

  it("ignores a malformed or future month and falls back to the current one", () => {
    const now = new Date("2026-09-15T12:00:00Z");
    expect(reportMonth("2026-13", now, TZ).key).toBe("2026-09");
    expect(reportMonth("junk", now, TZ).key).toBe("2026-09");
    expect(reportMonth("2027-01", now, TZ).key).toBe("2026-09");
  });
});
