import { requireTherapistProfile } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { formatCurrencyILS, formatDateTimeHe } from "@/lib/time";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent } from "@/components/ui/card";
import { getCommonDict, getPaymentsDict, normalizeLocale } from "@/lib/i18n";

const STATUS_TONE: Record<string, string> = {
  pending: "bg-warning-bg text-warning-fg",
  paid: "bg-success-bg text-success-fg",
  failed: "bg-danger-bg text-danger",
  refunded: "bg-subtle text-muted-foreground",
};

export default async function PaymentsPage() {
  const { userId, profile } = await requireTherapistProfile();
  const supabase = await createClient();
  const locale = normalizeLocale(profile.locale);
  const t = getPaymentsDict(locale);
  const c = getCommonDict(locale);

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
    <AppShell side="app" clinicName={clinic?.name} fullName={profile.full_name} locale={profile.locale} isAdmin={isAdmin}>
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
        <h1 className="text-2xl font-semibold">{t.title}</h1>

        {(!payments || payments.length === 0) && <p className="text-muted-foreground">{t.empty}</p>}

        <div className="flex flex-col gap-2">
          {(payments ?? []).map((p) => (
            <Card key={p.id} className="shadow-e1">
              <CardContent className="flex items-center justify-between gap-3 p-4 text-sm">
                <div>
                  <p className="font-medium">{c.paymentType[p.type] ?? p.type}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDateTimeHe(new Date(p.paid_at ?? p.created_at ?? "1970-01-01T00:00:00Z"))}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="tabular-nums font-medium">{formatCurrencyILS(p.amount_total)}</span>
                  <span className={`rounded-pill px-2.5 py-1 text-xs font-medium ${STATUS_TONE[p.status] ?? "bg-subtle"}`}>
                    {c.paymentStatus[p.status] ?? p.status}
                  </span>
                  {p.invoice_url && (
                    <a href={p.invoice_url} target="_blank" rel="noreferrer" className="text-xs text-violet-600 underline">
                      {t.invoice}
                    </a>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
