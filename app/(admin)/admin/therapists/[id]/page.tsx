import { notFound } from "next/navigation";
import { requireClinicAdmin } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { formatCurrencyILS, formatDateHe, formatDateTimeHe } from "@/lib/time";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import {
  updateRoleStatusAction,
  updateAdminNoteAction,
  grantBonusHoursAction,
  adjustPunchCardHoursAction,
  completeDepositAction,
} from "./actions";

// לפני התיקון הוצג כאן ה-enum הגולמי מה-DB (confirmed/cancelled_by_user/…) —
// אדמין לא היה מבחין בקלות אילו הזמנות בוטלו. עכשיו תווית עברית + צבע.
const BOOKING_STATUS_LABEL: Record<string, { label: string; tone: string }> = {
  confirmed: { label: "מאושרת", tone: "bg-success-bg text-success-fg" },
  cancelled_by_user: { label: 'בוטלה ע"י המטפל/ת', tone: "bg-danger-bg text-danger" },
  cancelled_by_admin: { label: 'בוטלה ע"י אדמין', tone: "bg-danger-bg text-danger" },
  completed: { label: "הסתיימה", tone: "bg-subtle text-muted-foreground" },
  no_show: { label: "לא הגיע/ה", tone: "bg-warning-bg text-warning-fg" },
};

export default async function TherapistDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { profile, clinicId } = await requireClinicAdmin();
  const supabase = await createClient();

  const [
    { data: clinic },
    { data: target },
    { data: cards },
    { data: bookings },
    { data: payments },
    { data: subscriptions },
    { data: note },
  ] = await Promise.all([
    supabase.from("clinics").select("name").eq("id", clinicId).single(),
    supabase.from("profiles").select("*").eq("id", id).eq("clinic_id", clinicId).maybeSingle(),
    supabase.from("punch_cards").select("*").eq("user_id", id).order("expires_at", { ascending: false }),
    supabase.from("bookings").select("id, starts_at, status, rooms(name)").eq("user_id", id).order("starts_at", { ascending: false }).limit(10),
    supabase.from("payments").select("id, type, status, amount_total, created_at").eq("user_id", id).order("created_at", { ascending: false }).limit(10),
    supabase.from("session_subscriptions").select("id, status, weekly_hours, monthly_price").eq("user_id", id).order("created_at", { ascending: false }),
    supabase.from("therapist_admin_notes").select("note").eq("user_id", id).maybeSingle(),
  ]);

  if (!target) notFound();

  return (
    <AppShell side="admin" clinicName={clinic?.name} fullName={profile.full_name}>
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
        <div>
          <h1 className="text-2xl font-semibold">{target.full_name}</h1>
          <p className="text-sm text-muted-foreground" dir="ltr">
            {target.phone} · {target.email}
          </p>
        </div>

        <Card className="shadow-e1">
          <CardHeader>
            <CardTitle className="text-base font-medium">תפקיד וסטטוס</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={updateRoleStatusAction} className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
              <input type="hidden" name="user_id" value={target.id} />
              <div className="flex flex-col gap-1">
                <Label className="text-xs">תפקיד</Label>
                <Select name="role" defaultValue={target.role} className="sm:w-auto">
                  <option value="therapist">מטפל/ת</option>
                  <option value="admin">אדמין/ית</option>
                  <option value="owner">בעלים</option>
                </Select>
              </div>
              <div className="flex flex-col gap-1">
                <Label className="text-xs">סטטוס</Label>
                <Select name="status" defaultValue={target.status} className="sm:w-auto">
                  <option value="active">פעיל</option>
                  <option value="suspended">מושעה</option>
                  <option value="archived">בארכיון</option>
                </Select>
              </div>
              <Button type="submit" size="sm" variant="outline" className="w-full sm:w-auto">
                שמירה
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="shadow-e1">
          <CardHeader>
            <CardTitle className="text-base font-medium">כרטיסיות</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {(cards ?? []).map((c) => (
              <div key={c.id} className="flex flex-col gap-2 border-b border-border pb-3 text-sm last:border-0">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="tabular-nums">
                    {c.hours_remaining} שעות · פיקדון {c.deposit_remaining}/{c.deposit_amount}
                  </span>
                  <span className="text-muted-foreground">
                    {c.active ? "פעילה" : "לא פעילה"} · עד {formatDateHe(new Date(c.expires_at))}
                  </span>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end">
                  <form action={adjustPunchCardHoursAction} className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end">
                    <input type="hidden" name="user_id" value={target.id} />
                    <input type="hidden" name="card_id" value={c.id} />
                    <Input name="delta" type="number" step="0.5" placeholder="+/- שעות" className="w-full sm:w-28" />
                    <Input name="note" placeholder="הערה" className="w-full sm:w-32" />
                    <Button type="submit" size="sm" variant="outline" className="w-full sm:w-auto">
                      עדכון יתרה
                    </Button>
                  </form>
                  {c.deposit_remaining < c.deposit_amount && (
                    <form action={completeDepositAction}>
                      <input type="hidden" name="user_id" value={target.id} />
                      <input type="hidden" name="card_id" value={c.id} />
                      <Button type="submit" size="sm" variant="outline" className="w-full sm:w-auto">
                        השלמת פיקדון
                      </Button>
                    </form>
                  )}
                </div>
              </div>
            ))}
            {(!cards || cards.length === 0) && <p className="text-sm text-muted-foreground">אין כרטיסיות.</p>}

            <form
              action={grantBonusHoursAction}
              className="flex flex-col gap-2 border-t border-border pt-4 sm:flex-row sm:flex-wrap sm:items-end"
            >
              <input type="hidden" name="user_id" value={target.id} />
              <div className="flex flex-col gap-1">
                <Label className="text-xs">מתנת שעות</Label>
                <Input name="hours" type="number" step="0.5" min="0.5" className="w-full sm:w-24" />
              </div>
              <Input name="note" placeholder="סיבה" className="w-full sm:w-40" />
              <Button type="submit" size="sm" className="w-full sm:w-auto">
                הענקת שעות
              </Button>
            </form>
          </CardContent>
        </Card>

        {subscriptions && subscriptions.length > 0 && (
          <Card className="shadow-e1">
            <CardHeader>
              <CardTitle className="text-base font-medium">ססיות</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2 text-sm">
              {subscriptions.map((s) => (
                <div key={s.id} className="flex flex-wrap items-center justify-between gap-2">
                  <span>
                    {s.weekly_hours} שעות · {formatCurrencyILS(s.monthly_price)}/חודש
                  </span>
                  <span className="text-muted-foreground">{s.status}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        <Card className="shadow-e1">
          <CardHeader>
            <CardTitle className="text-base font-medium">הזמנות אחרונות</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-sm">
            {(bookings ?? []).map((b) => {
              const status = BOOKING_STATUS_LABEL[b.status] ?? { label: b.status, tone: "bg-subtle" };
              return (
                <div key={b.id} className="flex flex-wrap items-center justify-between gap-2">
                  <span>
                    {(b.rooms as { name?: string } | null)?.name} · {formatDateTimeHe(new Date(b.starts_at))}
                  </span>
                  <span className={`rounded-pill px-2.5 py-1 text-xs font-medium ${status.tone}`}>{status.label}</span>
                </div>
              );
            })}
            {(!bookings || bookings.length === 0) && <p className="text-muted-foreground">אין הזמנות.</p>}
          </CardContent>
        </Card>

        <Card className="shadow-e1">
          <CardHeader>
            <CardTitle className="text-base font-medium">תשלומים אחרונים</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-sm">
            {(payments ?? []).map((p) => (
              <div key={p.id} className="flex flex-wrap items-center justify-between gap-2">
                <span>{p.type}</span>
                <span className="flex items-center gap-2">
                  <span className="tabular-nums">{formatCurrencyILS(p.amount_total)}</span>
                  <span className="text-muted-foreground">{p.status}</span>
                </span>
              </div>
            ))}
            {(!payments || payments.length === 0) && <p className="text-muted-foreground">אין תשלומים.</p>}
          </CardContent>
        </Card>

        <Card className="shadow-e1">
          <CardHeader>
            <CardTitle className="text-base font-medium">הערת אדמין (פנימית)</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={updateAdminNoteAction} className="flex flex-col gap-3">
              <input type="hidden" name="user_id" value={target.id} />
              <textarea
                name="note"
                defaultValue={note?.note ?? ""}
                rows={3}
                // text-base עד md — אותו כלל של iOS כמו ב-Input/Select.
                className="rounded-field border border-border-strong bg-surface p-3 text-base focus-visible:border-violet-500 focus-visible:outline-none focus-visible:[box-shadow:var(--focus-ring)] md:text-sm"
              />
              <Button type="submit" size="sm" variant="outline" className="w-fit">
                שמירת הערה
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
