/**
 * מדרגות הרכישה: באיזה מספר משתמשים פעילים (בשני המוצרים יחד) צריך לקנות מה.
 *
 * "משתמשים פעילים" = חשבונות בניסיון, משלמים, או בחסד — כל מי שמייצר עומס
 * (הזמנות, מיילים, תזכורות), לא רק מי שמשלם. המדרגות נגזרות ממגבלות
 * אמיתיות של הספקים ומהניתוח מ-10.9.2026 (ר' PROGRESS.md §"השקה").
 *
 * המחירים משוערים ולפי דפי התמחור הציבוריים באותו יום — לאמת לפני רכישה.
 * לשנות כאן = הדשבורד ב-/superadmin/owner מתעדכן.
 */
export type Threshold = {
  /** מאיזה מספר משתמשים פעילים המדרגה נדרשת. */
  at: number;
  service: string;
  action: string;
  /** דולר לחודש, משוער. */
  usdPerMonth: number;
  why: string;
  /** מה קורה אם לא — במילה. */
  risk: string;
  url: string;
};

export const THRESHOLDS: Threshold[] = [
  {
    at: 1,
    service: "Supabase",
    action: "Pro — גיבוי יומי (7 ימים) ל-CleanaS",
    usdPerMonth: 25,
    why: "בתוכנית החינמית אין גיבוי בכלל. מהלקוח המשלם הראשון, המידע של קליניקה חייב להיות ניתן לשחזור.",
    risk: "אובדן נתונים בלי דרך חזרה",
    url: "https://supabase.com/dashboard/org/koyflzehtzznzosknwak/billing",
  },
  {
    at: 15,
    service: "Resend",
    action: "Pro — 50,000 מיילים בחודש",
    usdPerMonth: 20,
    why: "התוכנית החינמית: 100 מיילים ביום. כל הזמנה = עד 3 מיילים (אישור, התראה, תזכורת). 15 משתמשים × 2 הזמנות × 3 = 90 ביום.",
    risk: "אישורים ותזכורות מפסיקים להישלח באמצע היום",
    url: "https://resend.com/settings/billing",
  },
  {
    at: 20,
    service: "Vercel",
    action: "Pro לצוות (שני הפרויקטים)",
    usdPerMonth: 20,
    why: "Hobby מגביל משימות cron ואורך פונקציה ל-60 שניות. cron החידושים והתזכורות צריכים יותר, וכך גם ניטור ולוגים.",
    risk: "cron שלא רץ = חידושים ותזכורות שלא קורים",
    url: "https://vercel.com/oavital/~/settings/billing",
  },
  {
    at: 50,
    service: "Supabase",
    action: "תוספת מחשוב Small ל-CleanaS",
    usdPerMonth: 15,
    why: "מופע ה-Micro של Pro מספיק ל-50 קליניקות שקטות; מעבר לזה, זמני תגובה של RPCs מתחילים להימרח בשעות העומס.",
    risk: "לוח החדרים נטען לאט בבוקר",
    url: "https://supabase.com/dashboard/project/hayqlgcnncuhugwkajve/settings/addons",
  },
  {
    at: 50,
    service: "Sentry",
    action: "לחבר גם את Cleana+ (יש ב-CleanaS)",
    usdPerMonth: 0,
    why: "ב-50 מטפלים כבר אי אפשר לשמוע על תקלות מהלקוחות. התוכנית החינמית של Sentry מספיקה.",
    risk: "באגים בפרודקשן שאף אחד לא רואה",
    url: "https://sentry.io/pricing/",
  },
  {
    at: 100,
    service: "Supabase",
    action: "PITR (שחזור לנקודת זמן) ל-CleanaS",
    usdPerMonth: 100,
    why: "גיבוי יומי מחזיר למצב של אתמול. ב-100 קליניקות, יום של הזמנות ותשלומים שאבד הוא נזק אמיתי.",
    risk: "שחזור מוחק עד יום שלם של פעילות",
    url: "https://supabase.com/dashboard/project/hayqlgcnncuhugwkajve/settings/addons",
  },
  {
    at: 100,
    service: "Cleana+ DB",
    action: "לוודא pooler (pgbouncer, פורט 6543) ולשקול Supabase Pro גם לו",
    usdPerMonth: 25,
    why: "Prisma פותח חיבורים לכל מופע שרת. בלי pooler, 100 משתמשים במקביל = 'too many connections'. גם ל-Cleana+ מגיע גיבוי.",
    risk: "שגיאות חיבור בשעות העומס",
    url: "https://supabase.com/dashboard",
  },
  {
    at: 250,
    service: "Supabase",
    action: "מחשוב Medium + pooler ייעודי",
    usdPerMonth: 60,
    why: "מ-250 קליניקות המסד הוא הצוואר: יותר CPU, ו-pooler שלא משתף משאבים עם המופע.",
    risk: "עומס בבוקר על כל הקליניקות בבת אחת",
    url: "https://supabase.com/dashboard/project/hayqlgcnncuhugwkajve/settings/addons",
  },
  {
    at: 1000,
    service: "Clerk",
    action: "Pro — מעל 10,000 משתמשים פעילים בחודש",
    usdPerMonth: 25,
    why: "התוכנית החינמית של Clerk מכסה 10,000 MAU. עד אז אין מה לקנות.",
    risk: "התחברות נחסמת מעבר למכסה",
    url: "https://clerk.com/pricing",
  },
];

/** המדרגות שהגיע זמנן ושטרם, לפי מספר המשתמשים הפעילים. */
export function ladder(activeUsers: number) {
  const due = THRESHOLDS.filter((t) => activeUsers >= t.at);
  const upcoming = THRESHOLDS.filter((t) => activeUsers < t.at);
  const next = upcoming[0] ?? null;
  const monthlyDueUsd = due.reduce((sum, t) => sum + t.usdPerMonth, 0);
  return { due, upcoming, next, monthlyDueUsd };
}
