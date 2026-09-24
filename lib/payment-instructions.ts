/**
 * איך המטפלים/ות משלמים לקליניקה — טקסט חופשי שבעל/ת הקליניקה כותב/ת
 * ("ביט ל-050...", "העברה לבנק...").
 *
 * מאז שהסליקה בין מטפל/ת לקליניקה יצאה מהמוצר (24.9.2026), זה מה שמחליף את
 * כפתור "לתשלום בחנות": המטפל/ת רואה מחירים, והטקסט הזה אומר לו/ה איך לשלם.
 * נשמר ב-app_settings תחת PAYMENT_INSTRUCTIONS_KEY, כמו שאר הגדרות הקליניקה.
 */
export const PAYMENT_INSTRUCTIONS_KEY = "payment_instructions";
export const PAYMENT_INSTRUCTIONS_MAX = 1000;

/** הערך מ-app_settings (jsonb) → טקסט, או null אם אין מה להציג. */
export function readPaymentInstructions(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const text = value.trim();
  return text ? text : null;
}

/** מה שהאדמין הקליד → מה שנשמר. */
export function normalizePaymentInstructions(raw: unknown): string {
  return String(raw ?? "")
    .replace(/\r\n?/g, "\n")
    .trim()
    .slice(0, PAYMENT_INSTRUCTIONS_MAX);
}
