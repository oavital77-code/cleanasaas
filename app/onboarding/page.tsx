import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-10 p-8">
      <div>
        <h1 className="text-2xl font-semibold">הקמת {clinic?.name}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          שלושה שלבים בסיסיים — הכל ניתן לעריכה מאוחר יותר דרך פאנל הניהול.
        </p>
      </div>

      <section className="flex flex-col gap-4 rounded-lg border p-5">
        <h2 className="font-medium">1. סניפים</h2>
        <ul className="flex flex-col gap-1 text-sm">
          {(branches ?? []).map((b) => (
            <li key={b.id} className="text-muted-foreground">
              {b.name} — {b.address}
            </li>
          ))}
        </ul>
        <form action={addBranchAction} className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="branch_name">שם הסניף</Label>
            <Input id="branch_name" name="name" required />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="branch_address">כתובת</Label>
            <Input id="branch_address" name="address" required />
          </div>
          <Button type="submit">הוספת סניף</Button>
        </form>
      </section>

      <section className="flex flex-col gap-4 rounded-lg border p-5">
        <h2 className="font-medium">2. חדרים</h2>
        <ul className="flex flex-col gap-1 text-sm">
          {(rooms ?? []).map((r) => (
            <li key={r.id} className="text-muted-foreground">
              {r.name} ({(r.branches as { name?: string } | null)?.name})
            </li>
          ))}
        </ul>
        {branches && branches.length > 0 ? (
          <form action={addRoomAction} className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="room_branch">סניף</Label>
              <select id="room_branch" name="branch_id" required className="h-10 rounded-md border border-input bg-background px-3">
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="room_name">שם החדר</Label>
              <Input id="room_name" name="name" required />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="room_type">סוג</Label>
              <select id="room_type" name="room_type" className="h-10 rounded-md border border-input bg-background px-3">
                <option value="talk">שיח</option>
                <option value="touch">מגע</option>
                <option value="podcast">פודקאסט</option>
                <option value="group">קבוצתי</option>
              </select>
            </div>
            <Button type="submit">הוספת חדר</Button>
          </form>
        ) : (
          <p className="text-sm text-muted-foreground">הוסיפו סניף קודם.</p>
        )}
      </section>

      <section className="flex flex-col gap-4 rounded-lg border p-5">
        <h2 className="font-medium">3. תמחור כרטיסייה (ברירת מחדל — לעריכה בהגדרות)</h2>
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
                <td>{t.hours}</td>
                <td>{t.price_per_hour}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="flex flex-col gap-4 rounded-lg border p-5">
        <h2 className="font-medium">4. מודל ססיה (מנוי חודשי קבוע)</h2>
        <form action={toggleSessionsAction} className="flex items-center gap-3">
          <input type="checkbox" id="sessions_enabled" name="sessions_enabled" defaultChecked={clinic?.sessions_enabled} />
          <Label htmlFor="sessions_enabled">יש בעסק שלי גם מודל ססיה, לא רק כרטיסיות</Label>
          <Button type="submit" variant="outline">
            שמירה
          </Button>
        </form>
      </section>

      <form action={finishOnboardingAction}>
        <Button type="submit" className="w-full">
          סיום — כניסה למערכת
        </Button>
      </form>
    </main>
  );
}
