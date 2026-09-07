import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { withCronAlert } from "@/lib/cron/guard";
import { sendEmail } from "@/lib/email/resend";
import { bookingReminderEmail, lowBalanceEmail, cardExpiringEmail, sessionRenewalReminderEmail } from "@/lib/email/templates";
import { getAdminEmails } from "@/lib/email/recipients";
import { accessWindow } from "@/lib/time";
import { sendWhatsAppReminders } from "@/lib/whatsapp/reminders";

// 09:00 — תזכורות 24 שעות (מייל + WhatsApp לקליניקות שהפעילו) + יתרה נמוכה
// + כרטיסייה פגה + חידוש ססיה קרב (7 ימים מראש, למטפל/ת ולאדמיני הקליניקה
// שלו/ה), כל הקליניקות. כל התראה מסומנת עם *_sent_at/*_notified_at כדי
// שלא תישלח שוב בכל ריצה.
export const GET = withCronAlert("send-reminders", async () => {
  const supabase = createAdminClient();
  const now = new Date();
  const in24h = new Date(now.getTime() + 24 * 60 * 60_000).toISOString();
  const in7days = new Date(now.getTime() + 7 * 24 * 60 * 60_000).toISOString().slice(0, 10);
  const today = now.toISOString().slice(0, 10);

  let reminders = 0;
  let lowBalance = 0;
  let expiring = 0;
  let sessionReminders = 0;

  // תזכורות 24 שעות
  const { data: upcomingBookings } = await supabase
    .from("bookings")
    .select("id, user_id, room_id, starts_at, ends_at")
    .eq("status", "confirmed")
    .is("reminder_sent_at", null)
    .lte("starts_at", in24h)
    .gt("starts_at", now.toISOString());

  for (const b of upcomingBookings ?? []) {
    const [{ data: profile }, { data: room }] = await Promise.all([
      supabase.from("profiles").select("email").eq("id", b.user_id).maybeSingle(),
      supabase.from("rooms").select("name, branch_id").eq("id", b.room_id).maybeSingle(),
    ]);
    if (!profile || !room) continue;
    const { data: branch } = await supabase.from("branches").select("name").eq("id", room.branch_id).maybeSingle();

    const { accessStart } = accessWindow(new Date(b.starts_at), new Date(b.ends_at));
    const { subject, html } = bookingReminderEmail({
      roomName: room.name,
      branchName: branch?.name ?? "",
      startsAt: new Date(b.starts_at),
      accessStart,
    });
    const result = await sendEmail({ to: profile.email, subject, html });
    if (result.ok) {
      await supabase.from("bookings").update({ reminder_sent_at: now.toISOString() }).eq("id", b.id);
      reminders++;
    }
  }

  // יתרה נמוכה (<= 2 שעות)
  const { data: lowBalanceCards } = await supabase
    .from("punch_cards")
    .select("id, user_id, hours_remaining")
    .eq("active", true)
    .is("low_balance_notified_at", null)
    .lte("hours_remaining", 2)
    .gt("expires_at", now.toISOString());

  for (const card of lowBalanceCards ?? []) {
    const { data: profile } = await supabase.from("profiles").select("email").eq("id", card.user_id).maybeSingle();
    if (!profile) continue;
    const { subject, html } = lowBalanceEmail(card.hours_remaining);
    const result = await sendEmail({ to: profile.email, subject, html });
    if (result.ok) {
      await supabase.from("punch_cards").update({ low_balance_notified_at: now.toISOString() }).eq("id", card.id);
      lowBalance++;
    }
  }

  // כרטיסייה פגה תוך 30 יום
  const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60_000).toISOString();
  const { data: expiringCards } = await supabase
    .from("punch_cards")
    .select("id, user_id, hours_remaining, expires_at")
    .eq("active", true)
    .is("expiry_notified_at", null)
    .lte("expires_at", in30Days)
    .gt("expires_at", now.toISOString());

  for (const card of expiringCards ?? []) {
    const { data: profile } = await supabase.from("profiles").select("email").eq("id", card.user_id).maybeSingle();
    if (!profile) continue;
    const { subject, html } = cardExpiringEmail(new Date(card.expires_at), card.hours_remaining);
    const result = await sendEmail({ to: profile.email, subject, html });
    if (result.ok) {
      await supabase.from("punch_cards").update({ expiry_notified_at: now.toISOString() }).eq("id", card.id);
      expiring++;
    }
  }

  // תזכורת חידוש ססיה — 7 ימים לפני next_billing_date, למטפל/ת ולאדמיני הקליניקה שלו/ה
  const { data: renewingSubs } = await supabase
    .from("session_subscriptions")
    .select("id, clinic_id, user_id, weekly_hours, next_billing_date")
    .eq("status", "active")
    .is("renewal_reminder_sent_at", null)
    .not("next_billing_date", "is", null)
    .lte("next_billing_date", in7days)
    .gte("next_billing_date", today);

  for (const sub of renewingSubs ?? []) {
    if (!sub.next_billing_date) continue;
    const { data: profile } = await supabase.from("profiles").select("full_name, email").eq("id", sub.user_id).maybeSingle();
    if (!profile) continue;

    const nextBillingDate = new Date(sub.next_billing_date);
    const therapistEmail = sessionRenewalReminderEmail({
      therapistName: profile.full_name,
      weeklyHours: sub.weekly_hours,
      nextBillingDate,
      forAdmin: false,
    });
    const adminEmails = await getAdminEmails(supabase, sub.clinic_id);
    const adminEmailContent = sessionRenewalReminderEmail({
      therapistName: profile.full_name,
      weeklyHours: sub.weekly_hours,
      nextBillingDate,
      forAdmin: true,
    });

    const results = await Promise.all([
      sendEmail({ to: profile.email, subject: therapistEmail.subject, html: therapistEmail.html }),
      adminEmails.length > 0
        ? sendEmail({ to: adminEmails, subject: adminEmailContent.subject, html: adminEmailContent.html })
        : Promise.resolve({ ok: true as const }),
    ]);

    if (results.every((r) => r.ok)) {
      await supabase.from("session_subscriptions").update({ renewal_reminder_sent_at: now.toISOString() }).eq("id", sub.id);
      sessionReminders++;
    }
  }

  // WhatsApp — ערוץ נפרד עם סימון נפרד (bookings.whatsapp_reminder_sent_at),
  // רק לקליניקות עם clinic_whatsapp_settings.enabled. ר' lib/whatsapp/reminders.ts.
  const whatsapp = await sendWhatsAppReminders(supabase, now);

  return NextResponse.json({ ok: true, reminders, lowBalance, expiring, sessionReminders, whatsapp });
});
