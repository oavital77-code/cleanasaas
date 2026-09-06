import { clerkMiddleware } from "@clerk/nextjs/server";
import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";
import { routeForHost } from "@/lib/hosts";

// SAASMIGRATIONSPEC §11: MVP מתחיל עם דומיין אחד + בחירת קליניקה אחרי login
// (הקליניקה נגזרת מ-profiles.clinic_id, לא מה-URL) — לא subdomains עדיין.
// המעבר ל-subdomains (clinicname.app.cleana.co.il) דורש wildcard DNS +
// תעודת SSL תואמת ב-Vercel; ישוקל כשיהיו כמה עשרות קליניקות שדורשות brand
// נפרד.
//
// clerkMiddleware עוטף הכל כדי ש-auth() יעבוד בכל Server Component/Action
// שמוגש דרך ה-matcher למטה. בתוך העטיפה עדיין מרעננים גם את ה-session cookie
// הישן של Supabase Auth — dual-mode (ר' lib/supabase/server.ts): כל עוד יש
// משתמשים שלא עברו ל-Clerk, ה-session הישן שלהם חייב להמשיך להתרענן.
export default clerkMiddleware(async (_auth, request: NextRequest) => {
  // cleanagroup.app — דף-הנחיתה המשותף של הקבוצה — מוגש מהפרויקט הזה דרך
  // rewrite ל-/group (ר' lib/hosts.ts). הדף ציבורי ולא צריך session, ולכן
  // יוצאים לפני רענון ה-cookie של Supabase.
  const route = routeForHost(
    request.headers.get("host"),
    request.nextUrl.pathname,
    request.nextUrl.search,
    { production: process.env.VERCEL_ENV === "production" },
  );
  if (route.kind === "redirect") return NextResponse.redirect(route.url, 307);
  if (route.kind === "rewrite") {
    const url = request.nextUrl.clone();
    url.pathname = route.pathname;
    return NextResponse.rewrite(url);
  }

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
});

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api|sw\\.js|manifest\\.webmanifest|icon|apple-icon).*)",
  ],
};
