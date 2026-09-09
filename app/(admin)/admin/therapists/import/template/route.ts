import { requireClinicAdmin } from "@/lib/auth/guards";
import { buildTemplateCsv } from "@/lib/import/therapists";

// תבנית CSV להורדה (UTF-8 + BOM → Excel פותח עברית נכון). מאחורי guard
// כמו כל /admin — לא שיש בה משהו סודי, פשוט עקביות.
export async function GET() {
  await requireClinicAdmin();
  return new Response(buildTemplateCsv(), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="therapists-template.csv"',
      "Cache-Control": "no-store",
    },
  });
}
