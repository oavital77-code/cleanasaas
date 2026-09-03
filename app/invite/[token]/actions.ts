"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type InviteSignupState = { error?: string; needsConfirmation?: boolean };

export async function signupViaInviteAction(
  token: string,
  _prevState: InviteSignupState,
  formData: FormData,
): Promise<InviteSignupState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const fullName = String(formData.get("full_name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  if (!email || !password || !fullName || !phone) {
    return { error: "נא למלא את כל השדות" };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { pending_invite_token: token, pending_full_name: fullName, pending_phone: phone } },
  });
  if (error) return { error: error.message };

  if (!data.session) return { needsConfirmation: true };

  const { error: acceptError } = await supabase.rpc("accept_therapist_invite", {
    p_token: token,
    p_full_name: fullName,
    p_phone: phone,
  });
  if (acceptError) return { error: acceptError.message };

  redirect("/");
}

export async function completeInviteFromMetadata(token: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const { data: existing } = await supabase.from("profiles").select("id").eq("id", user.id).maybeSingle();
  if (existing) return;

  const meta = user.user_metadata as Record<string, string | undefined>;
  if (meta.pending_invite_token !== token || !meta.pending_full_name || !meta.pending_phone) return;

  await supabase.rpc("accept_therapist_invite", {
    p_token: token,
    p_full_name: meta.pending_full_name,
    p_phone: meta.pending_phone,
  });
}
