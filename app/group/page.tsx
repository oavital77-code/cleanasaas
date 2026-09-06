import type { Metadata } from "next";
import Link from "next/link";
import { Check } from "lucide-react";

// אנגלית/LTR — כמו דף הבית הציבורי (ר' app/(app)/page.tsx) וכמו החריג
// המקורי ב-click-na. עמוד-hub נייטרלי שמציג את שני המוצרים בפועל
// (Cleana, Cleana+) ומקשר אליהם — לא נוגע בקוד/עיצוב של אף אחד מהם,
// רק מייצג את הצבעים האמיתיים שלהם (Cleana: violet-500 מ-globals.css
// כאן; Cleana+: טרקוטה/זהב מ-src/app/globals.css של ריפו click-na —
// hex מחושב מה-HSL שם, לא מומצא).
export const metadata: Metadata = {
  title: "CleanaGroup — Cleana & Cleana+",
  description:
    "CleanaGroup builds the scheduling and management systems behind the practice: Cleana for clinics that rent rooms to many therapists, Cleana+ for independent therapists managing their own clients.",
};

const CLEANA_POINTS = ["Overlap-proof room calendar", "Punch cards & recurring sessions", "Every clinic fully isolated"];

const CLEANA_PLUS_POINTS = [
  "One link, clients book themselves",
  "A calendar that holds itself",
  "Quiet reminders that cut no-shows",
];

const VALUES = [
  {
    title: "Built the same way",
    body: "Both products share the same non-negotiables: no double-booking, data that never leaks between accounts, and a calendar that's actually trustworthy.",
  },
  {
    title: "Sized to the job",
    body: "Running a clinic with dozens of therapists, or running your own practice solo — the tool fits the job, not a bigger version of the same thing bolted on.",
  },
  {
    title: "Kept separate on purpose",
    body: "Cleana and Cleana+ are independent systems. A clinic's data and a solo therapist's client list never mix — by design, not by accident.",
  },
];

export default function GroupPage() {
  return (
    <div dir="ltr" className="flex flex-1 flex-col bg-white text-neutral-900">
      <header className="border-b border-neutral-200 px-5 py-5 md:px-8">
        <div className="mx-auto flex w-full max-w-5xl items-center">
          <span className="text-lg font-semibold tracking-tight">CleanaGroup</span>
        </div>
      </header>

      <main className="flex flex-1 flex-col">
        <section className="mx-auto flex w-full max-w-2xl flex-col items-center gap-6 px-5 py-16 text-center md:px-8 md:py-24">
          <span className="text-xs font-semibold tracking-wide text-neutral-500">
            ONE GROUP, TWO PRACTICE TOOLS
          </span>
          <h1 className="text-4xl font-semibold text-balance sm:text-5xl">
            A holistic answer for clinics and independent practitioners.
          </h1>
          <p className="max-w-xl text-lg leading-relaxed text-neutral-600">
            CleanaGroup builds the scheduling and management systems behind
            the practice — one for clinics that rent rooms to many
            therapists, one for therapists managing their own clients.
          </p>
        </section>

        <section className="border-t border-neutral-200 px-5 py-16 md:px-8 md:py-24">
          <div className="mx-auto grid w-full max-w-5xl grid-cols-1 gap-8 md:grid-cols-2">
            {/* Cleana — סגול, הטוקנים האמיתיים מ-globals.css של cleanasaas */}
            <div className="flex flex-col gap-6 rounded-2xl border border-violet-200 bg-violet-50 p-8">
              <div className="flex items-center gap-3">
                <svg width="40" height="40" viewBox="0 0 100 100" fill="none" aria-hidden="true">
                  <rect x="4" y="4" width="92" height="92" rx="24" fill="#7A5AF8" />
                  <circle cx="50" cy="50" r="24" fill="none" stroke="white" strokeWidth="7" />
                </svg>
                <div>
                  <p className="text-xs font-semibold tracking-wide text-violet-600">FOR CLINIC OWNERS</p>
                  <h2 className="text-2xl font-semibold text-neutral-900">Cleana</h2>
                </div>
              </div>
              <p className="text-neutral-700">
                Room scheduling, punch cards, and sessions for clinics with
                multiple branches and therapists.
              </p>
              <ul className="flex flex-col gap-2">
                {CLEANA_POINTS.map((point) => (
                  <li key={point} className="flex items-center gap-2 text-sm text-neutral-700">
                    <Check className="size-4 shrink-0 text-violet-600" />
                    {point}
                  </li>
                ))}
              </ul>
              <Link
                href="/"
                className="mt-auto inline-flex h-11 items-center justify-center rounded-lg bg-violet-500 px-5 text-sm font-semibold text-white transition-colors hover:bg-violet-600"
              >
                Visit Cleana
              </Link>
            </div>

            {/* Cleana+ — טרקוטה/זהב, hex מחושב מ-HSL האמיתי ב-click-na
                (src/app/globals.css: --primary 24 55% 50%, --accent 41 71% 46%,
                --background 37 59% 90%) — לא נוגעים בריפו עצמו, רק מייצגים אותו. */}
            <div className="flex flex-col gap-6 rounded-2xl border p-8" style={{ borderColor: "#E3C9A6", backgroundColor: "#F4E9D6" }}>
              <div className="flex items-center gap-3">
                <svg width="40" height="40" viewBox="0 0 32 32" aria-hidden="true">
                  <rect width="32" height="32" rx="9" fill="#C6723A" />
                  <circle cx="16" cy="16" r="7.25" fill="none" stroke="#F4E9D6" strokeWidth="3" />
                </svg>
                <div>
                  <p className="text-xs font-semibold tracking-wide" style={{ color: "#8E4A1A" }}>
                    FOR INDEPENDENT THERAPISTS
                  </p>
                  <h2 className="text-2xl font-semibold text-neutral-900">
                    Cleana<span style={{ color: "#C99422" }}>+</span>
                  </h2>
                </div>
              </div>
              <p className="text-neutral-700">
                A booking link your clients understand, and a calendar that
                never double-books — for practitioners running their own
                practice.
              </p>
              <ul className="flex flex-col gap-2">
                {CLEANA_PLUS_POINTS.map((point) => (
                  <li key={point} className="flex items-center gap-2 text-sm text-neutral-700">
                    <Check className="size-4 shrink-0" style={{ color: "#C6723A" }} />
                    {point}
                  </li>
                ))}
              </ul>
              <a
                href="https://click-na.vercel.app/"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-auto inline-flex h-11 items-center justify-center rounded-lg px-5 text-sm font-semibold text-white transition-colors"
                style={{ backgroundColor: "#C6723A" }}
              >
                Visit Cleana+
              </a>
            </div>
          </div>
        </section>

        <section className="border-t border-neutral-200 px-5 py-16 md:px-8 md:py-24">
          <div className="mx-auto grid w-full max-w-5xl grid-cols-1 gap-8 md:grid-cols-3">
            {VALUES.map((v) => (
              <div key={v.title} className="flex flex-col gap-2">
                <p className="font-medium text-neutral-900">{v.title}</p>
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
              Terms
            </Link>
            <Link href="/privacy" className="hover:text-neutral-900">
              Privacy
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
