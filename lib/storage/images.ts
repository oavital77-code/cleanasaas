// תמונות חדרים וקליניקה — bucket אחד (room-images, public מאז migration
// 20260907000005). הנתיבים תמיד מתחילים ב-clinic_id כדי להתאים למדיניות
// ה-storage הקיימת ({clinic_id}/rooms/{room_id}/{uuid}.ext,
// {clinic_id}/clinic/{uuid}.ext). ב-DB נשמר הנתיב בלבד (rooms.images,
// clinics.image_path) — ה-URL נבנה כאן, כך שהחלפת bucket/דומיין לא דורשת
// מיגרציית נתונים.

export const IMAGE_BUCKET = "room-images";
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const MAX_ROOM_IMAGES = 6;

const EXT_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export function publicImageUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!base) return null;
  return `${base}/storage/v1/object/public/${IMAGE_BUCKET}/${path.split("/").map(encodeURIComponent).join("/")}`;
}

// מחזיר סיומת לפי ה-MIME המוצהר, או null אם הקובץ לא מתקבל (סוג/גודל).
// ה-bucket עצמו אוכף את אותן מגבלות (allowed_mime_types, file_size_limit)
// — כאן רק כדי להחזיר הודעה ידידותית לפני ההעלאה.
export function imageExtensionFor(file: { type: string; size: number }): string | null {
  if (file.size <= 0 || file.size > MAX_IMAGE_BYTES) return null;
  return EXT_BY_MIME[file.type] ?? null;
}

export function roomImagePath(clinicId: string, roomId: string, ext: string) {
  return `${clinicId}/rooms/${roomId}/${crypto.randomUUID()}.${ext}`;
}

export function clinicImagePath(clinicId: string, ext: string) {
  return `${clinicId}/clinic/${crypto.randomUUID()}.${ext}`;
}

// הגנה: מוחקים/מסירים רק נתיב ששייך לקליניקה הזו (כל הפעולות עוברות דרך
// service role, אז הבדיקה הזו היא הגבול).
export function pathBelongsToClinic(path: string, clinicId: string) {
  return path.startsWith(`${clinicId}/`) && !path.includes("..");
}
