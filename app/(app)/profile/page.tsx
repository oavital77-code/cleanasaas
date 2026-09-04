import { requireTherapistProfile } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateProfileAction } from "./actions";

const ROLE_LABEL: Record<string, string> = { owner: "בעלים", admin: "אדמין/ית", therapist: "מטפל/ת" };

export default async function ProfilePage() {
  const { userId, profile } = await requireTherapistProfile();
  const supabase = await createClient();

  const [{ data: clinic }, { data: cards }] = await Promise.all([
    supabase.from("clinics").select("name").eq("id", profile.clinic_id).single(),
    supabase.from("punch_cards").select("hours_remaining").eq("user_id", userId).eq("active", true),
  ]);

  const totalHours = (cards ?? []).reduce((sum, c) => sum + Number(c.hours_remaining), 0);
  const isAdmin = profile.role === "owner" || profile.role === "admin";
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";

  return (
    <AppShell side="app" clinicName={clinic?.name} fullName={profile.full_name} isAdmin={isAdmin}>
      <div className="mx-auto flex w-full max-w-xl flex-col gap-6">
        <h1 className="text-2xl font-semibold">הכרטיס שלי</h1>

        <Card className="shadow-e1">
          <CardHeader>
            <CardTitle className="text-base font-medium">פרטים אישיים</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={updateProfileAction} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="full_name">שם מלא</Label>
                <Input id="full_name" name="full_name" defaultValue={profile.full_name} required />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="profession">מקצוע</Label>
                <Input id="profession" name="profession" defaultValue={profile.profession ?? ""} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <Label className="text-muted-foreground">טלפון</Label>
                  <p className="text-sm" dir="ltr">
                    {profile.phone}
                  </p>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label className="text-muted-foreground">אימייל</Label>
                  <p className="text-sm" dir="ltr">
                    {profile.email}
                  </p>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                טלפון ואימייל ניתנים לעדכון רק ע&quot;י אדמין/ית הקליניקה.
              </p>
              <Button type="submit" className="w-fit">
                שמירה
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="shadow-e1">
          <CardHeader>
            <CardTitle className="text-base font-medium">סטטוס בקליניקה</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">תפקיד</span>
              <span>{ROLE_LABEL[profile.role] ?? profile.role}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">יתרת שעות כרטיסייה</span>
              <span className="tabular-nums">{totalHours}</span>
            </div>
            {profile.door_code && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">קוד כניסה</span>
                <span dir="ltr">{profile.door_code}</span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-e1">
          <CardHeader>
            <CardTitle className="text-base font-medium">פיד לוח שנה אישי</CardTitle>
            <CardDescription>הוספת ההזמנות שלכם ליומן (Google/Outlook/Apple) דרך קישור מנוי</CardDescription>
          </CardHeader>
          <CardContent>
            <code dir="ltr" className="block truncate rounded bg-muted px-2 py-1.5 text-xs">
              {appUrl}/api/ics/{profile.ics_token}
            </code>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
