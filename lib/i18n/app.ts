// מילונים למסכי צד המטפל/ת. ר' הערת הארכיטקטורה ב-index.ts.
import type { Locale } from "./index";

// ---------------------------------------------------------------------------
// /schedule (+ SlotGrid, BookingForm, createBookingAction)
// ---------------------------------------------------------------------------
const SCHEDULE_HE = {
  title: "לוח זמנים",
  view: { day: "יום", week: "שבוע", month: "חודש" },
  prevAria: (label: string) => `${label} קודם`,
  nextAria: (label: string) => `${label} הבא`,
  today: "היום",
  manualBookingTitle: "הזמנה ידנית (משך מותאם אישית)",
  youHaveBooking: "יש לך הזמנה",
  // SlotGrid
  hourColumn: "שעה",
  mine: "שלך",
  taken: "תפוס",
  blocked: "חסום",
  selected: "נבחר",
  available: "פנוי",
  cancelTitle: "ביטול",
  confirmBooking: "אישור הזמנה",
  // BookingForm
  room: "חדר",
  date: "תאריך",
  time: "שעה",
  durationHours: "משך (שעות)",
  book: "הזמנה",
  bookingDone: "ההזמנה בוצעה!",
  // actions
  bookingError: "שגיאה בהזמנה",
};

const SCHEDULE_EN: typeof SCHEDULE_HE = {
  title: "Schedule",
  view: { day: "Day", week: "Week", month: "Month" },
  prevAria: (label) => `Previous ${label.toLowerCase()}`,
  nextAria: (label) => `Next ${label.toLowerCase()}`,
  today: "Today",
  manualBookingTitle: "Manual booking (custom duration)",
  youHaveBooking: "You have a booking",
  hourColumn: "Time",
  mine: "Yours",
  taken: "Taken",
  blocked: "Blocked",
  selected: "Selected",
  available: "Free",
  cancelTitle: "Cancel",
  confirmBooking: "Confirm booking",
  room: "Room",
  date: "Date",
  time: "Time",
  durationHours: "Duration (hours)",
  book: "Book",
  bookingDone: "Booking confirmed!",
  bookingError: "Booking failed",
};

export function getScheduleDict(locale: Locale) {
  return locale === "en" ? SCHEDULE_EN : SCHEDULE_HE;
}

// ---------------------------------------------------------------------------
// /bookings
// ---------------------------------------------------------------------------
const BOOKINGS_HE = {
  title: "ההזמנות שלי",
  upcoming: "קרובות",
  history: "היסטוריה",
  noUpcoming: "אין הזמנות קרובות.",
  noHistory: "אין עדיין היסטוריה.",
  cancel: "ביטול",
};

const BOOKINGS_EN: typeof BOOKINGS_HE = {
  title: "My Bookings",
  upcoming: "Upcoming",
  history: "History",
  noUpcoming: "No upcoming bookings.",
  noHistory: "No history yet.",
  cancel: "Cancel",
};

export function getBookingsDict(locale: Locale) {
  return locale === "en" ? BOOKINGS_EN : BOOKINGS_HE;
}

// ---------------------------------------------------------------------------
// /purchase (+ success/failure, ClaimButton, claimPendingPurchaseAction)
// ---------------------------------------------------------------------------
const PURCHASE_HE = {
  title: "רכישת כרטיסייה",
  myActiveCards: "הכרטיסיות הפעילות שלי",
  hoursLeft: (n: number) => `${n} שעות נותרו`,
  validUntil: (d: string) => `בתוקף עד ${d}`,
  tierHours: (n: number) => `${n} שעות`,
  perHourBeforeVat: (price: string) => `${price} לשעה, לפני מע"מ`,
  includesDeposit: (n: number) => `כולל פיקדון של ${n} שעות`,
  buyInStore: "לרכישה בחנות",
  storeNotConfigured: "החנות טרם הוגדרה",
  noTiers: "עדיין לא הוגדרו מדרגות מחיר בקליניקה.",
  alreadyPaidTitle: "שילמתם כבר?",
  alreadyPaidDescription: "הרכישה בדרך כלל משתייכת אליכם אוטומטית תוך דקות. אם לא — אפשר לבדוק ידנית.",
  // ClaimButton
  checking: "בודק/ת…",
  claimButton: "כבר שילמתי — בדיקת רכישה ממתינה",
  // action
  noPendingPurchase: "לא נמצאה רכישה ממתינה לשיוך כרגע.",
  claimed: (hours: number) => `שויכה רכישה אחת (${hours} שעות נוספו).`,
  // success
  successTitle: "התשלום התקבל",
  successBody: 'השעות אמורות להתווסף אליכם תוך דקות. אם הן לא הופיעו — אפשר לבדוק ב-"רכישת כרטיסייה".',
  backToPurchase: "חזרה למסך הרכישה",
  // failure
  failureTitle: "התשלום לא הושלם",
  failureBody: "שום דבר לא חויב. אפשר לנסות שוב, או לפנות לניהול הקליניקה.",
  tryAgain: "ניסיון נוסף",
};

const PURCHASE_EN: typeof PURCHASE_HE = {
  title: "Buy Punch Card",
  myActiveCards: "My active punch cards",
  hoursLeft: (n) => `${n} hours left`,
  validUntil: (d) => `Valid until ${d}`,
  tierHours: (n) => `${n} hours`,
  perHourBeforeVat: (price) => `${price} per hour, before VAT`,
  includesDeposit: (n) => `Includes a ${n}-hour deposit`,
  buyInStore: "Buy in store",
  storeNotConfigured: "Store not configured yet",
  noTiers: "No price tiers have been set up in the clinic yet.",
  alreadyPaidTitle: "Already paid?",
  alreadyPaidDescription: "Purchases are usually matched to you automatically within minutes. If not, you can check manually.",
  checking: "Checking…",
  claimButton: "I already paid — check for a pending purchase",
  noPendingPurchase: "No pending purchase was found to match right now.",
  claimed: (hours) => `One purchase was matched (${hours} hours added).`,
  successTitle: "Payment received",
  successBody: 'Your hours should be added within minutes. If they don\'t show up, check under "Buy Punch Card".',
  backToPurchase: "Back to purchase",
  failureTitle: "Payment not completed",
  failureBody: "Nothing was charged. You can try again or contact the clinic management.",
  tryAgain: "Try again",
};

export function getPurchaseDict(locale: Locale) {
  return locale === "en" ? PURCHASE_EN : PURCHASE_HE;
}

// ---------------------------------------------------------------------------
// /payments
// ---------------------------------------------------------------------------
const PAYMENTS_HE = {
  title: "תשלומים",
  empty: "אין עדיין היסטוריית תשלומים.",
  invoice: "חשבונית",
};

const PAYMENTS_EN: typeof PAYMENTS_HE = {
  title: "Payments",
  empty: "No payment history yet.",
  invoice: "Invoice",
};

export function getPaymentsDict(locale: Locale) {
  return locale === "en" ? PAYMENTS_EN : PAYMENTS_HE;
}

// ---------------------------------------------------------------------------
// /sessions (+ /sessions/new, SlotBuilder, requestSessionAction)
// ---------------------------------------------------------------------------
const SESSIONS_HE = {
  title: "הססיות שלי",
  newRequest: "בקשת ססיה חדשה",
  notEnabled: "מודל ססיה לא פעיל בקליניקה שלכם.",
  empty: "אין עדיין בקשת/מנוי ססיה.",
  weeklyHoursPrice: (hours: number, price: string) => `${hours} שעות שבועיות · ${price}/חודש`,
  rejectionReason: (r: string) => `סיבת דחייה: ${r}`,
  nextBilling: (d: string) => `חיוב הבא: ${d}`,
  activeUntil: (d: string) => `פעיל עד: ${d}`,
  payInStore: "לתשלום בחנות",
  requestCancellation: "בקשת ביטול מנוי",
  // /sessions/new
  newTitle: "בקשת ססיה חדשה",
  fixedSlotsTitle: "משבצות שבועיות קבועות",
  fixedSlotsDescription: (baseHours: number) =>
    `הססיה היא היקף שבועי קבוע — ${baseHours} שעות בדיוק, בחדר/ים ובזמן/ים שתבחרו. הבקשה נשלחת לאישור אדמין ולא בודקת זמינות בפועל מראש.`,
  submitRequest: "שליחת בקשה לאישור אדמין",
  // SlotBuilder (משותף גם לאדמין)
  room: "חדר",
  weekday: "יום",
  startTime: "שעת התחלה",
  durationHours: "משך (שעות)",
  remove: "הסרה",
  addSlot: "הוספת משבצת נוספת",
  totalOfRequired: (total: number, required: number) => `סה"כ ${total} מתוך ${required} שעות שבועיות נדרשות`,
  totalWeekly: (total: number) => `סה"כ ${total} שעות שבועיות`,
  startDateOptional: "תאריך התחלה מבוקש (אופציונלי)",
  // action
  invalidSlots: "משבצות לא תקינות",
  requestError: "שגיאה בשליחת הבקשה",
};

const SESSIONS_EN: typeof SESSIONS_HE = {
  title: "My Sessions",
  newRequest: "New session request",
  notEnabled: "The session model is not enabled in your clinic.",
  empty: "No session request or subscription yet.",
  weeklyHoursPrice: (hours, price) => `${hours} weekly hours · ${price}/month`,
  rejectionReason: (r) => `Rejection reason: ${r}`,
  nextBilling: (d) => `Next charge: ${d}`,
  activeUntil: (d) => `Active until: ${d}`,
  payInStore: "Pay in store",
  requestCancellation: "Request subscription cancellation",
  newTitle: "New session request",
  fixedSlotsTitle: "Fixed weekly slots",
  fixedSlotsDescription: (baseHours) =>
    `A session is a fixed weekly amount — exactly ${baseHours} hours, in the room(s) and time(s) you choose. The request goes to the admin for approval and does not check actual availability in advance.`,
  submitRequest: "Send request for admin approval",
  room: "Room",
  weekday: "Day",
  startTime: "Start time",
  durationHours: "Duration (hours)",
  remove: "Remove",
  addSlot: "Add another slot",
  totalOfRequired: (total, required) => `Total ${total} of ${required} required weekly hours`,
  totalWeekly: (total) => `Total ${total} weekly hours`,
  startDateOptional: "Requested start date (optional)",
  invalidSlots: "Invalid slots",
  requestError: "Failed to send the request",
};

export function getSessionsDict(locale: Locale) {
  return locale === "en" ? SESSIONS_EN : SESSIONS_HE;
}
