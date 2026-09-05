import { requireClinicAdmin } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { addBranchAction, updateBranchAction, addRoomAction, updateRoomAction } from "./actions";

export default async function AdminRoomsPage() {
  const { profile, clinicId } = await requireClinicAdmin();
  const supabase = await createClient();

  const [{ data: clinic }, { data: branches }, { data: rooms }] = await Promise.all([
    supabase.from("clinics").select("name").eq("id", clinicId).single(),
    supabase.from("branches").select("*").eq("clinic_id", clinicId).order("sort_order"),
    supabase.from("rooms").select("*").eq("clinic_id", clinicId).order("sort_order"),
  ]);

  return (
    <AppShell side="admin" clinicName={clinic?.name} fullName={profile.full_name}>
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-8">
        <h1 className="text-2xl font-semibold">סניפים וחדרים</h1>

        {(branches ?? []).map((b) => (
          <Card key={b.id} className="shadow-e1">
            <CardHeader>
              <CardTitle className="text-base font-medium">{b.name}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <form
                action={updateBranchAction}
                className="flex flex-col gap-3 border-b border-border pb-4 sm:flex-row sm:flex-wrap sm:items-end"
              >
                <input type="hidden" name="id" value={b.id} />
                <div className="flex flex-col gap-1">
                  <Label className="text-xs">שם</Label>
                  <Input name="name" defaultValue={b.name} className="w-full sm:w-40" />
                </div>
                <div className="flex flex-col gap-1">
                  <Label className="text-xs">כתובת</Label>
                  <Input name="address" defaultValue={b.address} className="w-full sm:w-56" />
                </div>
                <label className="flex items-center gap-2 text-sm sm:pb-2">
                  <input type="checkbox" name="active" defaultChecked={b.active ?? true} className="size-4 accent-violet-500" />
                  פעיל
                </label>
                <Button type="submit" size="sm" variant="outline" className="w-full sm:w-auto">
                  שמירה
                </Button>
              </form>

              <div className="flex flex-col gap-3">
                {(rooms ?? [])
                  .filter((r) => r.branch_id === b.id)
                  .map((r) => (
                    <form
                      key={r.id}
                      action={updateRoomAction}
                      className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end"
                    >
                      <input type="hidden" name="id" value={r.id} />
                      <div className="flex flex-col gap-1">
                        <Label className="text-xs">שם החדר</Label>
                        <Input name="name" defaultValue={r.name} className="w-full sm:w-36" />
                      </div>
                      <div className="flex flex-col gap-1">
                        <Label className="text-xs">קיבולת</Label>
                        <Input name="capacity" type="number" defaultValue={r.capacity ?? 2} className="w-full sm:w-20" />
                      </div>
                      <div className="flex flex-col gap-1">
                        <Label className="text-xs">תיאור</Label>
                        <Input name="description" defaultValue={r.description ?? ""} className="w-full sm:w-48" />
                      </div>
                      <label className="flex items-center gap-2 text-sm sm:pb-2">
                        <input type="checkbox" name="active" defaultChecked={r.active ?? true} className="size-4 accent-violet-500" />
                        פעיל
                      </label>
                      <Button type="submit" size="sm" variant="outline" className="w-full sm:w-auto">
                        שמירה
                      </Button>
                    </form>
                  ))}
              </div>

              <form
                action={addRoomAction}
                className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:flex-wrap sm:items-end"
              >
                <input type="hidden" name="branch_id" value={b.id} />
                <div className="flex flex-col gap-1">
                  <Label className="text-xs">שם חדר חדש</Label>
                  <Input name="name" required className="w-full sm:w-40" />
                </div>
                <div className="flex flex-col gap-1">
                  <Label className="text-xs">קיבולת</Label>
                  <Input name="capacity" type="number" defaultValue={2} className="w-full sm:w-20" />
                </div>
                <Button type="submit" size="sm" className="w-full sm:w-auto">
                  הוספת חדר
                </Button>
              </form>
            </CardContent>
          </Card>
        ))}

        <Card className="shadow-e1">
          <CardHeader>
            <CardTitle className="text-base font-medium">הוספת סניף</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={addBranchAction} className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="branch_name">שם הסניף</Label>
                <Input id="branch_name" name="name" required />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="branch_address">כתובת</Label>
                <Input id="branch_address" name="address" required />
              </div>
              <Button type="submit" className="w-full sm:w-auto">
                הוספת סניף
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
