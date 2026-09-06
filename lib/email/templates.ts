import "server-only";
import { emailLayout, emailButton, escapeHtml } from "./layout";
import { formatDateHe, formatTimeHe, formatCurrencyILS, DEFAULT_TIMEZONE } from "@/lib/time";

export interface EmailContent {
  subject: string;
  html: string;
}

export function bookingConfirmedEmail(params: {
  roomName: string;
  branchName: string;
  startsAt: Date;
  endsAt: Date;
  accessStart: Date;
  accessEnd: Date;
  timezone?: string;
}): EmailContent {
  const tz = params.timezone ?? DEFAULT_TIMEZONE;
  return {
    subject: `אישור הזמנה — ${params.roomName}, ${formatDateHe(params.startsAt, tz)}`,
    html: emailLayout(`
      <p>ההזמנה שלך אושרה:</p>
      <p style="font-weight:700;font-size:17px;">${escapeHtml(params.roomName)} · ${escapeHtml(params.branchName)}</p>
      <p>${formatDateHe(params.startsAt, tz)}, ${formatTimeHe(params.startsAt, tz)}–${formatTimeHe(params.endsAt, tz)}</p>
      <p style="color:#6b7288;">🔑 כניסה בפועל: ${formatTimeHe(params.accessStart, tz)} · פינוי: ${formatTimeHe(params.accessEnd, tz)}</p>
      <p style="color:#6b7288;font-size:13px;">קובץ ICS מצורף — ניתן להוסיף ליומן.</p>
    `),
  };
}

export function bookingCancelledEmail(params: {
  roomName: string;
  startsAt: Date;
  hoursRefunded: boolean;
  timezone?: string;
}): EmailContent {
  const tz = params.timezone ?? DEFAULT_TIMEZONE;
  return {
    subject: `ההזמנה בוטלה — ${params.roomName}, ${formatDateHe(params.startsAt, tz)}`,
    html: emailLayout(`
      <p>ההזמנה הבאה בוטלה:</p>
      <p style="font-weight:700;">${escapeHtml(params.roomName)} · ${formatDateHe(params.startsAt, tz)}, ${formatTimeHe(params.startsAt, tz)}</p>
      <p>${params.hoursRefunded ? "השעות הוחזרו ליתרה שלך." : "הביטול בוצע בתוך 24 שעות מהמועד — השעות לא הוחזרו."}</p>
    `),
  };
}

export function punchCardPurchasedEmail(params: {
  hours: number;
  amountTotal: number;
  expiresAt: Date;
  invoiceUrl?: string | null;
}): EmailContent {
  return {
    subject: `כרטיסייה נרכשה — ${params.hours} שעות`,
    html: emailLayout(`
      <p>הכרטיסייה שלך פעילה:</p>
      <p style="font-weight:700;">${params.hours} שעות · תוקף עד ${formatDateHe(params.expiresAt)}</p>
      <p>סה״כ שולם: ${formatCurrencyILS(params.amountTotal)}</p>
      ${params.invoiceUrl ? emailButton(params.invoiceUrl, "לחשבונית") : ""}
    `),
  };
}

export function lowBalanceEmail(hoursRemaining: number): EmailContent {
  return {
    subject: "היתרה שלך עומדת להיגמר",
    html: emailLayout(`
      <p>נותרו לך <strong>${hoursRemaining} שעות</strong> בלבד ביתרה.</p>
      <p>מומלץ לרכוש כרטיסייה נוספת כדי לא להישאר בלי אפשרות להזמין.</p>
    `),
  };
}

export function cardExpiringEmail(expiresAt: Date, hoursRemaining: number): EmailContent {
  return {
    subject: "כרטיסייה עומדת לפוג בקרוב",
    html: emailLayout(`
      <p>הכרטיסייה שלך (${hoursRemaining} שעות נותרות) פגה בתאריך <strong>${formatDateHe(expiresAt)}</strong>.</p>
      <p>שעות שלא ינוצלו עד אז יאבדו.</p>
    `),
  };
}

export function sessionRequestedAdminEmail(params: {
  therapistName: string;
  weeklyHours: number;
  monthlyPrice: number;
}): EmailContent {
  return {
    subject: `בקשת ססיה חדשה — ${params.therapistName}`,
    html: emailLayout(`
      <p>התקבלה בקשת ססיה חדשה:</p>
      <p style="font-weight:700;">${escapeHtml(params.therapistName)} · ${params.weeklyHours} שעות שבועיות · ${formatCurrencyILS(params.monthlyPrice)}/חודש</p>
      <p>יש לבדוק זמינות ולאשר/לדחות בפאנל הניהול.</p>
    `),
  };
}

export function sessionApprovedEmail(paymentUrl: string): EmailContent {
  return {
    subject: "בקשת הססיה שלך אושרה",
    html: emailLayout(`
      <p>בקשת הססיה שלך אושרה. יש להשלים תשלום כדי לנעול את המשבצות.</p>
      ${emailButton(paymentUrl, "מעבר לתשלום")}
    `),
  };
}

export function sessionRenewalReminderEmail(params: {
  therapistName: string;
  weeklyHours: number;
  nextBillingDate: Date;
  forAdmin: boolean;
}): EmailContent {
  const intro = params.forAdmin
    ? `<p>המנוי של <strong>${escapeHtml(params.therapistName)}</strong> (${params.weeklyHours} שעות שבועיות) עומד להסתיים אם לא יחודש.</p>`
    : `<p>מנוי הססיה שלך (${params.weeklyHours} שעות שבועיות) עומד להסתיים.</p>`;
  return {
    subject: params.forAdmin ? `תזכורת חידוש ססיה — ${params.therapistName}` : "הססיה שלך עומדת להסתיים",
    html: emailLayout(`
      ${intro}
      <p style="font-weight:700;">תוקף עד ${formatDateHe(params.nextBillingDate)}</p>
      <p>${params.forAdmin ? "אם לא יחודש עד אז, המטפל/ת לא יוכל/תוכל לקבוע ססיות חדשות." : 'יש לחדש דרך "הססיות שלי" ב-Cleana עד לתאריך זה, אחרת לא ניתן יהיה לקבוע ססיות חדשות.'}</p>
    `),
  };
}

export function sessionRejectedEmail(reason: string): EmailContent {
  return {
    subject: "בקשת הססיה שלך נדחתה",
    html: emailLayout(`
      <p>לצערנו בקשת הססיה שלך לא אושרה.</p>
      <p style="font-weight:700;">סיבה: ${escapeHtml(reason)}</p>
      <p>ניתן לפנות להנהלת הקליניקה לבירור או להגיש בקשה חדשה.</p>
    `),
  };
}

export function sessionRenewedEmail(amountTotal: number, invoiceUrl?: string | null): EmailContent {
  return {
    subject: "חידוש מנוי ססיה",
    html: emailLayout(`
      <p>מנוי הססיה שלך חודש בהצלחה.</p>
      <p>סכום החיוב: ${formatCurrencyILS(amountTotal)}</p>
      ${invoiceUrl ? emailButton(invoiceUrl, "לחשבונית") : ""}
    `),
  };
}

export function paymentFailedEmail(params: { amountTotal: number; context: string }): EmailContent {
  return {
    subject: "חיוב נכשל",
    html: emailLayout(`
      <p>חיוב בסך ${formatCurrencyILS(params.amountTotal)} עבור ${escapeHtml(params.context)} נכשל.</p>
      <p>ייתכן שהחשבון יושעה עד להסדרת אמצעי התשלום. יש לפנות להנהלת הקליניקה במידת הצורך.</p>
    `),
  };
}

export function overrunRecordedEmail(params: {
  minutes: number;
  amount: number;
  source: "deposit" | "charge";
}): EmailContent {
  return {
    subject: "נרשמה חריגת זמן",
    html: emailLayout(`
      <p>נרשמה חריגה של ${params.minutes} דקות, בסך ${formatCurrencyILS(params.amount)}.</p>
      <p>${params.source === "deposit" ? "הסכום נוכה מהפיקדון." : "הסכום חויב באמצעי התשלום השמור."}</p>
    `),
  };
}

/** 🔴 שונה מהמקור בכוונה: ב-cleanasaas הלולאה per-subscription רצה בתוך
 * ה-RPC עצמו (materialize_session_bookings, plpgsql) ולא ב-JS — קונפליקט
 * נרשם ל-audit_log כ-sqlerrm גולמי לפי subscription_id, לא כ-room/time
 * ספציפיים כמו במקור. */
export function materializationConflictAdminEmail(params: { subscriptionId: string; detail: string }): EmailContent {
  return {
    subject: "🚨 שגיאה בשיבוץ אוטומטי של ססיה",
    html: emailLayout(`
      <p>ניסיון שיבוץ אוטומטי של ססיה נכשל:</p>
      <p style="font-weight:700;">מנוי ${params.subscriptionId}</p>
      <p style="color:#6b7288;font-family:monospace;font-size:13px;">${escapeHtml(params.detail)}</p>
      <p>נדרשת בדיקה ידנית בפאנל הניהול.</p>
    `),
  };
}

export function bookingReminderEmail(params: {
  roomName: string;
  branchName: string;
  startsAt: Date;
  accessStart: Date;
  timezone?: string;
}): EmailContent {
  const tz = params.timezone ?? DEFAULT_TIMEZONE;
  return {
    subject: `תזכורת — הזמנה מחר ב-${params.roomName}`,
    html: emailLayout(`
      <p>תזכורת להזמנה שלך מחר:</p>
      <p style="font-weight:700;">${escapeHtml(params.roomName)} · ${escapeHtml(params.branchName)}</p>
      <p>${formatDateHe(params.startsAt, tz)}, ${formatTimeHe(params.startsAt, tz)}</p>
      <p style="color:#6b7288;">🔑 כניסה בפועל: ${formatTimeHe(params.accessStart, tz)}</p>
    `),
  };
}

export function cronFailedAdminEmail(params: { jobName: string; detail: string }): EmailContent {
  return {
    subject: `🚨 משימת cron נכשלה — ${params.jobName}`,
    html: emailLayout(`
      <p>משימת ה-cron הבאה נכשלה ודורשת בדיקה:</p>
      <p style="font-weight:700;">${escapeHtml(params.jobName)}</p>
      <p style="color:#6b7288;font-family:monospace;font-size:13px;">${escapeHtml(params.detail)}</p>
    `),
  };
}

export function wooPurchaseReceivedEmail(params: { hours: number; registerUrl: string }): EmailContent {
  return {
    subject: `הרכישה שלך התקבלה — ${params.hours} שעות מחכות לך ב-Cleana`,
    html: emailLayout(`
      <p>תודה על הרכישה! כרטיסייה של <strong>${params.hours} שעות</strong> ממתינה לך.</p>
      <p>כדי להפעיל אותה, יש ליצור חשבון (או להתחבר, אם כבר יש לך אחד) באותה כתובת מייל או מספר טלפון שאיתם רכשת — הכרטיסייה תופעל אוטומטית עם ההרשמה.</p>
      ${emailButton(params.registerUrl, "יצירת חשבון / התחברות")}
    `),
  };
}

/** חדש (לא היה במקור, single-tenant) — מייל קבלת פנים לבעל/ת קליניקה חדשה
 * מיד אחרי signup_clinic. */
export function clinicWelcomeEmail(params: { clinicName: string; ownerName: string }): EmailContent {
  return {
    subject: `ברוך/ה הבא/ה ל-Cleana, ${params.ownerName}!`,
    html: emailLayout(`
      <p>שלום ${escapeHtml(params.ownerName)},</p>
      <p>הקליניקה <strong>${escapeHtml(params.clinicName)}</strong> נפתחה בהצלחה ב-Cleana.</p>
      <p>השלב הבא: הגדרת סניפים וחדרים, ואז הזמנת המטפלים שלך בקישור אחד מ"מטפלים" בפאנל הניהול.</p>
    `),
  };
}

/** חדש (לא היה במקור) — מייל לאדמיני/בעלי הקליניקה כשמטפל/ת חדש/ה מצטרף/ת,
 * דרך קישור הצטרפות פומבי או הזמנה אישית. */
export function therapistJoinedAdminEmail(params: { therapistName: string; role: "admin" | "therapist" }): EmailContent {
  const roleLabel = params.role === "admin" ? "אדמין/ית" : "מטפל/ת";
  return {
    subject: `${roleLabel} חדש/ה הצטרף/ה — ${params.therapistName}`,
    html: emailLayout(`
      <p><strong>${escapeHtml(params.therapistName)}</strong> הצטרף/ה לקליניקה שלך כ${roleLabel}.</p>
      <p>ניתן לראות ולנהל את הפרופיל שלו/ה תחת "מטפלים" בפאנל הניהול.</p>
    `),
  };
}
