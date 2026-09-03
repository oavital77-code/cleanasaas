import { requireTherapistProfile } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { formatDateTimeHe } from "@/lib/time";
import { BookingForm } from "./booking-form";
import { cancelBookingAction } from "./actions";
import { Button } from "@/components/ui/button";

// לוח זמנים מינימלי — טופס הזמנה + "ההזמנות שלי". לא תצוגת יומן מלאה
// (ר' PROGRESS.md): מספיק כדי לתרגל את הזרימה create_booking/cancel_booking
// מקצה לקצה מול ה-DB האמיתי.
export default async function SchedulePage() {
  const { userId } = await requireTherapistProfile();
  const supabase = await createClient();

  const { data: rooms } = await supabase.from("rooms").select("id, name").eq("active", true).order("sort_order");
  const { data: bookings } = await supabase
    .from("bookings")
    .select("id, starts_at, ends_at, status, source, rooms(name)")
    .eq("user_id", userId)
    .order("starts_at", { ascending: false })
    .limit(20);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 p-8">
      <h1 className="text-2xl font-semibold">הזמנת חדר</h1>

      {rooms && rooms.length > 0 ? (
        <BookingForm rooms={rooms} />
      ) : (
        <p className="text-muted-foreground">אין עדיין חדרים פעילים בקליניקה.</p>
      )}

      <section>
        <h2 className="mb-3 font-medium">ההזמנות שלי</h2>
        <ul className="flex flex-col gap-2">
          {(bookings ?? []).map((b) => (
            <li key={b.id} className="flex items-center justify-between rounded-md border p-3 text-sm">
              <span>
                {(b.rooms as { name?: string } | null)?.name} · {formatDateTimeHe(new Date(b.starts_at))}
                {" — "}
                {b.status === "confirmed" ? "מאושר" : b.status}
                {b.source === "session" && " (ססיה קבועה)"}
              </span>
              {b.status === "confirmed" && b.source !== "session" && (
                <form action={cancelBookingAction}>
                  <input type="hidden" name="booking_id" value={b.id} />
                  <Button type="submit" size="sm" variant="destructive">
                    ביטול
                  </Button>
                </form>
              )}
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
