import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// פיד ICS ציבורי (CLEANASITEMAPANDDESIGN §4) — נצרך ע"י Google/Outlook/Apple
// Calendar דרך URL עם טוקן, בלי session. הטוקן (profiles.ics_token) הוא
// ה-secret היחיד; לכן admin client כאן, אחרי חיפוש הפרופיל לפי הטוקן —
// אין דרך אחרת לאמת בקשה כזו. מחזיר רק את ההזמנות של אותו פרופיל בלבד,
// לעולם לא של מטפל/ת אחר/ת (חוק #3).
function escapeIcsText(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/,/g, "\\,").replace(/;/g, "\\;").replace(/\n/g, "\\n");
}

function toIcsDate(iso: string): string {
  return new Date(iso).toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
}

export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const supabase = createAdminClient();

  const { data: profile } = await supabase.from("profiles").select("id, full_name, clinic_id").eq("ics_token", token).maybeSingle();
  if (!profile) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  const { data: bookings } = await supabase
    .from("bookings")
    .select("id, starts_at, ends_at, status, rooms(name)")
    .eq("user_id", profile.id)
    .eq("status", "confirmed")
    .gt("starts_at", new Date(Date.now() - 24 * 60 * 60_000).toISOString())
    .order("starts_at");

  const events = (bookings ?? [])
    .map((b) => {
      const roomName = (b.rooms as { name?: string } | null)?.name ?? "חדר";
      return [
        "BEGIN:VEVENT",
        `UID:${b.id}@cleana`,
        `DTSTAMP:${toIcsDate(new Date().toISOString())}`,
        `DTSTART:${toIcsDate(b.starts_at)}`,
        `DTEND:${toIcsDate(b.ends_at)}`,
        `SUMMARY:${escapeIcsText(roomName)}`,
        "END:VEVENT",
      ].join("\r\n");
    })
    .join("\r\n");

  const body = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Cleana//Bookings//HE",
    "CALSCALE:GREGORIAN",
    `X-WR-CALNAME:${escapeIcsText(profile.full_name)} — הזמנות`,
    events,
    "END:VCALENDAR",
  ]
    .filter(Boolean)
    .join("\r\n");

  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": "inline; filename=cleana.ics",
    },
  });
}
