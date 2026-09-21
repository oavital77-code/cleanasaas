import { describe, expect, it } from "vitest";
import { mapWithConcurrency } from "./concurrency";

const tick = () => new Promise((r) => setTimeout(r, 1));

describe("mapWithConcurrency", () => {
  it("keeps results in the order of the input, not of completion", async () => {
    const out = await mapWithConcurrency([30, 1, 20, 2], 2, async (ms) => {
      await new Promise((r) => setTimeout(r, ms));
      return ms;
    });
    expect(out).toEqual([30, 1, 20, 2]);
  });

  it("never runs more than the limit at once", async () => {
    let running = 0;
    let peak = 0;
    await mapWithConcurrency(Array.from({ length: 20 }, (_, i) => i), 4, async () => {
      running++;
      peak = Math.max(peak, running);
      await tick();
      running--;
    });
    expect(peak).toBe(4);
  });

  it("handles an empty list and a limit larger than the list", async () => {
    expect(await mapWithConcurrency([], 5, async () => 1)).toEqual([]);
    expect(await mapWithConcurrency([1, 2], 99, async (n) => n * 2)).toEqual([2, 4]);
  });

  it("passes the index through", async () => {
    expect(await mapWithConcurrency(["a", "b", "c"], 2, async (v, i) => `${i}${v}`)).toEqual(["0a", "1b", "2c"]);
  });

  it("rejects if a task rejects, without leaving work unstarted", async () => {
    const started: number[] = [];
    await expect(
      mapWithConcurrency([1, 2, 3], 1, async (n) => {
        started.push(n);
        if (n === 2) throw new Error("boom");
        return n;
      }),
    ).rejects.toThrow("boom");
    expect(started).not.toContain(3);
  });
});
