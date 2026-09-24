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
  manualBookingTitle: "הזמנה עם משך אחר",
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
  bookingDone: "החדר הוזמן",
  // actions
  bookingError: "ההזמנה לא הצליחה",
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
  noHistory: "עוד אין הזמנות קודמות.",
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
// /purchase — מחירים והוראות תשלום. אין כאן תשלום: המטפל/ת משלם/ת לקליניקה,
// והקליניקה מנפיקה את הכרטיסייה (מצב ידני, 24.9.2026).
// ---------------------------------------------------------------------------
const PURCHASE_HE = {
  title: "רכישת כרטיסייה",
  myActiveCards: "הכרטיסיות הפעילות שלי",
  hoursLeft: (n: number) => `${n} שעות נותרו`,
  validUntil: (d: string) => `בתוקף עד ${d}`,
  tierHours: (n: number) => `${n} שעות`,
  perHourBeforeVat: (price: string) => `${price} לשעה, לפני מע"מ`,
  includesDeposit: (n: number) => `כולל פיקדון של ${n} שעות`,
  totalWithVat: "סה\"כ כולל מע\"מ",
  noTiers: "הקליניקה עוד לא הגדירה כרטיסיות למכירה.",
  howToPayTitle: "איך משלמים",
  howToPayFallback: "התשלום הוא ישירות לקליניקה. לפרטים אפשר לפנות להנהלת הקליניקה.",
  afterPayment: "ברגע שהקליניקה רושמת את התשלום, הכרטיסייה מופיעה כאן ואפשר להתחיל להזמין.",
};

const PURCHASE_EN: typeof PURCHASE_HE = {
  title: "Buy Punch Card",
  myActiveCards: "My active punch cards",
  hoursLeft: (n) => `${n} hours left`,
  validUntil: (d) => `Valid until ${d}`,
  tierHours: (n) => `${n} hours`,
  perHourBeforeVat: (price) => `${price} per hour, before VAT`,
  includesDeposit: (n) => `Includes a ${n}-hour deposit`,
  totalWithVat: "Total, VAT included",
  noTiers: "No price tiers have been set up in the clinic yet.",
  howToPayTitle: "How to pay",
  howToPayFallback: "Pay the clinic directly. For details, contact the clinic management.",
  afterPayment: "Once the clinic records your payment, the punch card appears here and the hours are ready to book.",
};

export function getPurchaseDict(locale: Locale) {
  return locale === "en" ? PURCHASE_EN : PURCHASE_HE;
}

// ---------------------------------------------------------------------------
// /payments
// ---------------------------------------------------------------------------
const PAYMENTS_HE = {
  title: "תשלומים",
  empty: "עוד אין תשלומים.",
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
  notEnabled: "הקליניקה לא מציעה ססיות כרגע.",
  empty: "עוד אין לך ססיה.",
  weeklyHoursPrice: (hours: number, price: string) => `${hours} שעות בשבוע · ${price} לחודש`,
  rejectionReason: (r: string) => `סיבת דחייה: ${r}`,
  nextBilling: (d: string) => `התשלום הבא: ${d}`,
  activeUntil: (d: string) => `פעילה עד ${d}`,
  awaitingPayment: "הססיה אושרה. התשלום הוא ישירות לקליניקה, וברגע שהוא נרשם הססיה נפתחת והשעות נשמרות לך.",
  requestCancellation: "ביטול הססיה",
  // /sessions/new
  newTitle: "בקשת ססיה חדשה",
  fixedSlotsTitle: "השעות הקבועות שלך בכל שבוע",
  fixedSlotsDescription: (min: number, max: number, pricePerHour: string) =>
    `בססיה שומרים לך את אותן שעות בכל שבוע, בחדרים ובימים שבוחרים כאן: ${
      min === max ? `${min} שעות בדיוק` : `בין ${min} ל-${max} שעות בשבוע`
    }. המחיר הוא ${pricePerHour} לחודש על כל שעה שבועית, לפני מע"מ. הבקשה עוברת לאישור הקליניקה, והקליניקה בודקת שהחדרים פנויים.`,
  submitRequest: "שליחת הבקשה לאישור הקליניקה",
  // SlotBuilder (משותף גם לאדמין)
  room: "חדר",
  weekday: "יום",
  startTime: "שעת התחלה",
  durationHours: "משך (שעות)",
  remove: "הסרה",
  addSlot: "הוספת שעה קבועה",
  totalInRange: (total: number, min: number, max: number) =>
    min === max ? `נבחרו ${total} מתוך ${min} שעות בשבוע` : `נבחרו ${total} שעות בשבוע (צריך בין ${min} ל-${max})`,
  monthlyPrice: (price: string) => `מחיר חודשי: ${price} + מע"מ`,
  totalWeekly: (total: number) => `סה"כ ${total} שעות בשבוע`,
  startDateOptional: "מתי להתחיל? (לא חובה)",
  // action
  invalidSlots: "חלק מהשעות שנבחרו לא תקינות",
  requestError: "שליחת הבקשה לא הצליחה",
};

const SESSIONS_EN: typeof SESSIONS_HE = {
  title: "My Sessions",
  newRequest: "New session request",
  notEnabled: "The session model is not enabled in your clinic.",
  empty: "No session request or subscription yet.",
  weeklyHoursPrice: (hours, price) => `${hours} weekly hours · ${price}/month`,
  rejectionReason: (r) => `Rejection reason: ${r}`,
  nextBilling: (d) => `Next payment due: ${d}`,
  activeUntil: (d) => `Active until: ${d}`,
  awaitingPayment: "Your session was approved. Pay the clinic directly — as soon as the payment is recorded, the session opens and the slots are locked in.",
  requestCancellation: "Request subscription cancellation",
  newTitle: "New session request",
  fixedSlotsTitle: "Fixed weekly slots",
  fixedSlotsDescription: (min, max, pricePerHour) =>
    `A session is a fixed weekly amount in the room(s) and time(s) you choose — ${
      min === max ? `exactly ${min} hours` : `between ${min} and ${max} hours a week`
    }, at ${pricePerHour} per weekly hour per month (+ VAT). The request goes to the admin for approval and does not check actual availability in advance.`,
  submitRequest: "Send request for admin approval",
  room: "Room",
  weekday: "Day",
  startTime: "Start time",
  durationHours: "Duration (hours)",
  remove: "Remove",
  addSlot: "Add another slot",
  totalInRange: (total, min, max) =>
    min === max ? `Total ${total} of ${min} required weekly hours` : `Total ${total} weekly hours (${min}–${max} required)`,
  monthlyPrice: (price) => `Monthly price: ${price} + VAT`,
  totalWeekly: (total) => `Total ${total} weekly hours`,
  startDateOptional: "Requested start date (optional)",
  invalidSlots: "Invalid slots",
  requestError: "Failed to send the request",
};

export function getSessionsDict(locale: Locale) {
  return locale === "en" ? SESSIONS_EN : SESSIONS_HE;
}
