"use client";

import { useMemo } from "react";
import { useSession } from "@clerk/nextjs";
import { createClient as createSupabaseJsClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

// לשימוש בקומפוננטות 'use client' (נכון לעכשיו אין כאלה בפועל — כל האפליקציה
// היא Server Components/Actions — אבל השארתי מוכן לפי הדפוס הרשמי של Clerk).
//
// זה hook ולא factory רגיל (בניגוד ל-lib/supabase/server.ts) כי בצד הלקוח
// הטוקן של Clerk נגיש רק דרך useSession() בתוך קומפוננטה — אין מקבילה
// ל-auth() השרתי שאפשר לקרוא לו מכל מקום.
export function useSupabaseClient() {
  const { session } = useSession();

  return useMemo(
    () =>
      createSupabaseJsClient<Database>(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        { accessToken: async () => (await session?.getToken()) ?? null },
      ),
    [session],
  );
}
