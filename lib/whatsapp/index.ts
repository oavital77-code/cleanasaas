import "server-only";

// שליחת הודעת WhatsApp דרך שער QR (המספר של הקליניקה מקושר בסריקת QR
// בקונסולת הספק, כמו WhatsApp Web). שני ספקים נתמכים, אותו חוזה:
//
//   green_api — POST {apiUrl}/waInstance{instanceId}/sendMessage/{token}
//               body { chatId: "<digits>@c.us", message }
//   whapi     — POST https://gate.whapi.cloud/messages/text
//               Authorization: Bearer <token>, body { to: "<digits>", body }
//
// 🔴 לעולם לא זורק — כמו sendEmail: כישלון שליחה לא מפיל את ה-cron ולא
// זרימה עסקית. הקורא מחליט מה לעשות (לסמן/לא לסמן, לרשום audit).
// 🔴 אין לוגים עם מספר טלפון או טוקן (CLAUDE.md: אין PII בלוגים).

export type WhatsAppProvider = "green_api" | "whapi";

export interface WhatsAppCredentials {
  provider: WhatsAppProvider;
  instanceId: string | null;
  apiUrl: string | null;
  apiToken: string;
}

export type SendWhatsAppResult = { ok: true } | { ok: false; error: string };

const GREEN_API_DEFAULT_URL = "https://api.green-api.com";
const WHAPI_URL = "https://gate.whapi.cloud/messages/text";

/** "+972501234567" → "972501234567" (ספרות בלבד, כמו שכל השערים מצפים). */
function toDigits(e164: string): string {
  return e164.replace(/[^\d]/g, "");
}

export function isWhatsAppProvider(value: string): value is WhatsAppProvider {
  return value === "green_api" || value === "whapi";
}

export async function sendWhatsAppText(
  creds: WhatsAppCredentials,
  toPhoneE164: string,
  text: string,
): Promise<SendWhatsAppResult> {
  const digits = toDigits(toPhoneE164);
  if (!digits) return { ok: false, error: "INVALID_PHONE" };
  if (!creds.apiToken) return { ok: false, error: "NOT_CONFIGURED" };

  try {
    let res: Response;
    if (creds.provider === "green_api") {
      if (!creds.instanceId) return { ok: false, error: "NOT_CONFIGURED" };
      const base = (creds.apiUrl || GREEN_API_DEFAULT_URL).replace(/\/+$/, "");
      res = await fetch(
        `${base}/waInstance${encodeURIComponent(creds.instanceId)}/sendMessage/${encodeURIComponent(creds.apiToken)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chatId: `${digits}@c.us`, message: text }),
        },
      );
    } else {
      res = await fetch(WHAPI_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${creds.apiToken}` },
        body: JSON.stringify({ to: digits, body: text }),
      });
    }

    if (!res.ok) {
      console.error(`[whatsapp:${creds.provider}] HTTP ${res.status}`);
      return { ok: false, error: `${creds.provider.toUpperCase()}_${res.status}` };
    }
    return { ok: true };
  } catch (err) {
    console.error(`[whatsapp:${creds.provider}] שליחה נכשלה`, err instanceof Error ? err.message : err);
    return { ok: false, error: err instanceof Error ? err.message : "UNKNOWN" };
  }
}

export type ReminderTemplateVars = {
  name: string;
  date: string;
  time: string;
  room: string;
  branch: string;
  clinic: string;
};

/** ממלא {name} {date} {time} {room} {branch} {clinic} בתבנית שהאדמין הגדיר. */
export function renderReminderTemplate(template: string, vars: ReminderTemplateVars): string {
  return template.replace(/\{(name|date|time|room|branch|clinic)\}/g, (_m, key: keyof ReminderTemplateVars) => vars[key]);
}
