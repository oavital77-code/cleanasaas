import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { withCronAlert } from "@/lib/cron/guard";
import { sendEmail } from "@/lib/email/resend";
import { materializationConflictAdminEmail } from "@/lib/email/templates";
import { getAdminEmails } from "@/lib/email/recipients";

// יומי 03:00 — materialize_session_bookings(), רולינג 90 יום, כל הקליניקות.
// הלולאה עצמה (per-clinic try/catch) חיה בתוך ה-RPC — ר' migration ה-sessions.
// כישלון בקליניקה בודדת לא זורק חוצה את ה-RPC; הוא נרשם ל-audit_log
// (action='session_materialization_job_error', clinic_id של אותה קליניקה).
// אחרי הריצה סורקים שורות audit_log חדשות מהריצה הזו בלבד (startedAt) ושולחים
// התראה לאדמיני *אותה* קליניקה בלבד — לא לכל הקליניקות (חוק #3 ב-CLAUDE.md).
export const GET = withCronAlert("materialize-sessions", async () => {
  const supabase = createAdminClient();
  const startedAt = new Date().toISOString();

  const { error } = await supabase.rpc("materialize_session_bookings");
  if (error) {
    return NextResponse.json({ error: "MATERIALIZE_FAILED" }, { status: 500 });
  }

  const { data: conflicts } = await supabase
    .from("audit_log")
    .select("clinic_id, entity_id, after")
    .eq("action", "session_materialization_job_error")
    .gte("created_at", startedAt);

  let conflictsNotified = 0;
  for (const c of conflicts ?? []) {
    if (!c.clinic_id || !c.entity_id) continue;
    const adminEmails = await getAdminEmails(supabase, c.clinic_id);
    if (adminEmails.length === 0) continue;

    const detail =
      c.after && typeof c.after === "object" && "error" in (c.after as Record<string, unknown>)
        ? String((c.after as Record<string, unknown>).error)
        : "שגיאה לא ידועה";
    const { subject, html } = materializationConflictAdminEmail({ subscriptionId: c.entity_id, detail });
    const result = await sendEmail({ to: adminEmails, subject, html });
    if (result.ok) conflictsNotified++;
  }

  return NextResponse.json({ ok: true, conflicts: conflicts?.length ?? 0, conflictsNotified });
});
