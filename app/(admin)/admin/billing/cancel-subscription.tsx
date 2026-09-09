"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

/** כפתור ביטול עם אישור בשני צעדים — פעולה בלתי-הפיכה לא נלחצת בטעות. */
export function CancelSubscription({
  action,
  labels,
}: {
  action: () => Promise<void>;
  labels: { cancel: string; confirm: string; yes: string; keep: string };
}) {
  const [confirming, setConfirming] = useState(false);
  if (!confirming) {
    return (
      <Button type="button" variant="outline" onClick={() => setConfirming(true)} className="w-full sm:w-auto">
        {labels.cancel}
      </Button>
    );
  }
  return (
    <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
      <span className="text-sm">{labels.confirm}</span>
      <form action={action}>
        <Button type="submit" variant="destructive" className="w-full sm:w-auto">
          {labels.yes}
        </Button>
      </form>
      <Button type="button" variant="ghost" onClick={() => setConfirming(false)}>
        {labels.keep}
      </Button>
    </div>
  );
}
