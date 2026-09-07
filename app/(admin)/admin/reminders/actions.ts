"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireClinicAdmin } from "@/lib/auth/guards";

// המסלול החצי-ידני: אחרי שהאדמין שלח/ה דרך wa.me מהטלפון שלו/ה, מסמן/ת
// "נשלח" — admin_mark_whatsapp_reminder_sent (migration 20260907000003)
// כותב whatsapp_reminder_sent_at + audit, וה-cron האוטומטי מדלג.
export async function markReminderSentAction(formData: FormData) {
  await requireClinicAdmin();
  const bookingId = String(formData.get("booking_id") ?? "");
  if (!bookingId) return;

  const supabase = await createClient();
  await supabase.rpc("admin_mark_whatsapp_reminder_sent", { p_booking_id: bookingId });
  revalidatePath("/admin/reminders");
}
