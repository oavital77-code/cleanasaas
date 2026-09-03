import Link from "next/link";
import { getAuthState } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { formatDateTimeHe } from "@/lib/time";

export default async function HomePage() {
  const { userId, profile } = await getAuthState();

  if (!userId || !profile) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-6 p-8 text-center">
        <h1 className="text-3xl font-semibold">Cleana SaaS</h1>
        <p className="max-w-md text-muted-foreground">
          פלטפורמה רב-דיירית לניהול השכרת קליניקות — כל עסק עם הסניפים,
          החדרים והמחירון שלו.
        </p>
        <div className="flex gap-4">
          <Link href="/signup" className="rounded-md bg-primary px-4 py-2 text-primary-foreground">
            פתיחת קליניקה חדשה
          </Link>
          <Link href="/login" className="rounded-md border px-4 py-2">
            כניסה
          </Link>
        </div>
      </main>
    );
  }

  const supabase = await createClient();
  const { data: clinic } = await supabase.from("clinics").select("name").eq("id", profile.clinic_id).single();
  const { data: cards } = await supabase
    .from("punch_cards")
    .select("hours_remaining")
    .eq("user_id", userId)
    .eq("active", true);
  const { data: nextBooking } = await supabase
    .from("bookings")
    .select("starts_at, room_id, rooms(name)")
    .eq("user_id", userId)
    .eq("status", "confirmed")
    .gt("starts_at", new Date().toISOString())
    .order("starts_at")
    .limit(1)
    .maybeSingle();

  const totalHours = (cards ?? []).reduce((sum, c) => sum + Number(c.hours_remaining), 0);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 p-8">
      <h1 className="text-2xl font-semibold">שלום, {profile.full_name}</h1>
      <p className="text-muted-foreground">{clinic?.name}</p>

      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-lg border p-4">
          <p className="text-sm text-muted-foreground">יתרת שעות</p>
          <p className="text-2xl font-semibold">{totalHours}</p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-sm text-muted-foreground">ההזמנה הבאה</p>
          <p className="text-lg">
            {nextBooking
              ? `${(nextBooking.rooms as { name?: string } | null)?.name} · ${formatDateTimeHe(new Date(nextBooking.starts_at))}`
              : "אין הזמנות קרובות"}
          </p>
        </div>
      </div>

      <div className="flex gap-3">
        <Link href="/schedule" className="rounded-md bg-primary px-4 py-2 text-primary-foreground">
          הזמנת חדר
        </Link>
        {(profile.role === "owner" || profile.role === "admin") && (
          <Link href="/admin/settings" className="rounded-md border px-4 py-2">
            ניהול הקליניקה
          </Link>
        )}
      </div>
    </main>
  );
}
