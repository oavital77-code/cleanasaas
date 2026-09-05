import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { auth, currentUser } from "@clerk/nextjs/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/types";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];

/**
 * טעינת המשתמש המחובר + הפרופיל שלו, פעם אחת לכל בקשה.
 *
 * 🔴 dual-mode (ר' lib/supabase/server.ts ו-app_user_id() ב-DB): קודם בודקים
 * אם יש session של Clerk (auth() מ-@clerk/nextjs/server) ומחפשים פרופיל לפי
 * clerk_user_id. אין session של Clerk → נופלים ל-supabase.auth.getUser()
 * הישן. userId המוחזר החוצה הוא תמיד profiles.id (uuid פנימי) — לא מזהה
 * הזהות הגולמי מאף אחד מהספקים — כי כל שאר הקוד באפליקציה מסנן לפיו
 * (bookings.user_id וכו').
 */
const loadAuthState = cache(async (): Promise<{
  userId: string | null;
  profile: Profile | null;
}> => {
  const supabase = await createClient();
  const { userId: clerkUserId } = await auth();

  if (clerkUserId) {
    const { data: existing } = await supabase
      .from("profiles")
      .select("*")
      .eq("clerk_user_id", clerkUserId)
      .maybeSingle();
    if (existing) return { userId: existing.id, profile: existing };

    // חד-פעמי, למי שהתחבר לפני המעבר: פרופיל קיים מ-Supabase Auth עם אותו
    // אימייל, שעדיין לא מקושר לשום חשבון Clerk — מקושר אוטומטית בכניסה
    // הראשונה, כדי שלא "תאבד" את הקליניקה. ר' link_clerk_identity()
    // (מיגרציה 20260905000005) למה זה RPC עם service role ולא UPDATE ישיר.
    const email = (await currentUser())?.primaryEmailAddress?.emailAddress;
    if (email) {
      const { data: linked } = await createAdminClient().rpc("link_clerk_identity", {
        p_clerk_user_id: clerkUserId,
        p_email: email,
      });
      const profile = linked?.[0] ?? null;
      if (profile) return { userId: profile.id, profile };
    }

    return { userId: null, profile: null };
  }

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

/** ל-AppHeader — האם למשתמש יש גישת סופר-אדמין (חוצה-קליניקות). */
export async function isSuperadmin(userId: string): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase.from("platform_admins").select("user_id").eq("user_id", userId).maybeSingle();
  return !!data;
}
