/**
 * תמחור מודל הססיה: טווח שעות שבועיות ומחיר לשעה שבועית (לחודש, לפני מע"מ).
 * ססיה של H שעות עולה H × מחיר לחודש.
 *
 * עד 25.9.2026 הססיה הייתה בגודל אחד — בדיוק session_base_hours ב-
 * session_base_price. readSessionPricing נופל חזרה לשני אלה בדיוק כמו
 * session_pricing() ב-DB (20260925000001): min = max = base hours, מחיר לשעה =
 * base price / base hours. אותם מספרים בשני הצדדים, או שהמסך יציג מחיר אחר
 * מזה שנשמר.
 */
export const SESSION_KEYS = {
  minHours: "session_min_hours",
  maxHours: "session_max_hours",
  pricePerHour: "session_price_per_hour",
  legacyHours: "session_base_hours",
  legacyPrice: "session_base_price",
} as const;

const DEFAULT_HOURS = 5;
const DEFAULT_PRICE = 600;
/** שבוע שלם. גבול עליון שפוי, לא מדיניות. */
const MAX_WEEKLY_HOURS = 168;
const MAX_PRICE_PER_HOUR = 100_000;
const HOUR_STEP = 0.5;

export interface SessionPricing {
  minHours: number;
  maxHours: number;
  pricePerHour: number;
}

export type SessionPricingResult = { ok: true; value: SessionPricing } | { ok: false };

const round2 = (n: number) => Math.round(n * 100) / 100;

function num(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/** הגדרות app_settings של קליניקה (key → value) → התמחור בפועל. */
export function readSessionPricing(settings: Record<string, unknown>): SessionPricing {
  const legacyHours = num(settings[SESSION_KEYS.legacyHours]) ?? DEFAULT_HOURS;
  const legacyPrice = num(settings[SESSION_KEYS.legacyPrice]) ?? DEFAULT_PRICE;
  return {
    minHours: num(settings[SESSION_KEYS.minHours]) ?? legacyHours,
    maxHours: num(settings[SESSION_KEYS.maxHours]) ?? legacyHours,
    pricePerHour:
      num(settings[SESSION_KEYS.pricePerHour]) ?? (legacyHours > 0 ? round2(legacyPrice / legacyHours) : round2(DEFAULT_PRICE / DEFAULT_HOURS)),
  };
}

/** המחיר החודשי (לפני מע"מ) — אותו round(hours × price, 2) שה-DB שומר. */
export function sessionMonthlyPrice(hours: number, pricePerHour: number): number {
  return round2(hours * pricePerHour);
}

export function hoursInRange(hours: number, pricing: SessionPricing): boolean {
  return hours >= pricing.minHours - 1e-9 && hours <= pricing.maxHours + 1e-9;
}

/** "3" / "10" / "120" מהטופס → תמחור תקין, או סירוב. */
export function parseSessionPricing(raw: { minHours: unknown; maxHours: unknown; pricePerHour: unknown }): SessionPricingResult {
  const strict = (v: unknown) => {
    const s = String(v ?? "").trim();
    return /^\d+(?:\.\d+)?$/.test(s) ? Number(s) : null;
  };
  const minHours = strict(raw.minHours);
  const maxHours = strict(raw.maxHours);
  const pricePerHour = strict(raw.pricePerHour);
  if (minHours === null || maxHours === null || pricePerHour === null) return { ok: false };

  const onGrid = (h: number) => Math.abs(Math.round(h / HOUR_STEP) * HOUR_STEP - h) < 1e-9;
  if (!onGrid(minHours) || !onGrid(maxHours)) return { ok: false };
  if (minHours < HOUR_STEP || maxHours > MAX_WEEKLY_HOURS || minHours > maxHours) return { ok: false };
  if (pricePerHour > MAX_PRICE_PER_HOUR) return { ok: false };

  return { ok: true, value: { minHours, maxHours, pricePerHour: round2(pricePerHour) } };
}
