"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireTherapistProfile } from "@/lib/auth/guards";

// מתג השפה של AppShell — זמין בכל מסך מחובר, בשני הצדדים (מטפל/ת ואדמין),
// לא רק ב-/profile. profiles.locale לא נעול ע"י enforce_profile_privilege_columns
// (ר' migration 20260906000006) — עדכון עצמי ישיר. revalidate של כל ה-layout
// כי הניווט/כיוון משתנים בכל דף.
export async function switchLocaleAction(formData: FormData) {
  const { userId } = await requireTherapistProfile();
  const supabase = await createClient();

  const locale = formData.get("locale");
  if (locale !== "he" && locale !== "en") return;

  await supabase.from("profiles").update({ locale }).eq("id", userId);
  revalidatePath("/", "layout");
}
