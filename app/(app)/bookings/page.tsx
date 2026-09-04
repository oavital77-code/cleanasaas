import { requireTherapistProfile } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { formatDateTimeHe } from "@/lib/time";
import { cancelBookingAction } from "../schedule/actions";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const SOURCE_LABEL: Record<string, string> = {
  punch_card: "כרטיסייה",
  session: "ססיה קבועה",
  admin_comp: "מתנת אדמין",
};

const STATUS_LABEL: Record<string, string> = {
  confirmed: "מאושר",
  cancelled_by_user: "בוטל",
  cancelled_by_admin: "בוטל ע\"י אדמין",
  completed: "הושלם",
  no_show: "לא הגיע/ה",
};

export default async function BookingsPage() {
  const { userId, profile } = await requireTherapistProfile();
  const supabase = await createClient();

  const [{ data: clinic }, { data: bookings }] = await Promise.all([
    supabase.from("clinics").select("name").eq("id", profile.clinic_id).single(),
    supabase
      .from("bookings")
      .select("id, starts_at, ends_at, status, source, rooms(name)")
      .eq("user_id", userId)
      .order("starts_at", { ascending: false })
      .limit(50),
  ]);

  const isAdmin = profile.role === "owner" || profile.role === "admin";
  const now = new Date();
  const upcoming = (bookings ?? []).filter((b) => new Date(b.starts_at) >= now && b.status === "confirmed");
  const past = (bookings ?? []).filter((b) => !(new Date(b.starts_at) >= now && b.status === "confirmed"));

  function BookingRow({ b }: { b: NonNullable<typeof bookings>[number] }) {
    return (
      <Card key={b.id} className="shadow-e1">
        <CardContent className="flex items-center justify-between p-3 text-sm">
          <span>
            {(b.rooms as { name?: string } | null)?.name} · {formatDateTimeHe(new Date(b.starts_at))}
            {" — "}
            {STATUS_LABEL[b.status] ?? b.status}
            {b.source !== "punch_card" && ` (${SOURCE_LABEL[b.source] ?? b.source})`}
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
    );
  }

  return (
    <AppShell side="app" clinicName={clinic?.name} fullName={profile.full_name} isAdmin={isAdmin}>
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-8">
        <h1 className="text-2xl font-semibold">ההזמנות שלי</h1>

        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-medium text-muted-foreground">קרובות</h2>
          {upcoming.length === 0 ? (
            <p className="text-sm text-muted-foreground">אין הזמנות קרובות.</p>
          ) : (
            upcoming.map((b) => <BookingRow key={b.id} b={b} />)
          )}
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-medium text-muted-foreground">היסטוריה</h2>
          {past.length === 0 ? (
            <p className="text-sm text-muted-foreground">אין עדיין היסטוריה.</p>
          ) : (
            past.map((b) => <BookingRow key={b.id} b={b} />)
          )}
        </section>
      </div>
    </AppShell>
  );
}
