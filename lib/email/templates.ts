import "server-only";
import { emailLayout, emailButton, escapeHtml } from "./layout";
import { formatDateHe, formatTimeHe, formatCurrencyILS, DEFAULT_TIMEZONE } from "@/lib/time";
import { type Locale, normalizeLocale } from "@/lib/i18n";

export interface EmailContent {
  subject: string;
  html: string;
}

// 🔴 i18n: כל מייל שמגיע למטפל/ת (או לבעל/ת קליניקה חדש/ה) מקבל `locale`
// — profiles.locale של הנמען/ת, מנורמל כאן. מיילים לקבוצת אדמינים,
// לסופר-אדמין (cron/materialization), ולנמען/ת לפני הרשמה (Woo) נשארים
// עברית: אין נמען/ת יחיד/ה עם העדפה, וזו שפת ההפעלה של הפלטפורמה.
// פורמט תאריך/מטבע נשאר dd/MM/yyyy ו-₪ בשתי השפות (מוסכמה, ר' lib/i18n).
function L(locale: string | null | undefined): Locale {
  return normalizeLocale(locale);
}

export function bookingConfirmedEmail(params: {
  roomName: string;
  branchName: string;
  startsAt: Date;
  endsAt: Date;
  accessStart: Date;
  accessEnd: Date;
  timezone?: string;
  locale?: string | null;
}): EmailContent {
  const tz = params.timezone ?? DEFAULT_TIMEZONE;
  const l = L(params.locale);
  const room = `${escapeHtml(params.roomName)} · ${escapeHtml(params.branchName)}`;
  const when = `${formatDateHe(params.startsAt, tz)}, ${formatTimeHe(params.startsAt, tz)}–${formatTimeHe(params.endsAt, tz)}`;
  const access = `${formatTimeHe(params.accessStart, tz)} · ${formatTimeHe(params.accessEnd, tz)}`;
  return l === "he"
    ? {
        subject: `אישור הזמנה — ${params.roomName}, ${formatDateHe(params.startsAt, tz)}`,
        html: emailLayout(`
      <p>ההזמנה שלך אושרה:</p>
      <p style="font-weight:700;font-size:17px;">${room}</p>
      <p>${when}</p>
      <p style="color:#6b7288;">🔑 כניסה בפועל: ${formatTimeHe(params.accessStart, tz)} · פינוי: ${formatTimeHe(params.accessEnd, tz)}</p>
      <p style="color:#6b7288;font-size:13px;">קובץ ICS מצורף — ניתן להוסיף ליומן.</p>
    `),
      }
    : {
        subject: `Booking confirmed — ${params.roomName}, ${formatDateHe(params.startsAt, tz)}`,
        html: emailLayout(
          `
      <p>Your booking is confirmed:</p>
      <p style="font-weight:700;font-size:17px;">${room}</p>
      <p>${when}</p>
      <p style="color:#6b7288;">🔑 Access from ${formatTimeHe(params.accessStart, tz)} · leave by ${formatTimeHe(params.accessEnd, tz)}</p>
      <p style="color:#6b7288;font-size:13px;">An ICS file is attached — add it to your calendar.</p>
    `,
          undefined,
          "en",
        ),
      };
  void access;
}

export function bookingCancelledEmail(params: {
  roomName: string;
  startsAt: Date;
  hoursRefunded: boolean;
  timezone?: string;
  locale?: string | null;
}): EmailContent {
  const tz = params.timezone ?? DEFAULT_TIMEZONE;
  const l = L(params.locale);
  const when = `${escapeHtml(params.roomName)} · ${formatDateHe(params.startsAt, tz)}, ${formatTimeHe(params.startsAt, tz)}`;
  if (l === "he") {
    return {
      subject: `ההזמנה בוטלה — ${params.roomName}, ${formatDateHe(params.startsAt, tz)}`,
      html: emailLayout(`
      <p>ההזמנה הבאה בוטלה:</p>
      <p style="font-weight:700;">${when}</p>
      <p>${params.hoursRefunded ? "השעות הוחזרו ליתרה שלך." : "הביטול בוצע בתוך 24 שעות מהמועד — השעות לא הוחזרו."}</p>
    `),
    };
  }
  return {
    subject: `Booking cancelled — ${params.roomName}, ${formatDateHe(params.startsAt, tz)}`,
    html: emailLayout(
      `
      <p>The following booking was cancelled:</p>
      <p style="font-weight:700;">${when}</p>
      <p>${params.hoursRefunded ? "The hours were returned to your balance." : "Cancelled within 24 hours of the start time — the hours were not refunded."}</p>
    `,
      undefined,
      "en",
    ),
  };
}

export function punchCardPurchasedEmail(params: {
  hours: number;
  amountTotal: number;
  expiresAt: Date;
  invoiceUrl?: string | null;
  locale?: string | null;
}): EmailContent {
  const l = L(params.locale);
  if (l === "he") {
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
  return {
    subject: `Punch card purchased — ${params.hours} hours`,
    html: emailLayout(
      `
      <p>Your punch card is active:</p>
      <p style="font-weight:700;">${params.hours} hours · valid until ${formatDateHe(params.expiresAt)}</p>
      <p>Total paid: ${formatCurrencyILS(params.amountTotal)}</p>
      ${params.invoiceUrl ? emailButton(params.invoiceUrl, "Invoice") : ""}
    `,
      undefined,
      "en",
    ),
  };
}

export function lowBalanceEmail(hoursRemaining: number, locale?: string | null): EmailContent {
  if (L(locale) === "he") {
    return {
      subject: "היתרה שלך עומדת להיגמר",
      html: emailLayout(`
      <p>נותרו לך <strong>${hoursRemaining} שעות</strong> בלבד ביתרה.</p>
      <p>מומלץ לרכוש כרטיסייה נוספת כדי לא להישאר בלי אפשרות להזמין.</p>
    `),
    };
  }
  return {
    subject: "Your balance is running out",
    html: emailLayout(
      `
      <p>Only <strong>${hoursRemaining} hours</strong> are left in your balance.</p>
      <p>We recommend buying another punch card so you can keep booking.</p>
    `,
      undefined,
      "en",
    ),
  };
}

export function cardExpiringEmail(expiresAt: Date, hoursRemaining: number, locale?: string | null): EmailContent {
  if (L(locale) === "he") {
    return {
      subject: "כרטיסייה עומדת לפוג בקרוב",
      html: emailLayout(`
      <p>הכרטיסייה שלך (${hoursRemaining} שעות נותרות) פגה בתאריך <strong>${formatDateHe(expiresAt)}</strong>.</p>
      <p>שעות שלא ינוצלו עד אז יאבדו.</p>
    `),
    };
  }
  return {
    subject: "Your punch card is about to expire",
    html: emailLayout(
      `
      <p>Your punch card (${hoursRemaining} hours left) expires on <strong>${formatDateHe(expiresAt)}</strong>.</p>
      <p>Hours not used by then will be lost.</p>
    `,
      undefined,
      "en",
    ),
  };
}

/** לקבוצת אדמיני הקליניקה — עברית (ר' הערה למעלה). */
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

export function sessionApprovedEmail(paymentUrl: string, locale?: string | null): EmailContent {
  if (L(locale) === "he") {
    return {
      subject: "בקשת הססיה שלך אושרה",
      html: emailLayout(`
      <p>בקשת הססיה שלך אושרה. יש להשלים תשלום כדי לנעול את המשבצות.</p>
      ${emailButton(paymentUrl, "מעבר לתשלום")}
    `),
    };
  }
  return {
    subject: "Your session request was approved",
    html: emailLayout(
      `
      <p>Your session request was approved. Complete the payment to lock in your slots.</p>
      ${emailButton(paymentUrl, "Go to payment")}
    `,
      undefined,
      "en",
    ),
  };
}

export function sessionRenewalReminderEmail(params: {
  therapistName: string;
  weeklyHours: number;
  nextBillingDate: Date;
  forAdmin: boolean;
  locale?: string | null;
}): EmailContent {
  // גרסת האדמין תמיד בעברית (קבוצת נמענים); גרסת המטפל/ת לפי locale.
  if (params.forAdmin || L(params.locale) === "he") {
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
  return {
    subject: "Your session is about to end",
    html: emailLayout(
      `
      <p>Your session subscription (${params.weeklyHours} weekly hours) is about to end.</p>
      <p style="font-weight:700;">Valid until ${formatDateHe(params.nextBillingDate)}</p>
      <p>Renew it under "My Sessions" in Cleana by that date, otherwise new sessions cannot be scheduled.</p>
    `,
      undefined,
      "en",
    ),
  };
}

export function sessionRejectedEmail(reason: string, locale?: string | null): EmailContent {
  if (L(locale) === "he") {
    return {
      subject: "בקשת הססיה שלך נדחתה",
      html: emailLayout(`
      <p>לצערנו בקשת הססיה שלך לא אושרה.</p>
      <p style="font-weight:700;">סיבה: ${escapeHtml(reason)}</p>
      <p>ניתן לפנות להנהלת הקליניקה לבירור או להגיש בקשה חדשה.</p>
    `),
    };
  }
  return {
    subject: "Your session request was declined",
    html: emailLayout(
      `
      <p>Unfortunately your session request was not approved.</p>
      <p style="font-weight:700;">Reason: ${escapeHtml(reason)}</p>
      <p>You can contact the clinic management or submit a new request.</p>
    `,
      undefined,
      "en",
    ),
  };
}

export function sessionRenewedEmail(amountTotal: number, invoiceUrl?: string | null, locale?: string | null): EmailContent {
  if (L(locale) === "he") {
    return {
      subject: "חידוש מנוי ססיה",
      html: emailLayout(`
      <p>מנוי הססיה שלך חודש בהצלחה.</p>
      <p>סכום החיוב: ${formatCurrencyILS(amountTotal)}</p>
      ${invoiceUrl ? emailButton(invoiceUrl, "לחשבונית") : ""}
    `),
    };
  }
  return {
    subject: "Session subscription renewed",
    html: emailLayout(
      `
      <p>Your session subscription was renewed successfully.</p>
      <p>Amount charged: ${formatCurrencyILS(amountTotal)}</p>
      ${invoiceUrl ? emailButton(invoiceUrl, "Invoice") : ""}
    `,
      undefined,
      "en",
    ),
  };
}

export function paymentFailedEmail(params: { amountTotal: number; context: string; locale?: string | null }): EmailContent {
  if (L(params.locale) === "he") {
    return {
      subject: "חיוב נכשל",
      html: emailLayout(`
      <p>חיוב בסך ${formatCurrencyILS(params.amountTotal)} עבור ${escapeHtml(params.context)} נכשל.</p>
      <p>ייתכן שהחשבון יושעה עד להסדרת אמצעי התשלום. יש לפנות להנהלת הקליניקה במידת הצורך.</p>
    `),
    };
  }
  return {
    subject: "Payment failed",
    html: emailLayout(
      `
      <p>A charge of ${formatCurrencyILS(params.amountTotal)} for ${escapeHtml(params.context)} failed.</p>
      <p>Your account may be suspended until the payment method is resolved. Contact the clinic management if needed.</p>
    `,
      undefined,
      "en",
    ),
  };
}

export function overrunRecordedEmail(params: {
  minutes: number;
  amount: number;
  source: "deposit" | "charge";
  locale?: string | null;
}): EmailContent {
  if (L(params.locale) === "he") {
    return {
      subject: "נרשמה חריגת זמן",
      html: emailLayout(`
      <p>נרשמה חריגה של ${params.minutes} דקות, בסך ${formatCurrencyILS(params.amount)}.</p>
      <p>${params.source === "deposit" ? "הסכום נוכה מהפיקדון." : "הסכום חויב באמצעי התשלום השמור."}</p>
    `),
    };
  }
  return {
    subject: "Overrun recorded",
    html: emailLayout(
      `
      <p>An overrun of ${params.minutes} minutes was recorded, totaling ${formatCurrencyILS(params.amount)}.</p>
      <p>${params.source === "deposit" ? "The amount was deducted from your deposit." : "The amount was charged to your saved payment method."}</p>
    `,
      undefined,
      "en",
    ),
  };
}

/** לסופר-אדמין — עברית. 🔴 שונה מהמקור בכוונה: ב-cleanasaas הלולאה
 * per-subscription רצה בתוך ה-RPC עצמו (materialize_session_bookings,
 * plpgsql) ולא ב-JS — קונפליקט נרשם ל-audit_log כ-sqlerrm גולמי לפי
 * subscription_id, לא כ-room/time ספציפיים כמו במקור. */
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
  locale?: string | null;
}): EmailContent {
  const tz = params.timezone ?? DEFAULT_TIMEZONE;
  const room = `${escapeHtml(params.roomName)} · ${escapeHtml(params.branchName)}`;
  if (L(params.locale) === "he") {
    return {
      subject: `תזכורת — הזמנה מחר ב-${params.roomName}`,
      html: emailLayout(`
      <p>תזכורת להזמנה שלך מחר:</p>
      <p style="font-weight:700;">${room}</p>
      <p>${formatDateHe(params.startsAt, tz)}, ${formatTimeHe(params.startsAt, tz)}</p>
      <p style="color:#6b7288;">🔑 כניסה בפועל: ${formatTimeHe(params.accessStart, tz)}</p>
    `),
    };
  }
  return {
    subject: `Reminder — booking tomorrow at ${params.roomName}`,
    html: emailLayout(
      `
      <p>A reminder of your booking tomorrow:</p>
      <p style="font-weight:700;">${room}</p>
      <p>${formatDateHe(params.startsAt, tz)}, ${formatTimeHe(params.startsAt, tz)}</p>
      <p style="color:#6b7288;">🔑 Access from ${formatTimeHe(params.accessStart, tz)}</p>
    `,
      undefined,
      "en",
    ),
  };
}

/** לסופר-אדמין — עברית. */
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

/** לנמען/ת שעדיין אין לו/ה פרופיל (רכישה בחנות לפני הרשמה) — עברית. */
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

/** מייל קבלת פנים לבעל/ת קליניקה חדש/ה מיד אחרי signup_clinic — לפי
 * profiles.locale של הבעלים (ברירת המחדל ב-DB היא en). */
export function clinicWelcomeEmail(params: { clinicName: string; ownerName: string; locale?: string | null }): EmailContent {
  if (L(params.locale) === "he") {
    return {
      subject: `ברוך/ה הבא/ה ל-Cleana, ${params.ownerName}!`,
      html: emailLayout(`
      <p>שלום ${escapeHtml(params.ownerName)},</p>
      <p>הקליניקה <strong>${escapeHtml(params.clinicName)}</strong> נפתחה בהצלחה ב-Cleana.</p>
      <p>השלב הבא: הגדרת סניפים וחדרים, ואז הזמנת המטפלים שלך בקישור אחד מ"מטפלים" בפאנל הניהול.</p>
    `),
    };
  }
  return {
    subject: `Welcome to Cleana, ${params.ownerName}!`,
    html: emailLayout(
      `
      <p>Hello ${escapeHtml(params.ownerName)},</p>
      <p>The clinic <strong>${escapeHtml(params.clinicName)}</strong> was created successfully in Cleana.</p>
      <p>Next step: set up branches and rooms, then invite your therapists with a single link from "Therapists" in the admin panel.</p>
    `,
      undefined,
      "en",
    ),
  };
}

/** לקבוצת אדמיני הקליניקה — עברית. */
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
