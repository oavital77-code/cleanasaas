import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAuthState } from "@/lib/auth/guards";
import { AppHeader } from "@/components/app-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { setClinicStatusAction } from "./actions";

// תואם ל-RETURNS TABLE של superadmin_list_clinics (ר' migration ה-superadmin).
type ClinicRow = {
  clinic_id: string;
  name: string;
  status: string;
  plan: string | null;
  subscription_status: string | null;
  branches_count: number;
  rooms_count: number;
  therapists_count: number;
  created_at: string;
};

// SAASMIGRATIONSPEC §8: ראייה חוצת-קליניקות. אין impersonation ב-MVP הזה —
// ר' הערה ב-migration ה-superadmin על למה זו החלטה מכוונת.
export default async function SuperadminPage() {
  const supabase = await createClient();
  // 🔴 לא supabase.auth.getUser() ישירות: ב-client של מצב Clerk
  // (accessToken) כל גישה ל-supabase.auth.* זורקת — ר' lib/auth/guards.ts.
  const { userId } = await getAuthState();
  if (!userId) redirect("/login");

  const { data: isSuperadminRow } = await supabase.from("platform_admins").select("user_id").eq("user_id", userId).maybeSingle();
  if (!isSuperadminRow) redirect("/");

  const { data: clinics, error } = await supabase.rpc("superadmin_list_clinics");

  return (
    <div className="flex flex-1 flex-col">
      <AppHeader isSuperadmin />
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 p-6 sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold">קליניקות</h1>
          <Link href="/superadmin/owner" className="text-sm text-violet-600 hover:underline">
            דשבורד בעלים: רוכשים ומדרגות רכישה
          </Link>
        </div>

        {error ? (
          <p className="text-destructive">שגיאה בטעינת רשימת הקליניקות: {error.message}</p>
        ) : (
          <Card className="shadow-e1 overflow-hidden p-0">
            <CardContent className="overflow-x-auto p-0">
              <table className="w-full text-sm">
                <thead className="bg-muted text-right">
                  <tr>
                    <th className="p-3 font-medium">שם</th>
                    <th className="p-3 font-medium">סטטוס</th>
                    <th className="hidden p-3 font-medium md:table-cell">תוכנית</th>
                    <th className="hidden p-3 font-medium md:table-cell">סניפים</th>
                    <th className="hidden p-3 font-medium md:table-cell">חדרים</th>
                    <th className="hidden p-3 font-medium sm:table-cell">מטפלים</th>
                    <th className="hidden p-3 font-medium lg:table-cell">נרשם</th>
                    <th className="p-3 font-medium">פעולה</th>
                  </tr>
                </thead>
                <tbody>
                  {((clinics ?? []) as ClinicRow[]).map((c) => (
                    <tr key={c.clinic_id} className="border-t border-border">
                      <td className="p-3 font-medium">{c.name}</td>
                      <td className="p-3">{c.status}</td>
                      <td className="hidden p-3 md:table-cell">{c.plan ?? "—"}</td>
                      <td className="tabular-nums hidden p-3 md:table-cell">{c.branches_count}</td>
                      <td className="tabular-nums hidden p-3 md:table-cell">{c.rooms_count}</td>
                      <td className="tabular-nums hidden p-3 sm:table-cell">{c.therapists_count}</td>
                      <td className="tabular-nums hidden p-3 lg:table-cell">{new Date(c.created_at).toLocaleDateString("he-IL")}</td>
                      <td className="p-3">
                        <form action={setClinicStatusAction} className="flex gap-2">
                          <input type="hidden" name="clinic_id" value={c.clinic_id} />
                          <input type="hidden" name="status" value={c.status === "suspended" ? "active" : "suspended"} />
                          <Button type="submit" size="sm" variant={c.status === "suspended" ? "default" : "destructive"}>
                            {c.status === "suspended" ? "הפעלה" : "השעיה"}
                          </Button>
                        </form>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
