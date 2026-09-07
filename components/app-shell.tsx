"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  CalendarDays,
  ClipboardList,
  ShoppingCart,
  Repeat,
  Receipt,
  User,
  LayoutDashboard,
  Table2,
  Users,
  ListChecks,
  Building2,
  Settings,
  BarChart3,
  ScrollText,
  ArrowLeftRight,
  LogOut,
  Menu,
  MessageCircle,
  X,
  type LucideIcon,
} from "lucide-react";
import { Logo } from "./logo";
import { SignOutButton } from "./sign-out-button";
import { dirFor, getAppShellDict, normalizeLocale } from "@/lib/i18n";
import { LocaleProvider } from "@/lib/i18n/context";

// שלד משותף לשני "הצדדים" (מטפל/ת ⇄ אדמין), לפי CLEANASITEMAPANDDESIGN §1:
// סרגל צד קבוע 220px בדסקטופ (inset-inline-start, אז ב-RTL הוא מימין
// ממילא), תפריט המבורגר במובייל. רק רשימת הפריטים שונה בין הצדדים —
// המרכיב עצמו זהה.
//
// 🔴 i18n: locale משפיע *רק* על ה-chrome הזה (ניווט/כותרות/כפתורים) — לא
// על children (תוכן הדף). ר' lib/i18n.ts להסבר המלא על הארכיטקטורה
// ההדרגתית. dir/lang מוגדרים כאן מקומית (aside/header/drawer) ולא על
// ה-<html> הגלובלי, כדי שדפים לא-מתורגמים ימשיכו RTL תקין ללא תלות בזה.
type NavItem = { href: string; navKey: keyof ReturnType<typeof getAppShellDict>["nav"]; icon: LucideIcon };

const APP_NAV: NavItem[] = [
  { href: "/dashboard", navKey: "dashboard", icon: Home },
  { href: "/schedule", navKey: "schedule", icon: CalendarDays },
  { href: "/bookings", navKey: "bookings", icon: ClipboardList },
  { href: "/purchase", navKey: "purchase", icon: ShoppingCart },
  { href: "/sessions", navKey: "sessions", icon: Repeat },
  { href: "/payments", navKey: "payments", icon: Receipt },
  { href: "/profile", navKey: "profile", icon: User },
];

const ADMIN_NAV: NavItem[] = [
  { href: "/admin", navKey: "adminHome", icon: LayoutDashboard },
  { href: "/admin/board", navKey: "adminBoard", icon: Table2 },
  { href: "/admin/therapists", navKey: "adminTherapists", icon: Users },
  { href: "/admin/sessions", navKey: "adminSessions", icon: ListChecks },
  { href: "/admin/payments", navKey: "adminPayments", icon: Receipt },
  { href: "/admin/rooms", navKey: "adminRooms", icon: Building2 },
  { href: "/admin/reminders", navKey: "adminReminders", icon: MessageCircle },
  { href: "/admin/settings", navKey: "adminSettings", icon: Settings },
  { href: "/admin/reports", navKey: "adminReports", icon: BarChart3 },
  { href: "/admin/audit", navKey: "adminAudit", icon: ScrollText },
];

function isActive(pathname: string, href: string) {
  if (href === "/" || href === "/admin") return pathname === href;
  return pathname === href || pathname.startsWith(href + "/");
}

function NavList({
  items,
  pathname,
  dict,
  onNavigate,
}: {
  items: NavItem[];
  pathname: string;
  dict: ReturnType<typeof getAppShellDict>;
  onNavigate?: () => void;
}) {
  return (
    // overscroll-contain: גלילה עד סוף התפריט לא "בורחת" לגלילת הדף שמאחוריו.
    <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto overscroll-contain p-3">
      {items.map((item) => {
        const active = isActive(pathname, item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={`flex items-center gap-3 rounded-button px-3 py-2.5 text-sm font-medium transition-colors ${
              active ? "bg-violet-50 text-violet-700" : "text-secondary-foreground hover:bg-subtle"
            }`}
          >
            <Icon className="size-[18px] shrink-0" />
            {dict.nav[item.navKey]}
          </Link>
        );
      })}
    </nav>
  );
}

export function AppShell({
  side,
  clinicName,
  fullName,
  isAdmin,
  locale: localeProp,
  children,
}: {
  side: "app" | "admin";
  clinicName?: string | null;
  fullName?: string | null;
  isAdmin?: boolean;
  locale?: string | null;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const items = side === "app" ? APP_NAV : ADMIN_NAV;
  const locale = normalizeLocale(localeProp);
  const dict = getAppShellDict(locale);
  const dir = dirFor(locale);

  // 🔴 היפוך מלא של הממשק לפי שפה: ה-wrapper החיצוני מקבל dir/lang (SSR —
  // הסרגל קופץ לשמאל באנגלית כבר ב-paint הראשון, בלי flash), וה-<html>
  // הגלובלי מסונכרן אחרי hydration — כדי שגם פס הגלילה של הדפדפן וכיוון
  // ברירת המחדל של אלמנטים "מחוץ" לעץ (portals) יתאימו. ה-cleanup מחזיר
  // rtl/he כי הדפים הציבוריים (login/signup/landing) נשארים עברית תמיד
  // וה-<html> ב-app/layout.tsx מוגדר rtl סטטית.
  useEffect(() => {
    const html = document.documentElement;
    const prevDir = html.getAttribute("dir");
    const prevLang = html.getAttribute("lang");
    html.setAttribute("dir", dir);
    html.setAttribute("lang", locale);
    return () => {
      html.setAttribute("dir", prevDir ?? "rtl");
      html.setAttribute("lang", prevLang ?? "he");
    };
  }, [dir, locale]);

  // כשהמגירה פתוחה — נעילת גלילת הדף שמאחוריה, וסגירה ב-Escape.
  // בלי זה במובייל גוללים את התוכן "מתחת" למגירה וזה מרגיש שבור.
  useEffect(() => {
    if (!mobileOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [mobileOpen]);

  // סגירה אוטומטית במעבר לדסקטופ, כדי שהמגירה לא תישאר "תקועה" פתוחה
  // אחרי סיבוב מסך או שינוי גודל חלון.
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const onChange = () => {
      if (mq.matches) setMobileOpen(false);
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  const crossLink =
    side === "app" && isAdmin
      ? { href: "/admin", label: dict.crossToAdmin }
      : side === "admin"
        ? { href: "/", label: dict.crossToApp }
        : null;

  // הלוגו הוא קישור לדף הבית של הצד שבו נמצאים (מסך הבית של האדמין, או
  // הבית של המטפל/ת) — התנהגות מצופה בכל דשבורד.
  const homeHref = side === "admin" ? "/admin" : "/dashboard";

  const sidebarBody = (
    <>
      <div className="flex h-[var(--page-header-h)] shrink-0 items-center gap-2 border-b border-border px-4">
        <Link href={homeHref} onClick={() => setMobileOpen(false)} aria-label={dict.homeAria}>
          <Logo size="sm" />
        </Link>
      </div>
      <NavList items={items} pathname={pathname} dict={dict} onNavigate={() => setMobileOpen(false)} />
      <div className="flex flex-col gap-2 border-t border-border p-3">
        {crossLink && (
          <Link
            href={crossLink.href}
            onClick={() => setMobileOpen(false)}
            className="flex items-center gap-3 rounded-button px-3 py-2.5 text-sm font-medium text-violet-600 hover:bg-violet-50"
          >
            <ArrowLeftRight className="size-[18px] shrink-0" />
            {crossLink.label}
          </Link>
        )}
        <div className="flex items-center justify-between gap-2 px-3">
          <div className="min-w-0">
            {fullName && <p className="truncate text-sm font-medium">{fullName}</p>}
            {clinicName && <p className="truncate text-xs text-muted-foreground">{clinicName}</p>}
          </div>
          <SignOutButton>
            <button
              type="button"
              title={dict.signOut}
              className="flex size-9 shrink-0 items-center justify-center rounded-button text-muted-foreground hover:bg-subtle hover:text-foreground"
            >
              <LogOut className="size-[18px]" />
            </button>
          </SignOutButton>
        </div>
      </div>
    </>
  );

  return (
    <LocaleProvider locale={locale}>
    <div dir={dir} lang={locale} className="flex min-h-full flex-1">
      {/* דסקטופ — סרגל צד קבוע. sticky top-0 self-start h-screen: בלי
          self-start הוא נמתח (align-items:stretch כברירת מחדל של flex)
          לגובה כל השורה הכוללת את תוכן העמוד, ואז "sticky" לא עוזר —
          האלמנט כבר תופס את כל הגובה וגולל יחד איתו. self-start משחרר
          אותו לגובה הטבעי שלו (h-screen), ורק אז sticky שומר אותו צמוד
          לראש המסך תוך כדי גלילת התוכן שלצידו. */}
      <aside
        dir={dir}
        lang={locale}
        className="sticky top-0 hidden h-screen w-[var(--sidebar-w)] shrink-0 flex-col self-start border-e border-border bg-surface md:flex"
      >
        {sidebarBody}
      </aside>

      {/* מובייל — top bar + סרגל נשלף */}
      {/* min-w-0 חובה: פריט flex מקבל min-width:auto כברירת מחדל, ואז טבלה
          או קוד ארוך בתוכן דוחפים את כל העמודה מעבר לרוחב המסך. */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* sticky top-0: נשאר צמוד לראש המסך בגלילה. תלוי ב-overflow-x:clip
            (לא hidden) על body ב-globals.css — hidden היה הופך את body
            ל-scroll container חדש ומבטל sticky של צאצא. */}
        <header
          dir={dir}
          lang={locale}
          className="sticky top-0 z-30 flex h-[var(--page-header-h)] shrink-0 items-center justify-between border-b border-border bg-surface px-4 md:hidden"
        >
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="flex size-9 items-center justify-center rounded-button text-foreground hover:bg-subtle"
            aria-label={dict.openMenuAria}
          >
            <Menu className="size-5" />
          </button>
          <Link href={homeHref} aria-label={dict.homeAria}>
            <Logo size="sm" />
          </Link>
        </header>

        {mobileOpen && (
          <div className="fixed inset-0 z-50 flex md:hidden">
            <div className="absolute inset-0 bg-black/30" onClick={() => setMobileOpen(false)} />
            <div dir={dir} lang={locale} className="relative flex h-full w-[min(var(--drawer-w),85vw)] flex-col bg-surface shadow-e3">
              <div className="flex h-[var(--page-header-h)] shrink-0 items-center justify-between border-b border-border px-4">
                <Link href={homeHref} onClick={() => setMobileOpen(false)} aria-label={dict.homeAria}>
                  <Logo size="sm" />
                </Link>
                <button
                  type="button"
                  onClick={() => setMobileOpen(false)}
                  className="flex size-9 items-center justify-center rounded-button text-muted-foreground hover:bg-subtle"
                  aria-label={dict.closeAria}
                >
                  <X className="size-5" />
                </button>
              </div>
              <NavList items={items} pathname={pathname} dict={dict} onNavigate={() => setMobileOpen(false)} />
              <div className="flex flex-col gap-2 border-t border-border p-3">
                {crossLink && (
                  <Link
                    href={crossLink.href}
                    onClick={() => setMobileOpen(false)}
                    className="flex items-center gap-3 rounded-button px-3 py-2.5 text-sm font-medium text-violet-600 hover:bg-violet-50"
                  >
                    <ArrowLeftRight className="size-[18px] shrink-0" />
                    {crossLink.label}
                  </Link>
                )}
                <SignOutButton>
                  <button
                    type="button"
                    className="flex w-full items-center gap-3 rounded-button px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-subtle"
                  >
                    <LogOut className="size-[18px]" />
                    {dict.signOut}
                  </button>
                </SignOutButton>
              </div>
            </div>
          </div>
        )}

        <main className="mx-auto w-full max-w-[var(--content-max)] flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
    </LocaleProvider>
  );
}
