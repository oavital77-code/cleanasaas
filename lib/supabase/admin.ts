import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// 🔴 Service Role — עוקף RLS. אך ורק בקוד שרת: webhooks, cron, RPCs מיוחסים.
// לעולם לא לחשוף ל-client. חוצה את כל הקליניקות בבת אחת — כל קוד שמשתמש בזה
// חייב לסנן clinic_id בעצמו (ה-RPCs שהוא קורא כבר עושות את זה, ר' assert_service_or_admin()).
// ⚠️ לא מחובר ל-Database generic — ר' ההערה ב-lib/supabase/server.ts.
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}
