import { requireClinicAdmin } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { formatCurrencyILS, formatDateTimeHe } from "@/lib/time";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { markSessionPaymentCashAction } from "./actions";

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

export default async function AdminPaymentsPage() {
  const { profile, clinicId } = await requireClinicAdmin();
  const supabase = await createClient();

  const [{ data: clinic }, { data: payments }] = await Promise.all([
    supabase.from("clinics").select("name").eq("id", clinicId).single(),
    supabase
      .from("payments")
      .select("id, type, status, amount_total, created_at, paid_at, profiles(full_name)")
      .eq("clinic_id", clinicId)
      .order("created_at", { ascending: false })
      .limit(100),
  ]);

  return (
    <AppShell side="admin" clinicName={clinic?.name} fullName={profile.full_name}>
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
        <h1 className="text-2xl font-semibold">תשלומים</h1>

        <Card className="shadow-e1 overflow-hidden p-0">
          <CardContent className="overflow-x-auto p-0">
            <table className="w-full text-sm">
              <thead className="bg-muted text-right">
                <tr>
                  <th className="p-3 font-medium">מטפל/ת</th>
                  <th className="p-3 font-medium">סוג</th>
                  <th className="p-3 font-medium">סכום</th>
                  <th className="p-3 font-medium">סטטוס</th>
                  <th className="p-3 font-medium">תאריך</th>
                  <th className="p-3 font-medium" />
                </tr>
              </thead>
              <tbody>
                {(payments ?? []).map((p) => {
                  const status = STATUS_LABEL[p.status] ?? { label: p.status, tone: "bg-subtle" };
                  const isSessionPending = p.status === "pending" && (p.type === "session_initial" || p.type === "session_recurring");
                  return (
                    <tr key={p.id} className="border-t border-border">
                      <td className="p-3">{(p.profiles as { full_name?: string } | null)?.full_name}</td>
                      <td className="p-3">{TYPE_LABEL[p.type] ?? p.type}</td>
                      <td className="tabular-nums p-3">{formatCurrencyILS(p.amount_total)}</td>
                      <td className="p-3">
                        <span className={`rounded-pill px-2.5 py-1 text-xs font-medium ${status.tone}`}>{status.label}</span>
                      </td>
                      <td className="p-3 text-muted-foreground">{formatDateTimeHe(new Date(p.paid_at ?? p.created_at ?? "1970-01-01T00:00:00Z"))}</td>
                      <td className="p-3">
                        {isSessionPending && (
                          <form action={markSessionPaymentCashAction}>
                            <input type="hidden" name="payment_id" value={p.id} />
                            <input type="hidden" name="kind" value={p.type === "session_recurring" ? "recurring" : "initial"} />
                            <Button type="submit" size="sm" variant="outline">
                              סימון כשולם במזומן
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
