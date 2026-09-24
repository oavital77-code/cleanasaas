import { NextResponse, type NextRequest } from "next/server";
import { requireClinicAdmin } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_TIMEZONE } from "@/lib/time";
import { normalizeLocale } from "@/lib/i18n";
import { toCsv } from "@/lib/csv";
import { reportMonth } from "@/lib/reports/month";
import { isReportSection, loadReportSection } from "@/lib/reports/sections";

// ייצוא רובריקה אחת מ-/admin/reports ל-CSV — אותן שורות שבטבלה, בלי הגבלת
// תצוגה. requireClinicAdmin מפנה החוצה מי שאינו מנהל/ת קליניקה.
export async function GET(request: NextRequest) {
  const { profile, clinicId } = await requireClinicAdmin();
  const section = request.nextUrl.searchParams.get("section");
  if (!isReportSection(section)) {
    return NextResponse.json({ error: "unknown section" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: clinic } = await supabase.from("clinics").select("timezone").eq("id", clinicId).single();
  const timezone = clinic?.timezone ?? DEFAULT_TIMEZONE;
  const month = reportMonth(request.nextUrl.searchParams.get("month") ?? undefined, new Date(), timezone);

  let table;
  try {
    table = await loadReportSection(section, { supabase, clinicId, month, timezone, locale: normalizeLocale(profile.locale) });
  } catch (error) {
    console.error("[reports/export]", section, error);
    return NextResponse.json({ error: "export failed" }, { status: 500 });
  }

  const csv = toCsv(
    table.columns.map((c) => c.label),
    table.rows,
  );
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="cleana-${section}-${month.key}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
