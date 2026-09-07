"use client";

import { useState, useTransition } from "react";
import { X } from "lucide-react";
import {
  SCROLLBOX,
  HOUR_COL_PX,
  MIN_COL_PX,
  CELL_TD,
  CELL_HEIGHT,
  STICKY_HEAD,
  STICKY_HOUR,
  STICKY_CORNER,
} from "@/components/calendar-grid-styles";
import { getCommonDict, getScheduleDict } from "@/lib/i18n";
import { useLocale } from "@/lib/i18n/context";
import { cancelBookingAction, createBookingAction } from "./actions";

// רשת אינטראקטיבית לבחירת משבצות: לחיצה ראשונה = התחלה, לחיצה שניה
// (באותה עמודה — אותו חדר/יום) = סיום, וכל מה שביניהן נבחר אוטומטית —
// בדיוק כמו cleana.co.il, בלי טופס נפרד לכל חצי שעה.
export type CellState =
  | { status: "past" }
  | { status: "mine"; bookingId: string; cancellable: boolean }
  | { status: "taken" }
  | { status: "blocked" }
  | { status: "available" };

export type GridColumn = {
  key: string;
  roomId: string;
  date: string;
  header: string;
  headerHref?: string;
};

export function SlotGrid({ slots, columns, cells }: { slots: string[]; columns: GridColumn[]; cells: CellState[][] }) {
  const locale = useLocale();
  const t = getScheduleDict(locale);
  const c = getCommonDict(locale);
  const [selection, setSelection] = useState<{ colIdx: number; startIdx: number; endIdx: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function isAvailable(colIdx: number, rowIdx: number) {
    return cells[colIdx]?.[rowIdx]?.status === "available";
  }

  function handleSlotClick(colIdx: number, rowIdx: number) {
    setError(null);
    setSelection((prev) => {
      if (!prev || prev.colIdx !== colIdx) {
        return { colIdx, startIdx: rowIdx, endIdx: rowIdx };
      }
      if (prev.startIdx === prev.endIdx && prev.startIdx === rowIdx) {
        return null;
      }
      if (prev.startIdx !== prev.endIdx) {
        return { colIdx, startIdx: rowIdx, endIdx: rowIdx };
      }
      // לחיצה שניה: יוצרים טווח, אך עוצרים בתא הראשון שלא פנוי — כדי
      // שלא ניתן יהיה "לדלג מעל" משבצת תפוסה.
      let lo = prev.startIdx;
      let hi = prev.startIdx;
      if (rowIdx >= prev.startIdx) {
        let i = prev.startIdx;
        while (i <= rowIdx && isAvailable(colIdx, i)) {
          hi = i;
          i++;
        }
      } else {
        let i = prev.startIdx;
        while (i >= rowIdx && isAvailable(colIdx, i)) {
          lo = i;
          i--;
        }
      }
      return { colIdx, startIdx: lo, endIdx: hi };
    });
  }

  function confirm() {
    if (!selection) return;
    const col = columns[selection.colIdx];
    const lo = Math.min(selection.startIdx, selection.endIdx);
    const hi = Math.max(selection.startIdx, selection.endIdx);
    const durationHours = (hi - lo + 1) * 0.5;
    const fd = new FormData();
    fd.set("room_id", col.roomId);
    fd.set("date", col.date);
    fd.set("start_time", slots[lo]);
    fd.set("duration_hours", String(durationHours));
    startTransition(async () => {
      const result = await createBookingAction({}, fd);
      if (result?.error) {
        setError(result.error);
      } else {
        setSelection(null);
      }
    });
  }

  const selLo = selection ? Math.min(selection.startIdx, selection.endIdx) : -1;
  const selHi = selection ? Math.max(selection.startIdx, selection.endIdx) : -1;

  return (
    <div className="relative">
      <div className={SCROLLBOX}>
        <table
          className="w-full border-separate border-spacing-0 text-sm"
          style={{ minWidth: `${HOUR_COL_PX + columns.length * MIN_COL_PX}px` }}
        >
          <thead>
            <tr>
              <th className={`${STICKY_CORNER} w-16 p-2 text-xs font-normal text-muted-foreground`}>{t.hourColumn}</th>
              {columns.map((col) => (
                <th key={col.key} className={`${STICKY_HEAD} p-2 text-center font-medium`}>
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {slots.map((slot, rowIdx) => (
              <tr key={slot} className="[&:last-child>*]:border-b-0">
                <td className={`${STICKY_HOUR} tabular-nums p-2 text-xs text-muted-foreground`}>{slot}</td>
                {columns.map((col, colIdx) => {
                  const cell = cells[colIdx][rowIdx];
                  const isSelected = selection?.colIdx === colIdx && rowIdx >= selLo && rowIdx <= selHi;

                  if (cell.status === "past") {
                    return <td key={col.key} className={`${CELL_TD} bg-subtle/50`} />;
                  }
                  if (cell.status === "mine") {
                    return (
                      <td key={col.key} className={CELL_TD}>
                        <div
                          className={`flex ${CELL_HEIGHT} items-center justify-between gap-1 rounded-field bg-violet-100 px-2 text-xs text-violet-700`}
                        >
                          <span className="min-w-0 truncate">{t.mine}</span>
                          {cell.cancellable && (
                            <form action={cancelBookingAction}>
                              <input type="hidden" name="booking_id" value={cell.bookingId} />
                              <button
                                type="submit"
                                className="-me-1 flex size-8 shrink-0 items-center justify-center rounded-button text-violet-500 hover:text-danger md:size-5"
                                title={t.cancelTitle}
                              >
                                <X className="size-3.5" />
                              </button>
                            </form>
                          )}
                        </div>
                      </td>
                    );
                  }
                  if (cell.status === "taken" || cell.status === "blocked") {
                    return (
                      <td key={col.key} className={CELL_TD}>
                        <div
                          className={`flex ${CELL_HEIGHT} items-center justify-center rounded-field bg-subtle text-xs text-muted-foreground`}
                        >
                          {cell.status === "taken" ? t.taken : t.blocked}
                        </div>
                      </td>
                    );
                  }
                  return (
                    <td key={col.key} className={CELL_TD}>
                      <button
                        type="button"
                        onClick={() => handleSlotClick(colIdx, rowIdx)}
                        className={`flex w-full ${CELL_HEIGHT} items-center justify-center rounded-field border text-xs transition-colors ${
                          isSelected
                            ? "border-violet-500 bg-violet-500 text-white"
                            : "border-success-border bg-success-bg text-success-fg hover:bg-success/20"
                        }`}
                      >
                        {isSelected ? t.selected : t.available}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* מרווח בתחתית הזרימה הרגילה: אלמנט fixed לא תופס מקום בעצמו, אז
          בלעדי זה הפס היה מכסה את השורה האחרונה של הטבלה. */}
      {selection && <div className="h-20 sm:h-14" aria-hidden />}

      {/* fixed לגמרי למסך — לא sticky בתוך תיבת הטבלה. כך הפס נשאר צמוד
          לתחתית המסך גם כשגוללים את שאר הדף, בלי תלות בגובה/גלילה של אף
          ancestor. z-40: מתחת למגירת הניווט (z-50) שנפתחת מעל הכל, מעל
          ה-header העליון ה-sticky (z-30). */}
      {selection && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface shadow-e3 [padding-bottom:env(safe-area-inset-bottom)]">
          <div className="mx-auto flex w-full max-w-[var(--content-max)] flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm">
              <span className="font-medium">{columns[selection.colIdx].header}</span>
              <span className="text-muted-foreground"> · {slots[selLo]}–{addHalfHour(slots[selHi])}</span>
              <span className="text-muted-foreground"> · {c.hoursN((selHi - selLo + 1) * 0.5)}</span>
            </div>
            <div className="flex items-center gap-2">
              {error && <span className="text-xs text-destructive">{error}</span>}
              <button
                type="button"
                onClick={() => setSelection(null)}
                className="flex h-10 items-center justify-center rounded-button border border-border-strong px-3 text-sm hover:bg-subtle md:h-9"
              >
                {c.cancel}
              </button>
              <button
                type="button"
                onClick={confirm}
                disabled={pending}
                className="flex h-10 items-center justify-center rounded-button bg-violet-600 px-4 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-60 md:h-9"
              >
                {pending ? c.sending : t.confirmBooking}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function addHalfHour(time: string): string {
  const [h, m] = time.split(":").map(Number);
  const total = h * 60 + m + 30;
  const hh = Math.floor(total / 60) % 24;
  const mm = total % 60;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}
