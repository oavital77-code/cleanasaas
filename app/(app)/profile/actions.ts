"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireTherapistProfile } from "@/lib/auth/guards";

// 🔴 phone/email/role/status/door_code נעולים ע"י enforce_profile_privilege_columns
// גם למי שמעדכן/ת את השורה של עצמו/ה — לכן הטופס כאן שולח רק full_name/profession.
//
// 🔴 לא supabase.auth.getUser() ישירות: ב-client של מצב Clerk (accessToken)
// כל גישה ל-supabase.auth.* זורקת — ר' lib/auth/guards.ts.
export async function updateProfileAction(formData: FormData) {
  const { userId } = await requireTherapistProfile();
  const supabase = await createClient();

  const fullName = String(formData.get("full_name") ?? "").trim();
  const profession = String(formData.get("profession") ?? "").trim();
  if (!fullName) return;

  await supabase.from("profiles").update({ full_name: fullName, profession: profession || null }).eq("id", userId);
  revalidatePath("/profile");
}

// 🔴 locale (ר' migration 20260906000006) הוא לא-privileged, ולכן — בניגוד
// ל-clerk_user_id/phone/email/role וכו' — עדכון עצמי ישיר עליו לא נבלם ע"י
// enforce_profile_privilege_columns ולא צריך RPC ייעודי.
export async function updateLocaleAction(formData: FormData) {
  const { userId } = await requireTherapistProfile();
  const supabase = await createClient();

  const locale = formData.get("locale");
  if (locale !== "he" && locale !== "en") return;

  await supabase.from("profiles").update({ locale }).eq("id", userId);
  revalidatePath("/", "layout");
}

// opt-in/out לתזכורות WhatsApp (profiles.whatsapp_reminders, migration
// 20260907000003) — לא privileged, עדכון עצמי ישיר. טוגל בלחיצה אחת.
export async function toggleWhatsAppRemindersAction(formData: FormData) {
  const { userId } = await requireTherapistProfile();
  const supabase = await createClient();
  const next = formData.get("enabled") === "on";
  await supabase.from("profiles").update({ whatsapp_reminders: next }).eq("id", userId);
  revalidatePath("/profile");
}
