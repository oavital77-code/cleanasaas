import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { setClinicStatusAction } from "./actions";

// SAASMIGRATIONSPEC §8: ראייה חוצת-קליניקות. אין impersonation ב-MVP הזה —
// ר' הערה ב-migration ה-superadmin על למה זו החלטה מכוונת.
export default async function SuperadminPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: isSuperadmin } = await supabase.from("platform_admins").select("user_id").eq("user_id", user.id).maybeSingle();
  if (!isSuperadmin) redirect("/");

  const { data: clinics, error } = await supabase.rpc("superadmin_list_clinics");
  if (error) {
    return <main className="p-8 text-destructive">שגיאה בטעינת רשימת הקליניקות: {error.message}</main>;
  }

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 p-8">
      <h1 className="text-2xl font-semibold">קליניקות</h1>
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted text-right">
            <tr>
              <th className="p-3 font-medium">שם</th>
              <th className="p-3 font-medium">סטטוס</th>
              <th className="p-3 font-medium">תוכנית</th>
              <th className="p-3 font-medium">סניפים</th>
              <th className="p-3 font-medium">חדרים</th>
              <th className="p-3 font-medium">מטפלים</th>
              <th className="p-3 font-medium">נרשם</th>
              <th className="p-3 font-medium">פעולה</th>
            </tr>
          </thead>
          <tbody>
            {(clinics ?? []).map((c) => (
              <tr key={c.clinic_id} className="border-t">
                <td className="p-3">{c.name}</td>
                <td className="p-3">{c.status}</td>
                <td className="p-3">{c.plan ?? "—"}</td>
                <td className="p-3">{c.branches_count}</td>
                <td className="p-3">{c.rooms_count}</td>
                <td className="p-3">{c.therapists_count}</td>
                <td className="p-3">{new Date(c.created_at).toLocaleDateString("he-IL")}</td>
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
      </div>
    </main>
  );
}
