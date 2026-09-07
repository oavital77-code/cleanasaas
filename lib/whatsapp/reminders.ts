import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { formatDateHe, formatTimeHe, DEFAULT_TIMEZONE } from "@/lib/time";
import { isWhatsAppProvider, renderReminderTemplate, sendWhatsAppText } from "./index";

// שלב ה-WhatsApp של cron התזכורות (app/api/cron/send-reminders). נפרד
// מהמייל: עמודת סימון משלו (bookings.whatsapp_reminder_sent_at), ולולאה
// לכל קליניקה עם WhatsApp פעיל — כי hours_before הוא per-clinic.
//
// ה-cron יומי (Vercel Hobby — לא ניתן לתדירות גבוהה יותר), אז בפועל:
// "בבוקר, כל ההזמנות שמתחילות בטווח hours_before הבא". אם יעברו ל-Pro
// עם cron שעתי — הקוד אידמפוטנטי (סימון + חלון) ויעבוד מדויק יותר בלי
// שינוי.
//
// 🔴 רץ עם service role — חוצה קליניקות; כל query מסונן clinic_id.
export async function sendWhatsAppReminders(
  supabase: SupabaseClient<Database>,
  now: Date,
): Promise<{ sent: number; failed: number }> {
  let sent = 0;
  let failed = 0;

  const { data: enabledClinics } = await supabase
    .from("clinic_whatsapp_settings")
    .select("clinic_id")
    .eq("enabled", true);

  for (const row of enabledClinics ?? []) {
    try {
      const result = await sendForClinic(supabase, row.clinic_id, now);
      sent += result.sent;
      failed += result.failed;
    } catch (err) {
      // קליניקה אחת לא מפילה את השאר.
      console.error(`[whatsapp-reminders] clinic ${row.clinic_id} failed`, err instanceof Error ? err.message : err);
    }
  }

  return { sent, failed };
}

async function sendForClinic(
  supabase: SupabaseClient<Database>,
  clinicId: string,
  now: Date,
): Promise<{ sent: number; failed: number }> {
  const [{ data: credsRows }, { data: clinic }] = await Promise.all([
    supabase.rpc("get_clinic_whatsapp_credentials", { p_clinic_id: clinicId }),
    supabase.from("clinics").select("name, timezone").eq("id", clinicId).maybeSingle(),
  ]);
  const creds = credsRows?.[0];
  if (!creds || !creds.enabled || !creds.api_token || !isWhatsAppProvider(creds.provider) || !clinic) {
    return { sent: 0, failed: 0 };
  }
  const timezone = clinic.timezone ?? DEFAULT_TIMEZONE;
  const windowEnd = new Date(now.getTime() + creds.hours_before * 60 * 60_000).toISOString();

  const { data: bookings } = await supabase
    .from("bookings")
    .select("id, user_id, room_id, starts_at")
    .eq("clinic_id", clinicId)
    .eq("status", "confirmed")
    .is("whatsapp_reminder_sent_at", null)
    .gt("starts_at", now.toISOString())
    .lte("starts_at", windowEnd);

  let sent = 0;
  let failed = 0;

  for (const b of bookings ?? []) {
    const [{ data: profile }, { data: room }] = await Promise.all([
      supabase.from("profiles").select("full_name, phone").eq("id", b.user_id).maybeSingle(),
      supabase.from("rooms").select("name, branch_id").eq("id", b.room_id).maybeSingle(),
    ]);
    if (!profile?.phone || !room) continue;
    const { data: branch } = await supabase.from("branches").select("name").eq("id", room.branch_id).maybeSingle();

    const startsAt = new Date(b.starts_at);
    const text = renderReminderTemplate(creds.template, {
      name: profile.full_name,
      date: formatDateHe(startsAt, timezone),
      time: formatTimeHe(startsAt, timezone),
      room: room.name,
      branch: branch?.name ?? "",
      clinic: clinic.name,
    });

    const result = await sendWhatsAppText(
      { provider: creds.provider, instanceId: creds.instance_id, apiUrl: creds.api_url, apiToken: creds.api_token },
      profile.phone,
      text,
    );

    if (result.ok) {
      // 🔴 עדכון עמודת סימון בלבד — לא "כתיבה עסקית" ל-bookings (אותו דבר
      // בדיוק כמו reminder_sent_at של המייל באותו route).
      await supabase.from("bookings").update({ whatsapp_reminder_sent_at: now.toISOString() }).eq("id", b.id);
      await supabase.from("audit_log").insert({
        clinic_id: clinicId,
        actor_id: null,
        action: "whatsapp_reminder_sent",
        entity: "bookings",
        entity_id: b.id,
        after: { provider: creds.provider },
      });
      sent++;
    } else {
      // לא מסומן → ינוסה שוב בריצה הבאה (ההזמנה עדיין בחלון). ללא טלפון בלוג.
      await supabase.from("audit_log").insert({
        clinic_id: clinicId,
        actor_id: null,
        action: "whatsapp_reminder_failed",
        entity: "bookings",
        entity_id: b.id,
        after: { provider: creds.provider, error: result.error },
      });
      failed++;
    }
  }

  return { sent, failed };
}
