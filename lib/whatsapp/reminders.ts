import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { formatDateHe, formatTimeHe, DEFAULT_TIMEZONE } from "@/lib/time";
import { mapWithConcurrency } from "@/lib/concurrency";
import { sendWhatsAppReminderTemplate } from "./index";

// שלב ה-WhatsApp של cron התזכורות (app/api/cron/send-reminders) — Meta Cloud
// API. נפרד מהמייל: עמודת סימון משלו (bookings.whatsapp_reminder_sent_at),
// לולאה לכל קליניקה עם WhatsApp פעיל (hours_before per-clinic), ומכבד את
// profiles.whatsapp_reminders (opt-out של המטפל/ת).
//
// ה-cron יומי (Vercel Hobby) → בפועל "בבוקר, כל ההזמנות שמתחילות ב-hours_before
// השעות הבאות". אידמפוטנטי — גם מה שנשלח ידנית דרך /admin/reminders מסומן
// באותה עמודה ולא יישלח שוב.
//
// 🔴 רץ עם service role — חוצה קליניקות; כל query מסונן clinic_id.
/** כמו במקטעי המייל של אותו cron: עבודה חסומה לכל ריצה, והשאר לריצה הבאה. */
const BATCH = 250;
const SEND_CONCURRENCY = 5;

const unique = (values: (string | null)[]): string[] => [...new Set(values.filter((v): v is string => !!v))];

export async function sendWhatsAppReminders(
  supabase: SupabaseClient<Database>,
  now: Date,
): Promise<{ sent: number; failed: number; skippedOptOut: number }> {
  const totals = { sent: 0, failed: 0, skippedOptOut: 0 };

  const { data: enabledClinics } = await supabase.from("clinic_whatsapp_settings").select("clinic_id").eq("enabled", true);

  for (const row of enabledClinics ?? []) {
    try {
      const r = await sendForClinic(supabase, row.clinic_id, now);
      totals.sent += r.sent;
      totals.failed += r.failed;
      totals.skippedOptOut += r.skippedOptOut;
    } catch (err) {
      // קליניקה אחת לא מפילה את השאר.
      console.error(`[whatsapp-reminders] clinic ${row.clinic_id} failed`, err instanceof Error ? err.message : err);
    }
  }

  return totals;
}

async function sendForClinic(supabase: SupabaseClient<Database>, clinicId: string, now: Date) {
  const result = { sent: 0, failed: 0, skippedOptOut: 0 };
  const [{ data: credsRows }, { data: clinic }] = await Promise.all([
    supabase.rpc("get_clinic_whatsapp_credentials", { p_clinic_id: clinicId }),
    supabase.from("clinics").select("name, timezone").eq("id", clinicId).maybeSingle(),
  ]);
  const creds = credsRows?.[0];
  if (!creds?.enabled || !creds.access_token || !creds.phone_number_id || !creds.template_name || !clinic) return result;

  const timezone = clinic.timezone ?? DEFAULT_TIMEZONE;
  const windowEnd = new Date(now.getTime() + creds.hours_before * 60 * 60_000).toISOString();

  const { data: bookingRows } = await supabase
    .from("bookings")
    .select("id, user_id, room_id, starts_at")
    .eq("clinic_id", clinicId)
    .eq("status", "confirmed")
    .is("whatsapp_reminder_sent_at", null)
    .gt("starts_at", now.toISOString())
    .lte("starts_at", windowEnd)
    .order("starts_at")
    .limit(BATCH);

  const bookings = bookingRows ?? [];
  if (bookings.length === 0) return result;

  // שאילתה אחת לכל טבלה למקטע, לא אחת לכל הזמנה.
  const [{ data: profileRows }, { data: roomRows }] = await Promise.all([
    supabase.from("profiles").select("id, full_name, phone, whatsapp_reminders").in("id", unique(bookings.map((b) => b.user_id))),
    supabase.from("rooms").select("id, name, branch_id").in("id", unique(bookings.map((b) => b.room_id))),
  ]);
  const profiles = new Map((profileRows ?? []).map((p) => [p.id, p]));
  const rooms = new Map((roomRows ?? []).map((r) => [r.id, r]));
  const branchIds = unique([...rooms.values()].map((r) => r.branch_id));
  const { data: branchRows } = branchIds.length > 0
    ? await supabase.from("branches").select("id, name").in("id", branchIds)
    : { data: [] as { id: string; name: string }[] };
  const branches = new Map((branchRows ?? []).map((b) => [b.id, b]));

  await mapWithConcurrency(bookings, SEND_CONCURRENCY, async (b) => {
    const profile = profiles.get(b.user_id);
    const room = rooms.get(b.room_id);
    if (!profile?.phone || !room) return;
    if (!profile.whatsapp_reminders) {
      result.skippedOptOut++;
      return;
    }
    const branch = branches.get(room.branch_id);

    const startsAt = new Date(b.starts_at);
    const send = await sendWhatsAppReminderTemplate(
      {
        phoneNumberId: creds.phone_number_id,
        accessToken: creds.access_token,
        templateName: creds.template_name,
        templateLang: creds.template_lang,
      },
      profile.phone,
      {
        name: profile.full_name,
        clinic: clinic.name,
        date: formatDateHe(startsAt, timezone),
        time: formatTimeHe(startsAt, timezone),
        room: room.name,
        branch: branch?.name ?? "",
      },
    );

    if (send.ok) {
      // עדכון עמודת סימון בלבד — כמו reminder_sent_at של המייל באותו route.
      await supabase.from("bookings").update({ whatsapp_reminder_sent_at: now.toISOString() }).eq("id", b.id);
      await supabase.from("audit_log").insert({
        clinic_id: clinicId,
        actor_id: null,
        action: "whatsapp_reminder_sent",
        entity: "bookings",
        entity_id: b.id,
        after: { provider: "meta_cloud", message_id: send.messageId ?? null },
      });
      result.sent++;
    } else {
      // לא מסומן → ינוסה שוב בריצה הבאה (כל עוד ההזמנה בחלון). ללא טלפון בלוג.
      await supabase.from("audit_log").insert({
        clinic_id: clinicId,
        actor_id: null,
        action: "whatsapp_reminder_failed",
        entity: "bookings",
        entity_id: b.id,
        after: { provider: "meta_cloud", error: send.error },
      });
      result.failed++;
    }
  });

  return result;
}
