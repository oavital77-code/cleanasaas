import Link from "next/link";
import { requireTherapistProfile } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { XCircle } from "lucide-react";
import { getPurchaseDict, normalizeLocale } from "@/lib/i18n";

export default async function PurchaseFailurePage() {
  const { profile } = await requireTherapistProfile();
  const supabase = await createClient();
  const { data: clinic } = await supabase.from("clinics").select("name").eq("id", profile.clinic_id).single();
  const isAdmin = profile.role === "owner" || profile.role === "admin";
  const t = getPurchaseDict(normalizeLocale(profile.locale));

  return (
    <AppShell side="app" clinicName={clinic?.name} fullName={profile.full_name} locale={profile.locale} isAdmin={isAdmin}>
      <div className="mx-auto flex w-full max-w-md flex-col items-center gap-6 text-center">
        <Card className="w-full shadow-e2 border-danger-border">
          <CardHeader className="items-center">
            <XCircle className="size-10 text-danger" />
            <CardTitle className="text-xl">{t.failureTitle}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <p className="text-muted-foreground">{t.failureBody}</p>
            <Button asChild>
              <Link href="/purchase">{t.tryAgain}</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
