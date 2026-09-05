import Link from "next/link";
import { redirect } from "next/navigation";
import { Building2, CalendarCheck2, ShieldCheck, TicketCheck, Users } from "lucide-react";
import { getAuthState } from "@/lib/auth/guards";
import { BrandBackdrop } from "@/components/brand-backdrop";
import { Logo } from "@/components/logo";
import { SiteFooter } from "@/components/site-footer";
import { Button } from "@/components/ui/button";

// שלוש התשובות בסדר שבו מנהל/ת קליניקה נתקל/ת בהן, לא רשימת פיצ'רים —
// בהשראת מבנה דף הבית של click-na (src/app/page.tsx, ANSWERS).
const ANSWERS = [
  {
    title: "כל מטפל/ת קובע/ת תור לבד",
    body: "לוח זמינות בלי לחייג ובלי לתאם בוואטסאפ. כל מטפל/ת רואה רק את החדרים והשעות הפנויים לו/ה — לא את היומן של מטפל/ת אחר/ת.",
  },
  {
    title: "אין כפל הזמנות. אף פעם.",
    body: "מניעת החפיפה קבועה במסד הנתונים עצמו, לא רק בממשק — שני מטפלים לעולם לא יתפסו אותו חדר באותה שעה, גם אם שניהם לוחצים באותו רגע.",
  },
  {
    title: "כרטיסיות וססיות מתנהלות לבד",
    body: "יתרת שעות, פיקדון וחידוש חודשי נרשמים אוטומטית מול התשלום בפועל. בלי טבלת אקסל שאף אחד לא מעדכן.",
  },
];

const CAPACITY = [
  { icon: Building2, label: "כמה סניפים" },
  { icon: CalendarCheck2, label: "לוח חדרים משותף" },
  { icon: Users, label: "עשרות עד מאות מטפלים" },
  { icon: TicketCheck, label: "כרטיסיות וססיות יחד" },
  { icon: ShieldCheck, label: "בידוד מלא בין קליניקות" },
];

// כמו OMISSIONS ב-click-na: התועלת מנוסחת כמה שנעלם, לא כרשימת יכולות.
const OMISSIONS = [
  "בלי אקסל למעקב יתרות שעות ופיקדון.",
  "בלי קבוצת וואטסאפ לתיאום מי תופס/ת איזה חדר.",
  "בלי חשש מהזמנה כפולה על אותו חדר, אותה שעה.",
  "בלי לחשוף למטפל/ת אחד/ת מי קבע/ה לפניו/ה — רק תפוס או פנוי.",
];

const FAQ = [
  {
    q: "איך מונעים כפל הזמנות?",
    a: "מניעת החפיפה נאכפת ברמת מסד הנתונים עצמו, לא רק בממשק — שני מטפלים לעולם לא יתפסו אותו חדר באותה שעה, גם אם שניהם לוחצים באותו רגע בדיוק.",
  },
  {
    q: "מטפל/ת רואה הזמנות של מטפל/ת אחר/ת?",
    a: "לא. זמינות נחשפת רק כתפוס או פנוי — בלי שם, בלי סוג הזמנה. שום מטפל/ת לא רואה פרטים של מטפל/ת אחר/ת בקליניקה.",
  },
  {
    q: "איך עובד התשלום?",
    a: "כל תשלום — כרטיסייה או ססיה — מתבצע בחנות שלכם, ומתעדכן במערכת אוטומטית ברגע שהוא מאושר.",
  },
  {
    q: "כמה זמן לוקח להקים קליניקה?",
    a: "כמה דקות. פותחים חשבון, מגדירים סניפים וחדרים, ומזמינים את המטפלים בקישור אחד.",
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
    <div className="relative flex flex-1 flex-col">
      <BrandBackdrop />

      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-sm">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-5 py-4 md:px-8">
          <Link href="/" className="inline-flex min-h-11 items-center">
            <Logo />
          </Link>
          <div className="flex items-center gap-4 text-sm">
            <Link href="/login" className="inline-flex min-h-11 items-center text-muted-foreground hover:text-foreground">
              כניסה
            </Link>
            <Button asChild>
              <Link href="/signup">פתיחת קליניקה חדשה</Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="flex flex-1 flex-col">
        <section className="relative overflow-hidden">
          <div className="relative mx-auto flex max-w-2xl flex-col items-center gap-6 px-5 py-16 text-center md:px-8 md:py-24 lg:py-32">
            <span className="kicker">פלטפורמת ניהול קליניקות</span>
            <h1 className="text-4xl font-semibold text-balance sm:text-5xl lg:text-6xl">
              הקליניקה מתנהלת לבד.
            </h1>
            <p className="max-w-xl text-lg leading-relaxed text-muted-foreground">
              לוח זמנים שלא מתבלבל, כרטיסיות שמתנהלות מעצמן, וכל מטפל/ת
              קובע/ת תור בלי לערב אתכם. זו כל התוכנית — והיא מספיקה.
            </p>
            <div className="flex flex-col items-center gap-3 pt-2 sm:flex-row">
              <Button asChild size="lg">
                <Link href="/signup">פתיחת קליניקה חדשה</Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="/login">כניסה</Link>
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">הקמה תוך דקות, בלי התקנה.</p>
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
              בנוי לניהול קליניקה שלמה, לא למטפל/ת בודד/ת
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
              <h2 className="text-3xl font-semibold sm:text-4xl">מנוהל, לא מנוהל ידנית.</h2>
              <p className="max-w-lg text-base leading-relaxed text-muted-foreground">
                כל קליניקה מקבלת את כל היכולות מהיום הראשון — לא גרסה
                חלקית שמחכה לשדרוג.
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
            <h2 className="text-center text-3xl font-semibold sm:text-4xl">שאלות נפוצות</h2>
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
            <h2 className="text-3xl font-semibold sm:text-4xl">מוכנים להפסיק לתאם ידנית?</h2>
            <p className="max-w-md text-lg leading-relaxed text-muted-foreground">
              פתחו את הקליניקה שלכם עכשיו — הגדרה ראשונית תוך דקות.
            </p>
            <Button asChild size="lg">
              <Link href="/signup">פתיחת קליניקה חדשה</Link>
            </Button>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
