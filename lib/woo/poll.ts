import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchRecentWooOrders, getClinicWooCredentials } from "./rest-client";
import { processWooOrder } from "./process-order";

/**
 * לולאת per-clinic (SAASMIGRATIONSPEC §14): עוברת על כל הקליניקות שהגדירו
 * חיבור Woo, שולפת הזמנות אחרונות ומזינה כל אחת ל-processWooOrder. תקלה
 * בקליניקה אחת (Woo לא זמין, מפתחות שגויים) לא עוצרת את שאר הקליניקות.
 */
export async function pollWooOrdersAllClinics(
  sinceMinutesAgo: number,
): Promise<{ clinicsChecked: number; ordersProcessed: number; errors: Array<{ clinicId: string; error: string }> }> {
  const supabase = createAdminClient();
  const errors: Array<{ clinicId: string; error: string }> = [];
  let clinicsChecked = 0;
  let ordersProcessed = 0;

  const { data: settingsRows } = await supabase
    .from("clinic_payment_settings")
    .select("clinic_id")
    .not("woo_store_url", "is", null);

  for (const row of settingsRows ?? []) {
    try {
      const creds = await getClinicWooCredentials(supabase, row.clinic_id);
      if (!creds) continue;

      clinicsChecked++;
      const orders = await fetchRecentWooOrders(creds, sinceMinutesAgo);
      for (const order of orders) {
        const result = await processWooOrder(supabase, row.clinic_id, order);
        if (result.ok && !result.skipped) ordersProcessed++;
      }
    } catch (err) {
      errors.push({ clinicId: row.clinic_id, error: err instanceof Error ? err.message : String(err) });
    }
  }

  return { clinicsChecked, ordersProcessed, errors };
}
