import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthState } from "@/lib/auth/guards";
import { JoinSignupForm } from "./join-signup-form";
import { AuthShell } from "@/components/auth-shell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

// קישור הצטרפות פומבי וקבוע — CLAUDE.md/משוב משתמש: admin מפרסם קישור אחד
// לקליניקה שלו/ה (ר' migration 20260905000001), במקום ליצור טוקן חד-פעמי
// לכל מטפל/ת. admin client כי אין session עדיין — בדיקת published/status
// היא הבדיקה הציבורית היחידה שמותר לחשוף כאן (לא שם/פרטי מטפלים).
export default async function JoinPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  // join_clinic_as_therapist רץ עכשיו בתוך <JoinSignupForm> עצמו, מיד אחרי
  // setActive() של Clerk — ר' app/signup/actions.ts להסבר המלא. אם כבר יש
  // session+פרופיל (מישהו/י שכבר הצטרפ/ה חוזר/ת לקישור) — ישר ל-/.
  const { userId } = await getAuthState();
  if (userId) redirect("/");

  const admin = createAdminClient();
  const { data: clinic } = await admin.from("clinics").select("name, published, status").eq("slug", slug).maybeSingle();

  if (!clinic || !clinic.published || clinic.status === "suspended") {
    return (
      <AuthShell>
        <Card className="shadow-e2 text-center">
          <CardHeader>
            <CardTitle className="text-xl">קישור ההצטרפות לא זמין</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">בקש/י קישור עדכני מהמנהל/ת של הקליניקה.</p>
          </CardContent>
        </Card>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <Card className="shadow-e2">
        <CardHeader className="text-center">
          <CardTitle className="text-xl">הצטרפות ל{clinic.name}</CardTitle>
          <CardDescription>יצירת חשבון מטפל/ת בקליניקה</CardDescription>
        </CardHeader>
        <CardContent>
          <JoinSignupForm slug={slug} />
        </CardContent>
      </Card>
    </AuthShell>
  );
}
