import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/lib/supabase/types";

// לשימוש ב-Server Components / Route Handlers. פועל עם RLS לפי המשתמש
// המחובר — כל קליניקה מבודדת דרך current_clinic_id() בצד ה-DB, לא כאן.
// Database מיוצר מ-`supabase gen types typescript` מול הפרויקט האמיתי —
// לרענן (mcp Supabase generate_typescript_types) אחרי כל migration חדשה.
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // נקרא מתוך Server Component — session מתרענן ע"י ה-middleware.
          }
        },
      },
    },
  );
}
