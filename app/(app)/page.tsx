import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowRight,
  Building2,
  CalendarCheck2,
  CalendarDays,
  Check,
  ClipboardList,
  CreditCard,
  Database,
  DoorOpen,
  KeyRound,
  Layers,
  Lock,
  Share2,
  ShieldCheck,
  Sparkles,
  TicketCheck,
  Users,
} from "lucide-react";
import { getAuthState } from "@/lib/auth/guards";
import { BrandBackdrop } from "@/components/brand-backdrop";
import { Logo } from "@/components/logo";
import { SiteFooter } from "@/components/site-footer";
import { Button } from "@/components/ui/button";
import { Board, BrowserFrame, CheckCard, Chips, Eyebrow, FactList, GridPaper, Kpi, Orbit, ScheduleList, SidebarRail, Steps, TrustRow } from "@/components/landing";
import { platformPlanPriceIls } from "@/lib/platform-billing";

// אנגלית/LTR — חריג מכוון, בדיוק כמו דף הבית של click-na (ר' ההערה שם:
// "the app is Hebrew and right-to-left; this one page is not"). שאר
// האפליקציה (dashboard/schedule/admin) נשארת עברית/RTL לגמרי.
//
// המוצר נקרא כאן "Cleana" בלבד — "SaaS" הוא שם פנימי, לא user-facing
// (ר' PROGRESS.md / דרישת המשתמש).
//
// המבנה והשפה הוויזואלית זהים לדף הבית של Cleana+ (click-na/src/app/page.tsx):
// הדמיית חלון דפדפן, אריחי KPI, לוח עמודות, שלבים, אבטחה, מחיר — בטוקנים של
// Cleana. לשמור את השניים תואמים.
export const metadata: Metadata = {
  title: "Cleana — Clinic & Room Management",
  description:
    "A schedule that never double-books, punch cards and sessions that run themselves, and every therapist books their own slot — for clinics with multiple branches, rooms, and therapists.",
};

// המחיר האחד, מאותו מקור כמו /admin/billing והחיוב עצמו (PLATFORM_PLAN_PRICE_ILS,
// ברירת מחדל 209). תקופת הניסיון: signup_clinic נותן 30 יום (מיגרציה
// 20260909000003) — אם משנים שם, לשנות גם כאן.
// עמוד אנגלי/LTR — "₪209" ולא "209 ₪" של he-IL (ר' formatPriceIls(…, "en") ב-Cleana+).
const PRICE = {
  amount: new Intl.NumberFormat("en-IL", { style: "currency", currency: "ILS", maximumFractionDigits: 0 }).format(platformPlanPriceIls()),
  period: "month, VAT included",
};
const TRIAL_DAYS = 30;

const TRUST = ["No card required", "Live in minutes", "Cancel any time"];

const CHIPS = [
  { icon: CalendarDays, label: "Room calendar" },
  { icon: TicketCheck, label: "Punch cards" },
  { icon: Layers, label: "Sessions" },
  { icon: Users, label: "Therapists" },
];

// שלוש התשובות בסדר שבו מנהל/ת קליניקה נתקל/ת בהן, לא רשימת פיצ'רים.
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

const STEPS = [
  {
    icon: Building2,
    title: "Set up branches and rooms",
    text: "Opening hours, room types, buffer between sessions, and the price of an hour. Minutes, not a project.",
  },
  {
    icon: Share2,
    title: "Invite therapists with one link",
    text: "They join under your clinic, in Hebrew or English, and see exactly the rooms and hours you opened to them.",
  },
  {
    icon: CalendarCheck2,
    title: "They book. It balances itself.",
    text: "Every booking draws from a punch card or a session, every payment tops it up, and the calendar never overlaps.",
  },
];

const CAPACITY = [
  { icon: Building2, label: "Multiple branches" },
  { icon: DoorOpen, label: "One shared room calendar" },
  { icon: Users, label: "Dozens to hundreds of therapists" },
  { icon: TicketCheck, label: "Punch cards and sessions together" },
  { icon: ShieldCheck, label: "Full isolation between clinics" },
];

/** מה כלול במסלול האחד — הצ'קליסט של כרטיס המחיר. */
const INCLUDED = [
  "Unlimited branches, rooms, and therapists",
  "One shared room calendar that never double-books",
  "Every therapist books their own slot",
  "Punch cards and monthly sessions, tracked against real payments",
  "Payments in your own store, reconciled automatically",
  "WhatsApp and email reminders",
  "Full isolation between clinics — by design",
];

// כמו OMISSIONS ב-click-na: התועלת מנוסחת כמה שנעלם, לא כרשימת יכולות.
const OMISSIONS = [
  "No spreadsheet to track hours and deposits.",
  "No group chat to coordinate who gets which room.",
  "No risk of double-booking the same room, same hour.",
  "No therapist ever sees who booked before them — just taken or open.",
];

// עובדות בלבד — כל שורה כאן ניתנת לאימות בקוד ובפרויקט (RLS, audit_log,
// Supabase eu-central-1, Clerk, הצפנת סודות ווקומרס).
const SECURITY_INCLUDED = [
  "Row-level isolation between clinics, enforced in the database itself",
  "Role-based access — owner, admin, therapist — checked on every action",
  "Every admin action written to an audit log you can read",
  "Sign-in with Google or a one-time code — no passwords to leak",
  "Store integration secrets encrypted at rest",
  "Encrypted in transit, end to end",
];

const SECURITY_FACTS = [
  { title: "Supabase · Frankfurt", sub: "Database hosted in the EU" },
  { title: "Row-level security", sub: "Isolation between clinics" },
  { title: "Audit log", sub: "Every admin action recorded" },
  { title: "Clerk", sub: "Sign-in and sessions" },
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
    q: "What does Cleana cost?",
    a: `One plan, ${PRICE.amount} per month, VAT included, per clinic — however many branches, rooms, and therapists you run. The first ${TRIAL_DAYS} days are free with no card. Cancel any time from the admin panel; access continues to the end of the paid month.`,
  },
  {
    q: "How long does setup take?",
    a: "Minutes. Create an account, set up branches and rooms, and invite your therapists with one link.",
  },
];

const H2 = "text-3xl font-bold tracking-tight text-balance sm:text-4xl lg:text-5xl";

// דף הבית הציבורי — לוגיקה, לא רק עיצוב, נפרד מ-/dashboard: משתמש/ת עם
// פרופיל קיים מופנה/ית ישר ל-/dashboard; כל השאר רואה את דף הנחיתה.
export default async function HomePage() {
  const { userId, profile } = await getAuthState();
  if (userId && profile) redirect("/dashboard");

  return (
    <div dir="ltr" className="relative flex flex-1 flex-col">
      <BrandBackdrop />

      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-sm">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-3.5 md:px-8">
          <Link href="/" className="inline-flex min-h-11 items-center">
            <Logo />
          </Link>
          <div className="flex items-center gap-3 text-sm">
            <Link href="#pricing" className="hidden min-h-11 items-center font-medium text-muted-foreground hover:text-foreground sm:inline-flex">
              Pricing
            </Link>
            <Link href="/signup" className="hidden min-h-11 items-center font-medium text-muted-foreground hover:text-foreground sm:inline-flex">
              Open a clinic
            </Link>
            <Button asChild size="lg" className="rounded-2xl px-6 font-semibold">
              <Link href="/login">Log in</Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="flex flex-1 flex-col">
        {/* Hero */}
        <section className="relative overflow-hidden">
          <GridPaper />
          <div className="relative mx-auto flex w-full max-w-3xl flex-col items-center gap-7 px-5 pt-16 pb-10 text-center md:px-8 md:pt-24">
            <Eyebrow icon={Sparkles}>Clinic management platform</Eyebrow>
            <h1 className="text-[2.6rem] leading-[1.05] font-extrabold tracking-tight text-balance sm:text-5xl lg:text-6xl">
              Everything a clinic needs.
              <br />
              <span className="text-violet-500">In one place.</span>
            </h1>
            <p className="max-w-xl text-lg leading-relaxed text-muted-foreground">
              A schedule that never gets confused, punch cards that manage themselves, and every therapist books
              their own slot without looping you in. That&rsquo;s the whole plan — and it&rsquo;s enough.
            </p>
            <div className="flex w-full max-w-md flex-col gap-3">
              <Button asChild size="lg" className="h-14 w-full rounded-2xl text-base font-semibold shadow-lg shadow-violet-500/25">
                <Link href="/signup">
                  Open a new clinic
                  <ArrowRight className="size-5" aria-hidden />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="h-14 w-full rounded-2xl text-base font-semibold">
                <Link href="#how-it-works">See how it works</Link>
              </Button>
            </div>
            <TrustRow items={TRUST} />
            <div className="inline-flex flex-wrap items-center justify-center gap-x-3 gap-y-1 rounded-full border border-border bg-card px-6 py-3 text-sm shadow-sm">
              <span className="text-[#f5b301]" aria-hidden>
                ★★★★★
              </span>
              <span>
                <strong>First {TRIAL_DAYS} days free</strong> · one plan per clinic · no per-seat fees
              </span>
            </div>
          </div>

          {/* המוצר, כחלון */}
          <div className="relative mx-auto w-full max-w-4xl px-5 pb-16 md:px-8 md:pb-24">
            <BrowserFrame>
              <div className="flex">
                <SidebarRail />
                <div className="flex flex-1 flex-col gap-4 p-4 md:p-6">
                  <div className="flex flex-col gap-2">
                    <span className="h-3 w-40 rounded-full bg-foreground/85" />
                    <span className="h-2.5 w-56 rounded-full bg-border-strong" />
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <Kpi label="Rooms today" value="11/14" delta="+2" />
                    <Kpi label="Therapists" value="23" delta="+3" />
                    <Kpi label="Hours sold" value="412" delta="+8%" />
                  </div>
                  <ScheduleList
                    title="Room 2 · today"
                    meta="Sunday, 19 Apr"
                    rows={[
                      { time: "09:00", name: "Noa Levi", status: "Confirmed", tone: "open" },
                      { time: "10:00", name: "Dan Ari", status: "Held", tone: "held" },
                      { time: "12:00", name: "Maya Cohen", status: "Session", tone: "booked" },
                    ]}
                  />
                </div>
              </div>
            </BrowserFrame>
          </div>
        </section>

        <section className="mx-auto w-full max-w-4xl px-5 md:px-8">
          <Chips items={CHIPS} />
        </section>

        {/* Answers */}
        <section className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-4 px-5 py-16 md:grid-cols-3 md:gap-6 md:px-8 md:py-24">
          {ANSWERS.map((answer, i) => (
            <div key={answer.title} className="flex flex-col gap-3 rounded-3xl border border-border bg-card p-6 shadow-sm md:p-7">
              <span className="text-2xl font-bold tabular-nums text-violet-500">{String(i + 1).padStart(2, "0")}</span>
              <p className="text-lg font-bold">{answer.title}</p>
              <p className="text-sm leading-relaxed text-muted-foreground">{answer.body}</p>
            </div>
          ))}
        </section>

        {/* Board */}
        <section className="relative overflow-hidden">
          <GridPaper />
          <div className="relative mx-auto grid w-full max-w-6xl items-center gap-10 px-5 py-16 md:grid-cols-2 md:px-8 md:py-24">
            <div className="flex flex-col gap-5 text-center md:text-start">
              <Eyebrow icon={DoorOpen}>The rooms, right now</Eyebrow>
              <h2 className={H2}>
                Open, held, booked. <span className="text-violet-500">Nothing else to track.</span>
              </h2>
              <p className="text-lg leading-relaxed text-muted-foreground">
                Every room-hour is one of three things. A booking moves it across the board by itself, a hold
                expires on its own, and a cancellation moves it back.
              </p>
            </div>
            <Board
              title="This morning"
              badge="12 booked today"
              columns={[
                {
                  title: "Open",
                  tone: "open",
                  cards: [
                    { title: "Room 1 · 11:00", sub: "Talk room" },
                    { title: "Room 3 · 12:00", sub: "Bodywork" },
                  ],
                  placeholders: 1,
                },
                { title: "Held", tone: "held", cards: [{ title: "Dan Ari", sub: "Room 2 · 10:00" }], placeholders: 1 },
                {
                  title: "Booked",
                  tone: "booked",
                  cards: [
                    { title: "Noa Levi", sub: "Room 2 · 09:00" },
                    { title: "Maya Cohen", sub: "Room 2 · 12:00" },
                    { title: "Yael Shapira", sub: "Room 1 · 09:00" },
                  ],
                },
              ]}
            />
          </div>
        </section>

        {/* How it works */}
        <section id="how-it-works" className="border-t border-border/60">
          <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-5 py-16 md:px-8 md:py-24">
            <div className="flex flex-col items-center gap-4 text-center">
              <Eyebrow icon={Check}>How it works</Eyebrow>
              <h2 className={H2}>
                Three steps. <span className="text-violet-500">Then it runs itself.</span>
              </h2>
            </div>
            <Steps steps={STEPS} />
          </div>
        </section>

        {/* Capacity */}
        <section className="border-t border-border/60">
          <div className="mx-auto flex w-full max-w-3xl flex-col items-center gap-10 px-5 py-16 text-center md:px-8 md:py-24">
            <h2 className={H2}>Built for running a whole clinic, not a single practitioner</h2>
            <div className="flex flex-wrap justify-center gap-x-10 gap-y-8">
              {CAPACITY.map(({ icon: Icon, label }) => (
                <div key={label} className="flex flex-col items-center gap-3">
                  <div className="flex size-16 items-center justify-center rounded-2xl border border-border bg-card shadow-sm">
                    <Icon className="size-6 text-violet-500" strokeWidth={1.75} />
                  </div>
                  <span className="max-w-[9rem] text-sm font-medium">{label}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Security */}
        <section className="relative overflow-hidden border-t border-border/60">
          <GridPaper />
          <div className="relative mx-auto flex w-full max-w-6xl flex-col gap-12 px-5 py-16 md:px-8 md:py-24">
            <div className="flex flex-col items-center gap-4 text-center">
              <Eyebrow icon={ShieldCheck}>Security &amp; privacy</Eyebrow>
              <h2 className={H2}>
                Your clinic&rsquo;s data. <span className="text-violet-500">Sealed off from every other.</span>
              </h2>
              <p className="max-w-xl text-lg leading-relaxed text-muted-foreground">
                A clinic&rsquo;s bookings, therapists and payments are its own. The separation is enforced where it
                cannot be bypassed — in the database — and every admin action leaves a trace.
              </p>
            </div>
            <div className="grid grid-cols-1 items-center gap-10 md:grid-cols-2">
              <Orbit center={ShieldCheck} satellites={[Lock, KeyRound, Database, ClipboardList]} />
              <div className="flex flex-col gap-6">
                <CheckCard title="What's included" items={SECURITY_INCLUDED} />
                <FactList facts={SECURITY_FACTS} />
              </div>
            </div>
          </div>
        </section>

        {/* Pricing */}
        <section id="pricing" className="relative overflow-hidden border-t border-border/60">
          <div aria-hidden className="pointer-events-none absolute -bottom-40 left-1/2 hidden h-[28rem] w-[44rem] -translate-x-1/2 rounded-full bg-violet-200/40 blur-3xl md:block" />
          <div className="relative mx-auto flex w-full max-w-6xl flex-col items-center gap-10 px-5 py-16 md:px-8 md:py-24">
            <div className="flex flex-col items-center gap-4 text-center">
              <Eyebrow icon={CreditCard}>The plan</Eyebrow>
              <h2 className={H2}>
                One plan. <span className="text-violet-500">The whole clinic in it.</span>
              </h2>
              <p className="max-w-lg text-lg leading-relaxed text-muted-foreground">
                Every clinic gets the full platform from day one — not a partial version waiting on an upgrade.
                One price per clinic, whatever its size.
              </p>
            </div>

            <div className="relative w-full max-w-3xl overflow-hidden rounded-3xl border border-violet-200 bg-card shadow-2xl shadow-violet-500/10">
              <div aria-hidden className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-violet-500 via-violet-300 to-violet-500" />
              <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
                <div className="flex flex-col items-center justify-center gap-5 border-b border-border/60 px-6 py-10 text-center md:items-start md:border-r md:border-b-0 md:px-10 md:text-left">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-success-fg/30 bg-success-bg px-3 py-1 text-xs font-semibold text-success-fg">
                    <Check className="size-3.5" aria-hidden />
                    First {TRIAL_DAYS} days free · no card
                  </span>
                  <div className="flex flex-col gap-1">
                    <span className="text-sm font-medium text-muted-foreground">Cleana · per clinic</span>
                    <p className="flex flex-wrap items-baseline justify-center gap-x-2 md:justify-start">
                      <span className="text-5xl font-extrabold tabular-nums tracking-tight md:text-6xl">{PRICE.amount}</span>
                      <span className="text-sm text-muted-foreground">/ {PRICE.period}</span>
                    </p>
                  </div>
                  <p className="max-w-xs text-sm leading-relaxed text-muted-foreground">
                    One monthly payment after the free trial, however many branches, rooms, and therapists you run.
                    Cancel any time from the admin panel.
                  </p>
                  <Button asChild size="lg" className="h-12 w-full rounded-2xl font-semibold md:w-auto">
                    <Link href="/signup">
                      Start free
                      <ArrowRight className="size-4" aria-hidden />
                    </Link>
                  </Button>
                </div>

                <ul className="flex flex-col gap-3 px-6 py-10 md:px-10">
                  {INCLUDED.map((line) => (
                    <li key={line} className="flex items-start gap-3 text-sm leading-relaxed">
                      <span className="mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-success-bg text-success-fg">
                        <Check className="size-3" strokeWidth={3} aria-hidden />
                      </span>
                      <span>{line}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <ul className="mx-auto flex max-w-xl flex-col gap-3">
              {OMISSIONS.map((line) => (
                <li key={line} className="border-t border-border/60 pt-3 text-center text-sm leading-relaxed text-muted-foreground first:border-t-0 first:pt-0">
                  {line}
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* FAQ */}
        <section className="border-t border-border/60">
          <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-5 py-16 md:px-8 md:py-24">
            <h2 className={`${H2} text-center`}>Questions</h2>
            <div className="flex flex-col gap-3">
              {FAQ.map((item) => (
                <div key={item.q} className="rounded-2xl border border-border bg-card p-5 shadow-sm md:p-6">
                  <p className="font-bold">{item.q}</p>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.a}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="relative overflow-hidden border-t border-border/60">
          <GridPaper />
          <div className="relative mx-auto flex w-full max-w-2xl flex-col items-center gap-6 px-5 py-16 text-center md:px-8 md:py-24">
            <h2 className={H2}>
              Ready to stop <span className="text-violet-500">coordinating by hand?</span>
            </h2>
            <p className="max-w-md text-lg leading-relaxed text-muted-foreground">Open your clinic now — initial setup takes minutes.</p>
            <Button asChild size="lg" className="h-14 w-full max-w-md rounded-2xl text-base font-semibold shadow-lg shadow-violet-500/25">
              <Link href="/signup">
                Open a new clinic
                <ArrowRight className="size-5" aria-hidden />
              </Link>
            </Button>
            <TrustRow items={TRUST} />
          </div>
        </section>
      </main>

      <SiteFooter english />
    </div>
  );
}
