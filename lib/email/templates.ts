import "server-only";
import { emailLayout, emailButton, escapeHtml } from "./layout";
import { formatDateHe, formatTimeHe, formatCurrencyILS, reminderLead, DEFAULT_TIMEZONE } from "@/lib/time";
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
        subject: `ההזמנה אושרה: ${params.roomName}, ${formatDateHe(params.startsAt, tz)}`,
        html: emailLayout(`
      <p>ההזמנה שלך אושרה:</p>
      <p style="font-weight:700;font-size:17px;">${room}</p>
      <p>${when}</p>
      <p style="color:#6b7288;">🔑 אפשר להיכנס מ-${formatTimeHe(params.accessStart, tz)} · לפנות את החדר עד ${formatTimeHe(params.accessEnd, tz)}</p>
      <p style="color:#6b7288;font-size:13px;">צירפנו קובץ שאפשר להוסיף ליומן.</p>
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
      subject: `ההזמנה בוטלה: ${params.roomName}, ${formatDateHe(params.startsAt, tz)}`,
      html: emailLayout(`
      <p>ההזמנה הזו בוטלה:</p>
      <p style="font-weight:700;">${when}</p>
      <p>${params.hoursRefunded ? "השעות הוחזרו ליתרה שלך." : "הביטול היה פחות מ-24 שעות לפני המועד, ולכן השעות לא הוחזרו."}</p>
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
      subject: `הכרטיסייה שלך מוכנה: ${params.hours} שעות`,
      html: emailLayout(`
      <p>הכרטיסייה שלך פעילה:</p>
      <p style="font-weight:700;">${params.hours} שעות · בתוקף עד ${formatDateHe(params.expiresAt)}</p>
      <p>שולם: ${formatCurrencyILS(params.amountTotal)}</p>
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
      subject: "השעות שלך עומדות להיגמר",
      html: emailLayout(`
      <p>נשארו לך רק <strong>${hoursRemaining} שעות</strong>.</p>
      <p>כדאי לרכוש כרטיסייה חדשה מהקליניקה, כדי שתוכלו להמשיך להזמין חדרים בלי הפסקה.</p>
    `),
    };
  }
  return {
    subject: "Your balance is running out",
    html: emailLayout(
      `
      <p>Only <strong>${hoursRemaining} hours</strong> are left in your balance.</p>
      <p>We recommend buying another punch card from your clinic so you can keep booking.</p>
    `,
      undefined,
      "en",
    ),
  };
}

export function cardExpiringEmail(expiresAt: Date, hoursRemaining: number, locale?: string | null): EmailContent {
  if (L(locale) === "he") {
    return {
      subject: "הכרטיסייה שלך תפוג בקרוב",
      html: emailLayout(`
      <p>בכרטיסייה שלך נשארו ${hoursRemaining} שעות, והיא בתוקף עד <strong>${formatDateHe(expiresAt)}</strong>.</p>
      <p>שעות שלא ינוצלו עד אז לא יעברו הלאה.</p>
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
    subject: `בקשת ססיה חדשה מ${params.therapistName}`,
    html: emailLayout(`
      <p>התקבלה בקשת ססיה חדשה:</p>
      <p style="font-weight:700;">${escapeHtml(params.therapistName)} · ${params.weeklyHours} שעות בשבוע · ${formatCurrencyILS(params.monthlyPrice)} לחודש</p>
      <p>אפשר לבדוק אם החדרים פנויים ולאשר או לדחות את הבקשה במסך הניהול.</p>
    `),
  };
}

/**
 * מצב ידני (24.9.2026): אין לינק לתשלום. המטפל/ת משלם/ת לקליניקה לפי
 * ההוראות שהיא כתבה בהגדרות, והקליניקה רושמת את התשלום — ואז הססיה נפתחת.
 */
export function sessionApprovedEmail(params: { instructions: string | null; locale?: string | null }): EmailContent {
  const how = (label: string) =>
    params.instructions
      ? `<p style="color:#6b7288;margin-top:12px;">${label}</p><p style="white-space:pre-wrap;">${escapeHtml(params.instructions)}</p>`
      : "";
  if (L(params.locale) === "he") {
    return {
      subject: "בקשת הססיה שלך אושרה",
      html: emailLayout(`
      <p>בקשת הססיה שלך אושרה. התשלום הוא ישירות לקליניקה, וברגע שהקליניקה רושמת אותו, הססיה נפתחת והשעות נשמרות לך.</p>
      ${how("איך משלמים:")}
    `),
    };
  }
  return {
    subject: "Your session request was approved",
    html: emailLayout(
      `
      <p>Your session request was approved. Pay the clinic directly; as soon as the payment is recorded, the session opens and your slots are locked in.</p>
      ${how("How to pay:")}
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
      ? `<p>הססיה של <strong>${escapeHtml(params.therapistName)}</strong> (${params.weeklyHours} שעות בשבוע) תסתיים אם לא תחודש.</p>`
      : `<p>הססיה שלך (${params.weeklyHours} שעות בשבוע) עומדת להסתיים.</p>`;
    return {
      subject: params.forAdmin ? `תזכורת לחידוש ססיה: ${params.therapistName}` : "הססיה שלך עומדת להסתיים",
      html: emailLayout(`
      ${intro}
      <p style="font-weight:700;">בתוקף עד ${formatDateHe(params.nextBillingDate)}</p>
      <p>${params.forAdmin ? "אם התשלום לא יגיע עד אז, השעות הקבועות לא יישמרו למטפל. כשהתשלום מגיע, רושמים אותו ברשימת הססיות." : "כדי להמשיך, צריך לשלם לקליניקה עד התאריך הזה. אחרת השעות הקבועות שלך לא יישמרו."}</p>
    `),
    };
  }
  return {
    subject: "Your session is about to end",
    html: emailLayout(
      `
      <p>Your session subscription (${params.weeklyHours} weekly hours) is about to end.</p>
      <p style="font-weight:700;">Valid until ${formatDateHe(params.nextBillingDate)}</p>
      <p>Settle the payment with your clinic by that date, otherwise new sessions cannot be scheduled.</p>
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
      <p>לצערנו, בקשת הססיה שלך לא אושרה.</p>
      <p style="font-weight:700;">הסיבה: ${escapeHtml(reason)}</p>
      <p>אפשר לפנות להנהלת הקליניקה לפרטים, או לשלוח בקשה חדשה.</p>
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
      subject: "הססיה שלך חודשה",
      html: emailLayout(`
      <p>הססיה שלך חודשה לחודש נוסף.</p>
      <p>שולם: ${formatCurrencyILS(amountTotal)}</p>
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
      subject: "החיוב לא עבר",
      html: emailLayout(`
      <p>החיוב על סך ${formatCurrencyILS(params.amountTotal)} עבור ${escapeHtml(params.context)} לא עבר.</p>
      <p>ייתכן שהחשבון יושהה עד שהתשלום יוסדר. לפרטים אפשר לפנות להנהלת הקליניקה.</p>
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
      subject: "נרשמה חריגה מהזמן",
      html: emailLayout(`
      <p>נרשמה חריגה של ${params.minutes} דקות מזמן ההזמנה, בסך ${formatCurrencyILS(params.amount)}.</p>
      <p>${params.source === "deposit" ? "הסכום ירד מהפיקדון." : "הסכום ממתין לתשלום לקליניקה."}</p>
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
    subject: "🚨 תקלה בשיבוץ האוטומטי של ססיה",
    html: emailLayout(`
      <p>השיבוץ האוטומטי של ססיה לא הצליח:</p>
      <p style="font-weight:700;">מנוי ${params.subscriptionId}</p>
      <p style="color:#6b7288;font-family:monospace;font-size:13px;">${escapeHtml(params.detail)}</p>
      <p>צריך לבדוק את זה במסך הניהול.</p>
    `),
  };
}

export function bookingReminderEmail(params: {
  roomName: string;
  branchName: string;
  startsAt: Date;
  accessStart: Date;
  /** רגע השליחה — קובע אם ההזמנה היא "מחר", "היום" או "עוד מעט". */
  now: Date;
  timezone?: string;
  locale?: string | null;
}): EmailContent {
  const tz = params.timezone ?? DEFAULT_TIMEZONE;
  const room = `${escapeHtml(params.roomName)} · ${escapeHtml(params.branchName)}`;
  const lead = reminderLead(params.startsAt, params.now, tz);
  const when = `${formatDateHe(params.startsAt, tz)}, ${formatTimeHe(params.startsAt, tz)}`;
  if (L(params.locale) === "he") {
    const whenWord = { soon: "עוד מעט", today: "היום", tomorrow: "מחר", later: formatDateHe(params.startsAt, tz) }[lead];
    return {
      subject: `תזכורת: הזמנה ${whenWord} ב${params.roomName}`,
      html: emailLayout(`
      <p>תזכורת להזמנה שלך ${whenWord}:</p>
      <p style="font-weight:700;">${room}</p>
      <p>${when}</p>
      <p style="color:#6b7288;">🔑 אפשר להיכנס מ-${formatTimeHe(params.accessStart, tz)}</p>
    `),
    };
  }
  const whenWord = { soon: "shortly", today: "today", tomorrow: "tomorrow", later: `on ${formatDateHe(params.startsAt, tz)}` }[lead];
  return {
    subject: `Reminder — booking ${whenWord} at ${params.roomName}`,
    html: emailLayout(
      `
      <p>A reminder of your booking ${whenWord}:</p>
      <p style="font-weight:700;">${room}</p>
      <p>${when}</p>
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

/**
 * פנייה חדשה מדף הנחיתה, לסופר-אדמיני הפלטפורמה — עברית.
 *
 * הליד כבר נשמר ב-platform_leads לפני שהמייל נשלח, ולכן כישלון שליחה לא
 * מאבד אותו; המייל הוא ההתראה, לא האחסון.
 */
export function newLeadEmail(params: {
  name: string;
  phone: string;
  email: string | null;
  clinicName: string | null;
  message: string | null;
  source: string;
}): EmailContent {
  const row = (label: string, value: string | null) =>
    value ? `<p style="margin:4px 0;"><span style="color:#6b7288;">${label}:</span> <strong>${escapeHtml(value)}</strong></p>` : "";
  return {
    subject: `פנייה חדשה מ-${params.source}: ${params.name}`,
    html: emailLayout(`
      <p>התקבלה פנייה חדשה מדף הנחיתה:</p>
      ${row("שם", params.name)}
      ${row("טלפון", params.phone)}
      ${row("מייל", params.email)}
      ${row("קליניקה", params.clinicName)}
      ${params.message ? `<p style="margin-top:12px;color:#6b7288;">הודעה:</p><p style="white-space:pre-wrap;">${escapeHtml(params.message)}</p>` : ""}
      <p style="color:#6b7288;font-size:13px;margin-top:16px;">הפנייה שמורה גם בדשבורד הבעלים.</p>
    `),
  };
}

/** לנמען/ת שעדיין אין לו/ה פרופיל (רכישה בחנות לפני הרשמה) — עברית. */
export function wooPurchaseReceivedEmail(params: { hours: number; registerUrl: string }): EmailContent {
  return {
    subject: `הרכישה שלך התקבלה — ${params.hours} שעות מחכות לך ב-Cleana`,
    html: emailLayout(`
      <p>תודה על הרכישה! כרטיסייה של <strong>${params.hours} שעות</strong> מחכה לך.</p>
      <p>כדי להפעיל אותה, צריך להירשם (או להיכנס, אם כבר יש לך חשבון) עם אותו מייל או טלפון שאיתם רכשת. הכרטיסייה תופעל אוטומטית.</p>
      ${emailButton(params.registerUrl, "להרשמה או כניסה")}
    `),
  };
}

/** מייל קבלת פנים לבעל/ת קליניקה חדש/ה מיד אחרי signup_clinic — לפי
 * profiles.locale של הבעלים (ברירת המחדל ב-DB היא en). */
export function clinicWelcomeEmail(params: { clinicName: string; ownerName: string; locale?: string | null }): EmailContent {
  if (L(params.locale) === "he") {
    return {
      subject: `${params.ownerName}, הקליניקה שלך ב-Cleana מוכנה`,
      html: emailLayout(`
      <p>שלום ${escapeHtml(params.ownerName)},</p>
      <p>הקליניקה <strong>${escapeHtml(params.clinicName)}</strong> נפתחה ב-Cleana.</p>
      <p>מה עכשיו? מגדירים סניפים וחדרים, ואז שולחים למטפלים את קישור ההצטרפות שנמצא במסך "מטפלים".</p>
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
  const roleLabel = params.role === "admin" ? "מנהל" : "מטפל";
  return {
    subject: `הצטרפות חדשה לקליניקה: ${params.therapistName}`,
    html: emailLayout(`
      <p>הצטרפות חדשה לקליניקה: <strong>${escapeHtml(params.therapistName)}</strong>, בתור ${roleLabel}.</p>
      <p>את הפרטים אפשר לראות ולערוך במסך "מטפלים".</p>
    `),
  };
}

// ═══ מנוי הפלטפורמה (PayPlus) — לבעלי/אדמיני הקליניקה ═══

export function platformSubscriptionActivatedEmail(params: {
  clinicName: string;
  amount: number;
  periodEnd: Date | null;
  locale?: string | null;
}): EmailContent {
  const until = params.periodEnd ? formatDateHe(params.periodEnd) : null;
  if (L(params.locale) === "he") {
    return {
      subject: `המנוי של ${params.clinicName} ב-Cleana פעיל`,
      html: emailLayout(`
      <p>התשלום על המנוי של <strong>${escapeHtml(params.clinicName)}</strong> עבר בהצלחה: ${formatCurrencyILS(params.amount)}.</p>
      <p>${until ? `החיוב הבא יהיה ב-${until}. ` : ""}אפשר לבטל בכל זמן ממסך "המנוי ל-Cleana", והביטול נכנס לתוקף בסוף התקופה ששולמה.</p>
      <p>החשבונית תישלח אליכם בנפרד ממערכת הסליקה.</p>
    `),
    };
  }
  return {
    subject: `${params.clinicName}'s Cleana subscription is active`,
    html: emailLayout(
      `
      <p>The subscription payment for <strong>${escapeHtml(params.clinicName)}</strong> went through: ${formatCurrencyILS(params.amount)}.</p>
      <p>${until ? `The next charge is on ${until}. ` : ""}You can cancel any time from "Subscription" in the admin panel — it takes effect at the end of the paid period.</p>
      <p>The invoice/receipt is sent separately by the payment provider.</p>
    `,
      undefined,
      "en",
    ),
  };
}

export function platformPaymentFailedEmail(params: { clinicName: string; graceDays: number; locale?: string | null }): EmailContent {
  if (L(params.locale) === "he") {
    return {
      subject: `התשלום על המנוי של ${params.clinicName} לא עבר`,
      html: emailLayout(`
      <p>לא הצלחנו לחייב את המנוי של <strong>${escapeHtml(params.clinicName)}</strong> ב-Cleana.</p>
      <p>הקליניקה תמשיך לעבוד כרגיל עוד ${params.graceDays} ימים. אחר כך לא יהיה אפשר ליצור הזמנות חדשות עד שהתשלום יוסדר. ההזמנות הקיימות לא נמחקות.</p>
      <p>כדי להסדיר את התשלום: מסך הניהול ← "המנוי ל-Cleana" ← "הפעלת מנוי".</p>
    `),
    };
  }
  return {
    subject: `The subscription payment for ${params.clinicName} did not go through`,
    html: emailLayout(
      `
      <p>We could not charge the Cleana subscription for <strong>${escapeHtml(params.clinicName)}</strong>.</p>
      <p>The clinic keeps working for ${params.graceDays} more days. After that, new bookings are blocked until the payment is settled — existing bookings are not deleted.</p>
      <p>To settle: admin panel → "Subscription" → "Activate subscription".</p>
    `,
      undefined,
      "en",
    ),
  };
}
