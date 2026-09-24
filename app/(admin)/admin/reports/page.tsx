import Link from "next/link";
import { requireClinicAdmin } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_TIMEZONE, formatCurrencyILS } from "@/lib/time";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getAdminReportsDict, normalizeLocale } from "@/lib/i18n";
import { reportMonth } from "@/lib/reports/month";
import { REPORT_SECTIONS, loadReportSection, type ReportTable } from "@/lib/reports/sections";

// דוחות לפי חודש: אריח לכל רובריקה, ומתחתיו הפירוט שמאחורי המספר + ייצוא
// ל-CSV. הפירוט והקובץ נבנים מאותו loader (lib/reports/sections.ts).
const MAX_ROWS_SHOWN = 100;

function monthLabel(key: string, locale: string) {
  const [y, m] = key.split("-").map(Number);
  return new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "he-IL", { month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(Date.UTC(y, m - 1, 15)),
  );
}

function renderCell(value: unknown, kind: ReportTable["columns"][number]["kind"]) {
  if (value === null || value === undefined || value === "") return "—";
  if (kind === "money" && typeof value === "number") return formatCurrencyILS(value);
  return String(value);
}

export default async function AdminReportsPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const { profile, clinicId } = await requireClinicAdmin();
  const supabase = await createClient();
  const locale = normalizeLocale(profile.locale);
  const t = getAdminReportsDict(locale);
  const { month: monthParam } = await searchParams;

  const { data: clinic } = await supabase.from("clinics").select("name, timezone").eq("id", clinicId).single();
  const timezone = clinic?.timezone ?? DEFAULT_TIMEZONE;
  const month = reportMonth(monthParam, new Date(), timezone);
  const tables = await Promise.all(
    REPORT_SECTIONS.map((section) => loadReportSection(section, { supabase, clinicId, month, timezone, locale })),
  );

  return (
    <AppShell side="admin" clinicName={clinic?.name} fullName={profile.full_name} locale={profile.locale}>
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold">{t.title}</h1>
          <nav className="flex items-center gap-2" aria-label={t.title}>
            <Button asChild size="sm" variant="outline">
              <Link href={`/admin/reports?month=${month.prevKey}`}>{t.prevMonth}</Link>
            </Button>
            <span className="min-w-32 text-center font-medium">{monthLabel(month.key, locale)}</span>
            {month.nextKey ? (
              <Button asChild size="sm" variant="outline">
                <Link href={`/admin/reports?month=${month.nextKey}`}>{t.nextMonth}</Link>
              </Button>
            ) : (
              <Button size="sm" variant="outline" disabled>
                {t.nextMonth}
              </Button>
            )}
          </nav>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {tables.map((table) => (
            <a key={table.section} href={`#${table.section}`} className="rounded-lg focus-visible:outline-2">
              <Card className="shadow-e1 h-full transition-colors hover:bg-muted/50">
                <CardHeader>
                  <CardTitle className="tabular-nums text-2xl">{table.headline}</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">{table.title}</CardContent>
              </Card>
            </a>
          ))}
        </div>

        {tables.map((table) => (
          <ReportSectionCard key={table.section} table={table} monthKey={month.key} t={t} />
        ))}
      </div>
    </AppShell>
  );
}

function ReportSectionCard({ table, monthKey, t }: { table: ReportTable; monthKey: string; t: ReturnType<typeof getAdminReportsDict> }) {
  const shown = table.rows.slice(0, MAX_ROWS_SHOWN);
  return (
    <section id={table.section} className="scroll-mt-20">
      <Card className="shadow-e1 overflow-hidden">
        <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <CardTitle>
              {t.details}: {table.title} <span className="tabular-nums text-muted-foreground">({table.headline})</span>
            </CardTitle>
            {table.snapshot && <p className="text-xs text-muted-foreground">{t.snapshotNote}</p>}
          </div>
          {table.rows.length > 0 && (
            <Button asChild size="sm" variant="outline">
              {/* קובץ להורדה — לא ניווט של ה-router */}
              <a href={`/admin/reports/export?section=${table.section}&month=${monthKey}`} download>
                {t.exportCsv}
              </a>
            </Button>
          )}
        </CardHeader>
        <CardContent className="flex flex-col gap-4 p-0">
          {table.breakdowns.some((b) => b.items.length > 0) && (
            <div className="flex flex-wrap gap-6 px-6">
              {table.breakdowns
                .filter((b) => b.items.length > 0)
                .map((b) => (
                  <dl key={b.title} className="text-sm">
                    <dt className="mb-1 font-medium">{b.title}</dt>
                    {b.items.map((item) => (
                      <dd key={item.label} className="flex justify-between gap-4 text-muted-foreground">
                        <span>{item.label}</span>
                        <span className="tabular-nums">{item.value}</span>
                      </dd>
                    ))}
                  </dl>
                ))}
            </div>
          )}
          {table.rows.length === 0 ? (
            <p className="px-6 pb-6 text-sm text-muted-foreground">{t.empty}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted">
                  <tr>
                    {table.columns.map((col) => (
                      <th key={col.label} className="whitespace-nowrap p-3 text-start font-medium">
                        {col.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {shown.map((row, i) => (
                    <tr key={i} className="border-t border-border">
                      {row.map((value, j) => (
                        <td key={j} className={`whitespace-nowrap p-3 ${table.columns[j].kind === "text" ? "" : "tabular-nums"}`}>
                          {renderCell(value, table.columns[j].kind)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              {table.rows.length > shown.length && (
                <p className="border-t border-border p-3 text-xs text-muted-foreground">{t.shownOf(shown.length, table.rows.length)}</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
