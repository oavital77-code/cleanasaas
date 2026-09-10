import { requireClinicAdmin } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  addBranchAction,
  updateBranchAction,
  addRoomAction,
  updateRoomAction,
  deleteRoomImageAction,
  deleteClinicImageAction,
} from "./actions";
import { ImageUpload } from "./image-upload";
import { getAdminRoomsDict, normalizeLocale } from "@/lib/i18n";
import { MAX_ROOM_IMAGES, publicImageUrl } from "@/lib/storage/images";
import { X } from "lucide-react";

export default async function AdminRoomsPage({ searchParams }: { searchParams: Promise<{ notice?: string }> }) {
  const { profile, clinicId } = await requireClinicAdmin();
  const supabase = await createClient();
  const t = getAdminRoomsDict(normalizeLocale(profile.locale));
  const { notice } = await searchParams;
  const noticeText = notice ? t.imageNotices[notice] : undefined;

  const [{ data: clinic }, { data: branches }, { data: rooms }] = await Promise.all([
    supabase.from("clinics").select("name, image_path").eq("id", clinicId).single(),
    supabase.from("branches").select("*").eq("clinic_id", clinicId).order("sort_order"),
    supabase.from("rooms").select("*").eq("clinic_id", clinicId).order("sort_order"),
  ]);

  const clinicImageUrl = publicImageUrl(clinic?.image_path);

  return (
    <AppShell side="admin" clinicName={clinic?.name} fullName={profile.full_name} locale={profile.locale}>
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-8">
        <h1 className="text-2xl font-semibold">{t.title}</h1>

        {noticeText && <p className="rounded-field bg-warning-bg px-3 py-2 text-sm text-warning-fg">{noticeText}</p>}

        <Card className="shadow-e1">
          <CardHeader>
            <CardTitle className="text-base font-medium">{t.clinicImageTitle}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-start">
            {clinicImageUrl ? (
              <div className="relative w-fit">
                {/* eslint-disable-next-line @next/next/no-img-element -- Supabase Storage, בלי image optimizer */}
                <img src={clinicImageUrl} alt={clinic?.name ?? ""} className="h-32 w-48 rounded-field object-cover shadow-e1" />
                <form action={deleteClinicImageAction} className="absolute top-1 end-1">
                  <button
                    type="submit"
                    title={t.removeImage}
                    aria-label={t.removeImage}
                    className="flex size-7 items-center justify-center rounded-full bg-surface/90 text-muted-foreground shadow-e1 hover:text-danger"
                  >
                    <X className="size-3.5" />
                  </button>
                </form>
              </div>
            ) : (
              <div className="flex h-32 w-48 items-center justify-center rounded-field bg-subtle text-xs text-muted-foreground">
                {t.noImage}
              </div>
            )}
            <div className="flex flex-1 flex-col gap-2">
              <Label className="text-xs">{clinicImageUrl ? t.replaceImage : t.uploadImage}</Label>
              <ImageUpload />
              <p className="text-xs text-muted-foreground">{t.imageHint}</p>
            </div>
          </CardContent>
        </Card>

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
                  <Label className="text-xs">{t.name}</Label>
                  <Input name="name" defaultValue={b.name} className="w-full sm:w-40" />
                </div>
                <div className="flex flex-col gap-1">
                  <Label className="text-xs">{t.address}</Label>
                  <Input name="address" defaultValue={b.address} className="w-full sm:w-56" />
                </div>
                <label className="flex items-center gap-2 text-sm sm:pb-2">
                  <input type="checkbox" name="active" defaultChecked={b.active ?? true} className="size-4 accent-violet-500" />
                  {t.active}
                </label>
                <Button type="submit" size="sm" variant="outline" className="w-full sm:w-auto">
                  {t.save}
                </Button>
              </form>

              <div className="flex flex-col gap-3">
                {(rooms ?? [])
                  .filter((r) => r.branch_id === b.id)
                  .map((r) => (
                    <div key={r.id} className="flex flex-col gap-3 rounded-field border border-border p-3">
                    <form
                      action={updateRoomAction}
                      className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end"
                    >
                      <input type="hidden" name="id" value={r.id} />
                      <div className="flex flex-col gap-1">
                        <Label className="text-xs">{t.roomName}</Label>
                        <Input name="name" defaultValue={r.name} className="w-full sm:w-36" />
                      </div>
                      <div className="flex flex-col gap-1">
                        <Label className="text-xs">{t.capacity}</Label>
                        <Input name="capacity" type="number" defaultValue={r.capacity ?? 2} className="w-full sm:w-20" />
                      </div>
                      <div className="flex flex-col gap-1">
                        <Label className="text-xs">{t.description}</Label>
                        <Input name="description" defaultValue={r.description ?? ""} className="w-full sm:w-48" />
                      </div>
                      <label className="flex items-center gap-2 text-sm sm:pb-2">
                        <input type="checkbox" name="active" defaultChecked={r.active ?? true} className="size-4 accent-violet-500" />
                        {t.active}
                      </label>
                      <Button type="submit" size="sm" variant="outline" className="w-full sm:w-auto">
                        {t.save}
                      </Button>
                    </form>

                    <div className="flex flex-wrap items-end gap-3">
                      {(r.images ?? []).map((path) => {
                        const url = publicImageUrl(path);
                        if (!url) return null;
                        return (
                          <div key={path} className="relative">
                            {/* eslint-disable-next-line @next/next/no-img-element -- Supabase Storage, בלי image optimizer */}
                            <img src={url} alt={r.name} className="h-20 w-28 rounded-field object-cover shadow-e1" />
                            <form action={deleteRoomImageAction} className="absolute top-1 end-1">
                              <input type="hidden" name="room_id" value={r.id} />
                              <input type="hidden" name="path" value={path} />
                              <button
                                type="submit"
                                title={t.removeImage}
                                aria-label={t.removeImage}
                                className="flex size-6 items-center justify-center rounded-full bg-surface/90 text-muted-foreground shadow-e1 hover:text-danger"
                              >
                                <X className="size-3" />
                              </button>
                            </form>
                          </div>
                        );
                      })}
                      {(r.images ?? []).length < MAX_ROOM_IMAGES && <ImageUpload roomId={r.id} compact />}
                    </div>
                    </div>
                  ))}
              </div>

              <form
                action={addRoomAction}
                className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:flex-wrap sm:items-end"
              >
                <input type="hidden" name="branch_id" value={b.id} />
                <div className="flex flex-col gap-1">
                  <Label className="text-xs">{t.newRoomName}</Label>
                  <Input name="name" required className="w-full sm:w-40" />
                </div>
                <div className="flex flex-col gap-1">
                  <Label className="text-xs">{t.capacity}</Label>
                  <Input name="capacity" type="number" defaultValue={2} className="w-full sm:w-20" />
                </div>
                <Button type="submit" size="sm" className="w-full sm:w-auto">
                  {t.addRoom}
                </Button>
              </form>
            </CardContent>
          </Card>
        ))}

        <Card className="shadow-e1">
          <CardHeader>
            <CardTitle className="text-base font-medium">{t.addBranchTitle}</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={addBranchAction} className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="branch_name">{t.branchName}</Label>
                <Input id="branch_name" name="name" required />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="branch_address">{t.address}</Label>
                <Input id="branch_address" name="address" required />
              </div>
              <Button type="submit" className="w-full sm:w-auto">
                {t.addBranch}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
