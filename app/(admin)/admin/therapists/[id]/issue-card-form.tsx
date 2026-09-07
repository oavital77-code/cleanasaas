"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { getAdminTherapistDetailDict } from "@/lib/i18n";
import { useLocale } from "@/lib/i18n/context";
import { issuePunchCardAction, type IssueCardState } from "./actions";

const initialState: IssueCardState = {};

export function IssueCardForm({
  userId,
  tiers,
}: {
  userId: string;
  tiers: { id: string; hours: number; totalLabel: string }[];
}) {
  const t = getAdminTherapistDetailDict(useLocale());
  const [state, formAction, pending] = useActionState(issuePunchCardAction, initialState);
  const [tierId, setTierId] = useState(tiers[0]?.id ?? "");
  const custom = tierId === "";

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="user_id" value={userId} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="tier_id">{t.issueCardTier}</Label>
          <Select id="tier_id" name="tier_id" value={tierId} onChange={(e) => setTierId(e.target.value)}>
            {tiers.map((tier) => (
              <option key={tier.id} value={tier.id}>
                {t.issueCardTierOption(tier.hours, tier.totalLabel)}
              </option>
            ))}
            <option value="">{t.issueCardCustom}</option>
          </Select>
        </div>
        {custom && (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="hours">{t.issueCardHours}</Label>
            <Input id="hours" name="hours" type="number" step={0.5} min={0.5} max={100} required={custom} />
          </div>
        )}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="amount_total">{t.issueCardAmount}</Label>
          <Input id="amount_total" name="amount_total" type="number" step="0.01" min={0} required={custom} placeholder={custom ? "" : t.issueCardAmountHint} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="method">{t.issueCardMethod}</Label>
          <Select id="method" name="method" defaultValue="cash">
            {Object.entries(t.paymentMethods).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="issue_note">{t.issueCardNote}</Label>
          <Input id="issue_note" name="note" />
        </div>
      </div>
      {state.error && <p className="text-sm text-danger">{state.error}</p>}
      {state.message && <p className="text-sm text-success">{state.message}</p>}
      <Button type="submit" disabled={pending} className="w-fit">
        {pending ? t.issueCardPending : t.issueCardSubmit}
      </Button>
    </form>
  );
}
