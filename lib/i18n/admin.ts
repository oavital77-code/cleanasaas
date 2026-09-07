// מילונים למסכי האדמין. ר' הערת הארכיטקטורה ב-index.ts.
import type { Locale } from "./index";

// ---------------------------------------------------------------------------
// /admin
// ---------------------------------------------------------------------------
const HOME_HE = {
  title: "מסך הבית",
  todayBookings: "הזמנות היום",
  pendingSessions: "בקשות ססיה ממתינות",
  activeTherapists: "מטפלים פעילים",
  lowBalance: "יתרה נמוכה (מתחת ל-2 שעות)",
};

const HOME_EN: typeof HOME_HE = {
  title: "Home",
  todayBookings: "Today's bookings",
  pendingSessions: "Pending session requests",
  activeTherapists: "Active therapists",
  lowBalance: "Low balance (under 2 hours)",
};

export function getAdminHomeDict(locale: Locale) {
  return locale === "en" ? HOME_EN : HOME_HE;
}

// ---------------------------------------------------------------------------
// /admin/board (+ AdminSlotGrid, AssignForm, actions)
// ---------------------------------------------------------------------------
const BOARD_HE = {
  title: "לוח מלא",
  manualAssignTitle: "שיבוץ ידני",
  needTherapistAndRoom: "צריך לפחות מטפל/ת אחד/ת וחדר פעיל אחד כדי לשבץ.",
  bookingsCount: (n: number) => `${n} הזמנות`,
  // AdminSlotGrid
  hourColumn: "שעה",
  blocked: "חסום",
  selected: "נבחר",
  available: "פנוי",
  cancelTitle: "ביטול",
  forWhomAria: "עבור מי לקבוע",
  notePlaceholder: "הערה (לא חובה)",
  cancel: "ביטול",
  assigning: "משבץ/ת…",
  assign: "שיבוץ",
  // AssignForm
  therapist: "מטפל/ת",
  room: "חדר",
  date: "תאריך",
  time: "שעה",
  durationHours: "משך (שעות)",
  note: "הערה",
  // actions
  slotTaken: "המשבצת תפוסה",
  assignError: "שגיאה בשיבוץ",
  // room blocks
  blocksTitle: "חסימות חדר",
  blocksDescription: "תחזוקה, חג, שיפוץ — החדר מוצג כ\"חסום\" בלוח ולא ניתן להזמין אותו. חסימה שחופפת הזמנה מאושרת נדחית.",
  blockFrom: "מ-",
  blockTo: "עד",
  blockReason: "סיבה",
  blockCreate: "חסימה",
  blockCreating: "חוסם/ת…",
  blockDelete: "הסרת חסימה",
  blocksEmpty: "אין חסימות קרובות.",
  blockError: "שגיאה ביצירת החסימה",
};

const BOARD_EN: typeof BOARD_HE = {
  title: "Full Board",
  manualAssignTitle: "Manual assignment",
  needTherapistAndRoom: "At least one therapist and one active room are needed to assign.",
  bookingsCount: (n) => `${n} bookings`,
  hourColumn: "Time",
  blocked: "Blocked",
  selected: "Selected",
  available: "Free",
  cancelTitle: "Cancel",
  forWhomAria: "Assign to",
  notePlaceholder: "Note (optional)",
  cancel: "Cancel",
  assigning: "Assigning…",
  assign: "Assign",
  therapist: "Therapist",
  room: "Room",
  date: "Date",
  time: "Time",
  durationHours: "Duration (hours)",
  note: "Note",
  slotTaken: "This slot is taken",
  assignError: "Assignment failed",
  blocksTitle: "Room blocks",
  blocksDescription: "Maintenance, holiday, renovation — the room shows as \"blocked\" on the board and cannot be booked. A block overlapping a confirmed booking is rejected.",
  blockFrom: "From",
  blockTo: "To",
  blockReason: "Reason",
  blockCreate: "Block",
  blockCreating: "Blocking…",
  blockDelete: "Remove block",
  blocksEmpty: "No upcoming blocks.",
  blockError: "Failed to create the block",
};

export function getAdminBoardDict(locale: Locale) {
  return locale === "en" ? BOARD_EN : BOARD_HE;
}

// ---------------------------------------------------------------------------
// /admin/therapists
// ---------------------------------------------------------------------------
const THERAPISTS_HE = {
  title: "מטפלים",
  joinLinkTitle: "קישור הצטרפות לקליניקה",
  joinLinkDescription:
    "קישור אחד וקבוע — כל מי שמקבל אותו יכול/ה להירשם ישירות כמטפל/ת אצלכם, בלי שתצטרכו ליצור הזמנה בנפרד לכל אחד/ת. גישת אדמין/ית עדיין ניתנת רק דרך הזמנה ידנית למטה.",
  closeRegistration: "כיבוי ההרשמה",
  publishClinic: "פרסום קליניקה — פתיחת הרשמה",
  openForRegistration: "פתוח להרשמה",
  closedForRegistration: "סגור להרשמה",
  colName: "שם",
  colPhone: "טלפון",
  colEmail: "אימייל",
  colRole: "תפקיד",
  colStatus: "סטטוס",
  colHours: "שעות",
  manualInviteTitle: "הזמנה ידנית (חד-פעמית)",
  manualInviteDescription: "למקרה שרוצים להזמין אדמין/ית נוסף/ת, או מטפל/ת ספציפי/ת בלי לפרסם קישור כללי.",
  createInviteLink: "יצירת קישור הזמנה",
  inviteUsed: "נוצל",
  inviteExpired: "פג תוקף",
  inviteActive: "פעיל",
  revokeInviteTitle: "ביטול קישור",
  clearUsedInvites: "ניקוי קישורים שנוצלו / פג תוקפם",
};

const THERAPISTS_EN: typeof THERAPISTS_HE = {
  title: "Therapists",
  joinLinkTitle: "Clinic join link",
  joinLinkDescription:
    "One permanent link — anyone who receives it can sign up directly as a therapist in your clinic, without a separate invite for each person. Admin access is still granted only through a manual invite below.",
  closeRegistration: "Close registration",
  publishClinic: "Publish clinic — open registration",
  openForRegistration: "Open for registration",
  closedForRegistration: "Closed for registration",
  colName: "Name",
  colPhone: "Phone",
  colEmail: "Email",
  colRole: "Role",
  colStatus: "Status",
  colHours: "Hours",
  manualInviteTitle: "Manual invite (one-time)",
  manualInviteDescription: "For inviting an additional admin, or a specific therapist without publishing a general link.",
  createInviteLink: "Create invite link",
  inviteUsed: "Used",
  inviteExpired: "Expired",
  inviteActive: "Active",
  revokeInviteTitle: "Revoke link",
  clearUsedInvites: "Clear used / expired links",
};

export function getAdminTherapistsDict(locale: Locale) {
  return locale === "en" ? THERAPISTS_EN : THERAPISTS_HE;
}

// ---------------------------------------------------------------------------
// /admin/therapists/[id]
// ---------------------------------------------------------------------------
const THERAPIST_DETAIL_HE = {
  roleStatusTitle: "תפקיד וסטטוס",
  role: "תפקיד",
  status: "סטטוס",
  save: "שמירה",
  punchCardsTitle: "כרטיסיות",
  cardSummary: (hours: number, depRemaining: number, depAmount: number) =>
    `${hours} שעות · פיקדון ${depRemaining}/${depAmount}`,
  cardActive: "פעילה",
  cardInactive: "לא פעילה",
  until: (d: string) => `עד ${d}`,
  deltaPlaceholder: "+/- שעות",
  notePlaceholder: "הערה",
  updateBalance: "עדכון יתרה",
  completeDeposit: "השלמת פיקדון",
  noCards: "אין כרטיסיות.",
  bonusHours: "מתנת שעות",
  reasonPlaceholder: "סיבה",
  grantHours: "הענקת שעות",
  sessionsTitle: "ססיות",
  sessionSummary: (hours: number, price: string) => `${hours} שעות · ${price}/חודש`,
  recentBookingsTitle: "הזמנות אחרונות",
  noBookings: "אין הזמנות.",
  recentPaymentsTitle: "תשלומים אחרונים",
  noPayments: "אין תשלומים.",
  adminNoteTitle: "הערת אדמין (פנימית)",
  saveNote: "שמירת הערה",
  // הנפקת כרטיסייה ידנית
  issueCardTitle: "הנפקת כרטיסייה ידנית",
  issueCardDescription:
    "למטפל/ת ששילם/ה במזומן / bit / העברה, מחוץ לחנות. נרשם כתשלום ששולם + כרטיסייה, ומודגש ביומן הפעולות.",
  issueCardTier: "מדרגה",
  issueCardCustom: "מותאם אישית (שעות + סכום)",
  issueCardTierOption: (hours: number, price: string) => `${hours} שעות · ${price} כולל מע"מ`,
  issueCardHours: "שעות",
  issueCardAmount: "סכום ששולם (₪, כולל מע\"מ)",
  issueCardAmountHint: "ריק = מחיר המחירון של המדרגה",
  issueCardMethod: "אמצעי תשלום",
  issueCardNote: "הערה",
  issueCardSubmit: "הנפקת כרטיסייה",
  issueCardPending: "מנפיק/ה…",
  issueCardDone: (hours: number, amount: string) => `הונפקה כרטיסייה של ${hours} שעות (${amount}).`,
  issueCardError: "שגיאה בהנפקת הכרטיסייה",
  paymentMethods: {
    cash: "מזומן",
    bit: "bit",
    paybox: "PayBox",
    credit_card: "אשראי (ידני)",
    other: "העברה בנקאית / אחר",
  } as Record<string, string>,
  // סטטוס הזמנה + חריגה
  markCompleted: "הושלם",
  markNoShow: "לא הגיע/ה",
  overrunMinutes: "דקות חריגה",
  overrunNote: "הערה",
  overrunRecord: "רישום חריגה",
  overrunRecording: "רושם/ת…",
  overrunDone: (amount: string, source: string) =>
    source === "deposit" ? `נרשמה חריגה — ${amount} נוכה מהפיקדון.` : `נרשמה חריגה — ${amount} ממתין לתשלום.`,
  overrunError: "שגיאה ברישום החריגה",
  overrunsTitle: "חריגות זמן",
  overrunSummary: (minutes: number, amount: string, source: string) =>
    `${minutes} דק' · ${amount} · ${source === "deposit" ? "מהפיקדון" : "לחיוב"}`,
  bookingStatus: {
    confirmed: "מאושרת",
    cancelled_by_user: 'בוטלה ע"י המטפל/ת',
    cancelled_by_admin: 'בוטלה ע"י אדמין',
    completed: "הסתיימה",
    no_show: "לא הגיע/ה",
  } as Record<string, string>,
};

const THERAPIST_DETAIL_EN: typeof THERAPIST_DETAIL_HE = {
  roleStatusTitle: "Role & status",
  role: "Role",
  status: "Status",
  save: "Save",
  punchCardsTitle: "Punch cards",
  cardSummary: (hours, depRemaining, depAmount) => `${hours} hours · deposit ${depRemaining}/${depAmount}`,
  cardActive: "Active",
  cardInactive: "Inactive",
  until: (d) => `until ${d}`,
  deltaPlaceholder: "+/- hours",
  notePlaceholder: "Note",
  updateBalance: "Update balance",
  completeDeposit: "Complete deposit",
  noCards: "No punch cards.",
  bonusHours: "Bonus hours",
  reasonPlaceholder: "Reason",
  grantHours: "Grant hours",
  sessionsTitle: "Sessions",
  sessionSummary: (hours, price) => `${hours} hours · ${price}/month`,
  recentBookingsTitle: "Recent bookings",
  noBookings: "No bookings.",
  recentPaymentsTitle: "Recent payments",
  noPayments: "No payments.",
  adminNoteTitle: "Admin note (internal)",
  saveNote: "Save note",
  issueCardTitle: "Issue punch card manually",
  issueCardDescription:
    "For a therapist who paid in cash / bit / bank transfer, outside the store. Recorded as a paid payment + punch card, and highlighted in the audit log.",
  issueCardTier: "Tier",
  issueCardCustom: "Custom (hours + amount)",
  issueCardTierOption: (hours, price) => `${hours} hours · ${price} incl. VAT`,
  issueCardHours: "Hours",
  issueCardAmount: "Amount paid (₪, incl. VAT)",
  issueCardAmountHint: "Empty = the tier's list price",
  issueCardMethod: "Payment method",
  issueCardNote: "Note",
  issueCardSubmit: "Issue punch card",
  issueCardPending: "Issuing…",
  issueCardDone: (hours, amount) => `Issued a ${hours}-hour punch card (${amount}).`,
  issueCardError: "Failed to issue the punch card",
  paymentMethods: {
    cash: "Cash",
    bit: "bit",
    paybox: "PayBox",
    credit_card: "Credit card (manual)",
    other: "Bank transfer / other",
  },
  markCompleted: "Completed",
  markNoShow: "No-show",
  overrunMinutes: "Overrun minutes",
  overrunNote: "Note",
  overrunRecord: "Record overrun",
  overrunRecording: "Recording…",
  overrunDone: (amount, source) =>
    source === "deposit" ? `Overrun recorded — ${amount} deducted from deposit.` : `Overrun recorded — ${amount} pending payment.`,
  overrunError: "Failed to record the overrun",
  overrunsTitle: "Overruns",
  overrunSummary: (minutes, amount, source) =>
    `${minutes} min · ${amount} · ${source === "deposit" ? "from deposit" : "to be charged"}`,
  bookingStatus: {
    confirmed: "Confirmed",
    cancelled_by_user: "Cancelled by therapist",
    cancelled_by_admin: "Cancelled by admin",
    completed: "Completed",
    no_show: "No-show",
  },
};

export function getAdminTherapistDetailDict(locale: Locale) {
  return locale === "en" ? THERAPIST_DETAIL_EN : THERAPIST_DETAIL_HE;
}

// ---------------------------------------------------------------------------
// /admin/sessions (+ /admin/sessions/new, actions)
// ---------------------------------------------------------------------------
const SESSIONS_HE = {
  title: "בקשות ססיה",
  createFree: "קביעת ססיה חופשית",
  pendingApproval: "ממתינות לאישור",
  noPending: "אין בקשות ממתינות.",
  requestSummary: (name: string, hours: number, price: string) => `${name} — ${hours} שעות · ${price}/חודש`,
  requestedStart: (d: string) => `תאריך התחלה מבוקש: ${d}`,
  noCommitment: "ללא התחייבות",
  oneMonth: "חודש",
  months: (n: number) => `${n} חודשים`,
  oneYear: "שנה",
  approve: "אישור",
  rejectReasonPlaceholder: "סיבת דחייה",
  reject: "דחייה",
  otherSessions: "שאר הססיות",
  restSummary: (name: string, hours: number) => `${name} — ${hours} שעות`,
  reasonNotGiven: "לא צוין",
  // /admin/sessions/new
  newTitle: "קביעת ססיה חופשית",
  directAssignTitle: "שיבוץ ישיר, ללא בדיקת התנגשות",
  directAssignDescription:
    'משמש בעיקר לקליטת מטפל/ת ותיק/ה שכבר יש לה משבצות קבועות. נכנס ישר ל"ממתין לתשלום" — התשלום עצמו לא מדולג.',
  createSession: "קביעת ססיה",
  creating: "קובע/ת…",
  therapist: "מטפל/ת",
  commitment: "התחייבות",
  none: "ללא",
  needTherapistAndRoom: "צריך לפחות מטפל/ת פעיל/ה וחדר פעיל אחד.",
  // actions
  chooseTherapist: "יש לבחור מטפל/ת",
  invalidSlots: "משבצות לא תקינות",
  therapistSuspended: "המטפל/ת מושעה",
  createError: "שגיאה בקביעת הססיה",
};

const SESSIONS_EN: typeof SESSIONS_HE = {
  title: "Session Requests",
  createFree: "Create a session directly",
  pendingApproval: "Pending approval",
  noPending: "No pending requests.",
  requestSummary: (name, hours, price) => `${name} — ${hours} hours · ${price}/month`,
  requestedStart: (d) => `Requested start date: ${d}`,
  noCommitment: "No commitment",
  oneMonth: "1 month",
  months: (n) => `${n} months`,
  oneYear: "1 year",
  approve: "Approve",
  rejectReasonPlaceholder: "Rejection reason",
  reject: "Reject",
  otherSessions: "Other sessions",
  restSummary: (name, hours) => `${name} — ${hours} hours`,
  reasonNotGiven: "Not specified",
  newTitle: "Create a session directly",
  directAssignTitle: "Direct assignment, no conflict check",
  directAssignDescription:
    'Mainly for onboarding an existing therapist who already has fixed slots. Goes straight to "awaiting payment" — the payment itself is never skipped.',
  createSession: "Create session",
  creating: "Creating…",
  therapist: "Therapist",
  commitment: "Commitment",
  none: "None",
  needTherapistAndRoom: "At least one active therapist and one active room are needed.",
  chooseTherapist: "Please choose a therapist",
  invalidSlots: "Invalid slots",
  therapistSuspended: "The therapist is suspended",
  createError: "Failed to create the session",
};

export function getAdminSessionsDict(locale: Locale) {
  return locale === "en" ? SESSIONS_EN : SESSIONS_HE;
}

// ---------------------------------------------------------------------------
// /admin/payments
// ---------------------------------------------------------------------------
const PAYMENTS_HE = {
  title: "תשלומים",
  colTherapist: "מטפל/ת",
  colType: "סוג",
  colAmount: "סכום",
  colStatus: "סטטוס",
  colDate: "תאריך",
  markPaidCash: "סימון כשולם במזומן",
};

const PAYMENTS_EN: typeof PAYMENTS_HE = {
  title: "Payments",
  colTherapist: "Therapist",
  colType: "Type",
  colAmount: "Amount",
  colStatus: "Status",
  colDate: "Date",
  markPaidCash: "Mark as paid in cash",
};

export function getAdminPaymentsDict(locale: Locale) {
  return locale === "en" ? PAYMENTS_EN : PAYMENTS_HE;
}

// ---------------------------------------------------------------------------
// /admin/rooms
// ---------------------------------------------------------------------------
const ROOMS_HE = {
  title: "סניפים וחדרים",
  name: "שם",
  address: "כתובת",
  active: "פעיל",
  save: "שמירה",
  roomName: "שם החדר",
  capacity: "קיבולת",
  description: "תיאור",
  newRoomName: "שם חדר חדש",
  addRoom: "הוספת חדר",
  addBranchTitle: "הוספת סניף",
  branchName: "שם הסניף",
  addBranch: "הוספת סניף",
};

const ROOMS_EN: typeof ROOMS_HE = {
  title: "Branches & Rooms",
  name: "Name",
  address: "Address",
  active: "Active",
  save: "Save",
  roomName: "Room name",
  capacity: "Capacity",
  description: "Description",
  newRoomName: "New room name",
  addRoom: "Add room",
  addBranchTitle: "Add branch",
  branchName: "Branch name",
  addBranch: "Add branch",
};

export function getAdminRoomsDict(locale: Locale) {
  return locale === "en" ? ROOMS_EN : ROOMS_HE;
}

// ---------------------------------------------------------------------------
// /admin/settings
// ---------------------------------------------------------------------------
const SETTINGS_HE = {
  title: "הגדרות",
  tiersTitle: "מדרגות כרטיסייה",
  tierHours: (n: number) => `${n} שעות`,
  pricePerHour: "₪/שעה",
  depositHours: "פיקדון (שעות)",
  save: "שמירה",
  sessionPricingTitle: "ססיה (מנוי חודשי קבוע)",
  sessionBaseHours: "שעות שבועיות קבועות",
  sessionBasePrice: "מחיר חודשי (₪)",
  hoursTitle: "שעות פעילות",
  hoursDescription: "הטווח שמוצג בלוח הזמנים (/schedule) וב-לוח המלא (/admin/board).",
  openHour: "שעת פתיחה",
  closeHour: "שעת סגירה",
  wooTitle: "שיטת תשלום — WooCommerce",
  wooDescriptionPrefix: "חברו את החנות שלכם. כתובת ה-webhook הייעודית שלכם:",
  storeUrl: "כתובת החנות",
  configuredPlaceholder: "•••• מוגדר",
  webhookSecretLabel: "Webhook Secret (אופציונלי — אם לא מוגדר, נעבוד ב-polling)",
  sessionProductIdLabel: "Product ID של מוצר הססיה בחנות (0 אם אין מודל ססיה)",
  // WhatsApp reminders
  whatsappTitle: "תזכורות WhatsApp (Meta Cloud API)",
  whatsappDescription:
    "תזכורת אוטומטית למטפל/ת לפני כל הזמנה, דרך ה-API הרשמי של Meta — מומלץ עם מספר ייעודי לקליניקה (לא הוואטסאפ האישי של המנהל/ת). הודעה יזומה חייבת להיות תבנית שאושרה ב-Meta Business Manager.",
  whatsappEnabled: "שליחה אוטומטית פעילה",
  whatsappPhoneNumberId: "Phone Number ID",
  whatsappToken: "Access Token (קבוע, של System User)",
  whatsappSenderPhone: "המספר שרשום ב-Meta (לתצוגה בלבד)",
  whatsappHoursBefore: "כמה שעות לפני ההזמנה",
  whatsappTemplateName: "שם התבנית ב-Meta",
  whatsappTemplateLang: "שפת התבנית (he / en_US)",
  whatsappMetaTemplateHelp: "צרו ב-Meta תבנית מסוג Utility עם 6 משתנים בסדר הזה: {{1}} שם, {{2}} קליניקה, {{3}} תאריך, {{4}} שעה, {{5}} חדר, {{6}} סניף. גוף מומלץ להעתקה:",
  whatsappTemplate: "טקסט ההודעה למסלול הידני (/admin/reminders)",
  whatsappTemplateHelp: "משתנים: {name} {clinic} {date} {time} {room} {branch}",
  whatsappCronNote: "השליחה האוטומטית רצה בריצת ה-cron היומית (בבוקר) לכל ההזמנות שמתחילות בטווח השעות שהוגדר. בלי הגדרת Meta, אפשר לשלוח ידנית מהמסך \"תזכורות\".",
  whatsappSendTest: "שליחת הודעת בדיקה אליי",
  whatsappTestSent: "הודעת בדיקה נשלחה",
  whatsappTestFailed: (reason: string) => `שליחת הבדיקה נכשלה: ${reason}`,
  whatsappNotConfigured: "יש להגדיר Phone Number ID, Access Token ושם תבנית לפני שליחת בדיקה",
  whatsappNoPhone: "אין טלפון בפרופיל שלך לשליחת הבדיקה",
};

const SETTINGS_EN: typeof SETTINGS_HE = {
  title: "Settings",
  tiersTitle: "Punch card tiers",
  tierHours: (n) => `${n} hours`,
  pricePerHour: "₪/hour",
  depositHours: "Deposit (hours)",
  save: "Save",
  sessionPricingTitle: "Session (fixed monthly subscription)",
  sessionBaseHours: "Fixed weekly hours",
  sessionBasePrice: "Monthly price (₪)",
  hoursTitle: "Operating hours",
  hoursDescription: "The range shown in the schedule (/schedule) and the full board (/admin/board).",
  openHour: "Opening hour",
  closeHour: "Closing hour",
  wooTitle: "Payment method — WooCommerce",
  wooDescriptionPrefix: "Connect your store. Your dedicated webhook URL:",
  storeUrl: "Store URL",
  configuredPlaceholder: "•••• configured",
  webhookSecretLabel: "Webhook Secret (optional — without it we fall back to polling)",
  sessionProductIdLabel: "Product ID of the session product in the store (0 if no session model)",
  whatsappTitle: "WhatsApp reminders (Meta Cloud API)",
  whatsappDescription:
    "An automatic reminder to the therapist before each booking via Meta's official API — recommended with a dedicated clinic number (not the manager's personal WhatsApp). Business-initiated messages must use a template approved in Meta Business Manager.",
  whatsappEnabled: "Automatic sending enabled",
  whatsappPhoneNumberId: "Phone Number ID",
  whatsappToken: "Access Token (permanent, System User)",
  whatsappSenderPhone: "Number registered with Meta (display only)",
  whatsappHoursBefore: "Hours before the booking",
  whatsappTemplateName: "Template name in Meta",
  whatsappTemplateLang: "Template language (he / en_US)",
  whatsappMetaTemplateHelp: "Create a Utility template in Meta with 6 variables in this order: {{1}} name, {{2}} clinic, {{3}} date, {{4}} time, {{5}} room, {{6}} branch. Suggested body to copy:",
  whatsappTemplate: "Message text for the manual route (/admin/reminders)",
  whatsappTemplateHelp: "Variables: {name} {clinic} {date} {time} {room} {branch}",
  whatsappCronNote: "Automatic sending runs in the daily cron (morning) for all bookings starting within the configured window. Without a Meta setup you can still send manually from the \"Reminders\" screen.",
  whatsappSendTest: "Send a test message to me",
  whatsappTestSent: "Test message sent",
  whatsappTestFailed: (reason) => `Test failed: ${reason}`,
  whatsappNotConfigured: "Set Phone Number ID, Access Token and template name before sending a test",
  whatsappNoPhone: "Your profile has no phone number to send the test to",
};

export function getAdminSettingsDict(locale: Locale) {
  return locale === "en" ? SETTINGS_EN : SETTINGS_HE;
}

// ---------------------------------------------------------------------------
// /admin/reminders — המסלול החצי-ידני (wa.me)
// ---------------------------------------------------------------------------
const REMINDERS_HE = {
  title: "תזכורות",
  description:
    "כל ההזמנות המאושרות בטווח הקרוב. לחיצה על \"WhatsApp\" פותחת את ההודעה מוכנה בוואטסאפ שלך — השליחה מהטלפון שלך, ואז מסמנים \"נשלח\". מה שכבר נשלח אוטומטית (Meta) או ידנית מסומן.",
  windowLabel: "טווח:",
  windowHours: (h: number) => `${h} שעות`,
  colTime: "מתי",
  colTherapist: "מטפל/ת",
  colRoom: "חדר",
  colStatus: "סטטוס",
  sent: "תזכורת WhatsApp נשלחה",
  emailSent: "מייל נשלח",
  optedOut: "ביקש/ה לא לקבל WhatsApp",
  noPhone: "אין טלפון",
  openWhatsApp: "WhatsApp",
  markSent: "סמן נשלח",
  empty: "אין הזמנות בטווח הזה.",
  templateMissing: "לא הוגדר טקסט הודעה בהגדרות — משתמשים בברירת מחדל.",
};

const REMINDERS_EN: typeof REMINDERS_HE = {
  title: "Reminders",
  description:
    "All confirmed bookings in the upcoming window. \"WhatsApp\" opens the ready message in your own WhatsApp — you send it from your phone, then mark it \"sent\". Anything already sent automatically (Meta) or manually is flagged.",
  windowLabel: "Window:",
  windowHours: (h) => `${h} hours`,
  colTime: "When",
  colTherapist: "Therapist",
  colRoom: "Room",
  colStatus: "Status",
  sent: "WhatsApp reminder sent",
  emailSent: "Email sent",
  optedOut: "Opted out of WhatsApp",
  noPhone: "No phone",
  openWhatsApp: "WhatsApp",
  markSent: "Mark sent",
  empty: "No bookings in this window.",
  templateMissing: "No message text set in settings — using the default.",
};

export function getAdminRemindersDict(locale: Locale) {
  return locale === "en" ? REMINDERS_EN : REMINDERS_HE;
}

// ---------------------------------------------------------------------------
// /admin/reports
// ---------------------------------------------------------------------------
const REPORTS_HE = {
  title: "דוחות",
  revenueThisMonth: "הכנסות החודש",
  hoursSoldThisMonth: "שעות כרטיסייה שנמכרו החודש",
  bookingsThisMonth: "הזמנות שנוצרו החודש",
  activeSessions: "מנויי ססיה פעילים",
  activeTherapists: "מטפלים פעילים",
};

const REPORTS_EN: typeof REPORTS_HE = {
  title: "Reports",
  revenueThisMonth: "Revenue this month",
  hoursSoldThisMonth: "Punch card hours sold this month",
  bookingsThisMonth: "Bookings created this month",
  activeSessions: "Active session subscriptions",
  activeTherapists: "Active therapists",
};

export function getAdminReportsDict(locale: Locale) {
  return locale === "en" ? REPORTS_EN : REPORTS_HE;
}

// ---------------------------------------------------------------------------
// /admin/audit
// ---------------------------------------------------------------------------
const AUDIT_HE = {
  title: "יומן פעולות",
  by: (name: string) => `ע"י ${name}`,
  details: "פרטים",
  empty: "אין עדיין רשומות.",
  actions: {
    booking_created: "הזמנה נוצרה",
    booking_created_retroactively: "הזמנה נוצרה רטרואקטיבית",
    booking_created_by_admin: 'הזמנה נוצרה ע"י אדמין',
    booking_cancelled: 'הזמנה בוטלה ע"י המטפל/ת',
    booking_cancelled_by_admin: 'הזמנה בוטלה ע"י אדמין',
    admin_adjusted_punch_card_hours: "עדכון ידני ליתרת כרטיסייה",
    bonus_hours_granted: "הענקת שעות מתנה",
    deposit_completed_manually: "השלמת פיקדון ידנית",
    branch_created: "סניף נוצר",
    room_created: "חדר נוצר",
    clinic_signed_up: "קליניקה נרשמה",
    invite_accepted: "הזמנה אושרה",
    joined_via_public_link: "הצטרפות דרך קישור ציבורי",
    overrun_charge_succeeded: "חיוב חריגה הצליח",
    overrun_charge_failed_suspended: "חיוב חריגה נכשל — הושעה",
    overrun_recorded: "נרשמה חריגה",
    session_requested: "בקשת ססיה הוגשה",
    session_approved: "ססיה אושרה",
    session_rejected: "ססיה נדחתה",
    session_created_by_admin: 'ססיה נקבעה ע"י אדמין',
    session_created_prepaid: "ססיה נקבעה (משולמת מראש)",
    session_activated: "ססיה הופעלה",
    session_activated_manually: "ססיה הופעלה ידנית",
    session_cancellation_requested: "התבקש ביטול ססיה",
    session_term_ended_by_admin: 'תקופת ססיה הופסקה ע"י אדמין',
    session_term_renewed: "ססיה חודשה",
    session_renewal_paid: "חידוש ססיה שולם",
    session_renewal_paid_manually: "חידוש ססיה שולם ידנית",
    session_renewal_failed: "חידוש ססיה נכשל",
    session_materialization_conflict: "התנגשות ביצירת מפגשי ססיה",
    session_materialization_job_error: "שגיאה בעבודת יצירת מפגשי ססיה",
    woo_purchase_claimed: "רכישה מהחנות שויכה לפרופיל",
    clerk_user_deleted_webhook: "חשבון Clerk נמחק — זיהוי נותק",
    whatsapp_reminder_sent: "תזכורת WhatsApp נשלחה",
    whatsapp_reminder_failed: "תזכורת WhatsApp נכשלה",
    whatsapp_settings_updated: "הגדרות WhatsApp עודכנו",
    punch_card_issued_manually: "כרטיסייה הונפקה ידנית (תשלום מחוץ לחנות)",
    room_block_created: "חדר נחסם",
    room_block_deleted: "חסימת חדר הוסרה",
    booking_marked_completed: "הזמנה סומנה כהושלמה",
    booking_marked_no_show: "הזמנה סומנה — לא הגיע/ה",
  } as Record<string, string>,
};

const AUDIT_EN: typeof AUDIT_HE = {
  title: "Audit Log",
  by: (name) => `by ${name}`,
  details: "Details",
  empty: "No entries yet.",
  actions: {
    booking_created: "Booking created",
    booking_created_retroactively: "Booking created retroactively",
    booking_created_by_admin: "Booking created by admin",
    booking_cancelled: "Booking cancelled by therapist",
    booking_cancelled_by_admin: "Booking cancelled by admin",
    admin_adjusted_punch_card_hours: "Manual punch card balance adjustment",
    bonus_hours_granted: "Bonus hours granted",
    deposit_completed_manually: "Deposit completed manually",
    branch_created: "Branch created",
    room_created: "Room created",
    clinic_signed_up: "Clinic signed up",
    invite_accepted: "Invite accepted",
    joined_via_public_link: "Joined via public link",
    overrun_charge_succeeded: "Overrun charge succeeded",
    overrun_charge_failed_suspended: "Overrun charge failed — suspended",
    overrun_recorded: "Overrun recorded",
    session_requested: "Session requested",
    session_approved: "Session approved",
    session_rejected: "Session rejected",
    session_created_by_admin: "Session created by admin",
    session_created_prepaid: "Session created (prepaid)",
    session_activated: "Session activated",
    session_activated_manually: "Session activated manually",
    session_cancellation_requested: "Session cancellation requested",
    session_term_ended_by_admin: "Session term ended by admin",
    session_term_renewed: "Session renewed",
    session_renewal_paid: "Session renewal paid",
    session_renewal_paid_manually: "Session renewal paid manually",
    session_renewal_failed: "Session renewal failed",
    session_materialization_conflict: "Conflict while creating session bookings",
    session_materialization_job_error: "Error in session bookings job",
    woo_purchase_claimed: "Store purchase matched to profile",
    clerk_user_deleted_webhook: "Clerk account deleted — identity unlinked",
    whatsapp_reminder_sent: "WhatsApp reminder sent",
    whatsapp_reminder_failed: "WhatsApp reminder failed",
    whatsapp_settings_updated: "WhatsApp settings updated",
    punch_card_issued_manually: "Punch card issued manually (paid outside the store)",
    room_block_created: "Room blocked",
    room_block_deleted: "Room block removed",
    booking_marked_completed: "Booking marked completed",
    booking_marked_no_show: "Booking marked no-show",
  },
};

export function getAdminAuditDict(locale: Locale) {
  return locale === "en" ? AUDIT_EN : AUDIT_HE;
}
