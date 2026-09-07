"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireTherapistProfile } from "@/lib/auth/guards";
import { sendEmail } from "@/lib/email/resend";
import { sessionRequestedAdminEmail } from "@/lib/email/templates";
import { getAdminEmails } from "@/lib/email/recipients";
import { getSessionsDict, normalizeLocale, translateRpcError } from "@/lib/i18n";

export type RequestSessionState = { error?: string };

// 🔴 request_session במכוון *לא* בודקת התנגשות זמינות אמיתית (CLAUDE.md
// #5) — כל בקשה מגיעה לאדמין, גם אם המשבצת בפועל תפוסה, כדי לא לחשוף על
// מטפל/ת אחר/ת. הבדיקה האמיתית קורית ב-approve_session בצד האדמין.
export async function requestSessionAction(_prevState: RequestSessionState, formData: FormData): Promise<RequestSessionState> {
  const { profile } = await requireTherapistProfile();
  const supabase = await createClient();
  const locale = normalizeLocale(profile.locale);
  const t = getSessionsDict(locale);
  const slotsRaw = String(formData.get("slots") ?? "[]");
  const startDate = String(formData.get("start_date") ?? "") || undefined;

  let slots: unknown;
  try {
    slots = JSON.parse(slotsRaw);
  } catch {
    return { error: t.invalidSlots };
  }

  const { data, error } = await supabase
    .rpc("request_session", {
      p_slots: slots as never,
      p_start_date: startDate,
    })
    .single();

  if (error) {
    return { error: translateRpcError(locale, error.message, t.requestError) };
  }

  if (data) {
    notifyAdminsOfSessionRequest(supabase, profile.clinic_id, profile.full_name, data.weekly_hours, data.monthly_price).catch(
      () => {},
    );
  }

  revalidatePath("/sessions");
  redirect("/sessions");
}

async function notifyAdminsOfSessionRequest(
  supabase: Awaited<ReturnType<typeof createClient>>,
  clinicId: string,
  therapistName: string,
  weeklyHours: number,
  monthlyPrice: number,
) {
  const adminEmails = await getAdminEmails(supabase, clinicId);
  if (adminEmails.length === 0) return;
  const { subject, html } = sessionRequestedAdminEmail({ therapistName, weeklyHours, monthlyPrice });
  await sendEmail({ to: adminEmails, subject, html });
}

export async function requestCancellationAction(formData: FormData) {
  const supabase = await createClient();
  const subscriptionId = String(formData.get("subscription_id") ?? "");
  if (!subscriptionId) return;
  await supabase.rpc("request_subscription_cancellation", { p_subscription_id: subscriptionId });
  revalidatePath("/sessions");
}
