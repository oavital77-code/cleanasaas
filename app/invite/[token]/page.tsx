import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthState } from "@/lib/auth/guards";
import { InviteSignupForm } from "./invite-signup-form";
import { AuthShell } from "@/components/auth-shell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  // accept_therapist_invite רץ עכשיו בתוך <InviteSignupForm> עצמו, מיד אחרי
  // setActive() של Clerk — ר' app/signup/actions.ts להסבר המלא.
  const { userId } = await getAuthState();
  if (userId) redirect("/");

  // בדיקת תקפות ההזמנה — service role כי עוד אין profile/session מתאים
  // לקרוא ישירות דרך RLS (admin_manage_invites דורש is_admin() על הקליניקה).
  const admin = createAdminClient();
  const { data: invite } = await admin
    .from("clinic_invites")
    .select("clinic_id, role, used_at, expires_at, clinics(name)")
    .eq("token", token)
    .maybeSingle();

  if (!invite || invite.used_at || new Date(invite.expires_at) < new Date()) {
    return (
      <AuthShell>
        <Card className="shadow-e2 text-center">
          <CardHeader>
            <CardTitle className="text-xl">קישור ההזמנה לא תקף</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">אפשר לבקש קישור חדש מהנהלת הקליניקה.</p>
          </CardContent>
        </Card>
      </AuthShell>
    );
  }

  const clinicName = (invite.clinics as { name?: string } | null)?.name ?? "";

  return (
    <AuthShell>
      <Card className="shadow-e2">
        <CardHeader className="text-center">
          <CardTitle className="text-xl">הצטרפות ל{clinicName}</CardTitle>
          <CardDescription>{invite.role === "admin" ? "קיבלת הזמנה להצטרף כמנהל." : "קיבלת הזמנה להצטרף כמטפל."}</CardDescription>
        </CardHeader>
        <CardContent>
          <InviteSignupForm token={token} />
        </CardContent>
      </Card>
    </AuthShell>
  );
}
