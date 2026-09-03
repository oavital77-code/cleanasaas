import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { withCronAlert } from "@/lib/cron/guard";

// כל שעה — ניקוי holds פגי תוקף של ססיות + סגירת ביטולים/פקיעות מנוי, וכן
// פקיעת trial ל-suspended (כל הקליניקות, ר' spec §7/§14).
export const GET = withCronAlert("cleanup-holds", async () => {
  const supabase = createAdminClient();

  const { error: holdsError } = await supabase.rpc("expire_session_holds_and_cancellations");
  if (holdsError) {
    return NextResponse.json({ error: "CLEANUP_FAILED" }, { status: 500 });
  }

  const { error: trialError } = await supabase.rpc("expire_trial_subscriptions");
  if (trialError) {
    return NextResponse.json({ error: "TRIAL_EXPIRY_FAILED" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
});
