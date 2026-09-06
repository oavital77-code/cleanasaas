import { requireClinicAdmin } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { formatDateTimeHe } from "@/lib/time";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent } from "@/components/ui/card";

// action כפי שנכתב ב-audit_log ע"י ה-RPCs (ר' supabase/migrations) — לפני
// התיקון הוצג כאן הקוד הגולמי (snake_case), וקשה היה להבחין למשל בין ביטול
// ע"י המטפל/ת לביטול ע"י אדמין. ברירת המחדל (הצגת הקוד הגולמי) עדיין
// חלה על action עתידי שלא נוסף כאן.
const ACTION_LABEL: Record<string, string> = {
  booking_created: "הזמנה נוצרה",
  booking_created_retroactively: "הזמנה נוצרה רטרואקטיבית",
  booking_created_by_admin: "הזמנה נוצרה ע\"י אדמין",
  booking_cancelled: "הזמנה בוטלה ע\"י המטפל/ת",
  booking_cancelled_by_admin: "הזמנה בוטלה ע\"י אדמין",
  admin_adjusted_punch_card_hours: "עדכון ידני ליתרת כרטיסייה",
  bonus_hours_granted: "הענקת שעות מתנה",
  deposit_completed_manually: "השלמת פיקדון ידנית",
  branch_created: "סניף נוצר",
  room_created: "חדר נוצר",
  clinic_signed_up: "קליניקה נרשמה",
  invite_accepted: "הזמנה אושרה",
  joined_via_public_link: "הצטרפות דרך קישור ציבורי",
  overrun_charge_succeeded: "חיוב חריגה הצליח",
  overrun_charge_failed_suspended: "חיוב חריגה נכשל — הושעה",
  overrun_recorded: "נרשמה חריגה",
  session_requested: "בקשת ססיה הוגשה",
  session_approved: "ססיה אושרה",
  session_rejected: "ססיה נדחתה",
  session_created_by_admin: "ססיה נקבעה ע\"י אדמין",
  session_created_prepaid: "ססיה נקבעה (משולמת מראש)",
  session_activated: "ססיה הופעלה",
  session_activated_manually: "ססיה הופעלה ידנית",
  session_cancellation_requested: "התבקש ביטול ססיה",
  session_term_ended_by_admin: "תקופת ססיה הופסקה ע\"י אדמין",
  session_term_renewed: "ססיה חודשה",
  session_renewal_paid: "חידוש ססיה שולם",
  session_renewal_paid_manually: "חידוש ססיה שולם ידנית",
  session_renewal_failed: "חידוש ססיה נכשל",
  session_materialization_conflict: "התנגשות ביצירת מפגשי ססיה",
  session_materialization_job_error: "שגיאה בעבודת יצירת מפגשי ססיה",
  woo_purchase_claimed: "רכישה מהחנות שויכה לפרופיל",
};

// פעולות "חריגות" שראוי שאדמין ישים לב אליהן ביתר תשומת לב — לא רק
// עוד שורה ביומן. ר' CLAUDE.md (הזמנה רטרואקטיבית) ו-migration
// 20260906000003 (cap על שעות מתנה) — שתיהן עוברות דרך RPC תקין, לא
// שגיאה, אז רק הדגשה ויזואלית מבדילה אותן משאר היומן.
const ALERT_ACTIONS = new Set(["booking_created_retroactively", "bonus_hours_granted"]);

export default async function AdminAuditPage() {
  const { profile, clinicId } = await requireClinicAdmin();
  const supabase = await createClient();

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
        <h1 className="text-2xl font-semibold">יומן פעולות</h1>

        <div className="flex flex-col gap-2">
          {(logs ?? []).map((log) => {
            const isAlert = ALERT_ACTIONS.has(log.action);
            return (
            <Card key={log.id} className={`shadow-e1 ${isAlert ? "border-warning-border bg-warning-bg" : ""}`}>
              <CardContent className="p-4 text-sm">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 font-medium">
                    {isAlert && <span aria-hidden="true">⚠️</span>}
                    {ACTION_LABEL[log.action] ?? log.action}
                  </span>
                  <span className="text-xs text-muted-foreground">{formatDateTimeHe(new Date(log.created_at ?? "1970-01-01T00:00:00Z"))}</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  ע&quot;י {(log.profiles as { full_name?: string } | null)?.full_name ?? "מערכת"}
                </p>
                {(log.before || log.after) && (
                  <details className="mt-2">
                    <summary className="cursor-pointer text-xs text-violet-600">פרטים</summary>
                    <pre dir="ltr" className="mt-1 overflow-x-auto rounded bg-muted p-2 text-xs">
                      {JSON.stringify({ before: log.before, after: log.after }, null, 2)}
                    </pre>
                  </details>
                )}
              </CardContent>
            </Card>
            );
          })}
          {(!logs || logs.length === 0) && <p className="text-sm text-muted-foreground">אין עדיין רשומות.</p>}
        </div>
      </div>
    </AppShell>
  );
}
