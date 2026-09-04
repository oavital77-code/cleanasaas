import Link from "next/link";
import { requireTherapistProfile } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { XCircle } from "lucide-react";

export default async function PurchaseFailurePage() {
  const { profile } = await requireTherapistProfile();
  const supabase = await createClient();
  const { data: clinic } = await supabase.from("clinics").select("name").eq("id", profile.clinic_id).single();
  const isAdmin = profile.role === "owner" || profile.role === "admin";

  return (
    <AppShell side="app" clinicName={clinic?.name} fullName={profile.full_name} isAdmin={isAdmin}>
      <div className="mx-auto flex w-full max-w-md flex-col items-center gap-6 text-center">
        <Card className="w-full shadow-e2 border-danger-border">
          <CardHeader className="items-center">
            <XCircle className="size-10 text-danger" />
            <CardTitle className="text-xl">התשלום לא הושלם</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <p className="text-muted-foreground">שום דבר לא חויב. אפשר לנסות שוב, או לפנות לניהול הקליניקה.</p>
            <Button asChild>
              <Link href="/purchase">ניסיון נוסף</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
