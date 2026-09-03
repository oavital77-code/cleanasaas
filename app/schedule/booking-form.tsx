"use client";

import { useActionState } from "react";
import { createBookingAction, type BookingState } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: BookingState = {};

export function BookingForm({ rooms }: { rooms: { id: string; name: string }[] }) {
  const [state, formAction, pending] = useActionState(createBookingAction, initialState);

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="room_id">חדר</Label>
        <select id="room_id" name="room_id" required className="h-10 rounded-md border border-input bg-background px-3">
          {rooms.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="date">תאריך</Label>
        <Input id="date" name="date" type="date" required />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="start_time">שעה</Label>
        <Input id="start_time" name="start_time" type="time" step={1800} required />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="duration_hours">משך (שעות)</Label>
        <Input id="duration_hours" name="duration_hours" type="number" step={0.5} min={0.5} max={8} defaultValue={1} className="w-24" />
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "שולח/ת…" : "הזמנה"}
      </Button>
      {state.error && <p className="w-full text-sm text-destructive">{state.error}</p>}
      {state.success && <p className="w-full text-sm text-success">ההזמנה בוצעה!</p>}
    </form>
  );
}
