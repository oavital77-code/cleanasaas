import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { withCronAlert } from "@/lib/cron/guard";

// יומי 03:00 — materialize_session_bookings(), רולינג 90 יום, כל הקליניקות.
// הלולאה עצמה (per-clinic try/catch) חיה בתוך ה-RPC — ר' migration ה-sessions.
export const GET = withCronAlert("materialize-sessions", async () => {
  const supabase = createAdminClient();
  const { error } = await supabase.rpc("materialize_session_bookings");
  if (error) {
    return NextResponse.json({ error: "MATERIALIZE_FAILED" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
});
