import { requireTherapistProfile } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { formatCurrencyILS, formatDateTimeHe } from "@/lib/time";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent } from "@/components/ui/card";

const TYPE_LABEL: Record<string, string> = {
  punch_card: "כרטיסייה",
  session_initial: "ססיה — תשלום ראשון",
  session_recurring: "ססיה — חיוב חודשי",
  overrun: "חריגת זמן",
  deposit_topup: "השלמת פיקדון",
};

const STATUS_LABEL: Record<string, { label: string; tone: string }> = {
  pending: { label: "ממתין", tone: "bg-warning-bg text-warning-fg" },
  paid: { label: "שולם", tone: "bg-success-bg text-success-fg" },
  failed: { label: "נכשל", tone: "bg-danger-bg text-danger" },
  refunded: { label: "זוכה", tone: "bg-subtle text-muted-foreground" },
};

export default async function PaymentsPage() {
  const { userId, profile } = await requireTherapistProfile();
  const supabase = await createClient();

  const [{ data: clinic }, { data: payments }] = await Promise.all([
    supabase.from("clinics").select("name").eq("id", profile.clinic_id).single(),
    supabase
      .from("payments")
      .select("id, type, status, amount_total, invoice_url, created_at, paid_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  const isAdmin = profile.role === "owner" || profile.role === "admin";

  return (
    <AppShell side="app" clinicName={clinic?.name} fullName={profile.full_name} isAdmin={isAdmin}>
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
        <h1 className="text-2xl font-semibold">תשלומים</h1>

        {(!payments || payments.length === 0) && <p className="text-muted-foreground">אין עדיין היסטוריית תשלומים.</p>}

        <div className="flex flex-col gap-2">
          {(payments ?? []).map((p) => {
            const status = STATUS_LABEL[p.status] ?? { label: p.status, tone: "bg-subtle" };
            return (
              <Card key={p.id} className="shadow-e1">
                <CardContent className="flex items-center justify-between gap-3 p-4 text-sm">
                  <div>
                    <p className="font-medium">{TYPE_LABEL[p.type] ?? p.type}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDateTimeHe(new Date(p.paid_at ?? p.created_at ?? "1970-01-01T00:00:00Z"))}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="tabular-nums font-medium">{formatCurrencyILS(p.amount_total)}</span>
                    <span className={`rounded-pill px-2.5 py-1 text-xs font-medium ${status.tone}`}>{status.label}</span>
                    {p.invoice_url && (
                      <a href={p.invoice_url} target="_blank" rel="noreferrer" className="text-xs text-violet-600 underline">
                        חשבונית
                      </a>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </AppShell>
  );
}
