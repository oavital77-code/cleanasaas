import Link from "next/link";
import { requireClinicAdmin } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { createInviteAction, adminResetPasswordAction, toggleClinicPublishedAction } from "./actions";

const ROLE_LABEL: Record<string, string> = { owner: "בעלים", admin: "אדמין/ית", therapist: "מטפל/ת" };
const STATUS_LABEL: Record<string, { label: string; tone: string }> = {
  active: { label: "פעיל", tone: "bg-success-bg text-success-fg" },
  suspended: { label: "מושעה", tone: "bg-danger-bg text-danger" },
  archived: { label: "בארכיון", tone: "bg-subtle text-muted-foreground" },
};

export default async function TherapistsPage() {
  const { profile, clinicId } = await requireClinicAdmin();
  const supabase = await createClient();

  const [{ data: clinic }, { data: profiles }, { data: cards }, { data: invites }] = await Promise.all([
    supabase.from("clinics").select("name, slug, published").eq("id", clinicId).single(),
    supabase.from("profiles").select("id, full_name, phone, email, role, status").eq("clinic_id", clinicId).order("full_name"),
    supabase.from("punch_cards").select("user_id, hours_remaining").eq("clinic_id", clinicId).eq("active", true),
    supabase
      .from("clinic_invites")
      .select("token, role, created_at, expires_at, used_at")
      .eq("clinic_id", clinicId)
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  const hoursByUser = new Map<string, number>();
  for (const c of cards ?? []) {
    hoursByUser.set(c.user_id, (hoursByUser.get(c.user_id) ?? 0) + Number(c.hours_remaining));
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
  const joinUrl = clinic?.slug ? `${appUrl}/join/${clinic.slug}` : "";

  return (
    <AppShell side="admin" clinicName={clinic?.name} fullName={profile.full_name}>
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-8">
        <h1 className="text-2xl font-semibold">מטפלים</h1>

        <Card className="shadow-e1">
          <CardHeader>
            <CardTitle className="text-base font-medium">קישור הצטרפות לקליניקה</CardTitle>
            <CardDescription>
              קישור אחד וקבוע — כל מי שמקבל אותו יכול/ה להירשם ישירות כמטפל/ת אצלכם, בלי
              שתצטרכו ליצור הזמנה בנפרד לכל אחד/ת. גישת אדמין/ית עדיין ניתנת רק דרך הזמנה
              ידנית למטה.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <form action={toggleClinicPublishedAction} className="flex items-center gap-3">
              <input type="hidden" name="published" value={clinic?.published ? "off" : "on"} />
              <Button type="submit" variant={clinic?.published ? "outline" : "default"} size="sm">
                {clinic?.published ? "כיבוי ההרשמה" : "פרסום קליניקה — פתיחת הרשמה"}
              </Button>
              <span className={`text-sm ${clinic?.published ? "text-success" : "text-muted-foreground"}`}>
                {clinic?.published ? "פתוח להרשמה" : "סגור להרשמה"}
              </span>
            </form>
            {clinic?.published && joinUrl && (
              <code dir="ltr" className="block truncate rounded bg-muted px-2 py-1.5 text-xs">
                {joinUrl}
              </code>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-e1 overflow-hidden p-0">
          <CardContent className="overflow-x-auto p-0">
            <table className="w-full text-sm">
              <thead className="bg-muted text-right">
                <tr>
                  <th className="p-3 font-medium">שם</th>
                  <th className="p-3 font-medium">טלפון</th>
                  <th className="p-3 font-medium">אימייל</th>
                  <th className="p-3 font-medium">תפקיד</th>
                  <th className="p-3 font-medium">סטטוס</th>
                  <th className="p-3 font-medium">שעות</th>
                  <th className="p-3 font-medium" />
                </tr>
              </thead>
              <tbody>
                {(profiles ?? []).map((p) => {
                  const status = STATUS_LABEL[p.status] ?? { label: p.status, tone: "bg-subtle" };
                  return (
                    <tr key={p.id} className="border-t border-border">
                      <td className="p-3">
                        <Link href={`/admin/therapists/${p.id}`} className="font-medium text-violet-600 hover:underline">
                          {p.full_name}
                        </Link>
                      </td>
                      <td className="p-3" dir="ltr">
                        {p.phone}
                      </td>
                      <td className="p-3" dir="ltr">
                        {p.email}
                      </td>
                      <td className="p-3">{ROLE_LABEL[p.role] ?? p.role}</td>
                      <td className="p-3">
                        <span className={`rounded-pill px-2.5 py-1 text-xs font-medium ${status.tone}`}>{status.label}</span>
                      </td>
                      <td className="tabular-nums p-3">{hoursByUser.get(p.id) ?? 0}</td>
                      <td className="p-3">
                        <form action={adminResetPasswordAction}>
                          <input type="hidden" name="email" value={p.email} />
                          <Button type="submit" size="sm" variant="outline">
                            איפוס סיסמה
                          </Button>
                        </form>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </CardContent>
        </Card>

        <Card className="shadow-e1">
          <CardHeader>
            <CardTitle className="text-base font-medium">הזמנה ידנית (חד-פעמית)</CardTitle>
            <CardDescription>למקרה שרוצים להזמין אדמין/ית נוסף/ת, או מטפל/ת ספציפי/ת בלי לפרסם קישור כללי.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <form action={createInviteAction} className="flex items-end gap-3">
              <select name="role" className="h-10 rounded-field border border-input bg-background px-3">
                <option value="therapist">מטפל/ת</option>
                <option value="admin">אדמין/ית</option>
              </select>
              <Button type="submit">יצירת קישור הזמנה</Button>
            </form>
            <ul className="flex flex-col gap-1 text-sm">
              {(invites ?? []).map((inv) => (
                <li key={inv.token} className="flex items-center justify-between gap-3 text-muted-foreground">
                  <code dir="ltr" className="truncate text-xs">
                    {appUrl}/invite/{inv.token}
                  </code>
                  <span>{inv.used_at ? "נוצל" : new Date(inv.expires_at) < new Date() ? "פג תוקף" : "פעיל"}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
