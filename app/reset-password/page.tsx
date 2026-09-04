"use client";

import { useActionState } from "react";
import Link from "next/link";
import { setNewPasswordAction, type SetPasswordState } from "./actions";
import { AuthShell } from "@/components/auth-shell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: SetPasswordState = {};

export default function ResetPasswordPage() {
  const [state, formAction, pending] = useActionState(setNewPasswordAction, initialState);

  if (state.success) {
    return (
      <AuthShell>
        <Card className="shadow-e2 text-center">
          <CardHeader>
            <CardTitle className="text-xl">הסיסמה עודכנה</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <p className="text-muted-foreground">אפשר להיכנס עכשיו עם הסיסמה החדשה.</p>
            <Button asChild>
              <Link href="/login">כניסה</Link>
            </Button>
          </CardContent>
        </Card>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <Card className="shadow-e2">
        <CardHeader className="text-center">
          <CardTitle className="text-xl">קביעת סיסמה חדשה</CardTitle>
          <CardDescription>הקישור מהמייל פתח עבורכם חלון קצר לעדכון הסיסמה</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={formAction} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="password">סיסמה חדשה</Label>
              <Input id="password" name="password" type="password" minLength={8} required />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="confirm">אימות סיסמה</Label>
              <Input id="confirm" name="confirm" type="password" minLength={8} required />
            </div>

            {state.error && (
              <p className="rounded-field border border-danger-border bg-danger-bg px-3 py-2 text-sm text-danger">
                {state.error}
              </p>
            )}

            <Button type="submit" disabled={pending} className="mt-2">
              {pending ? "שומר/ת…" : "עדכון סיסמה"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </AuthShell>
  );
}
