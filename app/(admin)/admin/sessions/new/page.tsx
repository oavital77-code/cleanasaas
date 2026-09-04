import { requireClinicAdmin } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { SlotBuilder } from "@/components/slot-builder";
import { Label } from "@/components/ui/label";
import { adminCreateSessionAction } from "./actions";

export default async function AdminNewSessionPage() {
  const { profile, clinicId } = await requireClinicAdmin();
  const supabase = await createClient();

  const [{ data: clinic }, { data: rooms }, { data: users }] = await Promise.all([
    supabase.from("clinics").select("name").eq("id", clinicId).single(),
    supabase.from("rooms").select("id, name").eq("clinic_id", clinicId).eq("active", true).order("sort_order"),
    supabase.from("profiles").select("id, full_name").eq("clinic_id", clinicId).eq("status", "active").order("full_name"),
  ]);

  return (
    <AppShell side="admin" clinicName={clinic?.name} fullName={profile.full_name}>
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
        <h1 className="text-2xl font-semibold">קביעת ססיה חופשית</h1>

        <Card className="shadow-e1">
          <CardHeader>
            <CardTitle className="text-base font-medium">שיבוץ ישיר, ללא בדיקת התנגשות</CardTitle>
            <CardDescription>
              משמש בעיקר לקליטת מטפל/ת ותיק/ה שכבר יש לה משבצות קבועות. נכנס ישר ל&quot;ממתין
              לתשלום&quot; — התשלום עצמו לא מדולג.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {users && users.length > 0 && rooms && rooms.length > 0 ? (
              <SlotBuilder
                rooms={rooms}
                action={adminCreateSessionAction}
                submitLabel="קביעת ססיה"
                pendingLabel="קובע/ת…"
                extraFields={
                  <div className="flex flex-wrap gap-4">
                    <div className="flex flex-col gap-1.5">
                      <Label>מטפל/ת</Label>
                      <select name="user_id" required className="h-10 rounded-field border border-input bg-background px-3">
                        {users.map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.full_name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Label>התחייבות</Label>
                      <select name="term_months" className="h-10 rounded-field border border-input bg-background px-3">
                        <option value="">ללא</option>
                        <option value="1">חודש</option>
                        <option value="3">3 חודשים</option>
                        <option value="6">6 חודשים</option>
                        <option value="12">שנה</option>
                      </select>
                    </div>
                  </div>
                }
              />
            ) : (
              <p className="text-muted-foreground">צריך לפחות מטפל/ת פעיל/ה וחדר פעיל אחד.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
