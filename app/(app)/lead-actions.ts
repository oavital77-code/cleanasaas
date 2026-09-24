"use server";

import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { parseLeadInput } from "@/lib/lead-input";
import { checkRateLimit, clientIp } from "@/lib/rate-limit";
import { sendEmail } from "@/lib/email/resend";
import { newLeadEmail } from "@/lib/email/templates";
import { getSuperadminEmails } from "@/lib/email/recipients";

export type LeadState = { error?: string; success?: boolean };

// הודעות קצרות ובעברית — הטופס ציבורי, אין בו i18n ואין בו משתמש/ת מחובר/ת
// עם locale. הדף עצמו עברי.
const MESSAGES = {
  missing: "צריך למלא שם וטלפון.",
  phone: "נראה שמספר הטלפון לא תקין.",
  email: "נראה שכתובת המייל לא תקינה.",
  rateLimited: "כבר קיבלנו כמה פניות מהרשת הזו. אפשר לנסות שוב בעוד כמה דקות.",
  failed: "השליחה לא הצליחה. אפשר לנסות שוב או לכתוב לנו ישירות.",
} as const;

/**
 * פנייה מדף הנחיתה — הדלת הרכה שלא הייתה: מי שרוצה לשאול לפני שהוא פותח
 * קליניקה משאיר פרטים, במקום לעזוב בלי זכר.
 *
 * 🔴 ציבורי לגמרי: אין session, אין clinic_id, וכל שדה מגיע מהאינטרנט
 * הפתוח. ההגנות הן שלוש — הגבלת קצב לפי IP, ולידציה ב-parseLeadInput,
 * ושדה מלכודת לבוטים. הכתיבה נעשית ב-service role כי RLS על
 * platform_leads דוחה הכול (ר' מיגרציה 20260923000001).
 */
export async function submitLeadAction(_prev: LeadState, formData: FormData): Promise<LeadState> {
  const ip = clientIp(await headers());
  const limit = checkRateLimit({ scope: "lead-form", identifier: ip, limit: 5, windowMs: 10 * 60_000 });
  if (!limit.ok) return { error: MESSAGES.rateLimited };

  const parsed = parseLeadInput({
    name: formData.get("name"),
    phone: formData.get("phone"),
    email: formData.get("email"),
    clinicName: formData.get("clinic_name"),
    message: formData.get("message"),
    website: formData.get("website"),
  });

  if (!parsed.ok) {
    // בוט: מדווחים הצלחה ולא שומרים כלום — אין טעם ללמד אותו מה נתפס.
    if (parsed.reason === "bot") return { success: true };
    return { error: MESSAGES[parsed.reason] };
  }

  const lead = parsed.value;
  const supabase = createAdminClient();
  const { error } = await supabase.from("platform_leads").insert({
    name: lead.name,
    phone: lead.phone,
    email: lead.email,
    clinic_name: lead.clinicName,
    message: lead.message,
    source: "cleanas",
  });
  if (error) {
    console.error("[leads] insert failed", error.message);
    return { error: MESSAGES.failed };
  }

  // ההתראה אחרי השמירה, ולעולם לא מפילה אותה: ליד שנשמר ולא נשלח עליו
  // מייל עדיין מופיע בדשבורד הבעלים.
  try {
    const emails = await getSuperadminEmails(supabase);
    if (emails.length > 0) {
      const { subject, html } = newLeadEmail({ ...lead, source: "Cleana" });
      await sendEmail({ to: emails, subject, html });
    }
  } catch (err) {
    console.error("[leads] notification failed", err instanceof Error ? err.message : err);
  }

  return { success: true };
}
