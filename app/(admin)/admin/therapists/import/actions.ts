"use server";

import { revalidatePath } from "next/cache";
import { readSheet } from "read-excel-file/node";
import { createClient } from "@/lib/supabase/server";
import { requireClinicAdmin } from "@/lib/auth/guards";
import { getAdminImportDict, normalizeLocale } from "@/lib/i18n";
import { MAX_IMPORT_ROWS, parseCsv, parseTherapistRows, type ParsedTherapistRow } from "@/lib/import/therapists";

// ייבוא מטפלים/ות — שני שלבים: (1) העלאת קובץ → פרסור + תצוגה מקדימה עם
// שגיאות פר שורה (כלום לא נכתב); (2) אישור → admin_import_therapists (RPC,
// SECURITY DEFINER, migration 20260907000005) עם השורות התקינות בלבד.
// השורות עוברות בין השלבים כ-JSON בשדה מוסתר — ה-RPC מוודא הכל שוב
// (פורמט, כפילויות, מכסת תוכנית), כך שהלקוח לא נסמך עליו.

export type ImportPreviewState = {
  step: "upload" | "preview" | "done";
  error?: string;
  fileName?: string;
  rows?: ParsedTherapistRow[];
  validCount?: number;
  result?: { inserted: number; skipped: number; errors: { line: number; message: string }[] };
};

const MAX_FILE_BYTES = 2 * 1024 * 1024;

export async function previewImportAction(_prev: ImportPreviewState, formData: FormData): Promise<ImportPreviewState> {
  const { profile } = await requireClinicAdmin();
  const t = getAdminImportDict(normalizeLocale(profile.locale));

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { step: "upload", error: t.errNoFile };
  if (file.size > MAX_FILE_BYTES) return { step: "upload", error: t.errFileTooLarge };

  const name = file.name.toLowerCase();
  let rows: unknown[][];
  try {
    if (name.endsWith(".xlsx")) {
      // הגיליון הראשון בלבד — זה מה שהתבנית וההנחיות מניחים.
      rows = await readSheet(Buffer.from(await file.arrayBuffer()));
    } else if (name.endsWith(".csv") || name.endsWith(".txt")) {
      rows = parseCsv(await file.text());
    } else {
      return { step: "upload", error: t.errUnsupportedType };
    }
  } catch {
    return { step: "upload", error: t.errUnreadable };
  }

  const parsed = parseTherapistRows(rows);
  if (!parsed.ok) {
    if (parsed.error === "EMPTY_FILE") return { step: "upload", error: t.errEmptyFile };
    return { step: "upload", error: t.errMissingColumns((parsed.missing ?? []).map((f) => t.fields[f]).join(", ")) };
  }
  if (parsed.rows.length >= MAX_IMPORT_ROWS) {
    return { step: "upload", error: t.errTooManyRows(MAX_IMPORT_ROWS) };
  }

  return { step: "preview", fileName: file.name, rows: parsed.rows, validCount: parsed.validCount };
}

export async function confirmImportAction(_prev: ImportPreviewState, formData: FormData): Promise<ImportPreviewState> {
  const { profile } = await requireClinicAdmin();
  const t = getAdminImportDict(normalizeLocale(profile.locale));
  const supabase = await createClient();

  let rows: ParsedTherapistRow[];
  try {
    rows = JSON.parse(String(formData.get("rows") ?? "[]")) as ParsedTherapistRow[];
  } catch {
    return { step: "preview", error: t.errUnreadable };
  }
  const valid = rows.filter((r) => Array.isArray(r.errors) && r.errors.length === 0);
  if (valid.length === 0) return { step: "preview", error: t.errNothingToImport };

  const { data, error } = await supabase.rpc("admin_import_therapists", {
    p_rows: valid.map((r) => ({
      full_name: r.full_name,
      phone: r.phone,
      email: r.email,
      hours: r.hours,
      profession: r.profession,
    })),
  });
  if (error) return { step: "preview", error: t.errImportFailed };

  const result = (data ?? {}) as { inserted?: number; skipped?: number; errors?: { row: number; code: string }[] };
  revalidatePath("/admin/therapists");
  return {
    step: "done",
    result: {
      inserted: result.inserted ?? 0,
      skipped: result.skipped ?? 0,
      // row ב-RPC = אינדקס בתוך המערך ששלחנו (1-based) → ממפים חזרה
      // למספר השורה המקורי בקובץ.
      errors: (result.errors ?? []).map((e) => ({
        line: valid[e.row - 1]?.line ?? e.row,
        message: t.rpcErrors[e.code] ?? e.code,
      })),
    },
  };
}
