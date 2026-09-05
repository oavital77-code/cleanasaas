"use client";

import { useActionState, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const WEEKDAYS = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];

type Row = { room_id: string; weekday: number; start_time: string; duration: number };
type SlotFormState = { error?: string };

// משותף לבקשת ססיה ע"י מטפל/ת (request_session — משבצות = בדיוק
// requiredHours) ולקביעה חופשית ע"י אדמין (admin_create_session — בלי
// מגבלת שעות). ה-action מקבל שדה נסתר בשם slots (JSON) בתוך ה-FormData.
export function SlotBuilder({
  rooms,
  action,
  requiredHours,
  submitLabel,
  pendingLabel,
  extraFields,
  showStartDate = true,
}: {
  rooms: { id: string; name: string }[];
  action: (state: SlotFormState, formData: FormData) => Promise<SlotFormState>;
  requiredHours?: number;
  submitLabel: string;
  pendingLabel: string;
  extraFields?: ReactNode;
  showStartDate?: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const [rows, setRows] = useState<Row[]>([
    { room_id: rooms[0]?.id ?? "", weekday: 0, start_time: "09:00", duration: requiredHours ?? 1 },
  ]);

  const totalHours = rows.reduce((sum, r) => sum + r.duration, 0);
  const matches = requiredHours === undefined || Math.abs(totalHours - requiredHours) < 0.001;

  function updateRow(i: number, patch: Partial<Row>) {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }

  function addRow() {
    setRows((prev) => [...prev, { room_id: rooms[0]?.id ?? "", weekday: 0, start_time: "09:00", duration: 1 }]);
  }

  function removeRow(i: number) {
    setRows((prev) => prev.filter((_, idx) => idx !== i));
  }

  function toEndTime(start: string, duration: number): string {
    const [h, m] = start.split(":").map(Number);
    const totalMin = h * 60 + m + duration * 60;
    const eh = Math.floor(totalMin / 60) % 24;
    const em = totalMin % 60;
    return `${String(eh).padStart(2, "0")}:${String(em).padStart(2, "0")}`;
  }

  const slotsJson = JSON.stringify(
    rows.map((r) => ({
      room_id: r.room_id,
      weekday: r.weekday,
      start_time: r.start_time,
      end_time: toEndTime(r.start_time, r.duration),
    })),
  );

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <input type="hidden" name="slots" value={slotsJson} />
      {extraFields}

      <div className="flex flex-col gap-3">
        {rows.map((row, i) => (
          <div
            key={i}
            className="flex flex-col gap-3 rounded-field border border-border p-3 sm:flex-row sm:flex-wrap sm:items-end"
          >
            <div className="flex flex-col gap-1">
              <Label className="text-xs">חדר</Label>
              <select
                value={row.room_id}
                onChange={(e) => updateRow(i, { room_id: e.target.value })}
                className="h-10 w-full rounded-field border border-input bg-background px-3 sm:w-auto"
              >
                {rooms.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-xs">יום</Label>
              <select
                value={row.weekday}
                onChange={(e) => updateRow(i, { weekday: Number(e.target.value) })}
                className="h-10 w-full rounded-field border border-input bg-background px-3 sm:w-auto"
              >
                {WEEKDAYS.map((d, idx) => (
                  <option key={idx} value={idx}>
                    {d}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-xs">שעת התחלה</Label>
              <Input
                type="time"
                step={1800}
                value={row.start_time}
                onChange={(e) => updateRow(i, { start_time: e.target.value })}
                className="w-full sm:w-28"
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-xs">משך (שעות)</Label>
              <Input
                type="number"
                step={0.5}
                min={0.5}
                value={row.duration}
                onChange={(e) => updateRow(i, { duration: Number(e.target.value) })}
                className="w-full sm:w-24"
              />
            </div>
            {rows.length > 1 && (
              <Button type="button" variant="ghost" size="sm" onClick={() => removeRow(i)} className="w-full sm:w-auto">
                הסרה
              </Button>
            )}
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button type="button" variant="outline" size="sm" onClick={addRow}>
          הוספת משבצת נוספת
        </Button>
        {requiredHours !== undefined ? (
          <p className={`text-sm tabular-nums ${matches ? "text-success" : "text-warning-fg"}`}>
            סה&quot;כ {totalHours} מתוך {requiredHours} שעות שבועיות נדרשות
          </p>
        ) : (
          <p className="text-sm tabular-nums text-muted-foreground">סה&quot;כ {totalHours} שעות שבועיות</p>
        )}
      </div>

      {showStartDate && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="start_date">תאריך התחלה מבוקש (אופציונלי)</Label>
          <Input id="start_date" name="start_date" type="date" className="w-full sm:w-48" />
        </div>
      )}

      {state.error && (
        <p className="rounded-field border border-danger-border bg-danger-bg px-3 py-2 text-sm text-danger">
          {state.error}
        </p>
      )}

      <Button type="submit" disabled={pending || !matches} className="w-fit">
        {pending ? pendingLabel : submitLabel}
      </Button>
    </form>
  );
}
