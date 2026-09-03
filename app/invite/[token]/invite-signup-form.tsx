"use client";

import { useActionState } from "react";
import { signupViaInviteAction, type InviteSignupState } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: InviteSignupState = {};

export function InviteSignupForm({ token }: { token: string }) {
  const boundAction = signupViaInviteAction.bind(null, token);
  const [state, formAction, pending] = useActionState(boundAction, initialState);

  if (state.needsConfirmation) {
    return <p className="text-center text-muted-foreground">שלחנו אליך מייל אימות — אחרי האישור תוכל/י להיכנס.</p>;
  }

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="full_name">שם מלא</Label>
        <Input id="full_name" name="full_name" required />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="phone">טלפון</Label>
        <Input id="phone" name="phone" type="tel" required dir="ltr" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="email">אימייל</Label>
        <Input id="email" name="email" type="email" required dir="ltr" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="password">סיסמה</Label>
        <Input id="password" name="password" type="password" minLength={8} required />
      </div>
      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      <Button type="submit" disabled={pending}>
        {pending ? "מצטרף/ת…" : "הצטרפות"}
      </Button>
    </form>
  );
}
