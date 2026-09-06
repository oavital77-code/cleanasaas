import Link from "next/link";
import { requireTherapistProfile } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2 } from "lucide-react";

// דף נחיתה אחרי חזרה מהתשלום בחנות ה-Woo (מוגדר שם כ-return URL). השיוך
// עצמו כבר קרה (webhook/polling) — זה רק מסך אישור, לא לוגיקה.
export default async function PurchaseSuccessPage() {
  const { profile } = await requireTherapistProfile();
  const supabase = await createClient();
  const { data: clinic } = await supabase.from("clinics").select("name").eq("id", profile.clinic_id).single();
  const isAdmin = profile.role === "owner" || profile.role === "admin";

  return (
    <AppShell side="app" clinicName={clinic?.name} fullName={profile.full_name} locale={profile.locale} isAdmin={isAdmin}>
      <div className="mx-auto flex w-full max-w-md flex-col items-center gap-6 text-center">
        <Card className="w-full shadow-e2">
          <CardHeader className="items-center">
            <CheckCircle2 className="size-10 text-success" />
            <CardTitle className="text-xl">התשלום התקבל</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <p className="text-muted-foreground">
              השעות אמורות להתווסף אליכם תוך דקות. אם הן לא הופיעו — אפשר לבדוק ב-&quot;רכישת כרטיסייה&quot;.
            </p>
            <Button asChild>
              <Link href="/purchase">חזרה למסך הרכישה</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
