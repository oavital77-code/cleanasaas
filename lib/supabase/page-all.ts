/**
 * שליפה מלאה בעמודים, במקום שאילתה אחת בלי גבול.
 *
 * 🔴 PostgREST של סופאבייס חותך תשובות ב-`db-max-rows` (1000 כברירת מחדל)
 * *בלי לומר כלום*. שאילתה בלי `.range()` על טבלה שממשיכה לגדול — למשל כל
 * התשלומים של הפלטפורמה — פשוט מפסיקה להחזיר את הכול, וסכום ההכנסות בדשבורד
 * הבעלים מתחיל להיות קטן מהאמת בשקט. כאן מביאים עמוד אחר עמוד עד שעמוד חוזר
 * חלקי, ואם יש יותר מ-MAX_PAGES — נכשלים בקול במקום להציג מספר שגוי.
 */
const PAGE_SIZE = 1000;
const MAX_PAGES = 100;

type Page<T> = { data: T[] | null; error: { message: string } | null };

export type PageAllResult<T> = { ok: true; rows: T[] } | { ok: false; reason: string };

export async function pageAll<T>(
  query: (from: number, to: number) => PromiseLike<Page<T>>,
  options: { pageSize?: number; maxPages?: number } = {},
): Promise<PageAllResult<T>> {
  const pageSize = options.pageSize ?? PAGE_SIZE;
  const maxPages = options.maxPages ?? MAX_PAGES;
  const rows: T[] = [];

  for (let page = 0; page < maxPages; page++) {
    const from = page * pageSize;
    const { data, error } = await query(from, from + pageSize - 1);
    if (error) return { ok: false, reason: error.message };
    const batch = data ?? [];
    rows.push(...batch);
    if (batch.length < pageSize) return { ok: true, rows };
  }

  return { ok: false, reason: `יותר מ-${maxPages * pageSize} שורות — צריך סיכום ב-DB במקום שליפה מלאה` };
}
