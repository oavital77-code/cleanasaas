"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getAdminTherapistDetailDict } from "@/lib/i18n";
import { useLocale } from "@/lib/i18n/context";
import { recordOverrunAction, setBookingStatusAction, type OverrunState } from "./actions";

const initialState: OverrunState = {};

// פעולות על הזמנה מאושרת שכבר התחילה: הושלם / לא-הגיע/ה / רישום חריגה.
// מוצג רק כשהתנאים מתקיימים (הדף מסנן) — ה-RPC בודק שוב בכל מקרה.
export function BookingRowActions({ bookingId, userId }: { bookingId: string; userId: string }) {
  const t = getAdminTherapistDetailDict(useLocale());
  const [state, formAction, pending] = useActionState(recordOverrunAction, initialState);

  return (
    <div className="flex flex-col gap-2 border-s-2 border-border ps-3 text-xs">
      <div className="flex flex-wrap gap-2">
        <form action={setBookingStatusAction}>
          <input type="hidden" name="booking_id" value={bookingId} />
          <input type="hidden" name="user_id" value={userId} />
          <input type="hidden" name="status" value="completed" />
          <Button type="submit" size="sm" variant="outline">
            {t.markCompleted}
          </Button>
        </form>
        <form action={setBookingStatusAction}>
          <input type="hidden" name="booking_id" value={bookingId} />
          <input type="hidden" name="user_id" value={userId} />
          <input type="hidden" name="status" value="no_show" />
          <Button type="submit" size="sm" variant="outline">
            {t.markNoShow}
          </Button>
        </form>
      </div>
      <form action={formAction} className="flex flex-wrap items-center gap-2">
        <input type="hidden" name="booking_id" value={bookingId} />
        <input type="hidden" name="user_id" value={userId} />
        <Input name="minutes" type="number" min={1} step={1} placeholder={t.overrunMinutes} className="h-9 w-32 md:h-8" required />
        <Input name="note" placeholder={t.overrunNote} className="h-9 w-40 md:h-8" />
        <Button type="submit" size="sm" variant="outline" disabled={pending}>
          {pending ? t.overrunRecording : t.overrunRecord}
        </Button>
        {state.error && <span className="text-danger">{state.error}</span>}
        {state.message && <span className="text-success">{state.message}</span>}
      </form>
    </div>
  );
}
