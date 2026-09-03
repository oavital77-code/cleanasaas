import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";

// SAASMIGRATIONSPEC §11: MVP מתחיל עם דומיין אחד + בחירת קליניקה אחרי login
// (הקליניקה נגזרת מ-profiles.clinic_id, לא מה-URL) — לא subdomains עדיין.
// המעבר ל-subdomains (clinicname.app.cleana.co.il) דורש wildcard DNS +
// תעודת SSL תואמת ב-Vercel; ישוקל כשיהיו כמה עשרות קליניקות שדורשות brand
// נפרד. עד אז ה-middleware כאן עושה רק דבר אחד: לרענן את ה-session cookie.
export async function middleware(request: NextRequest) {
  let response = NextResponse.next();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  await supabase.auth.getUser();

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api|sw\\.js|manifest\\.webmanifest|icon|apple-icon).*)",
  ],
};
