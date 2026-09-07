import "server-only";
import type { Locale } from "@/lib/i18n";

/**
 * בריחת HTML לכל טקסט שמקורו בקלט משתמש (למשל full_name) לפני הכנסה לגוף
 * מייל — מניעת הזרקת <img>/<a> (tracking pixel / פישינג) דרך שדות שאין
 * עליהם הגבלת אורך/תווים בהרשמה.
 */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * מעטפת HTML משותפת לכל המיילים — טבלאות (לא flexbox/grid) כי לקוחות מייל
 * לא תומכים ב-CSS מודרני. צבעי המותג (violet) של Cleana, לא של הקליניקה
 * השולחת — זה מייל של הפלטפורמה, לא של קליניקה ספציפית.
 *
 * locale (profiles.locale של הנמען/ת) קובע dir/lang/יישור וטקסט ה-footer.
 */
export function emailLayout(bodyHtml: string, previewText?: string, locale: Locale = "he"): string {
  const dir = locale === "he" ? "rtl" : "ltr";
  const align = locale === "he" ? "right" : "left";
  const footer =
    locale === "he"
      ? "נשלח אוטומטית ממערכת Cleana. לשאלות יש לפנות להנהלת הקליניקה שלך."
      : "Sent automatically by Cleana. For questions, contact your clinic management.";
  return `<!DOCTYPE html>
<html dir="${dir}" lang="${locale}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width" />
  <title>Cleana</title>
</head>
<body style="margin:0;padding:0;background:#f4f1fe;font-family:Arial,Helvetica,sans-serif;direction:${dir};">
  ${previewText ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${previewText}</div>` : ""}
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f1fe;padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e8eaf0;">
          <tr>
            <td style="background:#7a5af8;padding:20px 28px;">
              <span style="color:#ffffff;font-size:20px;font-weight:700;">Cleana</span>
            </td>
          </tr>
          <tr>
            <td style="padding:28px;color:#1b1e27;font-size:15px;line-height:1.75;text-align:${align};">
              ${bodyHtml}
            </td>
          </tr>
          <tr>
            <td style="padding:16px 28px;background:#f4f1fe;color:#6b7288;font-size:12px;text-align:${align};">
              ${footer}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function emailButton(url: string, label: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:20px 0;">
    <tr><td style="background:#7a5af8;border-radius:8px;">
      <a href="${url}" style="display:inline-block;padding:12px 24px;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;">${label}</a>
    </td></tr>
  </table>`;
}
