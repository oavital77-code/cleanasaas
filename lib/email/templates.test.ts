import { describe, expect, it } from "vitest";
import { bookingReminderEmail, sessionApprovedEmail } from "./templates";

const base = {
  roomName: "חדר 3",
  branchName: "סניף מרכז",
  timezone: "Asia/Jerusalem",
};

// 09:00 בירושלים ב-20/04/2026 — השעה שבה ה-cron היומי רץ.
const cronRun = new Date("2026-04-20T06:00:00Z");
const at = (iso: string) => new Date(iso);

describe("bookingReminderEmail", () => {
  it("does not call a booking half an hour away 'tomorrow'", () => {
    const { subject, html } = bookingReminderEmail({
      ...base,
      startsAt: at("2026-04-20T06:30:00Z"),
      accessStart: at("2026-04-20T06:25:00Z"),
      now: cronRun,
      locale: "he",
    });
    expect(subject).not.toContain("מחר");
    expect(html).not.toContain("מחר");
  });

  it("says today for a booking later the same day", () => {
    const { subject } = bookingReminderEmail({
      ...base,
      startsAt: at("2026-04-20T14:00:00Z"),
      accessStart: at("2026-04-20T13:55:00Z"),
      now: cronRun,
      locale: "he",
    });
    expect(subject).toContain("היום");
    expect(subject).not.toContain("מחר");
  });

  it("still says tomorrow when the booking really is tomorrow", () => {
    const { subject } = bookingReminderEmail({
      ...base,
      startsAt: at("2026-04-21T05:30:00Z"),
      accessStart: at("2026-04-21T05:25:00Z"),
      now: cronRun,
      locale: "he",
    });
    expect(subject).toContain("מחר");
  });

  it("phrases the English subject by the same distance", () => {
    const soon = bookingReminderEmail({
      ...base,
      startsAt: at("2026-04-20T06:30:00Z"),
      accessStart: at("2026-04-20T06:25:00Z"),
      now: cronRun,
      locale: "en",
    });
    const tomorrow = bookingReminderEmail({
      ...base,
      startsAt: at("2026-04-21T05:30:00Z"),
      accessStart: at("2026-04-21T05:25:00Z"),
      now: cronRun,
      locale: "en",
    });
    expect(soon.subject).not.toContain("tomorrow");
    expect(tomorrow.subject).toContain("tomorrow");
  });

  it("crosses midnight in the clinic's timezone, not the server's", () => {
    // 21:30 UTC ב-20/04 הוא 00:30 ב-21/04 בירושלים — כלומר מחר, לא היום.
    const { subject } = bookingReminderEmail({
      ...base,
      startsAt: at("2026-04-20T21:30:00Z"),
      accessStart: at("2026-04-20T21:25:00Z"),
      now: cronRun,
      locale: "he",
    });
    expect(subject).toContain("מחר");
  });
});

describe("sessionApprovedEmail", () => {
  it("tells the therapist to pay the clinic, with the clinic's own instructions", () => {
    const { subject, html } = sessionApprovedEmail({ instructions: "ביט ל-050-1234567", locale: "he" });
    expect(subject).toContain("אושרה");
    expect(html).toContain("ביט ל-050-1234567");
    expect(html).not.toContain("href");
  });

  it("still says how it works when the clinic has not written instructions", () => {
    const { html } = sessionApprovedEmail({ instructions: null, locale: "he" });
    expect(html).toContain("לקליניקה");
    expect(html).not.toContain("href");
  });

  it("escapes the clinic's text", () => {
    const { html } = sessionApprovedEmail({ instructions: "<script>x</script>", locale: "en" });
    expect(html).not.toContain("<script>");
  });
});
