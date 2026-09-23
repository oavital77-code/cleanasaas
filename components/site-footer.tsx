import Link from "next/link";
import { Logo } from "@/components/logo";

// פוטר משותף לדפי השיווק/משפט. עד 22.9.2026 היה לו גם מצב אנגלי/LTR לדפי
// הנחיתה האנגליים; מאז שכולם עברו לעברית אין לו אף משתמש, והוא הוסר.
export function SiteFooter() {
  return (
    <footer className="border-t border-border/60 px-5 py-10 md:px-8">
      <div className="mx-auto flex w-full max-w-4xl flex-col items-center justify-between gap-4 text-sm text-muted-foreground md:flex-row">
        <div className="flex items-center gap-3">
          <Link href="/" className="inline-flex min-h-11 items-center hover:text-foreground">
            <Logo size="sm" />
          </Link>
          {/* קישור מ-Cleana אל CleanaGroup — הכיוון ההפוך (מ-/group אל /)
              כבר קיים דרך כרטיסיית Cleana שם. */}
          <Link href="/group" className="text-xs text-muted-foreground hover:text-foreground">
            חלק מ-CleanaGroup
          </Link>
        </div>
        <div className="flex items-center gap-6">
          <Link href="/terms" className="inline-flex min-h-11 items-center hover:text-foreground">
            תנאי שימוש
          </Link>
          <Link href="/privacy" className="inline-flex min-h-11 items-center hover:text-foreground">
            מדיניות פרטיות
          </Link>
        </div>
      </div>
    </footer>
  );
}
