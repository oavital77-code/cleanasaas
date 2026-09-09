"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireClinicAdmin } from "@/lib/auth/guards";
import { createPlatformCheckout, platformBillingAvailability } from "@/lib/platform-billing";
import { PayPlusError } from "@/lib/payplus";
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

  let checkout: Awaited<ReturnType<typeof createPlatformCheckout>>;
  try {
    checkout = await createPlatformCheckout(availability.cfg, {
      clinicName: clinic?.name ?? "Cleana",
      ownerName: profile.full_name,
      ownerEmail: profile.email,
      ownerPhone: profile.phone,
      priceIls: availability.priceIls,
      locale: normalizeLocale(profile.locale),
    });
  } catch (err) {
    // הסיבה של PayPlus בשורה אחת (UID שגוי, מפתחות) בטוחה להצגה — והיא מה
    // שהופך תקלת הגדרה לניתנת לאבחון מהמסך.
    console.error("[platform-billing] checkout failed", err instanceof PayPlusError ? { status: err.status, body: err.body } : err);
    const detail = err instanceof PayPlusError ? providerDetail(err) : "";
    redirect(`/admin/billing?returned=error&detail=${encodeURIComponent(detail)}`);
  }

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
    .select("status, cancel_at_period_end")
    .eq("clinic_id", clinicId)
    .maybeSingle();
  if (!sub || sub.status !== "active" || sub.cancel_at_period_end) return;

  // אין מה להגיד ל-PayPlus: לוח החיובים שלנו, ושורה מבוטלת לא מחויבת לעולם
  // (platform_claim_due_renewals מדלגת על cancel_at_period_end).
  const { error } = await supabase.rpc("platform_request_cancellation");
  if (error) redirect("/admin/billing?returned=error");
  revalidatePath("/admin/billing");
}

function providerDetail(error: PayPlusError): string {
  const body = error.body as { results?: { description?: unknown; status?: unknown; code?: unknown }; message?: unknown } | string | null;
  if (typeof body === "string") return `${error.status}: ${body.slice(0, 200)}`;
  const parts = [body?.results?.status, body?.results?.code, body?.results?.description, body?.message].filter(
    (p) => typeof p === "string" || typeof p === "number",
  );
  return `${error.status}${parts.length ? ": " + parts.join(" · ") : ""}`;
}
