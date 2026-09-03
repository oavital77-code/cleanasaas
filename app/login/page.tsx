"use client";

import { useActionState } from "react";
import Link from "next/link";
import { loginAction, type LoginState } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: LoginState = {};

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(loginAction, initialState);

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 p-8">
      <h1 className="text-center text-2xl font-semibold">כניסה</h1>

      <form action={formAction} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="email">אימייל</Label>
          <Input id="email" name="email" type="email" required dir="ltr" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="password">סיסמה</Label>
          <Input id="password" name="password" type="password" required />
        </div>

        {state.error && <p className="text-sm text-destructive">{state.error}</p>}

        <Button type="submit" disabled={pending}>
          {pending ? "מתחבר/ת…" : "כניסה"}
        </Button>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        עדיין אין לך קליניקה? <Link href="/signup" className="underline">פתיחת קליניקה חדשה</Link>
      </p>
    </main>
  );
}
