import { NextResponse } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { withCronAlert } from "./guard";

// בקרת אבטחה, לא נוחות: ה-cron routes רצים עם service role וכותבים על פני
// כל הקליניקות. הבדיקות כאן נועלות את ההתנהגות כדי שהאימות לא ייעלם בטעות
// בעתיד (לפני התיקון ה-endpoints היו פתוחים לגמרי לאינטרנט).
const OK = () => Promise.resolve(NextResponse.json({ ok: true }));

function requestWith(authorization?: string) {
  return new Request("https://example.com/api/cron/x", {
    headers: authorization ? { authorization } : {},
  });
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("withCronAlert — אימות", () => {
  it("מחזיר 503 כש-CRON_SECRET לא מוגדר (fail closed)", async () => {
    vi.stubEnv("CRON_SECRET", "");
    const res = await withCronAlert("test", OK)(requestWith("Bearer whatever"));
    expect(res.status).toBe(503);
  });

  it("מחזיר 401 בלי כותרת Authorization", async () => {
    vi.stubEnv("CRON_SECRET", "s3cret");
    const res = await withCronAlert("test", OK)(requestWith());
    expect(res.status).toBe(401);
  });

  it.each([
    ["סוד שגוי", "Bearer wrong"],
    ["בלי הקידומת Bearer", "s3cret"],
    ["סכימה אחרת", "Basic s3cret"],
    ["סוד נכון עם תוספת", "Bearer s3cretX"],
  ])("מחזיר 401 — %s", async (_label, header) => {
    vi.stubEnv("CRON_SECRET", "s3cret");
    const res = await withCronAlert("test", OK)(requestWith(header));
    expect(res.status).toBe(401);
  });

  it("מריץ את ה-handler עם הסוד הנכון", async () => {
    vi.stubEnv("CRON_SECRET", "s3cret");
    const handler = vi.fn(OK);
    const res = await withCronAlert("test", handler)(requestWith("Bearer s3cret"));
    expect(res.status).toBe(200);
    expect(handler).toHaveBeenCalledOnce();
  });

  it("לא מריץ את ה-handler בכלל כשהאימות נכשל", async () => {
    vi.stubEnv("CRON_SECRET", "s3cret");
    const handler = vi.fn(OK);
    await withCronAlert("test", handler)(requestWith("Bearer wrong"));
    expect(handler).not.toHaveBeenCalled();
  });
});
