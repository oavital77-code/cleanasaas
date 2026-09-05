import Link from "next/link";
import { Logo } from "@/components/logo";

// פוטר משותף לדפי השיווק/משפט (דף הבית הציבורי, תנאי שימוש, מדיניות
// פרטיות) — כדי שהקישורים בין שלושתם יישארו עקביים במקום אחד.
export function SiteFooter() {
  return (
    <footer className="border-t border-border/60 px-5 py-10 md:px-8">
      <div className="mx-auto flex w-full max-w-4xl flex-col items-center justify-between gap-4 text-sm text-muted-foreground md:flex-row">
        <Link href="/" className="inline-flex min-h-11 items-center hover:text-foreground">
          <Logo size="sm" />
        </Link>
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
