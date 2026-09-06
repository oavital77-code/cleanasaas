import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

/**
 * מיילים של אדמיני/בעלי קליניקה ספציפית — 🔴 clinicId חובה. בלי סינון
 * clinic_id, התראה על קליניקה A הייתה נשלחת גם לאדמינים של קליניקה B (חוק
 * #3 ב-CLAUDE.md: מטפל/אדמין לעולם לא רואה/שומע על קליניקה אחרת).
 */
export async function getAdminEmails(client: SupabaseClient<Database>, clinicId: string): Promise<string[]> {
  const { data } = await client
    .from("profiles")
    .select("email")
    .eq("clinic_id", clinicId)
    .in("role", ["owner", "admin"]);
  return (data ?? []).map((p) => p.email);
}

/**
 * מיילים של סופר-אדמיני הפלטפורמה (platform_admins) — להתראות חוצות-קליניקות
 * (כישלון cron). לא ל-clinic_id ספציפי, לכן לא משתמש ב-getAdminEmails.
 * platform_admins.user_id הוא בפועל profiles.id (ר' isSuperadmin ב-guards.ts).
 */
export async function getSuperadminEmails(client: SupabaseClient<Database>): Promise<string[]> {
  const { data: admins } = await client.from("platform_admins").select("user_id");
  const ids = (admins ?? []).map((a) => a.user_id);
  if (ids.length === 0) return [];

  const { data: profiles } = await client.from("profiles").select("email").in("id", ids);
  return (profiles ?? []).map((p) => p.email);
}
