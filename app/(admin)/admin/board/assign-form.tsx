"use client";

import { useActionState } from "react";
import { adminAssignBookingAction, type AssignState } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: AssignState = {};

export function AssignForm({
  rooms,
  users,
  initialRoomId,
  initialDate,
  initialTime,
}: {
  rooms: { id: string; name: string }[];
  users: { id: string; full_name: string }[];
  initialRoomId?: string;
  initialDate: string;
  initialTime?: string;
}) {
  const [state, formAction, pending] = useActionState(adminAssignBookingAction, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
      <div className="flex flex-col gap-1.5">
        <Label>מטפל/ת</Label>
        <select name="user_id" required className="h-10 w-full rounded-field border border-input bg-background px-3 sm:w-auto">
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.full_name}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label>חדר</Label>
        <select
          name="room_id"
          required
          defaultValue={initialRoomId}
          className="h-10 w-full rounded-field border border-input bg-background px-3 sm:w-auto"
        >
          {rooms.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label>תאריך</Label>
        <Input name="date" type="date" defaultValue={initialDate} required className="w-full sm:w-auto" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label>שעה</Label>
        <Input name="start_time" type="time" step={1800} defaultValue={initialTime} required className="w-full sm:w-auto" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label>משך (שעות)</Label>
        <Input name="duration_hours" type="number" step={0.5} min={0.5} defaultValue={1} className="w-full sm:w-24" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label>הערה</Label>
        <Input name="note" className="w-full sm:w-40" />
      </div>
      <Button type="submit" disabled={pending} className="w-full sm:w-auto">
        {pending ? "משבץ/ת…" : "שיבוץ"}
      </Button>
      {state.error && <p className="w-full text-sm text-danger">{state.error}</p>}
    </form>
  );
}
