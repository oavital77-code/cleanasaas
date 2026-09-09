import { requireTherapistProfile } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { formatDateTimeHe } from "@/lib/time";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent } from "@/components/ui/card";
import { getDashboardDict, normalizeLocale } from "@/lib/i18n";
import { publicImageUrl } from "@/lib/storage/images";

// "הבית" של מטפל/ת מחובר/ת — הועבר מ-"/" (ר' app/(app)/page.tsx) כי אותה
// כתובת שימשה גם לדף הנחיתה הציבורי וגם למסך הזה, מה שהקשה על אבחון
// תקלות (שתי תכולות שונות לגמרי מתחת לאותו URL). "/" עכשיו דף נחיתה
// טהור שמפנה לכאן משתמש/ת מחובר/ת.
export default async function DashboardPage() {
  const { userId, profile } = await requireTherapistProfile();
  const supabase = await createClient();

  const [{ data: clinic }, { data: cards }, { data: nextBooking }] = await Promise.all([
    supabase.from("clinics").select("name, image_path").eq("id", profile.clinic_id).single(),
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
  ]);

  const totalHours = (cards ?? []).reduce((sum, c) => sum + Number(c.hours_remaining), 0);
  const isAdmin = profile.role === "owner" || profile.role === "admin";
  const locale = normalizeLocale(profile.locale);
  const t = getDashboardDict(locale);
  const clinicImageUrl = publicImageUrl(clinic?.image_path);

  return (
    <AppShell side="app" clinicName={clinic?.name} fullName={profile.full_name} locale={profile.locale} isAdmin={isAdmin}>
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
        <div className="flex items-center gap-4">
          {clinicImageUrl && (
            // eslint-disable-next-line @next/next/no-img-element -- Supabase Storage, בלי image optimizer
            <img src={clinicImageUrl} alt={clinic?.name ?? ""} className="size-16 shrink-0 rounded-field object-cover shadow-e1" />
          )}
          <div>
            <h1 className="text-2xl font-semibold">{t.greeting(profile.full_name)}</h1>
            <p className="text-muted-foreground">{clinic?.name}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Card className="shadow-e1">
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">{t.hoursRemaining}</p>
              <p className="tabular-nums text-2xl font-semibold">{totalHours}</p>
            </CardContent>
          </Card>
          <Card className="shadow-e1">
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">{t.nextBooking}</p>
              <p className="text-lg">
                {nextBooking
                  ? `${(nextBooking.rooms as { name?: string } | null)?.name} · ${formatDateTimeHe(new Date(nextBooking.starts_at))}`
                  : t.noUpcomingBookings}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
