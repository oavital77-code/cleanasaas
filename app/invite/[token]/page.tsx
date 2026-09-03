import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { completeInviteFromMetadata } from "./actions";
import { InviteSignupForm } from "./invite-signup-form";

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  await completeInviteFromMetadata(token);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const { data: profile } = await supabase.from("profiles").select("id").eq("id", user.id).maybeSingle();
    if (profile) redirect("/");
  }

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
      <main className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
        <h1 className="text-2xl font-semibold">קישור ההזמנה לא תקף</h1>
        <p className="text-muted-foreground">בקש/י קישור הזמנה חדש מהמנהל/ת שלך.</p>
      </main>
    );
  }

  const clinicName = (invite.clinics as { name?: string } | null)?.name ?? "";

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 p-8">
      <div className="text-center">
        <h1 className="text-2xl font-semibold">הצטרפות ל{clinicName}</h1>
        <p className="mt-1 text-sm text-muted-foreground">הוזמנת כ{invite.role === "admin" ? "אדמין/ית" : "מטפל/ת"}.</p>
      </div>
      <InviteSignupForm token={token} />
    </main>
  );
}
