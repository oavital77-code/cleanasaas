import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { pageAll } from "@/lib/supabase/page-all";

/**
 * מה שדשבורד הבעלים מציג: מי נרשם, מי משלם, מה נכנס — משני המוצרים.
 * CleanaS נקרא ישירות (service role); Cleana+ דרך /api/owner/stats שלו עם
 * סוד משותף (OWNER_STATS_SECRET). כל אחד מהמקורות יכול להיכשל בנפרד — הדף
 * מציג את מה שיש ואומר מה חסר.
 */
export type AccountRow = {
  id: string;
  name: string;
  email: string;
  createdAt: string;
  /** trialing | active | grace | locked | canceling | legacy_free | none */
  state: string;
  tier: string;
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
  lastPaymentAt: string | null;
  lastPaymentIls: number | null;
  /** CleanaS בלבד: כמה מטפלים/ות בקליניקה. */
  seats?: number;
};

export type ProductStats = {
  product: "cleana-plus" | "cleanas";
  generatedAt: string;
  totals: { accounts: number; trialing: number; paying: number; grace: number; locked: number; canceling: number; legacyFree: number };
  revenueIls: { thisMonth: number; allTime: number };
  accounts: AccountRow[];
};

export type ProductResult = { ok: true; stats: ProductStats } | { ok: false; reason: string };

export async function fetchCleanaPlusStats(): Promise<ProductResult> {
  const secret = process.env.OWNER_STATS_SECRET;
  const url = (process.env.CLEANAPLUS_STATS_URL ?? "https://cleanaplus.cleanagroup.app/api/owner/stats").replace(/\/+$/, "");
  if (!secret) return { ok: false, reason: "OWNER_STATS_SECRET לא מוגדר" };
  try {
    const res = await fetch(url, { headers: { authorization: `Bearer ${secret}` }, cache: "no-store" });
    if (!res.ok) return { ok: false, reason: `Cleana+ החזיר ${res.status}` };
    return { ok: true, stats: (await res.json()) as ProductStats };
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : "שגיאת רשת" };
  }
}

export async function fetchCleanasStats(): Promise<ProductResult> {
  const supabase = createAdminClient();
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();

  // כל אחת מאלה גדלה עם הזמן, ו-PostgREST חותך ב-db-max-rows בלי לומר כלום —
  // ובתשלומים זה אומר סכום הכנסות שקטן מהאמת. pageAll מביא הכול, ונכשל בקול.
  const [clinicsRes, subsRes, ownersRes, seatsRes, paymentsRes] = await Promise.all([
    pageAll((from, to) =>
      supabase.from("clinics").select("id, name, status, created_at").order("created_at", { ascending: false }).range(from, to),
    ),
    pageAll((from, to) =>
      supabase
        .from("platform_subscriptions")
        .select("clinic_id, plan, status, current_period_start, current_period_end, grace_ends_at, cancel_at_period_end")
        .order("clinic_id")
        .range(from, to),
    ),
    pageAll((from, to) =>
      supabase.from("profiles").select("clinic_id, email, full_name").eq("role", "owner").order("clinic_id").range(from, to),
    ),
    pageAll((from, to) => supabase.from("profiles").select("clinic_id").eq("status", "active").order("clinic_id").range(from, to)),
    pageAll((from, to) =>
      supabase
        .from("platform_payments")
        .select("clinic_id, amount, paid_at, status")
        .eq("status", "succeeded")
        .order("paid_at", { ascending: false })
        .range(from, to),
    ),
  ]);
  if (!clinicsRes.ok) return { ok: false, reason: clinicsRes.reason };
  if (!subsRes.ok) return { ok: false, reason: subsRes.reason };
  if (!ownersRes.ok) return { ok: false, reason: ownersRes.reason };
  if (!seatsRes.ok) return { ok: false, reason: seatsRes.reason };
  if (!paymentsRes.ok) return { ok: false, reason: paymentsRes.reason };

  const subs = new Map(subsRes.rows.map((s) => [s.clinic_id, s]));
  const owners = new Map(ownersRes.rows.map((p) => [p.clinic_id, p]));
  const seats = new Map<string, number>();
  for (const p of seatsRes.rows) seats.set(p.clinic_id, (seats.get(p.clinic_id) ?? 0) + 1);
  const lastPayment = new Map<string, { paid_at: string | null; amount: number }>();
  let thisMonth = 0;
  let allTime = 0;
  for (const p of paymentsRes.rows) {
    const amount = Number(p.amount);
    allTime += amount;
    if (p.paid_at && p.paid_at >= monthStart) thisMonth += amount;
    if (!lastPayment.has(p.clinic_id)) lastPayment.set(p.clinic_id, { paid_at: p.paid_at, amount });
  }

  const totals: ProductStats["totals"] = { accounts: 0, trialing: 0, paying: 0, grace: 0, locked: 0, canceling: 0, legacyFree: 0 };
  const accounts: AccountRow[] = clinicsRes.rows.map((c) => {
    const s = subs.get(c.id);
    const owner = owners.get(c.id);
    const periodEnd = s?.current_period_end ? new Date(s.current_period_end) : null;
    const graceEnd = s?.grace_ends_at ? new Date(s.grace_ends_at) : null;
    let state = "none";
    if (s) {
      if (s.status === "trialing") state = periodEnd && periodEnd > now ? "trialing" : "locked";
      else if (s.status === "active") state = s.cancel_at_period_end ? "canceling" : "active";
      else if (s.status === "past_due") state = graceEnd && graceEnd > now ? "grace" : "locked";
      else if (s.status === "canceled") state = periodEnd && periodEnd > now ? "canceling" : "locked";
      else state = "locked";
    }
    if (c.status === "suspended" && state !== "active") state = "locked";
    totals.accounts++;
    if (state === "trialing") totals.trialing++;
    else if (state === "active") totals.paying++;
    else if (state === "grace") totals.grace++;
    else if (state === "locked") totals.locked++;
    else if (state === "canceling") totals.canceling++;
    const last = lastPayment.get(c.id);
    return {
      id: c.id,
      name: c.name,
      email: owner?.email ?? "",
      createdAt: c.created_at ?? now.toISOString(),
      state,
      tier: s?.plan ?? "none",
      trialEndsAt: s?.status === "trialing" ? (s.current_period_end ?? null) : null,
      currentPeriodEnd: s?.status === "trialing" ? null : (s?.current_period_end ?? null),
      lastPaymentAt: last?.paid_at ?? null,
      lastPaymentIls: last?.amount ?? null,
      seats: seats.get(c.id) ?? 0,
    };
  });

  return {
    ok: true,
    stats: { product: "cleanas", generatedAt: now.toISOString(), totals, revenueIls: { thisMonth, allTime }, accounts },
  };
}

/** משתמשים "פעילים" לצורך מדרגות הרכישה: כל מי שמייצר עומס. */
export function activeUsersOf(stats: ProductStats | null): number {
  if (!stats) return 0;
  const t = stats.totals;
  return t.trialing + t.paying + t.grace + t.canceling + t.legacyFree;
}
