"use client";

import { useState, useTransition } from "react";
import { X } from "lucide-react";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { adminCancelBookingAction, adminAssignBookingAction } from "./actions";

// גרסת אדמין ל-SlotGrid: אותו מנגנון בחירת טווח בשתי לחיצות, אבל התא
// ה"תפוס" נושא שם מטפל/ת ולא "שלך" (אדמין רואה הכל, לא רק את עצמו/ה —
// חוק #3 חל רק על מטפל/ת), ופס האישור כולל בחירת עבור מי קובעים את התור
// (חוק CLEANASITEMAPANDDESIGN: אדמין יכול לשבץ את עצמו/ה או כל מטפל/ת אחר/ת).
// אין מצב "past" בכוונה — אדמין (בניגוד למטפל/ת) יכול/ה לשבץ גם משבצת
// שכבר עברה (למשל לתעד ידנית מפגש שהתקיים בלי הזמנה), בדיוק כמו שהיה
// בהתנהגות המקורית של BoardCell.
export type AdminCellState =
  | { status: "booked"; bookingId: string; label: string }
  | { status: "blocked"; reason: string }
  | { status: "available" };

export type GridColumn = { key: string; roomId: string; date: string; header: string };

function cellHeightClass() {
  return "h-11 md:h-8";
}

export function AdminSlotGrid({
  slots,
  columns,
  cells,
  users,
}: {
  slots: string[];
  columns: GridColumn[];
  cells: AdminCellState[][];
  users: { id: string; full_name: string }[];
}) {
  const [selection, setSelection] = useState<{ colIdx: number; startIdx: number; endIdx: number } | null>(null);
  const [userId, setUserId] = useState(users[0]?.id ?? "");
  const [note, setNote] = useState("");
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
    if (!selection || !userId) return;
    const col = columns[selection.colIdx];
    const lo = Math.min(selection.startIdx, selection.endIdx);
    const hi = Math.max(selection.startIdx, selection.endIdx);
    const durationHours = (hi - lo + 1) * 0.5;
    const fd = new FormData();
    fd.set("user_id", userId);
    fd.set("room_id", col.roomId);
    fd.set("date", col.date);
    fd.set("start_time", slots[lo]);
    fd.set("duration_hours", String(durationHours));
    if (note) fd.set("note", note);
    startTransition(async () => {
      const result = await adminAssignBookingAction({}, fd);
      if (result?.error) {
        setError(result.error);
      } else {
        setSelection(null);
        setNote("");
      }
    });
  }

  const selLo = selection ? Math.min(selection.startIdx, selection.endIdx) : -1;
  const selHi = selection ? Math.max(selection.startIdx, selection.endIdx) : -1;

  return (
    <div className="relative">
      <table
        className="w-full border-collapse text-sm"
        style={{ minWidth: columns.length > 4 ? `${64 + columns.length * 92}px` : undefined }}
      >
        <thead>
          <tr className="border-b border-border bg-muted">
            <th className="w-16 p-2 text-xs font-normal text-muted-foreground">שעה</th>
            {columns.map((c) => (
              <th key={c.key} className="p-2 text-center font-medium">
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {slots.map((slot, rowIdx) => (
            <tr key={slot} className="border-b border-border last:border-0">
              <td className="tabular-nums p-2 text-xs text-muted-foreground">{slot}</td>
              {columns.map((col, colIdx) => {
                const cell = cells[colIdx][rowIdx];
                const isSelected = selection?.colIdx === colIdx && rowIdx >= selLo && rowIdx <= selHi;

                if (cell.status === "booked") {
                  return (
                    <td key={col.key} className="p-1">
                      <div
                        className={`flex ${cellHeightClass()} items-center justify-between gap-1 rounded-field bg-violet-100 px-2 text-xs text-violet-700`}
                      >
                        <span className="min-w-0 truncate">{cell.label}</span>
                        <form action={adminCancelBookingAction}>
                          <input type="hidden" name="booking_id" value={cell.bookingId} />
                          <button
                            type="submit"
                            className="-me-1 flex size-8 shrink-0 items-center justify-center rounded-button text-violet-500 hover:text-danger md:size-5"
                            title="ביטול"
                          >
                            <X className="size-3.5" />
                          </button>
                        </form>
                      </div>
                    </td>
                  );
                }
                if (cell.status === "blocked") {
                  return (
                    <td key={col.key} className="p-1" title={cell.reason}>
                      <div
                        className={`flex ${cellHeightClass()} items-center justify-center rounded-field bg-subtle text-xs text-muted-foreground`}
                      >
                        חסום
                      </div>
                    </td>
                  );
                }
                return (
                  <td key={col.key} className="p-1">
                    <button
                      type="button"
                      onClick={() => handleSlotClick(colIdx, rowIdx)}
                      className={`flex w-full ${cellHeightClass()} items-center justify-center rounded-field border text-xs transition-colors ${
                        isSelected
                          ? "border-violet-500 bg-violet-500 text-white"
                          : "border-success-border bg-success-bg text-success-fg hover:bg-success/20"
                      }`}
                    >
                      {isSelected ? "נבחר" : "פנוי"}
                    </button>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>

      {selection && <div className="h-40 sm:h-16" aria-hidden />}

      {selection && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface shadow-e3 [padding-bottom:env(safe-area-inset-bottom)]">
          <div className="mx-auto flex w-full max-w-[var(--content-max)] flex-col gap-2 p-3">
            <div className="text-sm">
              <span className="font-medium">{columns[selection.colIdx].header}</span>
              <span className="text-muted-foreground"> · {slots[selLo]}–{addHalfHour(slots[selHi])}</span>
              <span className="text-muted-foreground"> · {(selHi - selLo + 1) * 0.5} שעות</span>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end">
              <div className="flex-1 sm:min-w-[10rem]">
                <Select value={userId} onChange={(e) => setUserId(e.target.value)} aria-label="עבור מי לקבוע">
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.full_name}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="flex-1 sm:min-w-[8rem]">
                <Input placeholder="הערה (לא חובה)" value={note} onChange={(e) => setNote(e.target.value)} />
              </div>
              <div className="flex items-center gap-2">
                {error && <span className="text-xs text-destructive">{error}</span>}
                <button
                  type="button"
                  onClick={() => setSelection(null)}
                  className="flex h-10 shrink-0 items-center justify-center rounded-button border border-border-strong px-3 text-sm hover:bg-subtle md:h-9"
                >
                  ביטול
                </button>
                <button
                  type="button"
                  onClick={confirm}
                  disabled={pending || !userId}
                  className="flex h-10 shrink-0 items-center justify-center rounded-button bg-violet-600 px-4 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-60 md:h-9"
                >
                  {pending ? "משבץ/ת…" : "שיבוץ"}
                </button>
              </div>
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
