import { redirect } from "next/navigation";
import { requireTherapistProfile } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { SlotBuilder } from "@/components/slot-builder";
import { requestSessionAction } from "../actions";
import { getCommonDict, getSessionsDict, normalizeLocale } from "@/lib/i18n";
import { SESSION_KEYS, readSessionPricing } from "@/lib/session-pricing";
import { formatCurrencyILS } from "@/lib/time";

export default async function NewSessionPage() {
  const { profile } = await requireTherapistProfile();
  const supabase = await createClient();
  const locale = normalizeLocale(profile.locale);
  const t = getSessionsDict(locale);
  const c = getCommonDict(locale);

  const [{ data: clinic }, { data: rooms }, { data: settingsRows }] = await Promise.all([
    supabase.from("clinics").select("name, sessions_enabled").eq("id", profile.clinic_id).single(),
    supabase.from("rooms").select("id, name").eq("clinic_id", profile.clinic_id).eq("active", true).order("sort_order"),
    supabase
      .from("app_settings")
      .select("key, value")
      .eq("clinic_id", profile.clinic_id)
      .in("key", Object.values(SESSION_KEYS)),
  ]);

  if (!clinic?.sessions_enabled) redirect("/sessions");

  // אותו טווח ומחיר שה-DB אוכף ב-request_session (session_pricing).
  const pricing = readSessionPricing(Object.fromEntries((settingsRows ?? []).map((r) => [r.key, r.value])));
  const isAdmin = profile.role === "owner" || profile.role === "admin";

  return (
    <AppShell side="app" clinicName={clinic?.name} fullName={profile.full_name} locale={profile.locale} isAdmin={isAdmin}>
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
        <h1 className="text-2xl font-semibold">{t.newTitle}</h1>

        <Card className="shadow-e1">
          <CardHeader>
            <CardTitle className="text-base font-medium">{t.fixedSlotsTitle}</CardTitle>
            <CardDescription>
              {t.fixedSlotsDescription(pricing.minHours, pricing.maxHours, formatCurrencyILS(pricing.pricePerHour))}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {rooms && rooms.length > 0 ? (
              <SlotBuilder
                rooms={rooms}
                action={requestSessionAction}
                pricing={pricing}
                submitLabel={t.submitRequest}
                pendingLabel={c.sending}
              />
            ) : (
              <p className="text-muted-foreground">{c.noRoomsYet}</p>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
