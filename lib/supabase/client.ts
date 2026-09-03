import { createBrowserClient } from "@supabase/ssr";

// לשימוש בקומפוננטות 'use client' בלבד. ⚠️ לא מחובר ל-Database generic —
// ר' ההערה ב-lib/supabase/server.ts.
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
