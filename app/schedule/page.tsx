import { requireTherapistProfile, isSuperadmin } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { formatDateTimeHe } from "@/lib/time";
import { BookingForm } from "./booking-form";
import { cancelBookingAction } from "./actions";
import { AppHeader } from "@/components/app-header";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

// לוח זמנים מינימלי — טופס הזמנה + "ההזמנות שלי". לא תצוגת יומן מלאה
// (ר' PROGRESS.md): מספיק כדי לתרגל את הזרימה create_booking/cancel_booking
// מקצה לקצה מול ה-DB האמיתי.
export default async function SchedulePage() {
  const { userId, profile } = await requireTherapistProfile();
  const supabase = await createClient();

  const [{ data: rooms }, { data: bookings }, { data: clinic }, superadmin] = await Promise.all([
    supabase.from("rooms").select("id, name").eq("active", true).order("sort_order"),
    supabase
      .from("bookings")
      .select("id, starts_at, ends_at, status, source, rooms(name)")
      .eq("user_id", userId)
      .order("starts_at", { ascending: false })
      .limit(20),
    supabase.from("clinics").select("name").eq("id", profile.clinic_id).single(),
    isSuperadmin(userId),
  ]);

  return (
    <div className="flex flex-1 flex-col">
      <AppHeader clinicName={clinic?.name} role={profile.role} isSuperadmin={superadmin} />
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 p-6 sm:p-8">
        <h1 className="text-2xl font-semibold">הזמנת חדר</h1>

        <Card className="shadow-e1">
          <CardContent className="pt-6">
            {rooms && rooms.length > 0 ? (
              <BookingForm rooms={rooms} />
            ) : (
              <p className="text-muted-foreground">אין עדיין חדרים פעילים בקליניקה.</p>
            )}
          </CardContent>
        </Card>

        <section>
          <CardTitle className="mb-3 text-base font-medium">ההזמנות שלי</CardTitle>
          <div className="flex flex-col gap-2">
            {(bookings ?? []).map((b) => (
              <Card key={b.id} className="shadow-e1">
                <CardContent className="flex items-center justify-between p-3 text-sm">
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
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
