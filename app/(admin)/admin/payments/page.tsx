import { requireClinicAdmin } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { formatCurrencyILS, formatDateTimeHe } from "@/lib/time";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { markSessionPaymentCashAction } from "./actions";
import { getAdminPaymentsDict, getAdminTherapistDetailDict, getCommonDict, normalizeLocale } from "@/lib/i18n";

const STATUS_TONE: Record<string, string> = {
  pending: "bg-warning-bg text-warning-fg",
  paid: "bg-success-bg text-success-fg",
  failed: "bg-danger-bg text-danger",
  refunded: "bg-subtle text-muted-foreground",
};

export default async function AdminPaymentsPage() {
  const { profile, clinicId } = await requireClinicAdmin();
  const supabase = await createClient();
  const locale = normalizeLocale(profile.locale);
  const t = getAdminPaymentsDict(locale);
  const c = getCommonDict(locale);
  const methods = getAdminTherapistDetailDict(locale).paymentMethods;

  const [{ data: clinic }, { data: payments }] = await Promise.all([
    supabase.from("clinics").select("name").eq("id", clinicId).single(),
    supabase
      .from("payments")
      .select("id, type, status, method, amount_total, created_at, paid_at, profiles(full_name)")
      .eq("clinic_id", clinicId)
      .order("created_at", { ascending: false })
      .limit(100),
  ]);

  return (
    <AppShell side="admin" clinicName={clinic?.name} fullName={profile.full_name} locale={profile.locale}>
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold">{t.title}</h1>
          <p className="text-sm text-muted-foreground">{t.intro}</p>
        </div>

        <Card className="shadow-e1 overflow-hidden p-0">
          <CardContent className="overflow-x-auto p-0">
            <table className="w-full text-sm">
              <thead className="bg-muted">
                <tr>
                  <th className="p-3 text-start font-medium">{t.colTherapist}</th>
                  <th className="hidden p-3 text-start font-medium sm:table-cell">{t.colType}</th>
                  <th className="p-3 text-start font-medium">{t.colAmount}</th>
                  <th className="p-3 text-start font-medium">{t.colStatus}</th>
                  <th className="hidden p-3 text-start font-medium sm:table-cell">{t.colMethod}</th>
                  <th className="hidden p-3 text-start font-medium md:table-cell">{t.colDate}</th>
                  <th className="p-3 font-medium" />
                </tr>
              </thead>
              <tbody>
                {(payments ?? []).map((p) => {
                  const isSessionPending = p.status === "pending" && (p.type === "session_initial" || p.type === "session_recurring");
                  return (
                    <tr key={p.id} className="border-t border-border">
                      <td className="p-3">{(p.profiles as { full_name?: string } | null)?.full_name}</td>
                      <td className="hidden p-3 sm:table-cell">{c.paymentType[p.type] ?? p.type}</td>
                      <td className="tabular-nums p-3">{formatCurrencyILS(p.amount_total)}</td>
                      <td className="p-3">
                        <span className={`rounded-pill px-2.5 py-1 text-xs font-medium ${STATUS_TONE[p.status] ?? "bg-subtle"}`}>
                          {c.paymentStatus[p.status] ?? p.status}
                        </span>
                      </td>
                      <td className="hidden p-3 text-muted-foreground sm:table-cell">{p.method ? (methods[p.method] ?? p.method) : "—"}</td>
                      <td className="hidden p-3 text-muted-foreground md:table-cell">
                        {formatDateTimeHe(new Date(p.paid_at ?? p.created_at ?? "1970-01-01T00:00:00Z"))}
                      </td>
                      <td className="p-3">
                        {isSessionPending && (
                          <form action={markSessionPaymentCashAction}>
                            <input type="hidden" name="payment_id" value={p.id} />
                            <input type="hidden" name="kind" value={p.type === "session_recurring" ? "recurring" : "initial"} />
                            <Button type="submit" size="sm" variant="outline">
                              {t.markPaidCash}
                            </Button>
                          </form>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
