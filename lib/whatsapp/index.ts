import "server-only";
import { toE164Israel } from "@/lib/phone";

// שליחת תזכורת WhatsApp דרך Meta WhatsApp Cloud API הרשמי (החליף את שערי
// ה-QR הלא-רשמיים — ר' PROGRESS.md סעיף 27). המספר שנרשם ל-Meta הוא מספר
// ייעודי של הקליניקה.
//
//   POST https://graph.facebook.com/{version}/{phone_number_id}/messages
//   Authorization: Bearer <access_token>
//   { messaging_product: "whatsapp", to: "<digits>", type: "template",
//     template: { name, language: { code }, components: [{ type: "body",
//       parameters: [{ type: "text", text }, …] }] } }
//
// 🔴 הודעה יזומה חייבת להיות תבנית *מאושרת* ב-Meta Business Manager — לא
// טקסט חופשי. הפרמטרים נשלחים בסדר קבוע (REMINDER_TEMPLATE_PARAMS) והתבנית
// שהקליניקה מאשרת ב-Meta חייבת לכלול {{1}}…{{6}} באותו סדר. הטקסט המומלץ
// להעתקה ל-Meta מוצג במסך ההגדרות (suggestedMetaTemplateBody).
//
// 🔴 לעולם לא זורק (כמו sendEmail); אין טלפון/טוקן בלוגים (CLAUDE.md).

export const META_GRAPH_VERSION = "v21.0";

export interface MetaCloudCredentials {
  phoneNumberId: string;
  accessToken: string;
  templateName: string;
  templateLang: string;
}

export type SendWhatsAppResult = { ok: true; messageId?: string } | { ok: false; error: string };

export type ReminderTemplateVars = {
  name: string;
  clinic: string;
  date: string;
  time: string;
  room: string;
  branch: string;
};

/** סדר הפרמטרים {{1}}…{{6}} בתבנית ה-Meta — חוזה עם מה שהקליניקה מאשרת שם. */
export const REMINDER_TEMPLATE_PARAMS: (keyof ReminderTemplateVars)[] = ["name", "clinic", "date", "time", "room", "branch"];

/**
 * מספר בפורמט בינלאומי בלי "+" (כמו ש-Meta ו-wa.me מצפים): "972501234567".
 * 🔴 מנרמל גם פורמט מקומי ישראלי ("0501234567") — בלי קידומת מדינה WhatsApp
 * מפרש את הספרות כ-username ("isn't on WhatsApp"). מספר שאינו ישראלי עובר
 * כספרות בלבד (בהנחה שכבר בינלאומי).
 */
export function toWhatsAppDigits(phone: string): string {
  const e164 = toE164Israel(phone);
  return (e164 ?? phone).replace(/[^\d]/g, "");
}

export async function sendWhatsAppReminderTemplate(
  creds: MetaCloudCredentials,
  toPhoneE164: string,
  vars: ReminderTemplateVars,
): Promise<SendWhatsAppResult> {
  const digits = toWhatsAppDigits(toPhoneE164);
  if (!digits) return { ok: false, error: "INVALID_PHONE" };
  if (!creds.phoneNumberId || !creds.accessToken || !creds.templateName) return { ok: false, error: "NOT_CONFIGURED" };

  try {
    const res = await fetch(
      `https://graph.facebook.com/${META_GRAPH_VERSION}/${encodeURIComponent(creds.phoneNumberId)}/messages`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${creds.accessToken}` },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: digits,
          type: "template",
          template: {
            name: creds.templateName,
            language: { code: creds.templateLang || "he" },
            components: [
              {
                type: "body",
                // Meta דוחה פרמטר ריק / עם שורות חדשות / 4+ רווחים רצופים.
                parameters: REMINDER_TEMPLATE_PARAMS.map((key) => ({
                  type: "text",
                  text: (vars[key] || "-").replace(/\s+/g, " ").trim() || "-",
                })),
              },
            ],
          },
        }),
      },
    );

    if (!res.ok) {
      let detail = `HTTP ${res.status}`;
      try {
        const body = (await res.json()) as { error?: { message?: string; code?: number } };
        if (body.error?.message) detail = `${body.error.code ?? res.status}: ${body.error.message}`;
      } catch {
        // גוף לא-JSON — נשארים עם קוד ה-HTTP
      }
      console.error(`[whatsapp:meta] ${detail}`);
      return { ok: false, error: detail };
    }
    const body = (await res.json()) as { messages?: { id?: string }[] };
    return { ok: true, messageId: body.messages?.[0]?.id };
  } catch (err) {
    console.error("[whatsapp:meta] שליחה נכשלה", err instanceof Error ? err.message : err);
    return { ok: false, error: err instanceof Error ? err.message : "UNKNOWN" };
  }
}

/** ממלא {name} {clinic} {date} {time} {room} {branch} בתבנית הטקסט החופשי —
 * למסלול החצי-ידני (wa.me) ולתצוגה מקדימה. */
export function renderReminderTemplate(template: string, vars: ReminderTemplateVars): string {
  return template.replace(/\{(name|clinic|date|time|room|branch)\}/g, (_m, key: keyof ReminderTemplateVars) => vars[key]);
}

/** קישור "לחיצה ושליחה" — פותח את WhatsApp של המנהל/ת עם ההודעה מוכנה
 * למטפל/ת. השליחה עצמה ידנית, מהטלפון האמיתי — אפס סיכון חסימה. */
export function buildWaMeLink(toPhoneE164: string, text: string): string {
  return `https://wa.me/${toWhatsAppDigits(toPhoneE164)}?text=${encodeURIComponent(text)}`;
}

/** גוף התבנית המומלץ להעתקה ל-Meta Business Manager, עם {{n}} בסדר הנכון. */
export function suggestedMetaTemplateBody(lang: "he" | "en"): string {
  return lang === "he"
    ? "שלום {{1}}, תזכורת להזמנה שלך ב-{{2}}: {{3}} בשעה {{4}}, {{5}} ({{6}})."
    : "Hi {{1}}, a reminder of your booking at {{2}}: {{3}} at {{4}}, {{5}} ({{6}}).";
}
