"use client";

import { useActionState } from "react";
import Link from "next/link";
import { signupAction, type SignupState } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: SignupState = {};

export default function SignupPage() {
  const [state, formAction, pending] = useActionState(signupAction, initialState);

  if (state.needsConfirmation) {
    return (
      <main className="mx-auto flex max-w-md flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
        <h1 className="text-2xl font-semibold">כמעט סיימנו</h1>
        <p className="text-muted-foreground">
          שלחנו אליך מייל אימות. אחרי אישור המייל תוכל/י להיכנס ולהמשיך בהקמת
          הקליניקה.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 p-8">
      <div className="text-center">
        <h1 className="text-2xl font-semibold">פתיחת קליניקה חדשה</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          חשבון owner + הקמת הקליניקה שלך — סניפים, חדרים ותמחור נקבעים בשלב
          הבא.
        </p>
      </div>

      <form action={formAction} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="clinic_name">שם העסק</Label>
          <Input id="clinic_name" name="clinic_name" required />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="slug">כתובת (slug)</Label>
          <Input id="slug" name="slug" placeholder="my-clinic" pattern="[a-z0-9][a-z0-9-]{1,48}[a-z0-9]" required dir="ltr" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="owner_full_name">שם מלא (הבעלים)</Label>
          <Input id="owner_full_name" name="owner_full_name" required />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="owner_phone">טלפון</Label>
          <Input id="owner_phone" name="owner_phone" type="tel" required dir="ltr" />
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
          {pending ? "יוצר/ת קליניקה…" : "המשך"}
        </Button>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        כבר יש לך חשבון? <Link href="/login" className="underline">כניסה</Link>
      </p>
    </main>
  );
}
