/**
 * מחירי מודל הססיה שאדמין קליניקה שומר בטופס ההגדרות.
 *
 * 🔴 בלי ולידציה, `Number(formData.get(...))` על שדה ריק הוא 0, על טקסט הוא
 * NaN, ועל שניהם ה-upsert ל-app_settings עובר בשקט — כלומר "מחיר" NaN או
 * שלילי שמוצג למטפלים/ות ונכנס לחישוב הססיה. אותה תבנית בדיוק כמו
 * parseTierFields של הכרטיסיות, שכבר עושה זאת נכון.
 */
const MAX_HOURS = 1000;
const MAX_PRICE = 1_000_000;

export interface SessionPricing {
  baseHours: number;
  basePrice: number;
}

export type SessionPricingResult = { ok: true; value: SessionPricing } | { ok: false };

function num(raw: unknown): number | null {
  const trimmed = String(raw ?? "").trim();
  if (!/^\d+(?:\.\d+)?$/.test(trimmed)) return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : null;
}

export function parseSessionPricing(raw: { baseHours: unknown; basePrice: unknown }): SessionPricingResult {
  const baseHours = num(raw.baseHours);
  const basePrice = num(raw.basePrice);
  if (baseHours === null || basePrice === null) return { ok: false };
  if (!Number.isInteger(baseHours) || baseHours < 1 || baseHours > MAX_HOURS) return { ok: false };
  if (basePrice > MAX_PRICE) return { ok: false };
  return { ok: true, value: { baseHours, basePrice } };
}
