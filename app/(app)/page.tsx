import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Building2, CalendarCheck2, ShieldCheck, TicketCheck, Users } from "lucide-react";
import { getAuthState } from "@/lib/auth/guards";
import { BrandBackdrop } from "@/components/brand-backdrop";
import { Logo } from "@/components/logo";
import { SiteFooter } from "@/components/site-footer";
import { Button } from "@/components/ui/button";

// אנגלית/LTR — חריג מכוון, בדיוק כמו דף הבית של click-na (ר' ההערה שם:
// "the app is Hebrew and right-to-left; this one page is not"). שאר
// האפליקציה (dashboard/schedule/admin) נשארת עברית/RTL לגמרי.
//
// המוצר נקרא כאן "Cleana" בלבד — "SaaS" הוא שם פנימי, לא user-facing
// (ר' PROGRESS.md / דרישת המשתמש).
export const metadata: Metadata = {
  title: "Cleana — Clinic & Room Management",
  description:
    "A schedule that never double-books, punch cards and sessions that run themselves, and every therapist books their own slot — for clinics with multiple branches, rooms, and therapists.",
};

// שלוש התשובות בסדר שבו מנהל/ת קליניקה נתקל/ת בהן, לא רשימת פיצ'רים —
// בהשראת מבנה דף הבית של click-na (src/app/page.tsx, ANSWERS).
const ANSWERS = [
  {
    title: "Every therapist books their own slot",
    body: "No phone calls, no WhatsApp back-and-forth. Each therapist sees only the rooms and hours open to them — never someone else's calendar.",
  },
  {
    title: "No double-booking. Ever.",
    body: "Overlap prevention lives in the database itself, not just the interface — two therapists can never take the same room at the same time, even down to the same click.",
  },
  {
    title: "Punch cards and sessions run themselves",
    body: "Remaining hours, deposits, and monthly renewals are tracked automatically against real payments. No spreadsheet nobody updates.",
  },
];

const CAPACITY = [
  { icon: Building2, label: "Multiple branches" },
  { icon: CalendarCheck2, label: "One shared room calendar" },
  { icon: Users, label: "Dozens to hundreds of therapists" },
  { icon: TicketCheck, label: "Punch cards and sessions together" },
  { icon: ShieldCheck, label: "Full isolation between clinics" },
];

// כמו OMISSIONS ב-click-na: התועלת מנוסחת כמה שנעלם, לא כרשימת יכולות.
const OMISSIONS = [
  "No spreadsheet to track hours and deposits.",
  "No group chat to coordinate who gets which room.",
  "No risk of double-booking the same room, same hour.",
  "No therapist ever sees who booked before them — just taken or open.",
];

const FAQ = [
  {
    q: "How do you prevent double-booking?",
    a: "Overlap prevention is enforced at the database level, not just the UI — two therapists can never take the same room at the same time, even down to the same click.",
  },
  {
    q: "Can one therapist see another's bookings?",
    a: "No. Availability is exposed only as taken or open — no name, no booking type. No therapist ever sees another's details.",
  },
  {
    q: "How does payment work?",
    a: "Every payment — punch card or session — happens in your own store, and updates automatically the moment it's confirmed.",
  },
  {
    q: "How long does setup take?",
    a: "Minutes. Create an account, set up branches and rooms, and invite your therapists with one link.",
  },
];

// דף הבית הציבורי — לוגיקה, לא רק עיצוב, נפרד מ-/dashboard: זו הייתה
// אותה כתובת (/) עם שני ענפים שונים לגמרי (שיווקי מול מסך מטפל/ת
// מחובר/ת), מה שהקשה לאבחן איזה מהם קרס. משתמש/ת עם פרופיל קיים
// מופנה/ית ישר ל-/dashboard; כל השאר (כולל session בלי פרופיל, עדיין
// באמצע ה-onboarding) רואה את דף הנחיתה.
export default async function HomePage() {
  const { userId, profile } = await getAuthState();
  if (userId && profile) redirect("/dashboard");

  return (
    <div dir="ltr" className="relative flex flex-1 flex-col">
      <BrandBackdrop />

      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-sm">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-5 py-4 md:px-8">
          <Link href="/" className="inline-flex min-h-11 items-center">
            <Logo />
          </Link>
          <div className="flex items-center gap-4 text-sm">
            <Link href="/login" className="inline-flex min-h-11 items-center text-muted-foreground hover:text-foreground">
              Log in
            </Link>
            <Button asChild>
              <Link href="/signup">Open a new clinic</Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="flex flex-1 flex-col">
        <section className="relative overflow-hidden">
          <div className="relative mx-auto flex max-w-2xl flex-col items-center gap-6 px-5 py-16 text-center md:px-8 md:py-24 lg:py-32">
            <span className="kicker">Clinic management platform</span>
            <h1 className="text-4xl font-semibold text-balance sm:text-5xl lg:text-6xl">
              The clinic runs itself.
            </h1>
            <p className="max-w-xl text-lg leading-relaxed text-muted-foreground">
              A schedule that never gets confused, punch cards that manage
              themselves, and every therapist books their own slot without
              looping you in. That&rsquo;s the whole plan — and it&rsquo;s enough.
            </p>
            <div className="flex flex-col items-center gap-3 pt-2 sm:flex-row">
              <Button asChild size="lg">
                <Link href="/signup">Open a new clinic</Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="/login">Log in</Link>
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">Live in minutes. No installation.</p>
          </div>
        </section>

        <section className="mx-auto grid w-full max-w-5xl grid-cols-1 gap-6 px-5 py-16 md:grid-cols-2 md:gap-8 md:px-8 md:py-24 lg:grid-cols-3 lg:gap-12 lg:py-32">
          {ANSWERS.map((answer, i) => (
            <div key={answer.title} className="flex flex-col gap-3">
              <span className="text-2xl font-semibold text-violet-500">
                {String(i + 1).padStart(2, "0")}
              </span>
              <p className="font-medium">{answer.title}</p>
              <p className="text-sm leading-relaxed text-muted-foreground">{answer.body}</p>
            </div>
          ))}
        </section>

        <section className="border-t border-border/60">
          <div className="mx-auto flex w-full max-w-3xl flex-col items-center gap-10 px-5 py-16 text-center md:px-8 md:py-24 lg:py-32">
            <h2 className="text-3xl font-semibold sm:text-4xl">
              Built for running a whole clinic, not a single practitioner
            </h2>
            <div className="flex flex-wrap justify-center gap-x-10 gap-y-8">
              {CAPACITY.map(({ icon: Icon, label }) => (
                <div key={label} className="flex flex-col items-center gap-3">
                  <div className="flex size-14 items-center justify-center rounded-full border border-violet-200 bg-violet-50">
                    <Icon className="size-5 text-violet-600" strokeWidth={1.75} />
                  </div>
                  <span className="text-sm">{label}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="border-t border-border/60">
          <div className="mx-auto flex w-full max-w-3xl flex-col gap-10 px-5 py-16 md:px-8 md:py-24 lg:py-32">
            <div className="flex flex-col items-center gap-4 text-center">
              <h2 className="text-3xl font-semibold sm:text-4xl">Managed, not manually managed.</h2>
              <p className="max-w-lg text-base leading-relaxed text-muted-foreground">
                Every clinic gets the full platform from day one — not a
                partial version waiting on an upgrade.
              </p>
            </div>

            <ul className="mx-auto flex max-w-xl flex-col gap-3">
              {OMISSIONS.map((line) => (
                <li
                  key={line}
                  className="border-t border-border/60 pt-3 text-sm leading-relaxed text-muted-foreground first:border-t-0 first:pt-0"
                >
                  {line}
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="border-t border-border/60">
          <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-5 py-16 md:px-8 md:py-24 lg:py-32">
            <h2 className="text-center text-3xl font-semibold sm:text-4xl">Questions</h2>
            <div className="flex flex-col gap-6">
              {FAQ.map((item) => (
                <div key={item.q} className="border-t border-border/60 pt-6 first:border-t-0 first:pt-0">
                  <p className="font-medium">{item.q}</p>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.a}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="border-t border-border/60">
          <div className="mx-auto flex w-full max-w-2xl flex-col items-center gap-5 px-5 py-16 text-center md:px-8 md:py-24 lg:py-32">
            <h2 className="text-3xl font-semibold sm:text-4xl">Ready to stop coordinating by hand?</h2>
            <p className="max-w-md text-lg leading-relaxed text-muted-foreground">
              Open your clinic now — initial setup takes minutes.
            </p>
            <Button asChild size="lg">
              <Link href="/signup">Open a new clinic</Link>
            </Button>
          </div>
        </section>
      </main>

      <SiteFooter english />
    </div>
  );
}
