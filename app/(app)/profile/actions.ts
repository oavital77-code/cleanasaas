"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// 🔴 phone/email/role/status/door_code נעולים ע"י enforce_profile_privilege_columns
// גם למי שמעדכן/ת את השורה של עצמו/ה — לכן הטופס כאן שולח רק full_name/profession.
export async function updateProfileAction(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const fullName = String(formData.get("full_name") ?? "").trim();
  const profession = String(formData.get("profession") ?? "").trim();
  if (!fullName) return;

  await supabase.from("profiles").update({ full_name: fullName, profession: profession || null }).eq("id", user.id);
  revalidatePath("/profile");
}
