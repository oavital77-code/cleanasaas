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
  X,
  type LucideIcon,
} from "lucide-react";
import { Logo } from "./logo";
import { signOutAction } from "@/lib/auth/actions";

// שלד משותף לשני "הצדדים" (מטפל/ת ⇄ אדמין), לפי CLEANASITEMAPANDDESIGN §1:
// סרגל צד קבוע 220px בדסקטופ (inset-inline-start, אז ב-RTL הוא מימין
// ממילא), תפריט המבורגר במובייל. רק רשימת הפריטים שונה בין הצדדים —
// המרכיב עצמו זהה.
type NavItem = { href: string; label: string; icon: LucideIcon };

const APP_NAV: NavItem[] = [
  { href: "/", label: "בית", icon: Home },
  { href: "/schedule", label: "לוח זמנים", icon: CalendarDays },
  { href: "/bookings", label: "ההזמנות שלי", icon: ClipboardList },
  { href: "/purchase", label: "רכישת כרטיסייה", icon: ShoppingCart },
  { href: "/sessions", label: "הססיות שלי", icon: Repeat },
  { href: "/payments", label: "תשלומים", icon: Receipt },
  { href: "/profile", label: "הכרטיס שלי", icon: User },
];

const ADMIN_NAV: NavItem[] = [
  { href: "/admin", label: "מסך הבית", icon: LayoutDashboard },
  { href: "/admin/board", label: "לוח מלא", icon: Table2 },
  { href: "/admin/therapists", label: "מטפלים", icon: Users },
  { href: "/admin/sessions", label: "בקשות ססיה", icon: ListChecks },
  { href: "/admin/payments", label: "תשלומים", icon: Receipt },
  { href: "/admin/rooms", label: "סניפים וחדרים", icon: Building2 },
  { href: "/admin/settings", label: "הגדרות", icon: Settings },
  { href: "/admin/reports", label: "דוחות", icon: BarChart3 },
  { href: "/admin/audit", label: "יומן פעולות", icon: ScrollText },
];

function isActive(pathname: string, href: string) {
  if (href === "/" || href === "/admin") return pathname === href;
  return pathname === href || pathname.startsWith(href + "/");
}

function NavList({ items, pathname, onNavigate }: { items: NavItem[]; pathname: string; onNavigate?: () => void }) {
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
            {item.label}
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
  children,
}: {
  side: "app" | "admin";
  clinicName?: string | null;
  fullName?: string | null;
  isAdmin?: boolean;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const items = side === "app" ? APP_NAV : ADMIN_NAV;

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
      ? { href: "/admin", label: "ניהול המערכת" }
      : side === "admin"
        ? { href: "/", label: "חזרה לאפליקציה" }
        : null;

  const sidebarBody = (
    <>
      <div className="flex h-[var(--page-header-h)] shrink-0 items-center gap-2 border-b border-border px-4">
        <Logo size="sm" />
      </div>
      <NavList items={items} pathname={pathname} onNavigate={() => setMobileOpen(false)} />
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
          <form action={signOutAction}>
            <button
              type="submit"
              title="יציאה"
              className="flex size-9 shrink-0 items-center justify-center rounded-button text-muted-foreground hover:bg-subtle hover:text-foreground"
            >
              <LogOut className="size-[18px]" />
            </button>
          </form>
        </div>
      </div>
    </>
  );

  return (
    <div className="flex min-h-full flex-1">
      {/* דסקטופ — סרגל צד קבוע */}
      <aside className="hidden w-[var(--sidebar-w)] shrink-0 flex-col border-e border-border bg-surface md:flex">
        {sidebarBody}
      </aside>

      {/* מובייל — top bar + סרגל נשלף */}
      {/* min-w-0 חובה: פריט flex מקבל min-width:auto כברירת מחדל, ואז טבלה
          או קוד ארוך בתוכן דוחפים את כל העמודה מעבר לרוחב המסך. */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* sticky top-0: נשאר צמוד לראש המסך בגלילה. תלוי ב-overflow-x:clip
            (לא hidden) על body ב-globals.css — hidden היה הופך את body
            ל-scroll container חדש ומבטל sticky של צאצא. */}
        <header className="sticky top-0 z-30 flex h-[var(--page-header-h)] shrink-0 items-center justify-between border-b border-border bg-surface px-4 md:hidden">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="flex size-9 items-center justify-center rounded-button text-foreground hover:bg-subtle"
            aria-label="פתיחת תפריט"
          >
            <Menu className="size-5" />
          </button>
          <Logo size="sm" />
        </header>

        {mobileOpen && (
          <div className="fixed inset-0 z-50 flex md:hidden">
            <div className="absolute inset-0 bg-black/30" onClick={() => setMobileOpen(false)} />
            <div className="relative flex h-full w-[min(var(--drawer-w),85vw)] flex-col bg-surface shadow-e3">
              <div className="flex h-[var(--page-header-h)] shrink-0 items-center justify-between border-b border-border px-4">
                <Logo size="sm" />
                <button
                  type="button"
                  onClick={() => setMobileOpen(false)}
                  className="flex size-9 items-center justify-center rounded-button text-muted-foreground hover:bg-subtle"
                  aria-label="סגירה"
                >
                  <X className="size-5" />
                </button>
              </div>
              <NavList items={items} pathname={pathname} onNavigate={() => setMobileOpen(false)} />
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
                <form action={signOutAction}>
                  <button
                    type="submit"
                    className="flex w-full items-center gap-3 rounded-button px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-subtle"
                  >
                    <LogOut className="size-[18px]" />
                    יציאה
                  </button>
                </form>
              </div>
            </div>
          </div>
        )}

        <main className="mx-auto w-full max-w-[var(--content-max)] flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
