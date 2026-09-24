"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireClinicAdmin } from "@/lib/auth/guards";

// סימון שורת תשלום ססיה ממתינה כשולמה. מאז המצב הידני (24.9.2026) תשלומי
// ססיה נרשמים מרשימת הססיות (admin_record_session_payment), שיוצרת את השורה
// ומסמנת אותה באותה פעולה — הכפתור הזה נשאר לשורות ממתינות שנוצרו לפני כן.
// כרטיסייה נרשמת מהכרטיס של המטפל/ת (admin_issue_punch_card).
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
