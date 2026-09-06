import Link from "next/link";
import { Logo } from "@/components/logo";

// פוטר משותף לדפי השיווק/משפט. english=true משמש בדפים האנגליים/LTR
// (דף הבית הציבורי, /group) — אותה תבנית בדיוק כמו SiteFooter של
// click-na: התוויות באנגלית, אבל הן עדיין מצביעות ל-/terms ו-/privacy
// העבריים הקיימים. זה תקדים מפורש שם (הערה בקוד: "the landing page is
// English, the terms and privacy pages are not"), לא באג.
export function SiteFooter({ english = false }: { english?: boolean } = {}) {
  return (
    <footer
      dir={english ? "ltr" : undefined}
      className="border-t border-border/60 px-5 py-10 md:px-8"
    >
      <div className="mx-auto flex w-full max-w-4xl flex-col items-center justify-between gap-4 text-sm text-muted-foreground md:flex-row">
        <Link href="/" className="inline-flex min-h-11 items-center hover:text-foreground">
          <Logo size="sm" />
        </Link>
        <div className="flex items-center gap-6">
          <Link href="/terms" className="inline-flex min-h-11 items-center hover:text-foreground">
            {english ? "Terms" : "תנאי שימוש"}
          </Link>
          <Link href="/privacy" className="inline-flex min-h-11 items-center hover:text-foreground">
            {english ? "Privacy" : "מדיניות פרטיות"}
          </Link>
        </div>
      </div>
    </footer>
  );
}
