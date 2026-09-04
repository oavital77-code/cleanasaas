import { redirect } from "next/navigation";
import { requireTherapistProfile } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { SlotBuilder } from "@/components/slot-builder";
import { requestSessionAction } from "../actions";

export default async function NewSessionPage() {
  const { profile } = await requireTherapistProfile();
  const supabase = await createClient();

  const [{ data: clinic }, { data: rooms }, { data: baseHoursSetting }] = await Promise.all([
    supabase.from("clinics").select("name, sessions_enabled").eq("id", profile.clinic_id).single(),
    supabase.from("rooms").select("id, name").eq("clinic_id", profile.clinic_id).eq("active", true).order("sort_order"),
    supabase.from("app_settings").select("value").eq("clinic_id", profile.clinic_id).eq("key", "session_base_hours").maybeSingle(),
  ]);

  if (!clinic?.sessions_enabled) redirect("/sessions");

  const baseHours = typeof baseHoursSetting?.value === "number" ? baseHoursSetting.value : 5;
  const isAdmin = profile.role === "owner" || profile.role === "admin";

  return (
    <AppShell side="app" clinicName={clinic?.name} fullName={profile.full_name} isAdmin={isAdmin}>
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
        <h1 className="text-2xl font-semibold">בקשת ססיה חדשה</h1>

        <Card className="shadow-e1">
          <CardHeader>
            <CardTitle className="text-base font-medium">משבצות שבועיות קבועות</CardTitle>
            <CardDescription>
              הססיה היא היקף שבועי קבוע — {baseHours} שעות בדיוק, בחדר/ים ובזמן/ים שתבחרו. הבקשה
              נשלחת לאישור אדמין ולא בודקת זמינות בפועל מראש.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {rooms && rooms.length > 0 ? (
              <SlotBuilder
                rooms={rooms}
                action={requestSessionAction}
                requiredHours={baseHours}
                submitLabel="שליחת בקשה לאישור אדמין"
                pendingLabel="שולח/ת…"
              />
            ) : (
              <p className="text-muted-foreground">אין עדיין חדרים פעילים בקליניקה.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
