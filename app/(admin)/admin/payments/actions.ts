"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireClinicAdmin } from "@/lib/auth/guards";

// סימון תשלום ססיה כשולם במזומן/ידנית — משמש רק לתשלומי ססיה (initial או
// recurring); כרטיסייה תמיד עוברת דרך חנות ה-Woo (CLAUDE.md #6), אין מסלול
// מזומן לכרטיסייה.
export async function markSessionPaymentCashAction(formData: FormData) {
  await requireClinicAdmin();
  const paymentId = String(formData.get("payment_id") ?? "");
  const kind = String(formData.get("kind") ?? ""); // "initial" | "recurring"
  if (!paymentId || !kind) return;

  const supabase = await createClient();
  const transactionUid = `cash-manual-${paymentId}-${Date.now()}`;
  const rpc = kind === "recurring" ? "admin_mark_session_recurring_paid_cash" : "admin_activate_session_cash_payment";
  await supabase.rpc(rpc, { p_payment_id: paymentId, p_method: "cash", p_transaction_uid: transactionUid });

  revalidatePath("/admin/payments");
}
