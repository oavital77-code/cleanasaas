"use client";

import { useActionState } from "react";
import Link from "next/link";
import { signupAction, type SignupState } from "./actions";
import { AuthShell } from "@/components/auth-shell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: SignupState = {};

export default function SignupPage() {
  const [state, formAction, pending] = useActionState(signupAction, initialState);

  if (state.needsConfirmation) {
    return (
      <AuthShell>
        <Card className="shadow-e2 text-center">
          <CardHeader>
            <CardTitle className="text-xl">כמעט סיימנו</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              שלחנו אליך מייל אימות. אחרי אישור המייל תוכל/י להיכנס ולהמשיך
              בהקמת הקליניקה.
            </p>
          </CardContent>
        </Card>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <Card className="shadow-e2">
        <CardHeader className="text-center">
          <CardTitle className="text-xl">פתיחת קליניקה חדשה</CardTitle>
          <CardDescription>
            חשבון owner + הקמת הקליניקה שלך — סניפים, חדרים ותמחור נקבעים
            בשלב הבא.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={formAction} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="clinic_name">שם העסק</Label>
              <Input id="clinic_name" name="clinic_name" required />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="slug">כתובת (slug)</Label>
              <Input
                id="slug"
                name="slug"
                placeholder="my-clinic"
                pattern="[a-z0-9][a-z0-9-]{1,48}[a-z0-9]"
                required
                dir="ltr"
              />
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

            {state.error && (
              <p className="rounded-field border border-danger-border bg-danger-bg px-3 py-2 text-sm text-danger">
                {state.error}
              </p>
            )}

            <Button type="submit" disabled={pending} className="mt-2">
              {pending ? "יוצר/ת קליניקה…" : "המשך"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <p className="text-center text-sm text-muted-foreground">
        כבר יש לך חשבון?{" "}
        <Link href="/login" className="font-medium text-violet-600 underline underline-offset-4">
          כניסה
        </Link>
      </p>
    </AuthShell>
  );
}
