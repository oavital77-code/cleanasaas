"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// idempotent: אם כבר יש profile, signup_clinic זורק ALREADY_REGISTERED —
// זה תקין (המשתמש חוזר ל-/onboarding אחרי ה-refresh), לא שגיאה אמיתית.
export async function completeSignupClinicFromMetadata() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: existing } = await supabase.from("profiles").select("id").eq("id", user.id).maybeSingle();
  if (existing) return;

  const meta = user.user_metadata as Record<string, string | undefined>;
  if (!meta.pending_clinic_name || !meta.pending_slug || !meta.pending_owner_full_name || !meta.pending_owner_phone) {
    // המשתמש הגיע לכאן בלי לעבור /signup (למשל invite למטפל) — לא הזרימה הזו.
    return;
  }

  const { error } = await supabase.rpc("signup_clinic", {
    p_clinic_name: meta.pending_clinic_name,
    p_slug: meta.pending_slug,
    p_owner_full_name: meta.pending_owner_full_name,
    p_owner_phone: meta.pending_owner_phone,
  });
  if (error && !error.message.includes("ALREADY_REGISTERED")) {
    throw new Error(error.message);
  }
}

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
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase.from("profiles").select("clinic_id").eq("id", user.id).maybeSingle();
  if (!profile) return;

  const { data: existing } = await supabase.from("punch_card_tiers").select("id").eq("clinic_id", profile.clinic_id);
  if (existing && existing.length > 0) return;

  await supabase.from("punch_card_tiers").insert(
    DEFAULT_TIERS.map((t, i) => ({ clinic_id: profile.clinic_id, hours: t.hours, price_per_hour: t.price_per_hour, sort_order: i })),
  );
  revalidatePath("/onboarding");
}

export async function toggleSessionsAction(formData: FormData) {
  const supabase = await createClient();
  const enabled = formData.get("sessions_enabled") === "on";
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase.from("profiles").select("clinic_id").eq("id", user.id).maybeSingle();
  if (!profile) return;

  await supabase.from("clinics").update({ sessions_enabled: enabled }).eq("id", profile.clinic_id);
  revalidatePath("/onboarding");
}

export async function finishOnboardingAction() {
  redirect("/");
}
