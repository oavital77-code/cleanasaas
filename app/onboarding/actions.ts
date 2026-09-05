"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireTherapistProfile } from "@/lib/auth/guards";

// 🔴 completeSignupClinicFromMetadata (הישנה) נמחקה: signup_clinic רץ
// עכשיו בתוך /signup עצמו, מיד אחרי setActive() של Clerk — עד שהמשתמש/ת
// מגיע/ה ל-/onboarding הקליניקה והפרופיל כבר קיימים. גרסה קודמת של הפונקציה
// הזו הייתה קוראת supabase.auth.getUser() ישירות, שמחזיר תמיד null לזהות
// Clerk (אין GoTrue session מאחורי ה-client מבוסס-accessToken) — כל
// הפעולות כאן עברו ל-requireTherapistProfile() (dual-mode, ר' lib/auth/guards.ts).

export async function addBranchAction(formData: FormData) {
  const supabase = await createClient();
  const name = String(formData.get("name") ?? "").trim();
  const address = String(formData.get("address") ?? "").trim();
  if (!name || !address) return;

  const { error } = await supabase.rpc("create_branch", { p_name: name, p_address: address });
  if (error) throw new Error(error.message);
  revalidatePath("/onboarding");
}

const ROOM_TYPES = ["talk", "touch", "podcast", "group"] as const;
type RoomType = (typeof ROOM_TYPES)[number];

export async function addRoomAction(formData: FormData) {
  const supabase = await createClient();
  const branchId = String(formData.get("branch_id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const rawRoomType = String(formData.get("room_type") ?? "talk");
  const roomType: RoomType = ROOM_TYPES.includes(rawRoomType as RoomType) ? (rawRoomType as RoomType) : "talk";
  if (!branchId || !name) return;

  const { error } = await supabase.rpc("create_room", {
    p_branch_id: branchId,
    p_name: name,
    p_room_type: [roomType],
  });
  if (error) throw new Error(error.message);
  revalidatePath("/onboarding");
}

const DEFAULT_TIERS = [
  { hours: 10, price_per_hour: 55 },
  { hours: 20, price_per_hour: 50 },
  { hours: 30, price_per_hour: 45 },
  { hours: 40, price_per_hour: 40 },
  { hours: 50, price_per_hour: 35 },
];

// ברירת מחדל = אותן 5 מדרגות של Cleana (SAASMIGRATIONSPEC §5), עריכה חופשית
// מלאה דרך /admin/settings אחרי ההקמה. punch_card_tiers אינה בין הטבלאות
// שדורשות RPC (רק bookings/punch_cards/session_subscriptions) — כתיבה ישירה
// מספיקה, מוגנת ע"י RLS (admin + clinic_id שלו בלבד).
export async function seedDefaultPricingAction() {
  const { profile } = await requireTherapistProfile();
  const supabase = await createClient();

  const { data: existing } = await supabase.from("punch_card_tiers").select("id").eq("clinic_id", profile.clinic_id);
  if (existing && existing.length > 0) return;

  await supabase.from("punch_card_tiers").insert(
    DEFAULT_TIERS.map((t, i) => ({ clinic_id: profile.clinic_id, hours: t.hours, price_per_hour: t.price_per_hour, sort_order: i })),
  );
  revalidatePath("/onboarding");
}

export async function toggleSessionsAction(formData: FormData) {
  const { profile } = await requireTherapistProfile();
  const supabase = await createClient();
  const enabled = formData.get("sessions_enabled") === "on";

  await supabase.from("clinics").update({ sessions_enabled: enabled }).eq("id", profile.clinic_id);
  revalidatePath("/onboarding");
}

export async function finishOnboardingAction() {
  redirect("/");
}
