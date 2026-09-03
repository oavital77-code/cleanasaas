import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { withCronAlert } from "@/lib/cron/guard";

// 09:00 — תזכורות 24 שעות + יתרה נמוכה + חידוש ססיה קרב (7 ימים מראש), כל
// הקליניקות. TODO: שליחת המייל בפועל ממתינה ל-lib/email (עדיין לא הועבר
// לריפו הזה — ר' PROGRESS.md). כרגע: מזהה מי צריך תזכורת ומסמן
// *_notified_at כדי שלא יישלח כפול ברגע שהמייל יחובר, בלי לשלוח בפועל.
export const GET = withCronAlert("send-reminders", async () => {
  const supabase = createAdminClient();
  const now = new Date();
  const in24h = new Date(now.getTime() + 24 * 60 * 60_000).toISOString();
  const in7days = new Date(now.getTime() + 7 * 24 * 60 * 60_000).toISOString();

  const { data: upcomingBookings } = await supabase
    .from("bookings")
    .select("id")
    .eq("status", "confirmed")
    .is("reminder_sent_at", null)
    .lte("starts_at", in24h)
    .gt("starts_at", now.toISOString());

  if (upcomingBookings && upcomingBookings.length > 0) {
    await supabase
      .from("bookings")
      .update({ reminder_sent_at: now.toISOString() })
      .in(
        "id",
        upcomingBookings.map((b) => b.id),
      );
  }

  const { data: lowBalanceCards } = await supabase
    .from("punch_cards")
    .select("id")
    .eq("active", true)
    .lte("hours_remaining", 2)
    .is("low_balance_notified_at", null);

  if (lowBalanceCards && lowBalanceCards.length > 0) {
    await supabase
      .from("punch_cards")
      .update({ low_balance_notified_at: now.toISOString() })
      .in(
        "id",
        lowBalanceCards.map((c) => c.id),
      );
  }

  const { data: renewingSubs } = await supabase
    .from("session_subscriptions")
    .select("id")
    .eq("status", "active")
    .is("renewal_reminder_sent_at", null)
    .lte("next_billing_date", in7days.slice(0, 10));

  if (renewingSubs && renewingSubs.length > 0) {
    await supabase
      .from("session_subscriptions")
      .update({ renewal_reminder_sent_at: now.toISOString() })
      .in(
        "id",
        renewingSubs.map((s) => s.id),
      );
  }

  return NextResponse.json({
    ok: true,
    upcomingBookings: upcomingBookings?.length ?? 0,
    lowBalanceCards: lowBalanceCards?.length ?? 0,
    renewingSubscriptions: renewingSubs?.length ?? 0,
    note: "email sending not yet wired — see PROGRESS.md",
  });
});
