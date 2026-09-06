// שפת ממשק אישית (profiles.locale) — ר' migration 20260906000006.
//
// 🔴 ארכיטקטורת שילוב הדרגתית: ה-<html dir="rtl"> הגלובלי ב-app/layout.tsx
// לא משתנה בכלל. AppShell (העטיפה המשותפת לכל מסך מחובר) מתרגם *רק* את
// ה-chrome של עצמו (ניווט/כותרות עליונות) לפי locale, ומגדיר dir/lang
// מקומי על ה-aside/header/drawer שלו. תוכן הדף עצמו (h1, טפסים, טקסטים
// עסקיים) נשאר עברית עד שהוא עובר תרגום מפורש דף-דף (ר' PROGRESS.md) —
// כך שדף שעדיין לא תורגם ממשיך תמיד להיראות עברית/RTL תקין ולא "שבור",
// גם כשה-locale של המשתמש/ת הוא en.
export type Locale = "he" | "en";

export const DEFAULT_LOCALE: Locale = "en";

export function dirFor(locale: Locale): "rtl" | "ltr" {
  return locale === "he" ? "rtl" : "ltr";
}

// profiles.locale מגיע מה-DB כ-string גולמי (הטיפוסים הנוצרים לא משקפים את
// ה-check constraint) — נרמול בטוח לפני שימוש. ברירת המחדל כאן היא "he"
// ולא "en": זו רק רשת ביטחון לקריאות ל-AppShell שעדיין לא מעבירות locale
// בכלל (או ערך לא תקין) — לא הדיפולט של פרופיל חדש, שנקבע ב-DB.
export function normalizeLocale(value: string | null | undefined): Locale {
  return value === "en" ? "en" : "he";
}

type AppShellDict = {
  nav: {
    dashboard: string;
    schedule: string;
    bookings: string;
    purchase: string;
    sessions: string;
    payments: string;
    profile: string;
    adminHome: string;
    adminBoard: string;
    adminTherapists: string;
    adminSessions: string;
    adminPayments: string;
    adminRooms: string;
    adminSettings: string;
    adminReports: string;
    adminAudit: string;
  };
  crossToAdmin: string;
  crossToApp: string;
  homeAria: string;
  openMenuAria: string;
  closeAria: string;
  signOut: string;
};

const APP_SHELL_DICT: Record<Locale, AppShellDict> = {
  he: {
    nav: {
      dashboard: "בית",
      schedule: "לוח זמנים",
      bookings: "ההזמנות שלי",
      purchase: "רכישת כרטיסייה",
      sessions: "הססיות שלי",
      payments: "תשלומים",
      profile: "הכרטיס שלי",
      adminHome: "מסך הבית",
      adminBoard: "לוח מלא",
      adminTherapists: "מטפלים",
      adminSessions: "בקשות ססיה",
      adminPayments: "תשלומים",
      adminRooms: "סניפים וחדרים",
      adminSettings: "הגדרות",
      adminReports: "דוחות",
      adminAudit: "יומן פעולות",
    },
    crossToAdmin: "ניהול המערכת",
    crossToApp: "חזרה לאפליקציה",
    homeAria: "דף הבית",
    openMenuAria: "פתיחת תפריט",
    closeAria: "סגירה",
    signOut: "יציאה",
  },
  en: {
    nav: {
      dashboard: "Home",
      schedule: "Schedule",
      bookings: "My Bookings",
      purchase: "Buy Punch Card",
      sessions: "My Sessions",
      payments: "Payments",
      profile: "My Profile",
      adminHome: "Home",
      adminBoard: "Full Board",
      adminTherapists: "Therapists",
      adminSessions: "Session Requests",
      adminPayments: "Payments",
      adminRooms: "Branches & Rooms",
      adminSettings: "Settings",
      adminReports: "Reports",
      adminAudit: "Audit Log",
    },
    crossToAdmin: "Admin Panel",
    crossToApp: "Back to App",
    homeAria: "Home page",
    openMenuAria: "Open menu",
    closeAria: "Close",
    signOut: "Sign out",
  },
};

export function getAppShellDict(locale: Locale): AppShellDict {
  return APP_SHELL_DICT[locale] ?? APP_SHELL_DICT.he;
}
