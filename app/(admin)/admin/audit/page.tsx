import { requireClinicAdmin } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { formatDateTimeHe } from "@/lib/time";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent } from "@/components/ui/card";
import { getAdminAuditDict, getCommonDict, normalizeLocale } from "@/lib/i18n";

// action כפי שנכתב ב-audit_log ע"י ה-RPCs (ר' supabase/migrations) — התוויות
// (עברית/אנגלית) ב-lib/i18n/admin.ts → getAdminAuditDict().actions. ברירת
// המחדל (הצגת הקוד הגולמי) עדיין חלה על action עתידי שלא נוסף שם.
//
// פעולות "חריגות" שראוי שאדמין ישים לב אליהן ביתר תשומת לב — לא רק
// עוד שורה ביומן. ר' CLAUDE.md (הזמנה רטרואקטיבית) ו-migration
// 20260906000003 (cap על שעות מתנה) — שתיהן עוברות דרך RPC תקין, לא
// שגיאה, אז רק הדגשה ויזואלית מבדילה אותן משאר היומן.
const ALERT_ACTIONS = new Set(["booking_created_retroactively", "bonus_hours_granted", "whatsapp_reminder_failed"]);

export default async function AdminAuditPage() {
  const { profile, clinicId } = await requireClinicAdmin();
  const supabase = await createClient();
  const locale = normalizeLocale(profile.locale);
  const t = getAdminAuditDict(locale);
  const c = getCommonDict(locale);

  const [{ data: clinic }, { data: logs }] = await Promise.all([
    supabase.from("clinics").select("name").eq("id", clinicId).single(),
    supabase
      .from("audit_log")
      .select("id, action, entity, entity_id, before, after, created_at, profiles(full_name)")
      .eq("clinic_id", clinicId)
      .order("created_at", { ascending: false })
      .limit(100),
  ]);

  return (
    <AppShell side="admin" clinicName={clinic?.name} fullName={profile.full_name} locale={profile.locale}>
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        <h1 className="text-2xl font-semibold">{t.title}</h1>

        <div className="flex flex-col gap-2">
          {(logs ?? []).map((log) => {
            const isAlert = ALERT_ACTIONS.has(log.action);
            return (
              <Card key={log.id} className={`shadow-e1 ${isAlert ? "border-warning-border bg-warning-bg" : ""}`}>
                <CardContent className="p-4 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 font-medium">
                      {isAlert && <span aria-hidden="true">⚠️</span>}
                      {t.actions[log.action] ?? log.action}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {formatDateTimeHe(new Date(log.created_at ?? "1970-01-01T00:00:00Z"))}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {t.by((log.profiles as { full_name?: string } | null)?.full_name ?? c.system)}
                  </p>
                  {(log.before || log.after) && (
                    <details className="mt-2">
                      <summary className="cursor-pointer text-xs text-violet-600">{t.details}</summary>
                      <pre dir="ltr" className="mt-1 overflow-x-auto rounded bg-muted p-2 text-xs">
                        {JSON.stringify({ before: log.before, after: log.after }, null, 2)}
                      </pre>
                    </details>
                  )}
                </CardContent>
              </Card>
            );
          })}
          {(!logs || logs.length === 0) && <p className="text-sm text-muted-foreground">{t.empty}</p>}
        </div>
      </div>
    </AppShell>
  );
}
