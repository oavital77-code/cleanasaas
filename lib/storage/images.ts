// תמונות חדרים וקליניקה — bucket אחד (room-images, public מאז migration
// 20260907000005). הנתיבים תמיד מתחילים ב-clinic_id כדי להתאים למדיניות
// ה-storage הקיימת ({clinic_id}/rooms/{room_id}/{uuid}.ext,
// {clinic_id}/clinic/{uuid}.ext). ב-DB נשמר הנתיב בלבד (rooms.images,
// clinics.image_path) — ה-URL נבנה כאן, כך שהחלפת bucket/דומיין לא דורשת
// מיגרציית נתונים.
//
// 🔴 הקבצים עצמם **לא** עוברים דרך Server Action (ר' 10/09: המשתמש/ת קיבל/ה
// "server-side exception" בהעלאה מהנייד). ל-Vercel יש תקרה קשיחה של ~4.5MB
// לגוף בקשה לפונקציה — היא נאכפת לפני שהפעולה בכלל רצה, ולא ניתנת להגדלה
// מ-next.config. לכן: הדפדפן מכווץ את התמונה, מבקש signed upload URL
// (server action קטן, בלי הקובץ), מעלה ישירות ל-Supabase, ורק הנתיב חוזר
// לשרת. עלייה ישירה = גם מהיר יותר וגם בלי תקרה.

export const IMAGE_BUCKET = "room-images";
// תקרת ה-bucket עצמו (migration 20260907000005). אחרי הכיווץ בדפדפן קובץ
// טיפוסי הוא 200–500KB, אז זו רשת ביטחון בלבד.
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const MAX_ROOM_IMAGES = 6;
// הצלע הארוכה אחרי כיווץ. 1600px מספיק לתצוגה מלאה ולתמונות ממוזערות בלוח.
export const MAX_IMAGE_DIMENSION = 1600;
export const JPEG_QUALITY = 0.82;

export const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

const EXT_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export type ImageExt = "jpg" | "png" | "webp";

export function isImageExt(value: string): value is ImageExt {
  return value === "jpg" || value === "png" || value === "webp";
}

export function publicImageUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!base) return null;
  return `${base}/storage/v1/object/public/${IMAGE_BUCKET}/${path.split("/").map(encodeURIComponent).join("/")}`;
}

export function extensionForMime(type: string): ImageExt | null {
  const ext = EXT_BY_MIME[type];
  return ext && isImageExt(ext) ? ext : null;
}

export function roomImagePath(clinicId: string, roomId: string, ext: ImageExt) {
  return `${clinicId}/rooms/${roomId}/${crypto.randomUUID()}.${ext}`;
}

export function clinicImagePath(clinicId: string, ext: ImageExt) {
  return `${clinicId}/clinic/${crypto.randomUUID()}.${ext}`;
}

// הגנה: מוחקים/מצרפים רק נתיב ששייך לקליניקה הזו (הפעולות רצות עם service
// role, אז הבדיקה הזו היא הגבול). `..` נחסם כדי שלא ייצא מהתיקייה.
export function pathBelongsToClinic(path: string, clinicId: string) {
  return path.startsWith(`${clinicId}/`) && !path.includes("..");
}

export function isRoomImagePath(path: string, clinicId: string, roomId: string) {
  return pathBelongsToClinic(path, clinicId) && path.startsWith(`${clinicId}/rooms/${roomId}/`);
}

export function isClinicImagePath(path: string, clinicId: string) {
  return pathBelongsToClinic(path, clinicId) && path.startsWith(`${clinicId}/clinic/`);
}
