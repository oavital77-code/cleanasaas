"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireClinicAdmin } from "@/lib/auth/guards";
import { createPlatformCheckout, platformBillingAvailability, stopPlatformRecurring } from "@/lib/platform-billing";
import { normalizeLocale } from "@/lib/i18n";

// פעולות שרת ולא route handlers: /api מוחרג מ-clerkMiddleware, ורק כאן יש
// session של האדמין (requireClinicAdmin). ה-callback של PayPlus הוא היחיד
// שיושב תחת /api — הוא ציבורי במכוון.

export async function startPlatformCheckoutAction() {
  const { profile, clinicId } = await requireClinicAdmin();
  const availability = platformBillingAvailability();
  if (!availability.ok) redirect("/admin/billing?returned=not_configured");

  const supabase = await createClient();
  const { data: clinic } = await supabase.from("clinics").select("name").eq("id", clinicId).single();

  const checkout = await createPlatformCheckout(availability.cfg, {
    clinicId,
    clinicName: clinic?.name ?? "Cleana",
    ownerName: profile.full_name,
    ownerEmail: profile.email,
    ownerPhone: profile.phone,
    priceIls: availability.priceIls,
    locale: normalizeLocale(profile.locale),
  });

  // is_admin() + הקליניקה של המשתמש נבדקים בתוך ה-RPC.
  const { error } = await supabase.rpc("platform_start_checkout", { p_page_request_uid: checkout.pageRequestUid });
  if (error) redirect("/admin/billing?returned=error");

  redirect(checkout.url);
}

export async function cancelPlatformSubscriptionAction() {
  const { clinicId } = await requireClinicAdmin();
  const supabase = await createClient();

  const { data: sub } = await supabase
    .from("platform_subscriptions")
    .select("status, cancel_at_period_end, payplus_recurring_uid")
    .eq("clinic_id", clinicId)
    .maybeSingle();
  if (!sub || sub.status !== "active" || sub.cancel_at_period_end) return;

  // קודם PayPlus, ואז הסימון אצלנו: אם העצירה נכשלת, כלום לא משתנה —
  // עדיף מנוי שעדיין מסומן פעיל מאשר מנוי "מבוטל" שממשיך להתחייב.
  if (sub.payplus_recurring_uid) {
    try {
      await stopPlatformRecurring(sub.payplus_recurring_uid);
    } catch (err) {
      console.error("[platform-billing] stopRecurring failed", err);
      redirect("/admin/billing?returned=error");
    }
  }
  const { error } = await supabase.rpc("platform_request_cancellation");
  if (error) redirect("/admin/billing?returned=error");
  revalidatePath("/admin/billing");
}
