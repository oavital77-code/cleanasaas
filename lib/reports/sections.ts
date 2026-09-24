import "server-only";
import type { createClient } from "@/lib/supabase/server";
import type { CsvCell } from "@/lib/csv";
import type { ReportMonth } from "./month";
import { pageAll } from "@/lib/supabase/page-all";
import { formatCurrencyILS, formatDateHe, formatDateTimeHe } from "@/lib/time";
import { formatIsraeliPhoneDisplay } from "@/lib/phone";
import { getAdminReportsDict, getAdminTherapistDetailDict, getCommonDict, type Locale } from "@/lib/i18n";

/**
 * הדוחות של /admin/reports — כל רובריקה עם השורות שמאחורי המספר שלה.
 *
 * הדף והייצוא ל-CSV קוראים את אותה פונקציה, כך שהטבלה על המסך והקובץ תמיד
 * זהים. השורות הן ערכים גולמיים: תאריכים כבר מעוצבים בשעון הקליניקה (כך
 * שהקובץ לא תלוי בהגדרות ה-Excel), וסכומים כמספרים — הדף מוסיף ₪ לפי סוג
 * העמודה, והקובץ נשאר ניתן לסכימה.
 *
 * הכול דרך ה-client של המשתמש/ת: RLS אוכף את גבולות הקליניקה, ו-clinic_id
 * מסונן גם במפורש.
 */
export const REPORT_SECTIONS = ["revenue", "hours", "bookings", "sessions", "therapists"] as const;
export type ReportSection = (typeof REPORT_SECTIONS)[number];

export function isReportSection(value: unknown): value is ReportSection {
  return typeof value === "string" && (REPORT_SECTIONS as readonly string[]).includes(value);
}

export type ColumnKind = "text" | "money" | "number";
export type ReportColumn = { label: string; kind: ColumnKind };
export type Breakdown = { title: string; items: { label: string; value: string }[] };

export interface ReportTable {
  section: ReportSection;
  title: string;
  /** המספר שעל האריח. */
  headline: string;
  columns: ReportColumn[];
  rows: CsvCell[][];
  breakdowns: Breakdown[];
  /** מצב נוכחי ולא לפי החודש שנבחר (ססיות, מטפלים). */
  snapshot: boolean;
}

type Supabase = Awaited<ReturnType<typeof createClient>>;
type Ctx = { supabase: Supabase; clinicId: string; month: ReportMonth; timezone: string; locale: Locale };

const name = (p: unknown) => (p as { full_name?: string } | null)?.full_name ?? "";
const round2 = (n: number) => Math.round(n * 100) / 100;

async function all<T>(query: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>) {
  const result = await pageAll(query);
  if (!result.ok) throw new Error(result.reason);
  return result.rows;
}

function sumBy<T>(rows: T[], key: (r: T) => string, value: (r: T) => number): Map<string, number> {
  const out = new Map<string, number>();
  for (const r of rows) out.set(key(r), round2((out.get(key(r)) ?? 0) + value(r)));
  return out;
}

async function revenue({ supabase, clinicId, month, timezone, locale }: Ctx): Promise<ReportTable> {
  const t = getAdminReportsDict(locale);
  const c = getCommonDict(locale);
  const methods = getAdminTherapistDetailDict(locale).paymentMethods;
  const rows = await all((from, to) =>
    supabase
      .from("payments")
      .select("paid_at, type, method, amount_before_vat, vat_amount, amount_total, profiles(full_name)")
      .eq("clinic_id", clinicId)
      .eq("status", "paid")
      .gte("paid_at", month.startIso)
      .lt("paid_at", month.endIso)
      .order("paid_at")
      .range(from, to),
  );
  const total = round2(rows.reduce((s, r) => s + Number(r.amount_total), 0));
  const byType = sumBy(rows, (r) => c.paymentType[r.type] ?? r.type, (r) => Number(r.amount_total));
  const byMethod = sumBy(rows, (r) => (r.method ? (methods[r.method] ?? r.method) : "—"), (r) => Number(r.amount_total));
  return {
    section: "revenue",
    title: t.revenueThisMonth,
    headline: formatCurrencyILS(total),
    columns: [
      { label: t.col.date, kind: "text" },
      { label: t.col.therapist, kind: "text" },
      { label: t.col.type, kind: "text" },
      { label: t.col.method, kind: "text" },
      { label: t.col.beforeVat, kind: "money" },
      { label: t.col.vat, kind: "money" },
      { label: t.col.amount, kind: "money" },
    ],
    rows: rows.map((r) => [
      r.paid_at ? formatDateTimeHe(new Date(r.paid_at), timezone) : "",
      name(r.profiles),
      c.paymentType[r.type] ?? r.type,
      r.method ? (methods[r.method] ?? r.method) : "",
      Number(r.amount_before_vat),
      Number(r.vat_amount),
      Number(r.amount_total),
    ]),
    breakdowns: [
      { title: t.byType, items: [...byType].map(([label, v]) => ({ label, value: formatCurrencyILS(v) })) },
      { title: t.byMethod, items: [...byMethod].map(([label, v]) => ({ label, value: formatCurrencyILS(v) })) },
    ],
    snapshot: false,
  };
}

async function hours({ supabase, clinicId, month, timezone, locale }: Ctx): Promise<ReportTable> {
  const t = getAdminReportsDict(locale);
  const rows = await all((from, to) =>
    supabase
      .from("punch_cards")
      .select("purchased_at, hours_purchased, hours_remaining, price_per_hour, expires_at, profiles(full_name)")
      .eq("clinic_id", clinicId)
      .gte("purchased_at", month.startIso)
      .lt("purchased_at", month.endIso)
      .order("purchased_at")
      .range(from, to),
  );
  const total = round2(rows.reduce((s, r) => s + Number(r.hours_purchased), 0));
  return {
    section: "hours",
    title: t.hoursSoldThisMonth,
    headline: String(total),
    columns: [
      { label: t.col.date, kind: "text" },
      { label: t.col.therapist, kind: "text" },
      { label: t.col.hoursPurchased, kind: "number" },
      { label: t.col.pricePerHour, kind: "money" },
      { label: t.col.hoursRemaining, kind: "number" },
      { label: t.col.validUntil, kind: "text" },
    ],
    rows: rows.map((r) => [
      r.purchased_at ? formatDateTimeHe(new Date(r.purchased_at), timezone) : "",
      name(r.profiles),
      Number(r.hours_purchased),
      Number(r.price_per_hour),
      Number(r.hours_remaining),
      formatDateHe(new Date(r.expires_at), timezone),
    ]),
    breakdowns: [],
    snapshot: false,
  };
}

async function bookings({ supabase, clinicId, month, timezone, locale }: Ctx): Promise<ReportTable> {
  const t = getAdminReportsDict(locale);
  const c = getCommonDict(locale);
  const rows = await all((from, to) =>
    supabase
      .from("bookings")
      .select("created_at, starts_at, hours_charged, status, profiles!bookings_user_id_fkey(full_name), rooms(name)")
      .eq("clinic_id", clinicId)
      .gte("created_at", month.startIso)
      .lt("created_at", month.endIso)
      .order("created_at")
      .range(from, to),
  );
  const byStatus = sumBy(rows, (r) => c.bookingStatus[r.status] ?? r.status, () => 1);
  return {
    section: "bookings",
    title: t.bookingsThisMonth,
    headline: String(rows.length),
    columns: [
      { label: t.col.created, kind: "text" },
      { label: t.col.when, kind: "text" },
      { label: t.col.therapist, kind: "text" },
      { label: t.col.room, kind: "text" },
      { label: t.col.hours, kind: "number" },
      { label: t.col.status, kind: "text" },
    ],
    rows: rows.map((r) => [
      r.created_at ? formatDateTimeHe(new Date(r.created_at), timezone) : "",
      formatDateTimeHe(new Date(r.starts_at), timezone),
      name(r.profiles),
      (r.rooms as { name?: string } | null)?.name ?? "",
      Number(r.hours_charged),
      c.bookingStatus[r.status] ?? r.status,
    ]),
    breakdowns: [{ title: t.byStatus, items: [...byStatus].map(([label, v]) => ({ label, value: String(v) })) }],
    snapshot: false,
  };
}

async function sessions({ supabase, clinicId, timezone, locale }: Ctx): Promise<ReportTable> {
  const t = getAdminReportsDict(locale);
  const c = getCommonDict(locale);
  const rows = await all((from, to) =>
    supabase
      .from("session_subscriptions")
      .select("weekly_hours, monthly_price, start_date, next_billing_date, status, profiles!session_subscriptions_user_id_fkey(full_name)")
      .eq("clinic_id", clinicId)
      .in("status", ["active", "pending_cancellation"])
      .order("start_date")
      .range(from, to),
  );
  const weekly = round2(rows.reduce((s, r) => s + Number(r.weekly_hours), 0));
  const monthly = round2(rows.reduce((s, r) => s + Number(r.monthly_price), 0));
  return {
    section: "sessions",
    title: t.activeSessions,
    headline: String(rows.length),
    columns: [
      { label: t.col.therapist, kind: "text" },
      { label: t.col.weeklyHours, kind: "number" },
      { label: t.col.monthlyPrice, kind: "money" },
      { label: t.col.start, kind: "text" },
      { label: t.col.nextPayment, kind: "text" },
      { label: t.col.status, kind: "text" },
    ],
    rows: rows.map((r) => [
      name(r.profiles),
      Number(r.weekly_hours),
      Number(r.monthly_price),
      r.start_date ? formatDateHe(new Date(r.start_date), timezone) : "",
      r.next_billing_date ? formatDateHe(new Date(r.next_billing_date), timezone) : "",
      c.sessionStatusShort[r.status] ?? r.status,
    ]),
    breakdowns: [
      {
        title: t.total,
        items: [
          { label: t.col.weeklyHours, value: String(weekly) },
          { label: t.col.monthlyPrice, value: formatCurrencyILS(monthly) },
        ],
      },
    ],
    snapshot: true,
  };
}

async function therapists({ supabase, clinicId, month, locale }: Ctx): Promise<ReportTable> {
  const t = getAdminReportsDict(locale);
  const nowIso = new Date().toISOString();
  const [people, cards, booked, paid] = await Promise.all([
    all((from, to) =>
      supabase
        .from("profiles")
        .select("id, full_name, phone, email")
        .eq("clinic_id", clinicId)
        .eq("status", "active")
        .order("full_name")
        .range(from, to),
    ),
    all((from, to) =>
      supabase
        .from("punch_cards")
        .select("user_id, hours_remaining")
        .eq("clinic_id", clinicId)
        .eq("active", true)
        .gt("expires_at", nowIso)
        .order("user_id")
        .range(from, to),
    ),
    // שימוש בחודש: הזמנות שמועדן בחודש ולא בוטלו.
    all((from, to) =>
      supabase
        .from("bookings")
        .select("user_id, hours_charged")
        .eq("clinic_id", clinicId)
        .in("status", ["confirmed", "completed", "no_show"])
        .gte("starts_at", month.startIso)
        .lt("starts_at", month.endIso)
        .order("user_id")
        .range(from, to),
    ),
    all((from, to) =>
      supabase
        .from("payments")
        .select("user_id, amount_total")
        .eq("clinic_id", clinicId)
        .eq("status", "paid")
        .gte("paid_at", month.startIso)
        .lt("paid_at", month.endIso)
        .order("user_id")
        .range(from, to),
    ),
  ]);
  const balance = sumBy(cards, (r) => r.user_id, (r) => Number(r.hours_remaining));
  const bookingCount = sumBy(booked, (r) => r.user_id, () => 1);
  const bookedHours = sumBy(booked, (r) => r.user_id, (r) => Number(r.hours_charged));
  const paidSum = sumBy(paid, (r) => r.user_id, (r) => Number(r.amount_total));
  return {
    section: "therapists",
    title: t.activeTherapists,
    headline: String(people.length),
    columns: [
      { label: t.col.name, kind: "text" },
      { label: t.col.phone, kind: "text" },
      { label: t.col.email, kind: "text" },
      { label: t.col.hoursBalance, kind: "number" },
      { label: t.col.bookingsInMonth, kind: "number" },
      { label: t.col.hoursBookedInMonth, kind: "number" },
      { label: t.col.paidInMonth, kind: "money" },
    ],
    rows: people.map((p) => [
      p.full_name,
      p.phone ? formatIsraeliPhoneDisplay(p.phone) : "",
      p.email,
      balance.get(p.id) ?? 0,
      bookingCount.get(p.id) ?? 0,
      bookedHours.get(p.id) ?? 0,
      paidSum.get(p.id) ?? 0,
    ]),
    breakdowns: [],
    snapshot: true,
  };
}

const LOADERS: Record<ReportSection, (ctx: Ctx) => Promise<ReportTable>> = { revenue, hours, bookings, sessions, therapists };

export function loadReportSection(section: ReportSection, ctx: Ctx): Promise<ReportTable> {
  return LOADERS[section](ctx);
}
