"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { loginAction, requestPasswordResetAction, type LoginState, type ResetRequestState } from "./actions";
import { AuthShell } from "@/components/auth-shell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const loginInitialState: LoginState = {};
const resetInitialState: ResetRequestState = {};

export default function LoginPage() {
  const [mode, setMode] = useState<"login" | "reset">("login");
  const [loginState, loginFormAction, loginPending] = useActionState(loginAction, loginInitialState);
  const [resetState, resetFormAction, resetPending] = useActionState(requestPasswordResetAction, resetInitialState);

  if (mode === "reset") {
    return (
      <AuthShell>
        <Card className="shadow-e2">
          <CardHeader className="text-center">
            <CardTitle className="text-xl">איפוס סיסמה</CardTitle>
            <CardDescription>נשלח לכם קישור לקביעת סיסמה חדשה</CardDescription>
          </CardHeader>
          <CardContent>
            {resetState.sent ? (
              <p className="text-center text-muted-foreground">
                אם קיים חשבון עם המייל הזה — קישור לאיפוס נשלח אליו.
              </p>
            ) : (
              <form action={resetFormAction} className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="reset_email">אימייל</Label>
                  <Input id="reset_email" name="email" type="email" required dir="ltr" />
                </div>
                {resetState.error && <p className="text-sm text-danger">{resetState.error}</p>}
                <Button type="submit" disabled={resetPending} className="mt-2">
                  {resetPending ? "שולח/ת…" : "שליחת קישור איפוס"}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>

        <button
          type="button"
          onClick={() => setMode("login")}
          className="text-center text-sm font-medium text-violet-600 underline underline-offset-4"
        >
          חזרה לכניסה
        </button>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <Card className="shadow-e2">
        <CardHeader className="text-center">
          <CardTitle className="text-xl">כניסה</CardTitle>
          <CardDescription>ניהול הקליניקה וההזמנות שלכם</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={loginFormAction} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email">אימייל</Label>
              <Input id="email" name="email" type="email" required dir="ltr" />
            </div>
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">סיסמה</Label>
                <button
                  type="button"
                  onClick={() => setMode("reset")}
                  className="text-xs text-violet-600 underline underline-offset-4"
                >
                  שכחת/י סיסמה?
                </button>
              </div>
              <Input id="password" name="password" type="password" required />
            </div>

            {loginState.error && (
              <p className="rounded-field border border-danger-border bg-danger-bg px-3 py-2 text-sm text-danger">
                {loginState.error}
              </p>
            )}

            <Button type="submit" disabled={loginPending} className="mt-2">
              {loginPending ? "מתחבר/ת…" : "כניסה"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <p className="text-center text-sm text-muted-foreground">
        עדיין אין לך קליניקה?{" "}
        <Link href="/signup" className="font-medium text-violet-600 underline underline-offset-4">
          פתיחת קליניקה חדשה
        </Link>
      </p>
    </AuthShell>
  );
}
