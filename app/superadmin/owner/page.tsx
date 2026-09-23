import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthState } from "@/lib/auth/guards";
import { fetchCleanaPlusStats, fetchCleanasStats } from "@/lib/owner/stats";
import { OwnerDashboardView } from "./view";

export const dynamic = "force-dynamic";

// דשבורד הבעלים: מי קנה, מתי, באיזה מצב — משני המוצרים — ומדרגות הרכישה
// (איזה שירות צריך לשדרג באיזו כמות משתמשים). סופר-אדמין בלבד; לא נוגע
// בשום נתון, רק קורא. התצוגה עצמה ב-view.tsx (קובץ page מותר לו לייצא רק
// את השדות של Next).
export default async function OwnerDashboardPage() {
  const supabase = await createClient();
  const { userId } = await getAuthState();
  if (!userId) redirect("/login");
  const { data: isSuperadminRow } = await supabase.from("platform_admins").select("user_id").eq("user_id", userId).maybeSingle();
  if (!isSuperadminRow) redirect("/");

  // הפניות נקראות ב-service role: RLS על platform_leads דוחה הכול
  // (ר' מיגרציה 20260923000001), והשער לדף כבר וידא סופר-אדמין.
  const { data: leads } = await createAdminClient()
    .from("platform_leads")
    .select("id, created_at, name, phone, email, clinic_name, message, status")
    .order("created_at", { ascending: false })
    .limit(100);

  const [plus, saas] = await Promise.all([fetchCleanaPlusStats(), fetchCleanasStats()]);
  return <OwnerDashboardView plus={plus} saas={saas} leads={leads ?? []} />;
}
