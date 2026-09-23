import { toE164Israel } from "@/lib/phone";

/**
 * פנייה מדף הנחיתה — אימות ונרמול לפני שהיא נכנסת ל-platform_leads.
 *
 * הטופס ציבורי לגמרי (אין התחברות, אין קליניקה), ולכן כל שדה כאן מגיע
 * מהאינטרנט הפתוח: אורך חסום, מייל מנורמל ל-lowercase, טלפון מומר ל-E.164
 * באותה פונקציה שמנרמלת טלפוני מטפלים/ות, ושדה מלכודת לבוטים.
 */
const MAX = { name: 120, email: 254, clinicName: 160, message: 2000 } as const;

export interface LeadInput {
  name: string;
  phone: string;
  email: string | null;
  clinicName: string | null;
  message: string | null;
}

export type LeadInputResult =
  | { ok: true; value: LeadInput }
  /** "bot" — מלכודת מולאה; הקורא מעמיד פנים שהכול תקין ולא שומר כלום. */
  | { ok: false; reason: "missing" | "phone" | "email" | "bot" };

const EMAIL = /^[^\s@]+@[^\s@.]+(?:\.[^\s@.]+)+$/;

const text = (raw: unknown, max: number): string => String(raw ?? "").trim().slice(0, max);

export function parseLeadInput(raw: {
  name: unknown;
  phone: unknown;
  email: unknown;
  clinicName: unknown;
  message: unknown;
  /** שדה שמוסתר ב-CSS: אדם לא רואה אותו, בוט ממלא אותו. */
  website: unknown;
}): LeadInputResult {
  if (text(raw.website, 200) !== "") return { ok: false, reason: "bot" };

  const name = text(raw.name, MAX.name);
  const phoneRaw = text(raw.phone, 40);
  if (!name || !phoneRaw) return { ok: false, reason: "missing" };

  const phone = toE164Israel(phoneRaw);
  if (!phone) return { ok: false, reason: "phone" };

  const emailRaw = text(raw.email, MAX.email).toLowerCase();
  if (emailRaw && !EMAIL.test(emailRaw)) return { ok: false, reason: "email" };

  return {
    ok: true,
    value: {
      name,
      phone,
      email: emailRaw || null,
      clinicName: text(raw.clinicName, MAX.clinicName) || null,
      message: text(raw.message, MAX.message) || null,
    },
  };
}
