"use client";

import { useActionState } from "react";
import { createBookingAction, type BookingState } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { getCommonDict, getScheduleDict } from "@/lib/i18n";
import { useLocale } from "@/lib/i18n/context";

const initialState: BookingState = {};

export function BookingForm({ rooms }: { rooms: { id: string; name: string }[] }) {
  const locale = useLocale();
  const t = getScheduleDict(locale);
  const c = getCommonDict(locale);
  const [state, formAction, pending] = useActionState(createBookingAction, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="room_id">{t.room}</Label>
        <Select id="room_id" name="room_id" required className="sm:w-auto">
          {rooms.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </Select>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="date">{t.date}</Label>
        <Input id="date" name="date" type="date" required className="w-full sm:w-auto" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="start_time">{t.time}</Label>
        <Input id="start_time" name="start_time" type="time" step={1800} required className="w-full sm:w-auto" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="duration_hours">{t.durationHours}</Label>
        <Input
          id="duration_hours"
          name="duration_hours"
          type="number"
          step={0.5}
          min={0.5}
          max={8}
          defaultValue={1}
          className="w-full sm:w-24"
        />
      </div>
      <Button type="submit" disabled={pending} className="w-full sm:w-auto">
        {pending ? c.sending : t.book}
      </Button>
      {state.error && <p className="w-full text-sm text-destructive">{state.error}</p>}
      {state.success && <p className="w-full text-sm text-success">{t.bookingDone}</p>}
    </form>
  );
}
