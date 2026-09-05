import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { completeJoinFromMetadata } from "./actions";
import { JoinSignupForm } from "./join-signup-form";
import { AuthShell } from "@/components/auth-shell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

// קישור הצטרפות פומבי וקבוע — CLAUDE.md/משוב משתמש: admin מפרסם קישור אחד
// לקליניקה שלו/ה (ר' migration 20260905000001), במקום ליצור טוקן חד-פעמי
// לכל מטפל/ת. admin client כי אין session עדיין — בדיקת published/status
// היא הבדיקה הציבורית היחידה שמותר לחשוף כאן (לא שם/פרטי מטפלים).
export default async function JoinPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  await completeJoinFromMetadata(slug);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const { data: profile } = await supabase.from("profiles").select("id").eq("id", user.id).maybeSingle();
    if (profile) redirect("/");
  }

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
