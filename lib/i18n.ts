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

export function otherLocale(locale: Locale): Locale {
  return locale === "he" ? "en" : "he";
}

// שם השפה כפי שדוברים אותה קוראים לה בעצמם (endonym) — תמיד באותה שפה,
// בלי קשר ל-locale הנוכחי של הממשק. מוסכמה סטנדרטית למתגי שפה (למשל
// Wikipedia): "עברית"/"English" נשארים קריאים למי שמחפש/ת אותם, גם
// כשהערכית הנוכחית היא השפה השנייה.
export const LOCALE_NATIVE_NAME: Record<Locale, string> = {
  he: "עברית",
  en: "English",
};

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

// 🔴 תאריך/שעה נשארים dd/MM/yyyy HH:mm (מספרי לגמרי) בשני ה-locale-ים —
// זו מוסכמת פורמט של האפליקציה (CLAUDE.md §"מוסכמות קוד"), לא עניין של
// שפת ממשק, ולפורמט מספרי טהור אין הבדל ויזואלי בין locale he/en
// ב-date-fns. מטבע (₪, Intl 'he-IL') מאותה סיבה בדיוק — לא מתורגם.
type DashboardDict = {
  greeting: (name: string) => string;
  hoursRemaining: string;
  nextBooking: string;
  noUpcomingBookings: string;
};

const DASHBOARD_DICT: Record<Locale, DashboardDict> = {
  he: {
    greeting: (name) => `שלום, ${name}`,
    hoursRemaining: "יתרת שעות",
    nextBooking: "ההזמנה הבאה",
    noUpcomingBookings: "אין הזמנות קרובות",
  },
  en: {
    greeting: (name) => `Hello, ${name}`,
    hoursRemaining: "Hours remaining",
    nextBooking: "Next booking",
    noUpcomingBookings: "No upcoming bookings",
  },
};

export function getDashboardDict(locale: Locale): DashboardDict {
  return DASHBOARD_DICT[locale] ?? DASHBOARD_DICT.he;
}

type ProfileDict = {
  title: string;
  personalDetailsTitle: string;
  fullNameLabel: string;
  professionLabel: string;
  phoneLabel: string;
  emailLabel: string;
  phoneEmailNote: string;
  save: string;
  localeCardTitle: string;
  localeCardDescription: string;
  statusCardTitle: string;
  roleLabel: string;
  roleValues: { owner: string; admin: string; therapist: string };
  hoursRemainingLabel: string;
  doorCodeLabel: string;
  calendarFeedTitle: string;
  calendarFeedDescription: string;
};

const PROFILE_DICT: Record<Locale, ProfileDict> = {
  he: {
    title: "הכרטיס שלי",
    personalDetailsTitle: "פרטים אישיים",
    fullNameLabel: "שם מלא",
    professionLabel: "מקצוע",
    phoneLabel: "טלפון",
    emailLabel: "אימייל",
    phoneEmailNote: "טלפון ואימייל ניתנים לעדכון רק ע\"י אדמין/ית הקליניקה.",
    save: "שמירה",
    localeCardTitle: "שפת ממשק / Interface language",
    localeCardDescription: "משפיעה על תפריט הניווט ותוכן העמוד; שאר האפליקציה עדיין בעברית",
    statusCardTitle: "סטטוס בקליניקה",
    roleLabel: "תפקיד",
    roleValues: { owner: "בעלים", admin: "אדמין/ית", therapist: "מטפל/ת" },
    hoursRemainingLabel: "יתרת שעות כרטיסייה",
    doorCodeLabel: "קוד כניסה",
    calendarFeedTitle: "פיד לוח שנה אישי",
    calendarFeedDescription: "הוספת ההזמנות שלכם ליומן (Google/Outlook/Apple) דרך קישור מנוי",
  },
  en: {
    title: "My Profile",
    personalDetailsTitle: "Personal details",
    fullNameLabel: "Full name",
    professionLabel: "Profession",
    phoneLabel: "Phone",
    emailLabel: "Email",
    phoneEmailNote: "Phone and email can only be updated by the clinic admin.",
    save: "Save",
    localeCardTitle: "Interface language / שפת ממשק",
    localeCardDescription: "Affects the nav menu and this page's content; the rest of the app is still in Hebrew",
    statusCardTitle: "Clinic status",
    roleLabel: "Role",
    roleValues: { owner: "Owner", admin: "Admin", therapist: "Therapist" },
    hoursRemainingLabel: "Punch card hours remaining",
    doorCodeLabel: "Door code",
    calendarFeedTitle: "Personal calendar feed",
    calendarFeedDescription: "Add your bookings to your calendar (Google/Outlook/Apple) via a subscription link",
  },
};

export function getProfileDict(locale: Locale): ProfileDict {
  return PROFILE_DICT[locale] ?? PROFILE_DICT.he;
}
