"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { getAdminSettingsDict } from "@/lib/i18n";
import { useLocale } from "@/lib/i18n/context";
import { sendWhatsAppTestAction, type WhatsAppTestState } from "./actions";

const initialState: WhatsAppTestState = {};

export function WhatsAppTestButton() {
  const t = getAdminSettingsDict(useLocale());
  const [state, formAction, pending] = useActionState(async () => sendWhatsAppTestAction(), initialState);

  return (
    <form action={formAction} className="flex flex-wrap items-center gap-3">
      <Button type="submit" variant="outline" size="sm" disabled={pending}>
        {t.whatsappSendTest}
      </Button>
      {state.message && (
        <p className={`text-sm ${state.ok ? "text-success" : "text-danger"}`}>{state.message}</p>
      )}
    </form>
  );
}
