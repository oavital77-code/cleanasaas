import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// לשימוש ב-Server Components / Route Handlers. פועל עם RLS לפי המשתמש
// המחובר — כל קליניקה מבודדת דרך current_clinic_id() בצד ה-DB, לא כאן.
//
// ⚠️ לא מחובר ל-Database generic (ר' lib/supabase/types.ts) — עד שיש
// טיפוסים אמיתיים מ-`supabase gen types`, queries כאן לא type-checked מול
// הסכמה. שגיאות עמודה/טבלה יתגלו ב-runtime, לא ב-compile.
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
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
