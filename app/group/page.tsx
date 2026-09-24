import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Check, Sparkles } from "lucide-react";
import { GridPaper, TrustRow } from "@/components/landing";
import { CLEANA_PLUS_URL, CLEANA_URL } from "@/lib/hosts";

// עברית/RTL — כמו שני דפי הנחיתה של המוצרים מאז 22.9.2026 (היה אנגלית/LTR,
// חריג שיובא מ-click-na). ה-dir מגיע מ-app/layout.tsx. עמוד-hub נייטרלי שמציג את שני המוצרים בפועל
// (Cleana, Cleana+) ומקשר אליהם — לא נוגע בקוד/עיצוב של אף אחד מהם,
// רק מייצג את הצבעים האמיתיים שלהם (Cleana: violet-500 מ-globals.css
// כאן; Cleana+: טרקוטה/זהב מ-src/app/globals.css של ריפו click-na —
// hex מחושב מה-HSL שם, לא מומצא).
export const metadata: Metadata = {
  title: "CleanaGroup — Cleana ו-Cleana+",
  description:
    "CleanaGroup מפתחת מערכות לתיאום ולניהול של עבודה טיפולית: Cleana לקליניקות שמשכירות חדרים למטפלים, ו-Cleana+ למטפלים עצמאיים שמנהלים את המטופלים שלהם.",
};

const CLEANA_POINTS = ["לוח חדרים בלי התנגשויות", "כרטיסיות וססיות חודשיות", "הפרדה מלאה בין קליניקות"];

const CLEANA_PLUS_POINTS = [
  "קישור אחד, והמטופלים קובעים תור בעצמם",
  "יומן בלי כפל תורים",
  "תזכורות שמצמצמות ביטולים של הרגע האחרון",
];

const VALUES = [
  {
    title: "אותם עקרונות",
    body: "שני המוצרים בנויים על אותם כללים: אין כפל הזמנות, המידע לא עובר בין חשבונות, והיומן תמיד מדויק.",
  },
  {
    title: "מותאמים לגודל העבודה",
    body: "קליניקה עם עשרות מטפלים ומטפל שעובד לבד צריכים כלים שונים. לכן יש שני מוצרים, ולא מוצר אחד עם תוספות.",
  },
  {
    title: "נפרדים בכוונה",
    body: "Cleana ו-Cleana+ הן מערכות נפרדות. המידע של קליניקה ורשימת המטופלים של מטפל עצמאי אף פעם לא מתערבבים.",
  },
];

export default function GroupPage() {
  return (
    <div className="flex flex-1 flex-col bg-white text-neutral-900">
      <header className="sticky top-0 z-40 border-b border-neutral-200 bg-white/80 px-5 py-4 backdrop-blur-sm md:px-8">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between">
          <span className="text-lg font-bold tracking-tight">CleanaGroup</span>
          <div className="flex items-center gap-2">
            <a href={CLEANA_URL} className="inline-flex h-11 items-center rounded-2xl px-4 text-sm font-semibold text-neutral-600 hover:text-neutral-900">
              Cleana
            </a>
            <a
              href={CLEANA_PLUS_URL}
              className="inline-flex h-11 items-center rounded-2xl px-4 text-sm font-semibold text-neutral-600 hover:text-neutral-900"
            >
              Cleana+
            </a>
          </div>
        </div>
      </header>

      <main className="flex flex-1 flex-col">
        <section className="relative overflow-hidden">
          <GridPaper />
          <div className="relative mx-auto flex w-full max-w-3xl flex-col items-center gap-7 px-5 py-16 text-center md:px-8 md:py-24">
            <span className="inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-white px-4 py-1.5 text-xs font-semibold tracking-wide text-neutral-600 shadow-sm">
              <Sparkles className="size-3.5" aria-hidden />
              קבוצה אחת, שני כלים לעבודה טיפולית
            </span>
            <h1 className="text-[2.6rem] leading-[1.05] font-extrabold tracking-tight text-balance sm:text-5xl lg:text-6xl">
              המערכות שמאחורי הטיפול.
              <br />
              <span className="text-violet-500">לקליניקות</span> ו<span style={{ color: "#C6723A" }}>למטפלים.</span>
            </h1>
            <p className="max-w-xl text-lg leading-relaxed text-neutral-600">
              CleanaGroup מפתחת שתי מערכות: אחת לקליניקות שמשכירות חדרים למטפלים,
              ואחת למטפלים עצמאיים שמנהלים את התורים והמטופלים שלהם.
            </p>
            <TrustRow items={["בלי כרטיס אשראי", "מוכן לעבודה תוך דקות", "אפשר לבטל בכל זמן"]} />
          </div>
        </section>

        <section className="px-5 pb-16 md:px-8 md:pb-24">
          <div className="mx-auto grid w-full max-w-5xl grid-cols-1 gap-6 md:grid-cols-2 md:gap-8">
            {/* Cleana — סגול, הטוקנים האמיתיים מ-globals.css של cleanasaas */}
            <div className="relative flex flex-col gap-6 overflow-hidden rounded-3xl border border-violet-200 bg-white p-8 shadow-2xl shadow-violet-500/10">
              <div aria-hidden className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-violet-500 via-violet-300 to-violet-500" />
              <div className="flex items-center gap-3">
                <svg width="44" height="44" viewBox="0 0 100 100" fill="none" aria-hidden="true">
                  <rect x="4" y="4" width="92" height="92" rx="24" fill="#7A5AF8" />
                  <circle cx="50" cy="50" r="24" fill="none" stroke="white" strokeWidth="7" />
                </svg>
                <div>
                  <p className="text-xs font-semibold tracking-wide text-violet-600">לבעלי קליניקות</p>
                  <h2 className="text-2xl font-bold text-neutral-900">Cleana</h2>
                </div>
              </div>
              <p className="text-neutral-700">
                ניהול חדרים, כרטיסיות וססיות לקליניקות עם כמה סניפים ומטפלים.
              </p>
              <ul className="flex flex-col gap-3">
                {CLEANA_POINTS.map((point) => (
                  <li key={point} className="flex items-center gap-3 text-sm text-neutral-700">
                    <span className="inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-violet-50 text-violet-600">
                      <Check className="size-3" strokeWidth={3} aria-hidden />
                    </span>
                    {point}
                  </li>
                ))}
              </ul>
              {/* מוחלט, לא "/": על cleanagroup.app השורש הוא הדף הזה עצמו
                  (rewrite ב-middleware), וקישור יחסי היה מוביל לעצמו. */}
              <a
                href={CLEANA_URL}
                className="mt-auto inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-violet-500 px-6 text-sm font-semibold text-white shadow-lg shadow-violet-500/25 transition-colors hover:bg-violet-600"
              >
                ל-Cleana
                <ArrowRight className="size-4 rtl:rotate-180" aria-hidden />
              </a>
            </div>

            {/* Cleana+ — טרקוטה/זהב, hex מחושב מ-HSL האמיתי ב-click-na
                (src/app/globals.css: --primary 24 55% 50%, --accent 41 71% 46%,
                --background 37 59% 90%) — לא נוגעים בריפו עצמו, רק מייצגים אותו. */}
            <div className="relative flex flex-col gap-6 overflow-hidden rounded-3xl border bg-white p-8 shadow-2xl" style={{ borderColor: "#E3C9A6", boxShadow: "0 25px 50px -12px rgba(198,114,58,0.12)" }}>
              <div aria-hidden className="absolute inset-x-0 top-0 h-1" style={{ background: "linear-gradient(to right, #C6723A, #C99422, #C6723A)" }} />
              <div className="flex items-center gap-3">
                <svg width="44" height="44" viewBox="0 0 32 32" aria-hidden="true">
                  <rect width="32" height="32" rx="9" fill="#C6723A" />
                  <circle cx="16" cy="16" r="7.25" fill="none" stroke="#F4E9D6" strokeWidth="3" />
                </svg>
                <div>
                  <p className="text-xs font-semibold tracking-wide" style={{ color: "#8E4A1A" }}>
                    למטפלים עצמאיים
                  </p>
                  <h2 className="text-2xl font-bold text-neutral-900">
                    Cleana<span style={{ color: "#C99422" }}>+</span>
                  </h2>
                </div>
              </div>
              <p className="text-neutral-700">
                קישור לקביעת תורים שהמטופלים מבינים מיד, ויומן בלי כפל תורים. למטפלים שמנהלים
                את העבודה שלהם בעצמם.
              </p>
              <ul className="flex flex-col gap-3">
                {CLEANA_PLUS_POINTS.map((point) => (
                  <li key={point} className="flex items-center gap-3 text-sm text-neutral-700">
                    <span className="inline-flex size-5 shrink-0 items-center justify-center rounded-full" style={{ backgroundColor: "#F4E9D6", color: "#8E4A1A" }}>
                      <Check className="size-3" strokeWidth={3} aria-hidden />
                    </span>
                    {point}
                  </li>
                ))}
              </ul>
              <a
                href={CLEANA_PLUS_URL}
                className="mt-auto inline-flex h-12 items-center justify-center gap-2 rounded-2xl px-6 text-sm font-semibold text-white transition-opacity hover:opacity-90"
                style={{ backgroundColor: "#C6723A", boxShadow: "0 10px 15px -3px rgba(198,114,58,0.25)" }}
              >
                ל-Cleana+
                <ArrowRight className="size-4 rtl:rotate-180" aria-hidden />
              </a>
            </div>
          </div>
        </section>

        <section className="border-t border-neutral-200 px-5 py-16 md:px-8 md:py-24">
          <div className="mx-auto grid w-full max-w-5xl grid-cols-1 gap-4 md:grid-cols-3 md:gap-6">
            {VALUES.map((v, i) => (
              <div key={v.title} className="flex flex-col gap-3 rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm md:p-7">
                <span className="text-2xl font-bold tabular-nums text-neutral-300">{String(i + 1).padStart(2, "0")}</span>
                <p className="text-lg font-bold text-neutral-900">{v.title}</p>
                <p className="text-sm leading-relaxed text-neutral-600">{v.body}</p>
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-neutral-200 px-5 py-10 md:px-8">
        <div className="mx-auto flex w-full max-w-4xl flex-col items-center justify-between gap-4 text-sm text-neutral-500 md:flex-row">
          <span>© CleanaGroup</span>
          <div className="flex items-center gap-6">
            <Link href="/terms" className="hover:text-neutral-900">
              תנאי שימוש
            </Link>
            <Link href="/privacy" className="hover:text-neutral-900">
              מדיניות פרטיות
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
