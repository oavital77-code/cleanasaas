// טוקנים משותפים לשתי רשתות הלוח (SlotGrid של המטפל/ת ו-AdminSlotGrid של
// האדמין), כדי ששורת הכותרת ועמודת השעה יתנהגו *בדיוק* אותו דבר בשני הצדדים.
//
// איך ה-sticky עובד כאן:
//   • הטבלה יושבת בתוך תיבת גלילה משלה (SCROLLBOX) שגוללת בשני הצירים.
//     בלי זה אי אפשר: הגלילה האנכית הייתה של הדף כולו, וה-sticky של תא
//     בטבלה נמדד מול ה-scroll container הקרוב ביותר — לא מול החלון.
//   • שורת הכותרת: top-0. עמודת השעה: start-0 (inset-inline-start, כלומר
//     ימין ב-RTL — שם באמת יושבת העמודה הראשונה).
//   • תא הפינה (כותרת "שעה") צריך את שניהם + z גבוה יותר משניהם.
//   • רקע אטום חובה על כל תא דביק, אחרת התוכן נגלל *מתחתיו* ונראה.
//   • הטבלה חייבת border-separate: עם border-collapse הגבולות שייכים לרשת
//     הטבלה ולא לתא, ולכן הם נשארים מאחור כשהתא נדבק ומתקבל קו כפול/חסר.

/** גובה תיבת הגלילה. dvh ולא vh — במובייל סרגל הדפדפן משנה את הגובה. */
export const SCROLLBOX = "overflow-auto overscroll-contain max-h-[calc(100dvh-13rem)] min-h-[18rem]";

/** רוחב מינימלי: עמודת השעה + רוחב סביר לכל עמודת תוכן. */
export const HOUR_COL_PX = 64;
export const MIN_COL_PX = 96;

const BORDER = "border-b border-border";

/** תא רגיל בגוף הטבלה. */
export const CELL_TD = `${BORDER} p-1`;

/** כותרת עמודה — נדבקת למעלה. */
export const STICKY_HEAD = `sticky top-0 z-20 ${BORDER} bg-muted`;

/** עמודת השעה בגוף הטבלה — נדבקת לצד. */
export const STICKY_HOUR = `sticky start-0 z-10 ${BORDER} bg-surface`;

/** תא הפינה — נדבק לשני הכיוונים, ולכן מעל שניהם. */
export const STICKY_CORNER = `sticky top-0 start-0 z-30 ${BORDER} bg-muted`;

/** גובה תא מגע: 44px במובייל, צפוף יותר בדסקטופ. */
export const CELL_HEIGHT = "h-11 md:h-8";
