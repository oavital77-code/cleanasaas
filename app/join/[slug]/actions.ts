"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type JoinSignupState = { error?: string; needsConfirmation?: boolean };

// 🔴 קישור פתוח/קבוע — לכן role תמיד 'therapist' בקוד עצמו (RPC), אף פעם
// לא מקבל role כפרמטר מהלקוח. הזמנת אדמין/ית ממשיכה אך ורק דרך
// /admin/therapists (create_therapist_invite, טוקן חד-פעמי).
export async function joinSignupAction(slug: string, _prevState: JoinSignupState, formData: FormData): Promise<JoinSignupState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const fullName = String(formData.get("full_name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  if (!email || !password || !fullName || !phone) {
    return { error: "נא למלא את כל השדות" };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { pending_join_slug: slug, pending_full_name: fullName, pending_phone: phone } },
  });
  if (error) return { error: error.message };

  if (!data.session) return { needsConfirmation: true };

  const { error: joinError } = await supabase.rpc("join_clinic_as_therapist", {
    p_slug: slug,
    p_full_name: fullName,
    p_phone: phone,
  });
  if (joinError) return { error: translateJoinError(joinError.message) };

  redirect("/");
}

export async function completeJoinFromMetadata(slug: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const { data: existing } = await supabase.from("profiles").select("id").eq("id", user.id).maybeSingle();
  if (existing) return;

  const meta = user.user_metadata as Record<string, string | undefined>;
  if (meta.pending_join_slug !== slug || !meta.pending_full_name || !meta.pending_phone) return;

  await supabase.rpc("join_clinic_as_therapist", {
    p_slug: slug,
    p_full_name: meta.pending_full_name,
    p_phone: meta.pending_phone,
  });
}

function translateJoinError(code: string): string {
  const map: Record<string, string> = {
    CLINIC_NOT_FOUND: "הקישור לא תקין",
    CLINIC_NOT_PUBLISHED: "הקליניקה טרם פתחה הרשמה",
    CLINIC_SUSPENDED: "הקליניקה מושעית זמנית",
    PLAN_LIMIT_THERAPISTS: "הגיע למספר המטפלים המקסימלי בתוכנית של הקליניקה",
    ALREADY_REGISTERED: "כבר יש לך חשבון במערכת",
  };
  for (const key of Object.keys(map)) {
    if (code.includes(key)) return map[key];
  }
  return "שגיאה בהצטרפות";
}
