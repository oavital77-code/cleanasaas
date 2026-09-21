import { describe, expect, it, vi } from "vitest";
import { pageAll } from "./page-all";

/** מדמה טבלה עם n שורות ואת סמנטיקת ה-range של PostgREST (כולל to). */
function table(n: number) {
  const rows = Array.from({ length: n }, (_, i) => ({ i }));
  return vi.fn(async (from: number, to: number) => ({ data: rows.slice(from, to + 1), error: null }));
}

describe("pageAll", () => {
  it("brings back everything past a single page", async () => {
    const query = table(25);
    const result = await pageAll(query, { pageSize: 10 });
    expect(result).toEqual({ ok: true, rows: Array.from({ length: 25 }, (_, i) => ({ i })) });
    expect(query).toHaveBeenCalledTimes(3);
  });

  it("stops after one call when the first page is already partial", async () => {
    const query = table(4);
    const result = await pageAll(query, { pageSize: 10 });
    expect(result.ok && result.rows).toHaveLength(4);
    expect(query).toHaveBeenCalledTimes(1);
  });

  it("asks once more when the row count lands exactly on a page boundary", async () => {
    const query = table(20);
    const result = await pageAll(query, { pageSize: 10 });
    expect(result.ok && result.rows).toHaveLength(20);
    expect(query).toHaveBeenCalledTimes(3);
  });

  it("handles an empty table", async () => {
    const result = await pageAll(table(0), { pageSize: 10 });
    expect(result).toEqual({ ok: true, rows: [] });
  });

  it("fails loudly rather than returning a silently short list", async () => {
    const result = await pageAll(table(1000), { pageSize: 10, maxPages: 3 });
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.reason).toContain("30");
  });

  it("passes a query error straight back", async () => {
    const result = await pageAll(async () => ({ data: null, error: { message: "permission denied" } }));
    expect(result).toEqual({ ok: false, reason: "permission denied" });
  });
});
