// שפת ממשק אישית (profiles.locale) — ר' migration 20260906000006.
//
// 🔴 ארכיטקטורה: כל הטקסטים של האפליקציה הפנימית (מאחורי login) עוברים
// דרך המילונים כאן. הקבצים:
//   - index.ts   — ליבה (Locale, dir, נרמול), AppShell, Dashboard, Profile,
//                  ו-common (סטטוסים/ימים משותפים לכמה מסכים).
//   - app.ts     — מסכי מטפל/ת (schedule, bookings, purchase, payments, sessions).
//   - admin.ts   — מסכי אדמין (board, therapists, sessions, payments, rooms,
//                  settings, reports, audit).
//   - context.tsx — LocaleProvider/useLocale ל-client components (AppShell
//                  מספק; server components מקבלים locale מ-profile ישירות).
//
// כל מילון מוגדר קודם בעברית (המקור), והאנגלית מחויבת ע"י TypeScript להיות
// באותה צורה בדיוק (`const EN: typeof HE`) — אי אפשר "לשכוח" מפתח.
//
// דפים ציבוריים (login/signup/landing) *לא* מתורגמים כאן בכוונה — הבקשה
// הייתה "כל האפליקציה הפנימית", ומיילים (lib/email/templates.ts) עדיין
// בעברית בלבד (ר' PROGRESS.md).
import { he as dfHe, enUS as dfEn } from "date-fns/locale";

export type Locale = "he" | "en";

export const DEFAULT_LOCALE: Locale = "en";

export function dirFor(locale: Locale): "rtl" | "ltr" {
  return locale === "he" ? "rtl" : "ltr";
}

// profiles.locale מגיע מה-DB כ-string גולמי (הטיפוסים הנוצרים לא משקפים את
// ה-check constraint) — נרמול בטוח לפני שימוש. ברירת המחדל כאן היא "he"
// ולא "en": זו רק רשת ביטחון לקריאות שלא מעבירות locale בכלל (או ערך לא
// תקין) — לא הדיפולט של פרופיל חדש, שנקבע ב-DB.
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

/** locale של date-fns — לשמות ימים/חודשים בתבניות טקסטואליות (EEEE, MMMM). */
export function dateFnsLocale(locale: Locale) {
  return locale === "he" ? dfHe : dfEn;
}

// ---------------------------------------------------------------------------
// common — מונחים שחוזרים בכמה מסכים (סטטוסים, ימים, תפקידים)
// ---------------------------------------------------------------------------
const COMMON_HE = {
  weekdaysShort: ["א׳", "ב׳", "ג׳", "ד׳", "ה׳", "ו׳", "ש׳"],
  holidays: {
    roshHashana: "ראש השנה", erevRoshHashana: "ערב ראש השנה", yomKippur: "יום כיפור", erevYomKippur: "ערב יום כיפור",
    sukkot: "סוכות", erevSukkot: "ערב סוכות", cholHamoedSukkot: "חול המועד סוכות", hoshanaRaba: "הושענא רבה", shminiAtzeret: "שמחת תורה",
    pesach: "פסח", erevPesach: "ערב פסח", cholHamoedPesach: "חול המועד פסח", erevShviiPesach: "ערב שביעי של פסח", shviiPesach: "שביעי של פסח",
    yomHazikaron: "יום הזיכרון", yomHaatzmaut: "יום העצמאות", erevShavuot: "ערב שבועות", shavuot: "שבועות",
  },
  weekdaysLong: ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"],
  /** "יום ראשון" בעברית, "Sunday" באנגלית — הקידומת "יום" קיימת רק בעברית. */
  weekdayWithPrefix: (i: number) => `יום ${COMMON_HE.weekdaysLong[i]}`,
  save: "שמירה",
  cancel: "ביטול",
  hours: "שעות",
  hoursN: (n: number) => `${n} שעות`,
  perMonth: "/חודש",
  active: "פעיל",
  inactive: "לא פעיל",
  system: "מערכת",
  noRoomsYet: "אין עדיין חדרים פעילים בקליניקה.",
  sending: "שולחים…",
  fillAllFields: "צריך למלא את כל השדות",
  invalidDetails: "חלק מהפרטים לא תקינים",
  role: { owner: "בעלים", admin: "מנהל", therapist: "מטפל" } as Record<string, string>,
  profileStatus: {
    active: "פעיל",
    suspended: "מושעה",
    archived: "בארכיון",
  } as Record<string, string>,
  bookingStatus: {
    confirmed: "מאושר",
    cancelled_by_user: "בוטל",
    cancelled_by_admin: "בוטל על ידי הקליניקה",
    completed: "הושלם",
    no_show: "אי הגעה",
  } as Record<string, string>,
  bookingSource: {
    punch_card: "כרטיסייה",
    session: "ססיה קבועה",
    admin_comp: "שעות מתנה",
  } as Record<string, string>,
  paymentType: {
    punch_card: "כרטיסייה",
    session_initial: "ססיה, תשלום ראשון",
    session_recurring: "ססיה, תשלום חודשי",
    overrun: "חריגת זמן",
    deposit_topup: "השלמת פיקדון",
  } as Record<string, string>,
  paymentStatus: {
    pending: "ממתין",
    paid: "שולם",
    failed: "נכשל",
    refunded: "הוחזר",
  } as Record<string, string>,
  sessionStatus: {
    requested: "ממתין לאישור הקליניקה",
    rejected: "נדחה",
    awaiting_payment: "ממתין לתשלום",
    active: "פעיל",
    pending_cancellation: "בוטל, פעיל עד סוף התקופה",
    cancelled: "בוטל",
    expired: "פג תוקף",
  } as Record<string, string>,
  sessionStatusShort: {
    requested: "ממתין לאישור",
    rejected: "נדחה",
    awaiting_payment: "ממתין לתשלום",
    active: "פעיל",
    pending_cancellation: "בביטול",
    cancelled: "בוטל",
    expired: "פג תוקף",
  } as Record<string, string>,
  // קודי שגיאה של ה-RPCs (נספח ב' באפיון) → הודעה למשתמש/ת
  rpcErrors: {
    NO_CREDIT: "אין יתרת שעות בתוקף",
    INSUFFICIENT_HOURS: "היתרה קטנה מהמבוקש",
    DEPOSIT_DEPLETED: "צריך להשלים את הפיקדון",
    ROOM_TAKEN: "מישהו אחר הזמין את השעה הזו ממש עכשיו",
    ROOM_UNAVAILABLE: "החדר לא זמין כרגע",
    SELF_OVERLAP: "יש לך כבר הזמנה בשעה הזו",
    TOO_FAR_AHEAD: "אי אפשר להזמין כל כך רחוק קדימה",
    TOO_FAR_PAST: "אי אפשר להזמין מועד שעבר מזמן",
    INVALID_SLOT: "אפשר להזמין רק משעה עגולה או מחצי שעה",
    BOOKING_PASSED: "המועד כבר עבר",
    USER_SUSPENDED: "החשבון שלך מושהה",
    CLINIC_SUSPENDED: "החשבון של הקליניקה מושהה זמנית",
    SESSIONS_NOT_ENABLED: "הקליניקה לא מציעה ססיות כרגע",
    SESSION_HOURS_FIXED: "מספר השעות בשבוע צריך להיות בדיוק כמו שהקליניקה קבעה",
    SESSION_HOURS_OUT_OF_RANGE: "מספר השעות בשבוע לא בטווח שהקליניקה קבעה",
    INVALID_START_DATE: "תאריך ההתחלה לא יכול להיות בעבר",
    BONUS_HOURS_CAP_EXCEEDED: "אפשר לתת עד 20 שעות מתנה בכל פעם",
    BONUS_HOURS_BLOCKED_DURING_TRIAL: "אי אפשר לתת שעות מתנה בתקופת הניסיון",
    TIER_NOT_FOUND: "סוג הכרטיסייה לא נמצא או שהוא לא פעיל",
    INVALID_HOURS: "מספר השעות צריך להיות בין 0.5 ל-100",
    INVALID_AMOUNT: "סכום לא תקין",
    BLOCK_OVERLAPS_BOOKING: "יש הזמנה מאושרת בשעות האלה. צריך לבטל אותה קודם.",
    BLOCK_OVERLAPS_BLOCK: "השעות האלה כבר חסומות",
    BOOKING_NOT_CONFIRMED: "ההזמנה כבר לא מאושרת",
    BOOKING_NOT_STARTED: "ההזמנה עדיין לא התחילה",
    INVALID_STATUS: "סטטוס לא תקין",
  } as Record<string, string>,
};

const COMMON_EN: typeof COMMON_HE = {
  weekdaysShort: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
  holidays: {
    roshHashana: "Rosh Hashana", erevRoshHashana: "Erev Rosh Hashana", yomKippur: "Yom Kippur", erevYomKippur: "Erev Yom Kippur",
    sukkot: "Sukkot", erevSukkot: "Erev Sukkot", cholHamoedSukkot: "Chol HaMoed Sukkot", hoshanaRaba: "Hoshana Raba", shminiAtzeret: "Shmini Atzeret",
    pesach: "Pesach", erevPesach: "Erev Pesach", cholHamoedPesach: "Chol HaMoed Pesach", erevShviiPesach: "Erev 7th of Pesach", shviiPesach: "7th of Pesach",
    yomHazikaron: "Memorial Day", yomHaatzmaut: "Independence Day", erevShavuot: "Erev Shavuot", shavuot: "Shavuot",
  },
  weekdaysLong: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
  weekdayWithPrefix: (i) => COMMON_EN.weekdaysLong[i],
  save: "Save",
  cancel: "Cancel",
  hours: "hours",
  hoursN: (n) => `${n} hours`,
  perMonth: "/month",
  active: "Active",
  inactive: "Inactive",
  system: "System",
  noRoomsYet: "No active rooms in the clinic yet.",
  sending: "Sending…",
  fillAllFields: "Please fill in all fields",
  invalidDetails: "Those details aren't valid",
  role: { owner: "Owner", admin: "Admin", therapist: "Therapist" },
  profileStatus: { active: "Active", suspended: "Suspended", archived: "Archived" },
  bookingStatus: {
    confirmed: "Confirmed",
    cancelled_by_user: "Cancelled",
    cancelled_by_admin: "Cancelled by admin",
    completed: "Completed",
    no_show: "No-show",
  },
  bookingSource: { punch_card: "Punch card", session: "Recurring session", admin_comp: "Admin gift" },
  paymentType: {
    punch_card: "Punch card",
    session_initial: "Session — first payment",
    session_recurring: "Session — monthly charge",
    overrun: "Overrun",
    deposit_topup: "Deposit top-up",
  },
  paymentStatus: { pending: "Pending", paid: "Paid", failed: "Failed", refunded: "Refunded" },
  sessionStatus: {
    requested: "Awaiting admin approval",
    rejected: "Rejected",
    awaiting_payment: "Awaiting payment",
    active: "Active",
    pending_cancellation: "Cancelling — active until end of term",
    cancelled: "Cancelled",
    expired: "Expired",
  },
  sessionStatusShort: {
    requested: "Awaiting approval",
    rejected: "Rejected",
    awaiting_payment: "Awaiting payment",
    active: "Active",
    pending_cancellation: "Cancelling",
    cancelled: "Cancelled",
    expired: "Expired",
  },
  rpcErrors: {
    NO_CREDIT: "No valid hour balance",
    INSUFFICIENT_HOURS: "Balance is lower than requested",
    DEPOSIT_DEPLETED: "Deposit is depleted — top-up required",
    ROOM_TAKEN: "This slot was just taken",
    ROOM_UNAVAILABLE: "The room is blocked or inactive",
    SELF_OVERLAP: "You already have a booking at this time",
    TOO_FAR_AHEAD: "Beyond the allowed booking window",
    TOO_FAR_PAST: "Cannot book that far in the past",
    INVALID_SLOT: "Time must be aligned to 30 minutes",
    BOOKING_PASSED: "This time has already passed",
    USER_SUSPENDED: "The account is suspended",
    CLINIC_SUSPENDED: "The clinic is temporarily suspended",
    SESSIONS_NOT_ENABLED: "The session model is not enabled in your clinic",
    SESSION_HOURS_FIXED: "Total weekly hours must exactly match the fixed amount",
    SESSION_HOURS_OUT_OF_RANGE: "Total weekly hours are outside the range the clinic set",
    INVALID_START_DATE: "Start date cannot be in the past",
    BONUS_HOURS_CAP_EXCEEDED: "Cannot grant more than 20 hours in one action",
    BONUS_HOURS_BLOCKED_DURING_TRIAL: "Bonus hours cannot be granted during the trial period",
    TIER_NOT_FOUND: "Tier not found or inactive",
    INVALID_HOURS: "Invalid number of hours (0.5–100)",
    INVALID_AMOUNT: "Invalid amount",
    BLOCK_OVERLAPS_BOOKING: "A confirmed booking exists in this range — cancel it first",
    BLOCK_OVERLAPS_BLOCK: "A block already exists in this range",
    BOOKING_NOT_CONFIRMED: "The booking is no longer confirmed",
    BOOKING_NOT_STARTED: "The booking has not started yet",
    INVALID_STATUS: "Invalid status",
  },
};

export type CommonDict = typeof COMMON_HE;

export function getCommonDict(locale: Locale): CommonDict {
  return locale === "en" ? COMMON_EN : COMMON_HE;
}

/** מתרגם הודעת שגיאה של RPC (מכילה את הקוד) להודעה למשתמש/ת. */
export function translateRpcError(locale: Locale, message: string, fallback: string): string {
  const map = getCommonDict(locale).rpcErrors;
  for (const key of Object.keys(map)) {
    if (message.includes(key)) return map[key];
  }
  return fallback;
}

// ---------------------------------------------------------------------------
// AppShell
// ---------------------------------------------------------------------------
const APP_SHELL_HE = {
  nav: {
    dashboard: "בית",
    schedule: "לוח זמנים",
    bookings: "ההזמנות שלי",
    purchase: "רכישת כרטיסייה",
    sessions: "הססיות שלי",
    payments: "תשלומים",
    profile: "הפרופיל שלי",
    adminHome: "מסך הבית",
    adminBoard: "לוח החדרים",
    adminTherapists: "מטפלים",
    adminSessions: "ססיות",
    adminPayments: "תשלומים",
    adminRooms: "סניפים וחדרים",
    adminReminders: "תזכורות",
    adminSettings: "הגדרות",
    adminBilling: "המנוי ל-Cleana",
    adminReports: "דוחות",
    adminAudit: "יומן פעולות",
  },
  crossToAdmin: "ניהול המערכת",
  crossToApp: "למסך המטפל",
  homeAria: "דף הבית",
  openMenuAria: "פתיחת תפריט",
  closeAria: "סגירה",
  signOut: "יציאה",
};

const APP_SHELL_EN: typeof APP_SHELL_HE = {
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
    adminReminders: "Reminders",
    adminSettings: "Settings",
    adminBilling: "Subscription",
    adminReports: "Reports",
    adminAudit: "Audit Log",
  },
  crossToAdmin: "Admin Panel",
  crossToApp: "Back to App",
  homeAria: "Home page",
  openMenuAria: "Open menu",
  closeAria: "Close",
  signOut: "Sign out",
};

export type AppShellDict = typeof APP_SHELL_HE;

export function getAppShellDict(locale: Locale): AppShellDict {
  return locale === "en" ? APP_SHELL_EN : APP_SHELL_HE;
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------
// 🔴 תאריך/שעה נשארים dd/MM/yyyy HH:mm (מספרי לגמרי) בשני ה-locale-ים —
// זו מוסכמת פורמט של האפליקציה (CLAUDE.md §"מוסכמות קוד"), לא עניין של
// שפת ממשק, ולפורמט מספרי טהור אין הבדל ויזואלי בין locale he/en
// ב-date-fns. מטבע (₪, Intl 'he-IL') מאותה סיבה בדיוק — לא מתורגם.
const DASHBOARD_HE = {
  greeting: (name: string) => `שלום, ${name}`,
  hoursRemaining: "יתרת שעות",
  nextBooking: "ההזמנה הבאה",
  noUpcomingBookings: "אין הזמנות קרובות",
};

const DASHBOARD_EN: typeof DASHBOARD_HE = {
  greeting: (name) => `Hello, ${name}`,
  hoursRemaining: "Hours remaining",
  nextBooking: "Next booking",
  noUpcomingBookings: "No upcoming bookings",
};

export function getDashboardDict(locale: Locale) {
  return locale === "en" ? DASHBOARD_EN : DASHBOARD_HE;
}

// ---------------------------------------------------------------------------
// Profile
// ---------------------------------------------------------------------------
const PROFILE_HE = {
  title: "הפרופיל שלי",
  personalDetailsTitle: "פרטים אישיים",
  fullNameLabel: "שם מלא",
  professionLabel: "מקצוע",
  phoneLabel: "טלפון",
  emailLabel: "מייל",
  phoneEmailNote: "את הטלפון והמייל אפשר לשנות רק דרך הנהלת הקליניקה.",
  save: "שמירה",
  localeCardTitle: "שפת ממשק / Interface language",
  localeCardDescription: "השפה משתנה בכל המערכת בלחיצה אחת.",
  whatsappCardTitle: "תזכורות בוואטסאפ",
  whatsappCardDescription: "הקליניקה תשלח לך תזכורת בוואטסאפ לפני כל הזמנה.",
  whatsappOn: "פעיל (לחיצה תכבה)",
  whatsappOff: "כבוי (לחיצה תפעיל)",
  statusCardTitle: "המצב שלי בקליניקה",
  roleLabel: "תפקיד",
  hoursRemainingLabel: "שעות שנותרו בכרטיסייה",
  doorCodeLabel: "קוד כניסה",
  calendarFeedTitle: "סנכרון עם היומן שלך",
  calendarFeedDescription: "ההזמנות שלך יופיעו אוטומטית ביומן של Google, Outlook או Apple.",
};

const PROFILE_EN: typeof PROFILE_HE = {
  title: "My Profile",
  personalDetailsTitle: "Personal details",
  fullNameLabel: "Full name",
  professionLabel: "Profession",
  phoneLabel: "Phone",
  emailLabel: "Email",
  phoneEmailNote: "Phone and email can only be updated by the clinic admin.",
  save: "Save",
  localeCardTitle: "Interface language / שפת ממשק",
  localeCardDescription: "One click switches the language of the whole app, including layout direction.",
  whatsappCardTitle: "WhatsApp reminders",
  whatsappCardDescription: "A reminder before each booking, from the clinic, to your WhatsApp.",
  whatsappOn: "On — click to turn off",
  whatsappOff: "Off — click to turn on",
  statusCardTitle: "Clinic status",
  roleLabel: "Role",
  hoursRemainingLabel: "Punch card hours remaining",
  doorCodeLabel: "Door code",
  calendarFeedTitle: "Personal calendar feed",
  calendarFeedDescription: "Add your bookings to your calendar (Google/Outlook/Apple) via a subscription link",
};

export function getProfileDict(locale: Locale) {
  return locale === "en" ? PROFILE_EN : PROFILE_HE;
}

export { getScheduleDict, getBookingsDict, getPurchaseDict, getPaymentsDict, getSessionsDict } from "./app";
export {
  getAdminHomeDict,
  getAdminBoardDict,
  getAdminTherapistsDict,
  getAdminTherapistDetailDict,
  getAdminSessionsDict,
  getAdminPaymentsDict,
  getAdminRoomsDict,
  getAdminRemindersDict,
  getAdminSettingsDict,
  getAdminReportsDict,
  getAdminAuditDict,
  getAdminBillingDict,
  getAdminImportDict,
} from "./admin";
