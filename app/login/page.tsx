"use client";

import { useActionState } from "react";
import Link from "next/link";
import { loginAction, type LoginState } from "./actions";
import { AuthShell } from "@/components/auth-shell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: LoginState = {};

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(loginAction, initialState);

  return (
    <AuthShell>
      <Card className="shadow-e2">
        <CardHeader className="text-center">
          <CardTitle className="text-xl">כניסה</CardTitle>
          <CardDescription>ניהול הקליניקה וההזמנות שלכם</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={formAction} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email">אימייל</Label>
              <Input id="email" name="email" type="email" required dir="ltr" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="password">סיסמה</Label>
              <Input id="password" name="password" type="password" required />
            </div>

            {state.error && (
              <p className="rounded-field border border-danger-border bg-danger-bg px-3 py-2 text-sm text-danger">
                {state.error}
              </p>
            )}

            <Button type="submit" disabled={pending} className="mt-2">
              {pending ? "מתחבר/ת…" : "כניסה"}
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
