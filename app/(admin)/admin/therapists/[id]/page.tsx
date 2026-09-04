import { notFound } from "next/navigation";
import { requireClinicAdmin } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { formatCurrencyILS, formatDateHe, formatDateTimeHe } from "@/lib/time";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  updateRoleStatusAction,
  updateAdminNoteAction,
  grantBonusHoursAction,
  adjustPunchCardHoursAction,
  completeDepositAction,
} from "./actions";

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
            <form action={updateRoleStatusAction} className="flex flex-wrap items-end gap-3">
              <input type="hidden" name="user_id" value={target.id} />
              <div className="flex flex-col gap-1">
                <Label className="text-xs">תפקיד</Label>
                <select name="role" defaultValue={target.role} className="h-10 rounded-field border border-input bg-background px-3">
                  <option value="therapist">מטפל/ת</option>
                  <option value="admin">אדמין/ית</option>
                  <option value="owner">בעלים</option>
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <Label className="text-xs">סטטוס</Label>
                <select name="status" defaultValue={target.status} className="h-10 rounded-field border border-input bg-background px-3">
                  <option value="active">פעיל</option>
                  <option value="suspended">מושעה</option>
                  <option value="archived">בארכיון</option>
                </select>
              </div>
              <Button type="submit" size="sm" variant="outline">
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
                <div className="flex items-center justify-between">
                  <span className="tabular-nums">
                    {c.hours_remaining} שעות · פיקדון {c.deposit_remaining}/{c.deposit_amount}
                  </span>
                  <span className="text-muted-foreground">
                    {c.active ? "פעילה" : "לא פעילה"} · עד {formatDateHe(new Date(c.expires_at))}
                  </span>
                </div>
                <div className="flex flex-wrap items-end gap-2">
                  <form action={adjustPunchCardHoursAction} className="flex items-end gap-2">
                    <input type="hidden" name="user_id" value={target.id} />
                    <input type="hidden" name="card_id" value={c.id} />
                    <Input name="delta" type="number" step="0.5" placeholder="+/- שעות" className="w-28" />
                    <Input name="note" placeholder="הערה" className="w-32" />
                    <Button type="submit" size="sm" variant="outline">
                      עדכון יתרה
                    </Button>
                  </form>
                  {c.deposit_remaining < c.deposit_amount && (
                    <form action={completeDepositAction}>
                      <input type="hidden" name="user_id" value={target.id} />
                      <input type="hidden" name="card_id" value={c.id} />
                      <Button type="submit" size="sm" variant="outline">
                        השלמת פיקדון
                      </Button>
                    </form>
                  )}
                </div>
              </div>
            ))}
            {(!cards || cards.length === 0) && <p className="text-sm text-muted-foreground">אין כרטיסיות.</p>}

            <form action={grantBonusHoursAction} className="flex flex-wrap items-end gap-2 border-t border-border pt-4">
              <input type="hidden" name="user_id" value={target.id} />
              <div className="flex flex-col gap-1">
                <Label className="text-xs">מתנת שעות</Label>
                <Input name="hours" type="number" step="0.5" min="0.5" className="w-24" />
              </div>
              <Input name="note" placeholder="סיבה" className="w-40" />
              <Button type="submit" size="sm">
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
                <div key={s.id} className="flex items-center justify-between">
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
            {(bookings ?? []).map((b) => (
              <div key={b.id} className="flex items-center justify-between">
                <span>
                  {(b.rooms as { name?: string } | null)?.name} · {formatDateTimeHe(new Date(b.starts_at))}
                </span>
                <span className="text-muted-foreground">{b.status}</span>
              </div>
            ))}
            {(!bookings || bookings.length === 0) && <p className="text-muted-foreground">אין הזמנות.</p>}
          </CardContent>
        </Card>

        <Card className="shadow-e1">
          <CardHeader>
            <CardTitle className="text-base font-medium">תשלומים אחרונים</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-sm">
            {(payments ?? []).map((p) => (
              <div key={p.id} className="flex items-center justify-between">
                <span>{p.type}</span>
                <span className="tabular-nums">{formatCurrencyILS(p.amount_total)}</span>
                <span className="text-muted-foreground">{p.status}</span>
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
                className="rounded-field border border-input bg-background p-3 text-sm"
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
