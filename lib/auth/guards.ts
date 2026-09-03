import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];

/**
 * טעינת המשתמש המחובר + הפרופיל שלו, פעם אחת לכל בקשה. ר' תיעוד מקורי
 * (oavital77-code/claude-test lib/auth/guards.ts) — אותו טעם קאשינג.
 */
const loadAuthState = cache(async (): Promise<{
  userId: string | null;
  profile: Profile | null;
}> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { userId: null, profile: null };

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  return { userId: user.id, profile: profile ?? null };
});

/**
 * דורש session מחובר + פרופיל קיים (כלומר: כבר סיים/ה signup_clinic או
 * accept_therapist_invite). בלי session → /login. עם session אך בלי
 * פרופיל → /onboarding (עדיין באמצע ההרשמה/wizard). מושעה → /suspended.
 */
export async function requireTherapistProfile(): Promise<{
  userId: string;
  profile: Profile;
}> {
  const { userId, profile } = await loadAuthState();

  if (!userId) redirect("/login");
  if (!profile) redirect("/onboarding");
  if (profile.status === "suspended") redirect("/suspended");

  return { userId, profile };
}

/**
 * דורש session עם role in ('owner','admin'). מחזיר גם clinicId מפורשות —
 * כל route/action שקורא לזה משתמש בו ישירות לכל query/RPC ולא "שוכח" לסנן
 * (SAASMIGRATIONSPEC §4: requireAdmin -> requireClinicAdmin).
 */
export async function requireClinicAdmin(): Promise<{
  userId: string;
  profile: Profile;
  clinicId: string;
}> {
  const { userId, profile } = await requireTherapistProfile();
  if (profile.role !== "owner" && profile.role !== "admin") redirect("/login");
  return { userId, profile, clinicId: profile.clinic_id };
}

/** בשימוש ב-/login וב-/onboarding: session קיים? יש כבר פרופיל? */
export async function getAuthState(): Promise<{
  userId: string | null;
  profile: Profile | null;
}> {
  return loadAuthState();
}
