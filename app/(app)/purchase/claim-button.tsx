"use client";

import { useActionState } from "react";
import { claimPendingPurchaseAction, type ClaimState } from "./actions";
import { Button } from "@/components/ui/button";

const initialState: ClaimState = {};

export function ClaimButton() {
  const [state, formAction, pending] = useActionState(async () => claimPendingPurchaseAction(), initialState);

  return (
    <form action={formAction} className="flex flex-col items-start gap-2">
      <Button type="submit" variant="outline" size="sm" disabled={pending}>
        {pending ? "בודק/ת…" : "כבר שילמתי — בדיקת רכישה ממתינה"}
      </Button>
      {state.message && <p className="text-sm text-muted-foreground">{state.message}</p>}
    </form>
  );
}
