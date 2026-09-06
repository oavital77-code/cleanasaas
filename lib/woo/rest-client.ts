import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import type { WooOrderPayload } from "./process-order";

// גישה ל-WooCommerce REST API — פר-קליניקה. הפרטים (URL/Key/Secret) מגיעים
// מ-clinic_payment_settings (SAASMIGRATIONSPEC §6), לא ממשתני סביבה גלובליים:
// כל קליניקה מביאה את החנות שלה. הרשאת Read בלבד מספיקה בצד ה-Woo.
export interface ClinicWooCredentials {
  baseUrl: string;
  key: string;
  secret: string;
}

// 🔴 לא select ישיר: woo_consumer_secret מוצפן (bytea, pgcrypto) בטבלה.
// get_clinic_woo_credentials (SECURITY DEFINER, service_role בלבד — ר'
// migration 20260906000002) מפענחת ומחזירה טקסט רגיל. supabase כאן חייב
// להיות admin client (service role) — כל קוראי הפונקציה הזו כבר משתמשים בו.
export async function getClinicWooCredentials(
  supabase: SupabaseClient<Database>,
  clinicId: string,
): Promise<ClinicWooCredentials | null> {
  const { data } = await supabase.rpc("get_clinic_woo_credentials", { p_clinic_id: clinicId }).maybeSingle();

  if (!data?.woo_store_url || !data.woo_consumer_key || !data.woo_consumer_secret) return null;
  return { baseUrl: data.woo_store_url, key: data.woo_consumer_key, secret: data.woo_consumer_secret };
}

/**
 * שולף הזמנות ש-Woo יצר/עדכן מאז `sinceMinutesAgo` דקות אחורה, לחנות של
 * קליניקה ספציפית. לא מסונן לפי סטטוס (processWooOrder כבר מסנן).
 */
export async function fetchRecentWooOrders(
  creds: ClinicWooCredentials,
  sinceMinutesAgo: number,
): Promise<WooOrderPayload[]> {
  const after = new Date(Date.now() - sinceMinutesAgo * 60_000).toISOString();
  const url = new URL("/wp-json/wc/v3/orders", creds.baseUrl);
  url.searchParams.set("after", after);
  url.searchParams.set("per_page", "100");
  url.searchParams.set("orderby", "date");
  url.searchParams.set("order", "desc");

  const auth = Buffer.from(`${creds.key}:${creds.secret}`).toString("base64");
  const res = await fetch(url.toString(), {
    headers: { Authorization: `Basic ${auth}` },
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`WooCommerce REST API החזיר ${res.status}`);
  }

  const orders = (await res.json()) as unknown;
  return Array.isArray(orders) ? (orders as WooOrderPayload[]) : [];
}
