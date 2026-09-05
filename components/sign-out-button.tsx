"use client";

import { useState } from "react";
import { Slot } from "@radix-ui/react-slot";
import { useRouter } from "next/navigation";
import { useAuth, useClerk } from "@clerk/nextjs";
import { signOutAction } from "@/lib/auth/actions";

// עוטף כפתור/form יציאה קיים ומחליף את ה-onClick שלו בהתנתקות דו-מצבית.
// 🔴 supabase.auth.signOut() זורק כש-ה-client בנוי עם accessToken (מצב
// Clerk, ר' lib/supabase/server.ts) — "Supabase Client is configured
// with the accessToken option, accessing supabase.auth.signOut is not
// possible". session של Clerk מתנתק רק דרך clerk.signOut() בצד הלקוח
// (מול ה-Frontend API של Clerk) — signOutAction (server action ישן,
// supabase.auth.signOut) נשאר רק ל-fallback ה-legacy כשאין session של
// Clerk בכלל.
export function SignOutButton({ children }: { children: React.ReactNode }) {
  const { isLoaded, isSignedIn } = useAuth();
  const { signOut } = useClerk();
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function handleSignOut() {
    if (!isLoaded || pending) return;
    setPending(true);
    if (isSignedIn) {
      await signOut(() => router.push("/login"));
      return;
    }
    await signOutAction();
  }

  return (
    <Slot onClick={handleSignOut} aria-disabled={!isLoaded || pending}>
      {children}
    </Slot>
  );
}
