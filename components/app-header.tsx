import Link from "next/link";
import { Logo } from "./logo";
import { Button } from "./ui/button";
import { SignOutButton } from "./sign-out-button";

// סרגל עליון למסכים מחוברים (בית/schedule/admin/superadmin). לא בשימוש
// במסכי אימות (ר' AuthShell) — שם אין עדיין ניווט פנימי.
export function AppHeader({
  clinicName,
  role,
  isSuperadmin,
}: {
  clinicName?: string | null;
  role?: string | null;
  isSuperadmin?: boolean;
}) {
  const isAdmin = role === "owner" || role === "admin";

  return (
    <header className="sticky top-0 z-10 flex h-[var(--page-header-h)] shrink-0 items-center justify-between border-b border-border bg-surface/85 px-4 backdrop-blur supports-[backdrop-filter]:bg-surface/70 sm:px-6">
      <Link href="/" className="shrink-0">
        <Logo size="sm" />
      </Link>

      <nav className="hidden items-center gap-1 md:flex">
        <HeaderLink href="/">בית</HeaderLink>
        <HeaderLink href="/schedule">הזמנת חדר</HeaderLink>
        {isAdmin && <HeaderLink href="/admin/settings">ניהול</HeaderLink>}
        {isSuperadmin && <HeaderLink href="/superadmin">סופר-אדמין</HeaderLink>}
      </nav>

      <div className="flex items-center gap-3">
        {clinicName && (
          <span className="hidden max-w-[12rem] truncate text-sm text-muted-foreground sm:inline">
            {clinicName}
          </span>
        )}
        <SignOutButton>
          <Button type="button" variant="ghost" size="sm">
            יציאה
          </Button>
        </SignOutButton>
      </div>
    </header>
  );
}

function HeaderLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="rounded-button px-3 py-2 text-sm font-medium text-secondary-foreground hover:bg-violet-50 hover:text-violet-700"
    >
      {children}
    </Link>
  );
}
