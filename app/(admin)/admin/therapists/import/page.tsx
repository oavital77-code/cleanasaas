import Link from "next/link";
import { requireClinicAdmin } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { getAdminImportDict, normalizeLocale } from "@/lib/i18n";
import { TEMPLATE_HEADERS, TEMPLATE_EXAMPLE_ROWS } from "@/lib/import/therapists";
import { ImportForm } from "./import-form";

// ייבוא מטפלים/ות מ-Excel/CSV — הדף מסביר את הפורמט הנדרש (בקשת המשתמש/ת:
// "אם נדרש סידור מסוים — להסביר ולהנחות"), נותן תבנית להורדה, ואז
// <ImportForm> (תצוגה מקדימה → אישור).
export default async function ImportTherapistsPage() {
  const { profile, clinicId } = await requireClinicAdmin();
  const supabase = await createClient();
  const t = getAdminImportDict(normalizeLocale(profile.locale));
  const { data: clinic } = await supabase.from("clinics").select("name, slug, published").eq("id", clinicId).single();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
  const joinUrl = clinic?.slug ? `${appUrl}/join/${clinic.slug}` : "";

  return (
    <AppShell side="admin" clinicName={clinic?.name} fullName={profile.full_name} locale={profile.locale}>
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-8">
        <div>
          <Link href="/admin/therapists" className="text-sm text-violet-600 hover:underline">
            {t.backToTherapists}
          </Link>
          <h1 className="mt-1 text-2xl font-semibold">{t.title}</h1>
        </div>

        <Card className="shadow-e1">
          <CardHeader>
            <CardTitle className="text-base font-medium">{t.formatTitle}</CardTitle>
            <CardDescription>{t.formatDescription}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <ol className="list-decimal space-y-1 ps-5 text-sm">
              {t.steps.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ol>

            <div className="overflow-x-auto rounded-field border border-border">
              <table className="w-full text-sm">
                <thead className="bg-muted">
                  <tr>
                    {TEMPLATE_HEADERS.map((h) => (
                      <th key={h} className="p-2 text-start font-medium">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {TEMPLATE_EXAMPLE_ROWS.map((row, i) => (
                    <tr key={i} className="border-t border-border text-muted-foreground">
                      {row.map((cell, j) => (
                        <td key={j} className="p-2" dir={j === 1 || j === 2 ? "ltr" : undefined}>
                          {cell || "—"}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <ul className="list-disc space-y-1 ps-5 text-sm text-muted-foreground">
              {t.columnNotes.map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>

            <Button asChild variant="outline" size="sm" className="w-fit">
              <a href="/admin/therapists/import/template" download>
                <Download className="size-4" />
                {t.downloadTemplate}
              </a>
            </Button>
          </CardContent>
        </Card>

        <Card className="shadow-e1">
          <CardHeader>
            <CardTitle className="text-base font-medium">{t.uploadTitle}</CardTitle>
            <CardDescription>{t.uploadDescription}</CardDescription>
          </CardHeader>
          <CardContent>
            <ImportForm />
          </CardContent>
        </Card>

        <Card className="shadow-e1">
          <CardHeader>
            <CardTitle className="text-base font-medium">{t.afterTitle}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-sm">
            <p>{t.afterDescription}</p>
            {clinic?.published && joinUrl ? (
              <code dir="ltr" className="block truncate rounded bg-muted px-2 py-1.5 text-xs">
                {joinUrl}
              </code>
            ) : (
              <p className="text-warning-fg">{t.afterNotPublished}</p>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
