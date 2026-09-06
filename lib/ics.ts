// ייצור iCalendar (RFC 5545) לצירוף למייל אישור הזמנה. פיד ה-ICS האישי
// (app/api/ics/[token]/route.ts) עצמאי ובונה VEVENT משלו — לא חולק קוד עם
// הקובץ הזה, כי הוא כבר עבד לפני ה-feature הזה ואין סיבה לגעת בו.

function escapeIcsText(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

function formatIcsDate(d: Date): string {
  return d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
}

/** עוטף שורות ארוכות ל-75 תווים לפי RFC 5545 (המשך שורה מתחיל ברווח). */
function foldIcsLine(line: string): string {
  if (line.length <= 75) return line;
  const chunks: string[] = [];
  let rest = line;
  chunks.push(rest.slice(0, 75));
  rest = rest.slice(75);
  while (rest.length > 0) {
    chunks.push(" " + rest.slice(0, 74));
    rest = rest.slice(74);
  }
  return chunks.join("\r\n");
}

export interface IcsEvent {
  uid: string;
  summary: string;
  description?: string;
  location?: string;
  startsAt: Date;
  endsAt: Date;
}

function buildVevent(event: IcsEvent, stamp: Date): string[] {
  const lines = [
    "BEGIN:VEVENT",
    `UID:${event.uid}`,
    `DTSTAMP:${formatIcsDate(stamp)}`,
    `DTSTART:${formatIcsDate(event.startsAt)}`,
    `DTEND:${formatIcsDate(event.endsAt)}`,
    `SUMMARY:${escapeIcsText(event.summary)}`,
  ];
  if (event.description) lines.push(`DESCRIPTION:${escapeIcsText(event.description)}`);
  if (event.location) lines.push(`LOCATION:${escapeIcsText(event.location)}`);
  lines.push("END:VEVENT");
  return lines;
}

/** קובץ ICS למפגש בודד — לצירוף למייל אישור הזמנה. */
export function generateSingleEventIcs(event: IcsEvent): string {
  const stamp = new Date();
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Cleana//booking//HE",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    ...buildVevent(event, stamp),
    "END:VCALENDAR",
  ];
  return lines.map(foldIcsLine).join("\r\n");
}
