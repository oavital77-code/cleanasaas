import Link from "next/link";
import { getAuthState, isSuperadmin } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { formatDateTimeHe } from "@/lib/time";
import { AppHeader } from "@/components/app-header";
import { BrandBackdrop } from "@/components/brand-backdrop";
import { Logo } from "@/components/logo";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const FEATURES = [
  { title: "לוח זמנים בלי כאב ראש", body: "מניעת חפיפות ברמת ה-DB — שני מטפלים לעולם לא יתפסו אותו חדר." },
  { title: "כרטיסיות וססיות", body: "מדרגות מחיר, פיקדון ו-FIFO על תוקף שעות — בנוי מהיסוד, לא טלאים." },
  { title: "כל קליניקה מבודדת", body: "מטפל אצלכם לא רואה מטפל בקליניקה אחרת. אף פעם." },
];

export default async function HomePage() {
  const { userId, profile } = await getAuthState();

  if (!userId || !profile) {
    return (
      <div className="relative flex flex-1 flex-col">
        <BrandBackdrop />
        <header className="flex items-center justify-between p-6">
          <Logo />
          <div className="flex gap-2">
            <Button asChild variant="ghost">
              <Link href="/login">כניסה</Link>
            </Button>
            <Button asChild>
              <Link href="/signup">פתיחת קליניקה חדשה</Link>
            </Button>
          </div>
        </header>

        <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center gap-8 p-8 text-center">
          <div className="flex flex-col gap-4">
            <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
              ניהול השכרת קליניקות, על אוטומט
            </h1>
            <p className="mx-auto max-w-xl text-lg text-muted-foreground">
              פלטפורמת SaaS רב-דיירית — כל עסק עם הסניפים, החדרים, המחירון
              ושיטת התשלום שלו. נרשמים ומקימים תוך דקות.
            </p>
          </div>
          <div className="flex gap-4">
            <Button asChild size="lg">
              <Link href="/signup">פתיחת קליניקה חדשה</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/login">כניסה</Link>
            </Button>
          </div>

          <div className="mt-8 grid w-full gap-4 text-right sm:grid-cols-3">
            {FEATURES.map((f) => (
              <Card key={f.title} className="shadow-e1">
                <CardHeader>
                  <CardTitle className="text-base">{f.title}</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">{f.body}</CardContent>
              </Card>
            ))}
          </div>
        </main>
      </div>
    );
  }

  const supabase = await createClient();
  const [{ data: clinic }, { data: cards }, { data: nextBooking }, superadmin] = await Promise.all([
    supabase.from("clinics").select("name").eq("id", profile.clinic_id).single(),
    supabase.from("punch_cards").select("hours_remaining").eq("user_id", userId).eq("active", true),
    supabase
      .from("bookings")
      .select("starts_at, room_id, rooms(name)")
      .eq("user_id", userId)
      .eq("status", "confirmed")
      .gt("starts_at", new Date().toISOString())
      .order("starts_at")
      .limit(1)
      .maybeSingle(),
    isSuperadmin(userId),
  ]);

  const totalHours = (cards ?? []).reduce((sum, c) => sum + Number(c.hours_remaining), 0);

  return (
    <div className="flex flex-1 flex-col">
      <AppHeader clinicName={clinic?.name} role={profile.role} isSuperadmin={superadmin} />
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 p-6 sm:p-8">
        <div>
          <h1 className="text-2xl font-semibold">שלום, {profile.full_name}</h1>
          <p className="text-muted-foreground">{clinic?.name}</p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Card className="shadow-e1">
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">יתרת שעות</p>
              <p className="tabular-nums text-2xl font-semibold">{totalHours}</p>
            </CardContent>
          </Card>
          <Card className="shadow-e1">
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">ההזמנה הבאה</p>
              <p className="text-lg">
                {nextBooking
                  ? `${(nextBooking.rooms as { name?: string } | null)?.name} · ${formatDateTimeHe(new Date(nextBooking.starts_at))}`
                  : "אין הזמנות קרובות"}
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="flex gap-3">
          <Button asChild>
            <Link href="/schedule">הזמנת חדר</Link>
          </Button>
          {(profile.role === "owner" || profile.role === "admin") && (
            <Button asChild variant="outline">
              <Link href="/admin/settings">ניהול הקליניקה</Link>
            </Button>
          )}
        </div>
      </main>
    </div>
  );
}
