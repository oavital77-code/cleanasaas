import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { withCronAlert } from "@/lib/cron/guard";
import { sendEmail } from "@/lib/email/resend";
import { bookingReminderEmail, lowBalanceEmail, cardExpiringEmail, sessionRenewalReminderEmail } from "@/lib/email/templates";
import { getAdminEmails } from "@/lib/email/recipients";
import { accessWindow, DEFAULT_TIMEZONE } from "@/lib/time";
import { mapWithConcurrency } from "@/lib/concurrency";
import { sendWhatsAppReminders } from "@/lib/whatsapp/reminders";

// 09:00 — תזכורות 24 שעות (מייל + WhatsApp לקליניקות שהפעילו) + יתרה נמוכה
// + כרטיסייה פגה + חידוש ססיה קרב (7 ימים מראש, למטפל/ת ולאדמיני הקליניקה
// שלו/ה), כל הקליניקות. כל התראה מסומנת עם *_sent_at/*_notified_at כדי
// שלא תישלח שוב בכל ריצה.
// המקסימום שכל תוכנית של Vercel מקבלת בלי לשבור את ה-build ב-Hobby; להעלות ב-Pro.
export const maxDuration = 60;

/**
 * תקרה לכל מקטע. בלי זה ריצה אחת מושכת כל שורה שעונה לתנאי ושולחת מייל לכל
 * אחת — ובשלב כלשהו היא חורגת מ-maxDuration ונקטעת באמצע, כך שהמקטעים
 * שאחריה (יתרה נמוכה, כרטיסייה פגה, חידוש ססיה) לא רצים כלל. עם תקרה,
 * ריצה אחת עושה עבודה חסומה, וכל מה שנשאר מחכה לריצה הבאה — הסימון
 * לכל שורה הוא שמבטיח שלא יישלח פעמיים.
 */
const BATCH = 250;

/** Resend חוסמת מבול; סדרתי חורג מהזמן. באמצע: כמה במקביל. */
const SEND_CONCURRENCY = 5;

const unique = (values: (string | null)[]): string[] => [...new Set(values.filter((v): v is string => !!v))];

function byId<T extends { id: string }>(rows: T[] | null): Map<string, T> {
  return new Map((rows ?? []).map((row) => [row.id, row]));
}

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
  const truncated: string[] = [];
  const cap = (name: string, rows: unknown[]) => {
    if (rows.length >= BATCH) truncated.push(name);
    return rows;
  };

  // תזכורות 24 שעות
  const { data: upcomingRows } = await supabase
    .from("bookings")
    .select("id, user_id, room_id, starts_at, ends_at")
    .eq("status", "confirmed")
    .is("reminder_sent_at", null)
    .lte("starts_at", in24h)
    .gt("starts_at", now.toISOString())
    .order("starts_at")
    .limit(BATCH);

  const upcomingBookings = upcomingRows ?? [];
  cap("reminders", upcomingBookings);
  if (upcomingBookings.length > 0) {
    // שלוש שאילתות לכל המקטע במקום שלוש לכל הזמנה.
    const [{ data: profileRows }, { data: roomRows }] = await Promise.all([
      supabase.from("profiles").select("id, email, locale").in("id", unique(upcomingBookings.map((b) => b.user_id))),
      supabase.from("rooms").select("id, name, branch_id, clinic_id").in("id", unique(upcomingBookings.map((b) => b.room_id))),
    ]);
    const profiles = byId(profileRows);
    const rooms = byId(roomRows);
    const roomList = [...rooms.values()];
    const branchIds = unique(roomList.map((r) => r.branch_id));
    const clinicIds = unique(roomList.map((r) => r.clinic_id));
    const [{ data: branchRows }, { data: clinicRows }] = await Promise.all([
      branchIds.length > 0
        ? supabase.from("branches").select("id, name").in("id", branchIds)
        : { data: [] as { id: string; name: string }[] },
      clinicIds.length > 0
        ? supabase.from("clinics").select("id, timezone").in("id", clinicIds)
        : { data: [] as { id: string; timezone: string }[] },
    ]);
    const branches = byId(branchRows);
    const clinics = byId(clinicRows);

    const sent = await mapWithConcurrency(upcomingBookings, SEND_CONCURRENCY, async (b) => {
      const profile = profiles.get(b.user_id);
      const room = rooms.get(b.room_id);
      if (!profile || !room) return false;

      const { accessStart } = accessWindow(new Date(b.starts_at), new Date(b.ends_at));
      const { subject, html } = bookingReminderEmail({
        roomName: room.name,
        branchName: branches.get(room.branch_id)?.name ?? "",
        startsAt: new Date(b.starts_at),
        accessStart,
        now,
        // שעון הקליניקה, לא של השרת — הוא שקובע אם ההזמנה היא "היום" או "מחר".
        timezone: clinics.get(room.clinic_id)?.timezone ?? DEFAULT_TIMEZONE,
        locale: profile.locale,
      });
      const result = await sendEmail({ to: profile.email, subject, html });
      if (!result.ok) return false;
      await supabase.from("bookings").update({ reminder_sent_at: now.toISOString() }).eq("id", b.id);
      return true;
    });
    reminders = sent.filter(Boolean).length;
  }

  // יתרה נמוכה (<= 2 שעות)
  const { data: lowBalanceRows } = await supabase
    .from("punch_cards")
    .select("id, user_id, hours_remaining")
    .eq("active", true)
    .is("low_balance_notified_at", null)
    .lte("hours_remaining", 2)
    .gt("expires_at", now.toISOString())
    .limit(BATCH);

  const lowBalanceCards = lowBalanceRows ?? [];
  cap("lowBalance", lowBalanceCards);
  if (lowBalanceCards.length > 0) {
    const { data: profileRows } = await supabase
      .from("profiles")
      .select("id, email, locale")
      .in("id", unique(lowBalanceCards.map((c) => c.user_id)));
    const profiles = byId(profileRows);

    const sent = await mapWithConcurrency(lowBalanceCards, SEND_CONCURRENCY, async (card) => {
      const profile = profiles.get(card.user_id);
      if (!profile) return false;
      const { subject, html } = lowBalanceEmail(card.hours_remaining, profile.locale);
      const result = await sendEmail({ to: profile.email, subject, html });
      if (!result.ok) return false;
      await supabase.from("punch_cards").update({ low_balance_notified_at: now.toISOString() }).eq("id", card.id);
      return true;
    });
    lowBalance = sent.filter(Boolean).length;
  }

  // כרטיסייה פגה תוך 30 יום
  const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60_000).toISOString();
  const { data: expiringRows } = await supabase
    .from("punch_cards")
    .select("id, user_id, hours_remaining, expires_at")
    .eq("active", true)
    .is("expiry_notified_at", null)
    .lte("expires_at", in30Days)
    .gt("expires_at", now.toISOString())
    .order("expires_at")
    .limit(BATCH);

  const expiringCards = expiringRows ?? [];
  cap("expiring", expiringCards);
  if (expiringCards.length > 0) {
    const { data: profileRows } = await supabase
      .from("profiles")
      .select("id, email, locale")
      .in("id", unique(expiringCards.map((c) => c.user_id)));
    const profiles = byId(profileRows);

    const sent = await mapWithConcurrency(expiringCards, SEND_CONCURRENCY, async (card) => {
      const profile = profiles.get(card.user_id);
      if (!profile) return false;
      const { subject, html } = cardExpiringEmail(new Date(card.expires_at), card.hours_remaining, profile.locale);
      const result = await sendEmail({ to: profile.email, subject, html });
      if (!result.ok) return false;
      await supabase.from("punch_cards").update({ expiry_notified_at: now.toISOString() }).eq("id", card.id);
      return true;
    });
    expiring = sent.filter(Boolean).length;
  }

  // תזכורת חידוש ססיה — 7 ימים לפני next_billing_date, למטפל/ת ולאדמיני הקליניקה שלו/ה
  const { data: renewingRows } = await supabase
    .from("session_subscriptions")
    .select("id, clinic_id, user_id, weekly_hours, next_billing_date")
    .eq("status", "active")
    .is("renewal_reminder_sent_at", null)
    .not("next_billing_date", "is", null)
    .lte("next_billing_date", in7days)
    .gte("next_billing_date", today)
    .order("next_billing_date")
    .limit(BATCH);

  const renewingSubs = renewingRows ?? [];
  cap("sessionReminders", renewingSubs);
  if (renewingSubs.length > 0) {
    const { data: profileRows } = await supabase
      .from("profiles")
      .select("id, full_name, email, locale")
      .in("id", unique(renewingSubs.map((s) => s.user_id)));
    const profiles = byId(profileRows);

    // אותה קליניקה חוזרת על פני מנויים — רשימת האדמינים שלה נטענת פעם אחת.
    const clinicAdmins = new Map(
      await Promise.all(
        unique(renewingSubs.map((s) => s.clinic_id)).map(
          async (clinicId) => [clinicId, await getAdminEmails(supabase, clinicId)] as const,
        ),
      ),
    );

    const sent = await mapWithConcurrency(renewingSubs, SEND_CONCURRENCY, async (sub) => {
      if (!sub.next_billing_date) return false;
      const profile = profiles.get(sub.user_id);
      if (!profile) return false;

      const nextBillingDate = new Date(sub.next_billing_date);
      const therapistEmail = sessionRenewalReminderEmail({
        therapistName: profile.full_name,
        weeklyHours: sub.weekly_hours,
        nextBillingDate,
        forAdmin: false,
        locale: profile.locale,
      });
      const adminEmails = clinicAdmins.get(sub.clinic_id) ?? [];
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
      if (!results.every((r) => r.ok)) return false;
      await supabase.from("session_subscriptions").update({ renewal_reminder_sent_at: now.toISOString() }).eq("id", sub.id);
      return true;
    });
    sessionReminders = sent.filter(Boolean).length;
  }

  // WhatsApp — ערוץ נפרד עם סימון נפרד (bookings.whatsapp_reminder_sent_at),
  // רק לקליניקות עם clinic_whatsapp_settings.enabled. ר' lib/whatsapp/reminders.ts.
  const whatsapp = await sendWhatsAppReminders(supabase, now);

  // מקטע שהגיע לתקרה סיים רק חלק מהעבודה; השאר מחכה לריצה הבאה, ומופיע
  // בלוג כדי שיהיה ברור שצריך להעלות תדירות/תקרה ולא לחכות ליום.
  if (truncated.length > 0) console.warn(`[cron:send-reminders] הגיע לתקרה (${BATCH}) במקטעים: ${truncated.join(", ")}`);

  return NextResponse.json({ ok: true, reminders, lowBalance, expiring, sessionReminders, whatsapp, truncated });
});
