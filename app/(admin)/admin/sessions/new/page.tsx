import { requireClinicAdmin } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { SlotBuilder } from "@/components/slot-builder";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { adminCreateSessionAction } from "./actions";
import { getAdminSessionsDict, normalizeLocale } from "@/lib/i18n";

export default async function AdminNewSessionPage() {
  const { profile, clinicId } = await requireClinicAdmin();
  const supabase = await createClient();
  const t = getAdminSessionsDict(normalizeLocale(profile.locale));

  const [{ data: clinic }, { data: rooms }, { data: users }] = await Promise.all([
    supabase.from("clinics").select("name").eq("id", clinicId).single(),
    supabase.from("rooms").select("id, name").eq("clinic_id", clinicId).eq("active", true).order("sort_order"),
    supabase.from("profiles").select("id, full_name").eq("clinic_id", clinicId).eq("status", "active").order("full_name"),
  ]);

  return (
    <AppShell side="admin" clinicName={clinic?.name} fullName={profile.full_name} locale={profile.locale}>
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
        <h1 className="text-2xl font-semibold">{t.newTitle}</h1>

        <Card className="shadow-e1">
          <CardHeader>
            <CardTitle className="text-base font-medium">{t.directAssignTitle}</CardTitle>
            <CardDescription>{t.directAssignDescription}</CardDescription>
          </CardHeader>
          <CardContent>
            {users && users.length > 0 && rooms && rooms.length > 0 ? (
              <SlotBuilder
                rooms={rooms}
                action={adminCreateSessionAction}
                submitLabel={t.createSession}
                pendingLabel={t.creating}
                extraFields={
                  <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap">
                    <div className="flex flex-col gap-1.5">
                      <Label>{t.therapist}</Label>
                      <Select name="user_id" required className="sm:w-auto">
                        {users.map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.full_name}
                          </option>
                        ))}
                      </Select>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Label>{t.commitment}</Label>
                      <Select name="term_months" className="sm:w-auto">
                        <option value="">{t.none}</option>
                        <option value="1">{t.oneMonth}</option>
                        <option value="3">{t.months(3)}</option>
                        <option value="6">{t.months(6)}</option>
                        <option value="12">{t.oneYear}</option>
                      </Select>
                    </div>
                  </div>
                }
              />
            ) : (
              <p className="text-muted-foreground">{t.needTherapistAndRoom}</p>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
