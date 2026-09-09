import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email/resend";
import { getAdminEmails } from "@/lib/email/recipients";
import { platformPaymentFailedEmail, platformSubscriptionActivatedEmail } from "@/lib/email/templates";
import type { ApplyOutcome } from "@/lib/platform-billing";

/**
 * מודיע לאדמיני הקליניקה על תוצאת תשלום — אחרי שההחלטה כבר נרשמה ב-DB.
 * לעולם לא זורק: מייל שנכשל לא מבטל תשלום שהצליח.
 */
export async function notifyPlatformPaymentOutcome(clinicId: string | null, outcome: ApplyOutcome): Promise<void> {
  if (!clinicId) return;
  if (outcome !== "activated" && outcome !== "payment_failed") return;
  try {
    const supabase = createAdminClient();
    const [{ data: clinic }, { data: sub }, { data: owner }, emails] = await Promise.all([
      supabase.from("clinics").select("name").eq("id", clinicId).maybeSingle(),
      supabase.from("platform_subscriptions").select("current_period_end").eq("clinic_id", clinicId).maybeSingle(),
      supabase.from("profiles").select("locale").eq("clinic_id", clinicId).eq("role", "owner").limit(1).maybeSingle(),
      getAdminEmails(supabase, clinicId),
    ]);
    if (!clinic || emails.length === 0) return;
    const { data: lastPayment } = await supabase
      .from("platform_payments")
      .select("amount")
      .eq("clinic_id", clinicId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const content =
      outcome === "activated"
        ? platformSubscriptionActivatedEmail({
            clinicName: clinic.name,
            amount: Number(lastPayment?.amount ?? 0),
            periodEnd: sub?.current_period_end ? new Date(sub.current_period_end) : null,
            locale: owner?.locale,
          })
        : platformPaymentFailedEmail({ clinicName: clinic.name, graceDays: 7, locale: owner?.locale });
    await sendEmail({ to: emails, ...content });
  } catch (err) {
    console.error("[platform-billing] notification failed", err);
  }
}
