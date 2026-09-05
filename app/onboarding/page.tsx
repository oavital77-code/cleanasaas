import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppHeader } from "@/components/app-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import {
  completeSignupClinicFromMetadata,
  addBranchAction,
  addRoomAction,
  seedDefaultPricingAction,
  toggleSessionsAction,
  finishOnboardingAction,
} from "./actions";

// wizard הקמה (SAASMIGRATIONSPEC §5): סניפים → חדרים → תמחור → הפעלת ססיה.
// כל שלב כותב ישירות דרך RPC/direct-write ומרענן את אותו עמוד — לא state
// בצד לקוח. אין ברירת מחדל גלובלית משותפת בין עסקים: כל שורה כאן נוצרת עם
// clinic_id של הקליניקה הזו בלבד (נגזר מהמשתמש המחובר בתוך ה-RPCs עצמן).
function StepNumber({ n }: { n: number }) {
  return (
    <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-violet-500 text-sm font-semibold text-white">
      {n}
    </span>
  );
}

export default async function OnboardingPage() {
  await completeSignupClinicFromMetadata();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("clinic_id, role").eq("id", user.id).maybeSingle();
  if (!profile) redirect("/login");

  const { data: clinic } = await supabase.from("clinics").select("*").eq("id", profile.clinic_id).single();
  const { data: branches } = await supabase.from("branches").select("*").order("sort_order");
  const { data: rooms } = await supabase.from("rooms").select("*, branches(name)").order("sort_order");
  const { data: tiers } = await supabase.from("punch_card_tiers").select("*").order("sort_order");

  if (!tiers || tiers.length === 0) {
    await seedDefaultPricingAction();
  }

  return (
    <div className="flex flex-1 flex-col">
      <AppHeader clinicName={clinic?.name} role={profile.role} />
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 p-6 sm:p-8">
        <div>
          <h1 className="text-2xl font-semibold">הקמת {clinic?.name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            שלושה שלבים בסיסיים — הכל ניתן לעריכה מאוחר יותר דרך פאנל הניהול.
          </p>
        </div>

        <Card className="shadow-e1">
          <CardHeader className="flex-row items-center gap-3 space-y-0">
            <StepNumber n={1} />
            <CardTitle className="text-base font-medium">סניפים</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <ul className="flex flex-col gap-1 text-sm">
              {(branches ?? []).map((b) => (
                <li key={b.id} className="text-muted-foreground">
                  {b.name} — {b.address}
                </li>
              ))}
            </ul>
            <form action={addBranchAction} className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="branch_name">שם הסניף</Label>
                <Input id="branch_name" name="name" required />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="branch_address">כתובת</Label>
                <Input id="branch_address" name="address" required />
              </div>
              <Button type="submit" className="w-full sm:w-auto">הוספת סניף</Button>
            </form>
          </CardContent>
        </Card>

        <Card className="shadow-e1">
          <CardHeader className="flex-row items-center gap-3 space-y-0">
            <StepNumber n={2} />
            <CardTitle className="text-base font-medium">חדרים</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <ul className="flex flex-col gap-1 text-sm">
              {(rooms ?? []).map((r) => (
                <li key={r.id} className="text-muted-foreground">
                  {r.name} ({(r.branches as { name?: string } | null)?.name})
                </li>
              ))}
            </ul>
            {branches && branches.length > 0 ? (
              <form action={addRoomAction} className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="room_branch">סניף</Label>
                  <Select id="room_branch" name="branch_id" required className="sm:w-auto">
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="room_name">שם החדר</Label>
                  <Input id="room_name" name="name" required />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="room_type">סוג</Label>
                  <Select id="room_type" name="room_type" className="sm:w-auto">
                    <option value="talk">שיח</option>
                    <option value="touch">מגע</option>
                    <option value="podcast">פודקאסט</option>
                    <option value="group">קבוצתי</option>
                  </Select>
                </div>
                <Button type="submit" className="w-full sm:w-auto">הוספת חדר</Button>
              </form>
            ) : (
              <p className="text-sm text-muted-foreground">הוסיפו סניף קודם.</p>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-e1">
          <CardHeader className="flex-row items-center gap-3 space-y-0">
            <StepNumber n={3} />
            <CardTitle className="text-base font-medium">תמחור כרטיסייה</CardTitle>
            <CardDescription className="mr-auto">ברירת מחדל — לעריכה בהגדרות</CardDescription>
          </CardHeader>
          <CardContent>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-right text-muted-foreground">
                  <th className="font-normal">שעות</th>
                  <th className="font-normal">₪/שעה</th>
                </tr>
              </thead>
              <tbody>
                {(tiers ?? []).map((t) => (
                  <tr key={t.id}>
                    <td className="tabular-nums py-1">{t.hours}</td>
                    <td className="tabular-nums py-1">{t.price_per_hour}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>

        <Card className="shadow-e1">
          <CardHeader className="flex-row items-center gap-3 space-y-0">
            <StepNumber n={4} />
            <CardTitle className="text-base font-medium">מודל ססיה (מנוי חודשי קבוע)</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={toggleSessionsAction} className="flex flex-wrap items-center gap-3">
              <input
                type="checkbox"
                id="sessions_enabled"
                name="sessions_enabled"
                defaultChecked={clinic?.sessions_enabled}
                className="size-4 accent-violet-500"
              />
              <Label htmlFor="sessions_enabled" className="font-normal">
                יש בעסק שלי גם מודל ססיה, לא רק כרטיסיות
              </Label>
              <Button type="submit" variant="outline" size="sm">
                שמירה
              </Button>
            </form>
          </CardContent>
        </Card>

        <form action={finishOnboardingAction}>
          <Button type="submit" size="lg" className="w-full">
            סיום — כניסה למערכת
          </Button>
        </form>
      </main>
    </div>
  );
}
