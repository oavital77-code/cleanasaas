import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * select נייטיבי בעיצוב אחיד עם Input — נוצר כדי שלא יהיה 13 עותקים של
 * אותו className מפוזרים במסכים (וכדי שכל select חדש יקבל אוטומטית את שני
 * הכללים הקריטיים במובייל):
 *   1. text-base (16px) עד md — אחרת iOS Safari מזמזם את כל הדף ב-focus.
 *   2. h-12 עד md — אזור מגע ≥44px לפי --tap-min שבשפה העיצובית.
 * ברירת מחדל w-full; מסך שרוצה שורה אופקית בדסקטופ מעביר sm:w-auto.
 */
function Select({ className, ...props }: React.ComponentProps<"select">) {
  return (
    <select
      data-slot="select"
      className={cn(
        "h-12 w-full rounded-field border border-border-strong bg-surface px-3 text-base transition-colors focus-visible:outline-none focus-visible:border-violet-500 focus-visible:[box-shadow:var(--focus-ring)] disabled:cursor-not-allowed disabled:bg-subtle disabled:text-grey-400 md:h-10 md:text-[14.5px]",
        className,
      )}
      {...props}
    />
  );
}

export { Select };
