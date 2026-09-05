import { createServerClient } from "@supabase/ssr";
import { createClient as createSupabaseJsClient, type SupabaseClient } from "@supabase/supabase-js";
import { auth } from "@clerk/nextjs/server";
import { cookies } from "next/headers";
import type { Database } from "@/lib/supabase/types";

// לשימוש ב-Server Components / Route Handlers. פועל עם RLS לפי המשתמש
// המחובר — כל קליניקה מבודדת דרך current_clinic_id() בצד ה-DB, לא כאן.
// Database מיוצר מ-`supabase gen types typescript` מול הפרויקט האמיתי —
// לרענן (mcp Supabase generate_typescript_types) אחרי כל migration חדשה.
//
// 🔴 dual-mode במכוון (ר' supabase/migrations/20260905000003 — app_user_id()):
// יש session של Clerk → נבנה client עם accessToken שמעביר את הטוקן של Clerk
// בכל בקשה (Clerk כבר מנהל cookie session משלו, אין צורך גם בזה של
// Supabase Auth). אין session של Clerk → נופלים חזרה ל-client מבוסס-cookies
// הישן של Supabase Auth, כדי שמשתמשים שעדיין לא עברו ל-Clerk ימשיכו לעבוד.
// למחוק את הענף השני רק אחרי שכל המשתמשים הקיימים הועברו בפועל ל-clerk_user_id.
//
// 🔴 טיפוס חזרה מפורש (SupabaseClient<Database>) ולא הסקה אוטומטית: שני
// הענפים מחזירים מבחינה מבנית את אותו טיפוס בדיוק (שניהם SupabaseClient מאותה
// גרסה של @supabase/supabase-js — @supabase/ssr רק עוטף אותו), אבל TypeScript
// לא מאחד שתי הופעות נפרדות של generic instantiation לאיחוד קריא ל-union —
// כל קריאה ל-.from()/.rpc() בכל הקוד הייתה נשברת עם "expression is not
// callable" בלי ה-annotation המפורש הזה.
export async function createClient(): Promise<SupabaseClient<Database>> {
  const { userId, getToken } = await auth();

  if (userId) {
    return createSupabaseJsClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { accessToken: getToken },
    );
  }

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
