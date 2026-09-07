"use client";

import { useActionState } from "react";
import { claimPendingPurchaseAction, type ClaimState } from "./actions";
import { Button } from "@/components/ui/button";
import { getPurchaseDict } from "@/lib/i18n";
import { useLocale } from "@/lib/i18n/context";

const initialState: ClaimState = {};

export function ClaimButton() {
  const t = getPurchaseDict(useLocale());
  const [state, formAction, pending] = useActionState(async () => claimPendingPurchaseAction(), initialState);

  return (
    <form action={formAction} className="flex flex-col items-start gap-2">
      <Button type="submit" variant="outline" size="sm" disabled={pending}>
        {pending ? t.checking : t.claimButton}
      </Button>
      {state.message && <p className="text-sm text-muted-foreground">{state.message}</p>}
    </form>
  );
}
