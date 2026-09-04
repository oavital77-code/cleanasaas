import { requireClinicAdmin } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { formatDateTimeHe } from "@/lib/time";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent } from "@/components/ui/card";

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
    <AppShell side="admin" clinicName={clinic?.name} fullName={profile.full_name}>
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        <h1 className="text-2xl font-semibold">יומן פעולות</h1>

        <div className="flex flex-col gap-2">
          {(logs ?? []).map((log) => (
            <Card key={log.id} className="shadow-e1">
              <CardContent className="p-4 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-medium">
                    {log.action} · {log.entity}
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
          ))}
          {(!logs || logs.length === 0) && <p className="text-sm text-muted-foreground">אין עדיין רשומות.</p>}
        </div>
      </div>
    </AppShell>
  );
}
