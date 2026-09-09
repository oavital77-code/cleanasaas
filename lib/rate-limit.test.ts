import { describe, expect, it } from "vitest";

import { checkRateLimit, clientIp } from "./rate-limit";

describe("checkRateLimit", () => {
  it("allows up to the limit in a window, then refuses with a retry hint", () => {
    const now = new Date("2026-09-09T10:00:10Z");
    const opts = { scope: "t", identifier: "1.2.3.4", limit: 3, windowMs: 60_000, now };
    expect(checkRateLimit(opts)).toEqual({ ok: true });
    expect(checkRateLimit(opts)).toEqual({ ok: true });
    expect(checkRateLimit(opts)).toEqual({ ok: true });
    expect(checkRateLimit(opts)).toEqual({ ok: false, retryAfterSeconds: 50 });
  });

  it("starts over in the next window and keeps identifiers apart", () => {
    const now = new Date("2026-09-09T11:00:00Z");
    const a = { scope: "w", identifier: "a", limit: 1, windowMs: 60_000, now };
    expect(checkRateLimit(a)).toEqual({ ok: true });
    expect(checkRateLimit(a).ok).toBe(false);
    expect(checkRateLimit({ ...a, identifier: "b" })).toEqual({ ok: true });
    expect(checkRateLimit({ ...a, now: new Date("2026-09-09T11:01:00Z") })).toEqual({ ok: true });
  });
});

describe("clientIp", () => {
  it("takes the first forwarded hop, then x-real-ip, then unknown", () => {
    expect(clientIp(new Headers({ "x-forwarded-for": "9.9.9.9, 10.0.0.1" }))).toBe("9.9.9.9");
    expect(clientIp(new Headers({ "x-real-ip": "8.8.8.8" }))).toBe("8.8.8.8");
    expect(clientIp(new Headers())).toBe("unknown");
  });
});
