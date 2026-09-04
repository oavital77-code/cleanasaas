"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type ClaimState = { message?: string };

// 🔴 CLAUDE.md סעיף 6: מקור האמת לתשלום הוא ה-הזמנה בחנות ה-Woo עצמה —
// claim_woo_pending_purchase רק "מחפש" רכישה ששולמה כבר בחנות ואיתור
// אוטומטי (webhook/polling) לא הצליח לשייך (למשל טלפון לא תאם בדיוק).
// לא יוצר תשלום/כרטיסייה בעצמו.
export async function claimPendingPurchaseAction(): Promise<ClaimState> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("claim_woo_pending_purchase");
  if (error) {
    return { message: "לא נמצאה רכישה ממתינה לשיוך כרגע." };
  }
  revalidatePath("/purchase");
  revalidatePath("/");
  const claimed = data?.[0]?.claimed_count ?? 0;
  return {
    message: claimed > 0 ? `שויכה רכישה אחת (${data?.[0]?.hours_granted ?? 0} שעות נוספו).` : "לא נמצאה רכישה ממתינה לשיוך כרגע.",
  };
}
