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
  MessageSquare,
  Share2,
  ShieldCheck,
  Sparkles,
  TicketCheck,
  Users,
} from "lucide-react";
import { getAuthState } from "@/lib/auth/guards";
import { BrandBackdrop } from "@/components/brand-backdrop";
import { Logo } from "@/components/logo";
import { LeadForm } from "@/components/lead-form";
import { SiteFooter } from "@/components/site-footer";
import { Button } from "@/components/ui/button";
import { Board, BrowserFrame, CheckCard, Chips, Eyebrow, FactList, GridPaper, Kpi, Orbit, ScheduleList, SidebarRail, Steps, TrustRow } from "@/components/landing";
import { platformPlanPriceIls } from "@/lib/platform-billing";

// עברית/RTL — כמו כל שאר האפליקציה. עד 22.9.2026 הדף הזה היה באנגלית/LTR
// (חריג שיובא מ-click-na), אבל הקונה הוא מנהל/ת קליניקה בישראל: עמוד
// באנגלית גורם לו/ה להניח "זה לא בשבילי" לפני שקרא/ה שורה. ה-dir מגיע
// מ-app/layout.tsx (lang="he" dir="rtl") ולכן לא נקבע כאן.
//
// המוצר נקרא כאן "Cleana" בלבד — "SaaS" הוא שם פנימי, לא user-facing
// (ר' PROGRESS.md / דרישת המשתמש).
//
// המבנה והשפה הוויזואלית זהים לדף הבית של Cleana+ (click-na/src/app/page.tsx):
// הדמיית חלון דפדפן, אריחי KPI, לוח עמודות, שלבים, אבטחה, מחיר — בטוקנים של
// Cleana. לשמור את השניים תואמים.
export const metadata: Metadata = {
  title: "Cleana — ניהול קליניקה וחדרי טיפול",
  description:
    "לוח חדרים שלא מתנגש לעולם, כרטיסיות וססיות שמתנהלות לבד, וכל מטפל/ת מזמין/ה את המשבצת שלו/ה — לקליניקות עם כמה סניפים, חדרים ומטפלים/ות.",
};

// המחיר האחד, מאותו מקור כמו /admin/billing והחיוב עצמו (PLATFORM_PLAN_PRICE_ILS,
// ברירת מחדל 179). תקופת הניסיון: signup_clinic נותן 30 יום (מיגרציה
// 20260909000003) — אם משנים שם, לשנות גם כאן.
const PRICE = {
  amount: new Intl.NumberFormat("he-IL", { style: "currency", currency: "ILS", maximumFractionDigits: 0 }).format(platformPlanPriceIls()),
  period: "לחודש, כולל מע\"מ",
};
const TRIAL_DAYS = 30;

const TRUST = ["בלי כרטיס אשראי", "עולה באוויר בדקות", "ביטול בכל רגע"];

const CHIPS = [
  { icon: CalendarDays, label: "לוח חדרים" },
  { icon: TicketCheck, label: "כרטיסיות" },
  { icon: Layers, label: "ססיות" },
  { icon: Users, label: "מטפלים/ות" },
];

// שלוש התשובות בסדר שבו מנהל/ת קליניקה נתקל/ת בהן, לא רשימת פיצ'רים.
const ANSWERS = [
  {
    title: "כל מטפל/ת מזמין/ה לבד",
    body: "בלי טלפונים ובלי הודעות הלוך ושוב. כל אחד/ת רואה רק את החדרים והשעות שפתחתם לו/ה — לעולם לא את היומן של מישהו אחר.",
  },
  {
    title: "בלי כפל הזמנות. נקודה.",
    body: "מניעת החפיפה יושבת בבסיס הנתונים עצמו, לא רק בממשק — שני מטפלים לא יכולים לתפוס את אותו חדר באותה שעה, גם לא באותה לחיצה בדיוק.",
  },
  {
    title: "כרטיסיות וססיות מתנהלות לבד",
    body: "שעות שנותרו, פיקדונות וחידושים חודשיים נספרים אוטומטית מול תשלומים אמיתיים. בלי גיליון שאף אחד לא מעדכן.",
  },
];

const STEPS = [
  {
    icon: Building2,
    title: "מקימים סניפים וחדרים",
    text: "שעות פתיחה, סוגי חדרים, מרווח בין טיפולים ומחיר שעה. דקות, לא פרויקט.",
  },
  {
    icon: Share2,
    title: "מזמינים מטפלים/ות בלינק אחד",
    text: "הם מצטרפים לקליניקה שלכם, בעברית או באנגלית, ורואים בדיוק את החדרים והשעות שפתחתם להם.",
  },
  {
    icon: CalendarCheck2,
    title: "הם מזמינים. זה מאזן את עצמו.",
    text: "כל הזמנה יורדת מכרטיסייה או מססיה, כל תשלום מטעין בחזרה, והלוח לעולם לא מתנגש.",
  },
];

const CAPACITY = [
  { icon: Building2, label: "כמה סניפים" },
  { icon: DoorOpen, label: "לוח חדרים משותף אחד" },
  { icon: Users, label: "עשרות עד מאות מטפלים/ות" },
  { icon: TicketCheck, label: "כרטיסיות וססיות יחד" },
  { icon: ShieldCheck, label: "הפרדה מלאה בין קליניקות" },
];

/** מה כלול במסלול האחד — הצ'קליסט של כרטיס המחיר. */
const INCLUDED = [
  "סניפים, חדרים ומטפלים/ות — בלי הגבלה",
  "לוח חדרים משותף אחד שלא מתנגש לעולם",
  "כל מטפל/ת מזמין/ה את המשבצת שלו/ה",
  "כרטיסיות וססיות חודשיות, נספרות מול תשלומים אמיתיים",
  "תשלומים בחנות שלכם, מתעדכנים אוטומטית",
  "תזכורות בוואטסאפ ובמייל",
  "הפרדה מלאה בין קליניקות — לפי תכנון",
];

// כמו OMISSIONS ב-click-na: התועלת מנוסחת כמה שנעלם, לא כרשימת יכולות.
const OMISSIONS = [
  "אין גיליון אקסל למעקב אחרי שעות ופיקדונות.",
  "אין קבוצת וואטסאפ לתיאום מי מקבל איזה חדר.",
  "אין סיכון ששני מטפלים יתפסו את אותו חדר באותה שעה.",
  "אף מטפל/ת לא רואה מי הזמין לפניו — רק תפוס או פנוי.",
];

// עובדות בלבד — כל שורה כאן ניתנת לאימות בקוד ובפרויקט (RLS, audit_log,
// Supabase eu-central-1, Clerk, הצפנת סודות ווקומרס).
const SECURITY_INCLUDED = [
  "הפרדה ברמת השורה בין קליניקות, נאכפת בבסיס הנתונים עצמו",
  "הרשאות לפי תפקיד — בעלים, אדמין, מטפל/ת — נבדקות בכל פעולה",
  "כל פעולת אדמין נרשמת ביומן ביקורת שאפשר לקרוא",
  "כניסה עם Google או קוד חד-פעמי — אין סיסמאות שידלפו",
  "סודות החיבור לחנות מוצפנים באחסון",
  "מוצפן בהעברה, מקצה לקצה",
];

const SECURITY_FACTS = [
  { title: "Supabase · פרנקפורט", sub: "בסיס הנתונים מאוחסן באיחוד האירופי" },
  { title: "Row-level security", sub: "הפרדה בין קליניקות" },
  { title: "יומן ביקורת", sub: "כל פעולת אדמין נרשמת" },
  { title: "Clerk", sub: "כניסה וניהול סשנים" },
];

const FAQ = [
  {
    q: "איך מונעים כפל הזמנות?",
    a: "מניעת החפיפה נאכפת ברמת בסיס הנתונים, לא רק בממשק — שני מטפלים לא יכולים לתפוס את אותו חדר באותה שעה, גם לא באותה לחיצה בדיוק.",
  },
  {
    q: "מטפל/ת אחד/ת יכול/ה לראות את ההזמנות של אחר/ת?",
    a: "לא. הזמינות נחשפת רק כתפוס או פנוי — בלי שם ובלי סוג הזמנה. אף מטפל/ת לא רואה את הפרטים של אחר/ת.",
  },
  {
    q: "איך עובד התשלום?",
    a: "כל תשלום — כרטיסייה או ססיה — מתבצע בחנות שלכם, ומתעדכן אוטומטית ברגע שהוא מאושר.",
  },
  {
    q: "כמה Cleana עולה?",
    a: `מסלול אחד, ${PRICE.amount} לחודש כולל מע"מ, לקליניקה — בלי קשר לכמה סניפים, חדרים ומטפלים/ות יש לכם. ${TRIAL_DAYS} הימים הראשונים בחינם, בלי כרטיס אשראי. אפשר לבטל בכל רגע מפאנל הניהול; הגישה נמשכת עד סוף החודש ששולם.`,
  },
  {
    q: "כמה זמן לוקחת ההקמה?",
    a: "דקות. פותחים חשבון, מקימים סניפים וחדרים, ומזמינים את המטפלים/ות בלינק אחד.",
  },
];

const H2 = "text-3xl font-bold tracking-tight text-balance sm:text-4xl lg:text-5xl";

// דף הבית הציבורי — לוגיקה, לא רק עיצוב, נפרד מ-/dashboard: משתמש/ת עם
// פרופיל קיים מופנה/ית ישר ל-/dashboard; כל השאר רואה את דף הנחיתה.
export default async function HomePage() {
  const { userId, profile } = await getAuthState();
  if (userId && profile) redirect("/dashboard");

  return (
    <div className="relative flex flex-1 flex-col">
      <BrandBackdrop />

      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-sm">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-3.5 md:px-8">
          <Link href="/" className="inline-flex min-h-11 items-center">
            <Logo />
          </Link>
          <div className="flex items-center gap-3 text-sm">
            <Link href="#pricing" className="hidden min-h-11 items-center font-medium text-muted-foreground hover:text-foreground sm:inline-flex">
              מחיר
            </Link>
            <Link href="/signup" className="hidden min-h-11 items-center font-medium text-muted-foreground hover:text-foreground sm:inline-flex">
              פתיחת קליניקה
            </Link>
            <Link href="#talk" className="hidden min-h-11 items-center font-medium text-muted-foreground hover:text-foreground sm:inline-flex">
              לדבר איתנו
            </Link>
            <Button asChild size="lg" className="rounded-2xl px-6 font-semibold">
              <Link href="/login">כניסה</Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="flex flex-1 flex-col">
        {/* Hero */}
        <section className="relative overflow-hidden">
          <GridPaper />
          <div className="relative mx-auto flex w-full max-w-3xl flex-col items-center gap-7 px-5 pt-16 pb-10 text-center md:px-8 md:pt-24">
            <Eyebrow icon={Sparkles}>פלטפורמה לניהול קליניקה</Eyebrow>
            <h1 className="text-[2.6rem] leading-[1.05] font-extrabold tracking-tight text-balance sm:text-5xl lg:text-6xl">
              כל מה שקליניקה צריכה.
              <br />
              <span className="text-violet-500">במקום אחד.</span>
            </h1>
            <p className="max-w-xl text-lg leading-relaxed text-muted-foreground">
              לוח שלא מתבלבל, כרטיסיות שמתנהלות לבד, וכל מטפל/ת מזמין/ה את המשבצת שלו/ה בלי לעבור דרככם.
              זו כל התוכנית — וזה מספיק.
            </p>
            <div className="flex w-full max-w-md flex-col gap-3">
              <Button asChild size="lg" className="h-14 w-full rounded-2xl text-base font-semibold shadow-lg shadow-violet-500/25">
                <Link href="/signup">
                  פתיחת קליניקה חדשה
                  <ArrowRight className="size-5 rtl:rotate-180" aria-hidden />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="h-14 w-full rounded-2xl text-base font-semibold">
                <Link href="#how-it-works">איך זה עובד</Link>
              </Button>
            </div>
            <TrustRow items={TRUST} />
            <div className="inline-flex flex-wrap items-center justify-center gap-x-3 gap-y-1 rounded-full border border-border bg-card px-6 py-3 text-sm shadow-sm">
              <span className="text-[#f5b301]" aria-hidden>
                ★★★★★
              </span>
              <span>
                <strong>{TRIAL_DAYS} הימים הראשונים בחינם</strong> · מסלול אחד לקליניקה · בלי תשלום לפי מושב
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
                    <Kpi label="חדרים היום" value="11/14" delta="+2" />
                    <Kpi label="מטפלים/ות" value="23" delta="+3" />
                    <Kpi label="שעות שנמכרו" value="412" delta="+8%" />
                  </div>
                  <ScheduleList
                    title="חדר 2 · היום"
                    meta="ראשון, 19 באפריל"
                    rows={[
                      { time: "09:00", name: "נועה לוי", status: "מאושר", tone: "open" },
                      { time: "10:00", name: "דן ארי", status: "מוחזק", tone: "held" },
                      { time: "12:00", name: "מאיה כהן", status: "ססיה", tone: "booked" },
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
              <Eyebrow icon={DoorOpen}>החדרים, ברגע זה</Eyebrow>
              <h2 className={H2}>
                פנוי, מוחזק, מוזמן. <span className="text-violet-500">אין מה עוד לעקוב.</span>
              </h2>
              <p className="text-lg leading-relaxed text-muted-foreground">
                כל שעת-חדר היא אחד משלושה דברים. הזמנה מזיזה אותה על הלוח לבד, החזקה פגה מעצמה,
                וביטול מחזיר אותה.
              </p>
            </div>
            <Board
              title="הבוקר"
              badge="12 הזמנות היום"
              columns={[
                {
                  title: "פנוי",
                  tone: "open",
                  cards: [
                    { title: "חדר 1 · 11:00", sub: "חדר שיחה" },
                    { title: "חדר 3 · 12:00", sub: "עבודת גוף" },
                  ],
                  placeholders: 1,
                },
                { title: "מוחזק", tone: "held", cards: [{ title: "דן ארי", sub: "חדר 2 · 10:00" }], placeholders: 1 },
                {
                  title: "מוזמן",
                  tone: "booked",
                  cards: [
                    { title: "נועה לוי", sub: "חדר 2 · 09:00" },
                    { title: "מאיה כהן", sub: "חדר 2 · 12:00" },
                    { title: "יעל שפירא", sub: "חדר 1 · 09:00" },
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
              <Eyebrow icon={Check}>איך זה עובד</Eyebrow>
              <h2 className={H2}>
                שלושה שלבים. <span className="text-violet-500">ומשם זה רץ לבד.</span>
              </h2>
            </div>
            <Steps steps={STEPS} />
          </div>
        </section>

        {/* Capacity */}
        <section className="border-t border-border/60">
          <div className="mx-auto flex w-full max-w-3xl flex-col items-center gap-10 px-5 py-16 text-center md:px-8 md:py-24">
            <h2 className={H2}>בנוי לניהול קליניקה שלמה, לא מטפל/ת אחד/ת</h2>
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
              <Eyebrow icon={ShieldCheck}>אבטחה ופרטיות</Eyebrow>
              <h2 className={H2}>
                המידע של הקליניקה שלכם. <span className="text-violet-500">אטום מכל האחרות.</span>
              </h2>
              <p className="max-w-xl text-lg leading-relaxed text-muted-foreground">
                ההזמנות, המטפלים/ות והתשלומים של קליניקה שייכים לה בלבד. ההפרדה נאכפת במקום שאי אפשר לעקוף —
                בבסיס הנתונים — וכל פעולת אדמין משאירה עקבות.
              </p>
            </div>
            <div className="grid grid-cols-1 items-center gap-10 md:grid-cols-2">
              <Orbit center={ShieldCheck} satellites={[Lock, KeyRound, Database, ClipboardList]} />
              <div className="flex flex-col gap-6">
                <CheckCard title="מה כלול" items={SECURITY_INCLUDED} />
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
              <Eyebrow icon={CreditCard}>המסלול</Eyebrow>
              <h2 className={H2}>
                מסלול אחד. <span className="text-violet-500">כל הקליניקה בפנים.</span>
              </h2>
              <p className="max-w-lg text-lg leading-relaxed text-muted-foreground">
                כל קליניקה מקבלת את הפלטפורמה המלאה מהיום הראשון — לא גרסה חלקית שמחכה לשדרוג.
                מחיר אחד לקליניקה, בכל גודל.
              </p>
            </div>

            <div className="relative w-full max-w-3xl overflow-hidden rounded-3xl border border-violet-200 bg-card shadow-2xl shadow-violet-500/10">
              <div aria-hidden className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-violet-500 via-violet-300 to-violet-500" />
              <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
                <div className="flex flex-col items-center justify-center gap-5 border-b border-border/60 px-6 py-10 text-center md:items-start md:border-e md:border-b-0 md:px-10 md:text-start">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-success-fg/30 bg-success-bg px-3 py-1 text-xs font-semibold text-success-fg">
                    <Check className="size-3.5" aria-hidden />
                    {TRIAL_DAYS} הימים הראשונים בחינם · בלי כרטיס
                  </span>
                  <div className="flex flex-col gap-1">
                    <span className="text-sm font-medium text-muted-foreground">Cleana · לקליניקה</span>
                    <p className="flex flex-wrap items-baseline justify-center gap-x-2 md:justify-start">
                      <span className="text-5xl font-extrabold tabular-nums tracking-tight md:text-6xl">{PRICE.amount}</span>
                      <span className="text-sm text-muted-foreground">{PRICE.period}</span>
                    </p>
                  </div>
                  <p className="max-w-xs text-sm leading-relaxed text-muted-foreground">
                    תשלום חודשי אחד אחרי תקופת הניסיון, בלי קשר לכמה סניפים, חדרים ומטפלים/ות יש לכם.
                    אפשר לבטל בכל רגע מפאנל הניהול.
                  </p>
                  <Button asChild size="lg" className="h-12 w-full rounded-2xl font-semibold md:w-auto">
                    <Link href="/signup">
                      להתחיל בחינם
                      <ArrowRight className="size-4 rtl:rotate-180" aria-hidden />
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
            <h2 className={`${H2} text-center`}>שאלות</h2>
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

        {/* השאירו פרטים — הדלת הרכה לצד ההרשמה העצמית */}
        <section id="talk" className="scroll-mt-20 border-t border-border/60">
          <div className="mx-auto grid w-full max-w-5xl items-start gap-10 px-5 py-16 md:grid-cols-[minmax(0,0.85fr)_minmax(0,1fr)] md:px-8 md:py-24">
            <div className="flex flex-col gap-5 text-center md:text-start">
              <Eyebrow icon={MessageSquare}>לדבר איתנו</Eyebrow>
              <h2 className={H2}>
                רוצים לראות את זה <span className="text-violet-500">על הקליניקה שלכם?</span>
              </h2>
              <p className="text-lg leading-relaxed text-muted-foreground">
                השאירו שם וטלפון ונחזור אליכם. אנחנו נשמח גם להקים לכם את הסניפים, החדרים והמטפלים/ות —
                כדי שתראו את המערכת עם הנתונים האמיתיים שלכם ולא עם דוגמה.
              </p>
              <p className="text-sm leading-relaxed text-muted-foreground">
                מעדיפים פשוט להתחיל? <Link href="/signup" className="font-semibold text-violet-500 underline underline-offset-4">פתחו קליניקה</Link>{" "}
                — {TRIAL_DAYS} הימים הראשונים בחינם, בלי כרטיס אשראי.
              </p>
            </div>
            <LeadForm />
          </div>
        </section>

        {/* Final CTA */}
        <section className="relative overflow-hidden border-t border-border/60">
          <GridPaper />
          <div className="relative mx-auto flex w-full max-w-2xl flex-col items-center gap-6 px-5 py-16 text-center md:px-8 md:py-24">
            <h2 className={H2}>
              מוכנים להפסיק <span className="text-violet-500">לתאם ביד?</span>
            </h2>
            <p className="max-w-md text-lg leading-relaxed text-muted-foreground">פתחו את הקליניקה עכשיו — ההקמה לוקחת דקות.</p>
            <Button asChild size="lg" className="h-14 w-full max-w-md rounded-2xl text-base font-semibold shadow-lg shadow-violet-500/25">
              <Link href="/signup">
                פתיחת קליניקה חדשה
                <ArrowRight className="size-5 rtl:rotate-180" aria-hidden />
              </Link>
            </Button>
            <TrustRow items={TRUST} />
            <p className="text-sm text-muted-foreground">
              עוד לא בטוחים?{" "}
              <Link href="#talk" className="font-semibold text-violet-500 underline underline-offset-4">
                השאירו פרטים ונחזור אליכם
              </Link>
              .
            </p>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
