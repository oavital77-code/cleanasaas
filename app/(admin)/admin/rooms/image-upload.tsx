"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ImagePlus, Loader2 } from "lucide-react";
import { useSupabaseClient } from "@/lib/supabase/client";
import { getAdminRoomsDict } from "@/lib/i18n";
import { useLocale } from "@/lib/i18n/context";
import {
  ALLOWED_IMAGE_TYPES,
  IMAGE_BUCKET,
  JPEG_QUALITY,
  MAX_IMAGE_BYTES,
  MAX_IMAGE_DIMENSION,
  extensionForMime,
  type ImageExt,
} from "@/lib/storage/images";
import {
  attachClinicImageAction,
  attachRoomImageAction,
  createClinicImageUploadUrlAction,
  createRoomImageUploadUrlAction,
} from "./actions";

// 🔴 הקובץ עולה ישירות מהדפדפן ל-Supabase Storage (signed upload URL), לא
// דרך Server Action — ר' ההערה ב-lib/storage/images.ts: גוף בקשה לפונקציית
// Vercel חסום ב-~4.5MB והבקשה נדחית לפני שהפעולה רצה (זה מה שהחזיר
// "server-side exception" בהעלאה מהנייד). כאן גם מכווצים לפני ההעלאה, כך
// שתמונה של 5MB מהטלפון הופכת ל-~300KB — מהיר יותר, וגם HEIC של אייפון
// מומר ל-JPEG ע"י ה-canvas.
type Prepared = { blob: Blob; ext: ImageExt; type: string };

async function prepareImage(file: File): Promise<Prepared | null> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_IMAGE_DIMENSION / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("no-2d-context");
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close?.();

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY));
    if (!blob) throw new Error("no-blob");
    return { blob, ext: "jpg", type: "image/jpeg" };
  } catch {
    // דפדפן שלא יודע לפענח את הפורמט (או canvas חסום) — מעלים כמו שהוא,
    // בתנאי שזה סוג ש-bucket מקבל ושהגודל בטווח.
    const ext = extensionForMime(file.type);
    if (!ext || file.size === 0 || file.size > MAX_IMAGE_BYTES) return null;
    return { blob: file, ext, type: file.type };
  }
}

export function ImageUpload({ roomId, compact = false }: { roomId?: string; compact?: boolean }) {
  const t = getAdminRoomsDict(useLocale());
  const router = useRouter();
  const supabase = useSupabaseClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [, startTransition] = useTransition();

  async function handleFile(file: File) {
    setError(null);
    setBusy(true);
    try {
      const prepared = await prepareImage(file);
      if (!prepared) {
        setError(t.imageNotices.image_invalid);
        return;
      }

      const ticket = roomId
        ? await createRoomImageUploadUrlAction(roomId, prepared.ext)
        : await createClinicImageUploadUrlAction(prepared.ext);
      if (ticket.error || !ticket.path || !ticket.token) {
        setError(t.imageNotices[ticket.error === "IMAGE_LIMIT" ? "image_limit" : "image_failed"]);
        return;
      }

      const { error: uploadError } = await supabase.storage
        .from(IMAGE_BUCKET)
        .uploadToSignedUrl(ticket.path, ticket.token, prepared.blob, { contentType: prepared.type });
      if (uploadError) {
        setError(t.imageNotices.image_failed);
        return;
      }

      const result = roomId
        ? await attachRoomImageAction(roomId, ticket.path)
        : await attachClinicImageAction(ticket.path);
      if (result.error) {
        setError(t.imageNotices[result.error === "IMAGE_LIMIT" ? "image_limit" : "image_failed"]);
        return;
      }

      if (inputRef.current) inputRef.current.value = "";
      startTransition(() => router.refresh());
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <label
        className={`inline-flex w-fit cursor-pointer items-center gap-2 rounded-button border border-border-strong px-3 font-semibold transition-colors hover:bg-subtle ${
          compact ? "h-9 text-xs" : "h-10 text-sm"
        } ${busy ? "pointer-events-none opacity-60" : ""}`}
      >
        {busy ? <Loader2 className="size-4 animate-spin" /> : <ImagePlus className="size-4" />}
        {busy ? t.uploading : t.uploadImage}
        <input
          ref={inputRef}
          type="file"
          className="sr-only"
          // 🔴 בלי heic/heif ברשימה: כשהיא מכילה רק jpeg/png/webp, ספארי
          // באייפון ממיר את התמונה מהגלריה ל-JPEG בעצמו. הוספת heic הייתה
          // גורמת לו להעביר קובץ HEIC גולמי שדפדפנים אחרים לא יודעים לפענח.
          accept={ALLOWED_IMAGE_TYPES.join(",")}
          disabled={busy}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleFile(file);
          }}
        />
      </label>
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}
