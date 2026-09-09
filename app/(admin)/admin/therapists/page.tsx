import Link from "next/link";
import { requireClinicAdmin } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { X, Upload } from "lucide-react";
import { createInviteAction, toggleClinicPublishedAction, revokeInviteAction, clearUsedInvitesAction } from "./actions";
import { getAdminTherapistsDict, getCommonDict, normalizeLocale } from "@/lib/i18n";

const STATUS_TONE: Record<string, string> = {
  active: "bg-success-bg text-success-fg",
  suspended: "bg-danger-bg text-danger",
  archived: "bg-subtle text-muted-foreground",
};

export default async function TherapistsPage() {
  const { profile, clinicId } = await requireClinicAdmin();
  const supabase = await createClient();
  const locale = normalizeLocale(profile.locale);
  const t = getAdminTherapistsDict(locale);
  const c = getCommonDict(locale);

  const [{ data: clinic }, { data: profiles }, { data: cards }, { data: invites }] = await Promise.all([
    supabase.from("clinics").select("name, slug, published").eq("id", clinicId).single(),
    supabase.from("profiles").select("id, full_name, phone, email, role, status, clerk_user_id").eq("clinic_id", clinicId).order("full_name"),
    supabase.from("punch_cards").select("user_id, hours_remaining").eq("clinic_id", clinicId).eq("active", true),
    supabase
      .from("clinic_invites")
      .select("token, role, created_at, expires_at, used_at")
      .eq("clinic_id", clinicId)
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  const hoursByUser = new Map<string, number>();
  for (const card of cards ?? []) {
    hoursByUser.set(card.user_id, (hoursByUser.get(card.user_id) ?? 0) + Number(card.hours_remaining));
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
  const joinUrl = clinic?.slug ? `${appUrl}/join/${clinic.slug}` : "";

  return (
    <AppShell side="admin" clinicName={clinic?.name} fullName={profile.full_name} locale={profile.locale}>
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold">{t.title}</h1>
          <Button asChild variant="outline" size="sm">
            <Link href="/admin/therapists/import">
              <Upload className="size-4" />
              {t.importFromFile}
            </Link>
          </Button>
        </div>

        <Card className="shadow-e1">
          <CardHeader>
            <CardTitle className="text-base font-medium">{t.joinLinkTitle}</CardTitle>
            <CardDescription>{t.joinLinkDescription}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <form action={toggleClinicPublishedAction} className="flex flex-wrap items-center gap-3">
              <input type="hidden" name="published" value={clinic?.published ? "off" : "on"} />
              <Button type="submit" variant={clinic?.published ? "outline" : "default"} size="sm">
                {clinic?.published ? t.closeRegistration : t.publishClinic}
              </Button>
              <span className={`text-sm ${clinic?.published ? "text-success" : "text-muted-foreground"}`}>
                {clinic?.published ? t.openForRegistration : t.closedForRegistration}
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
              <thead className="bg-muted text-start">
                <tr>
                  <th className="p-3 text-start font-medium">{t.colName}</th>
                  <th className="hidden p-3 text-start font-medium sm:table-cell">{t.colPhone}</th>
                  <th className="hidden p-3 text-start font-medium md:table-cell">{t.colEmail}</th>
                  <th className="p-3 text-start font-medium">{t.colRole}</th>
                  <th className="p-3 text-start font-medium">{t.colStatus}</th>
                  <th className="hidden p-3 text-start font-medium sm:table-cell">{t.colHours}</th>
                </tr>
              </thead>
              <tbody>
                {(profiles ?? []).map((p) => (
                  <tr key={p.id} className="border-t border-border">
                    <td className="p-3">
                      <Link href={`/admin/therapists/${p.id}`} className="font-medium text-violet-600 hover:underline">
                        {p.full_name}
                      </Link>
                    </td>
                    <td className="hidden p-3 sm:table-cell" dir="ltr">
                      {p.phone}
                    </td>
                    <td className="hidden p-3 md:table-cell" dir="ltr">
                      {p.email}
                    </td>
                    <td className="p-3">{c.role[p.role] ?? p.role}</td>
                    <td className="p-3">
                      <span className={`rounded-pill px-2.5 py-1 text-xs font-medium ${STATUS_TONE[p.status] ?? "bg-subtle"}`}>
                        {c.profileStatus[p.status] ?? p.status}
                      </span>
                      {!p.clerk_user_id && (
                        <span className="ms-1 rounded-pill bg-warning-bg px-2 py-0.5 text-xs text-warning-fg" title={t.pendingSignup}>
                          {t.pendingSignup}
                        </span>
                      )}
                    </td>
                    <td className="tabular-nums hidden p-3 sm:table-cell">{hoursByUser.get(p.id) ?? 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>

        <Card className="shadow-e1">
          <CardHeader>
            <CardTitle className="text-base font-medium">{t.manualInviteTitle}</CardTitle>
            <CardDescription>{t.manualInviteDescription}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <form action={createInviteAction} className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <Select name="role" className="sm:w-auto">
                <option value="therapist">{c.role.therapist}</option>
                <option value="admin">{c.role.admin}</option>
              </Select>
              <Button type="submit" className="w-full sm:w-auto">
                {t.createInviteLink}
              </Button>
            </form>
            {invites && invites.length > 0 && (
              <>
                <ul className="flex flex-col gap-1 text-sm">
                  {invites.map((inv) => {
                    const used = Boolean(inv.used_at);
                    const expired = !used && new Date(inv.expires_at) < new Date();
                    return (
                      <li key={inv.token} className="flex items-center justify-between gap-2 text-muted-foreground">
                        <code dir="ltr" className="min-w-0 truncate text-xs">
                          {appUrl}/invite/{inv.token}
                        </code>
                        <span className="shrink-0 text-xs">{used ? t.inviteUsed : expired ? t.inviteExpired : t.inviteActive}</span>
                        <form action={revokeInviteAction}>
                          <input type="hidden" name="token" value={inv.token} />
                          <button
                            type="submit"
                            className="flex size-8 shrink-0 items-center justify-center rounded-button text-muted-foreground hover:text-danger"
                            title={t.revokeInviteTitle}
                          >
                            <X className="size-3.5" />
                          </button>
                        </form>
                      </li>
                    );
                  })}
                </ul>
                {invites.some((inv) => inv.used_at || new Date(inv.expires_at) < new Date()) && (
                  <form action={clearUsedInvitesAction}>
                    <Button type="submit" size="sm" variant="outline">
                      {t.clearUsedInvites}
                    </Button>
                  </form>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
