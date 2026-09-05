import * as React from "react";

import { cn } from "@/lib/utils";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        // 🔴 text-base (16px) במובייל ולא text-[14.5px]: ל-iOS Safari יש
        // התנהגות קשיחה — שדה קלט עם font-size מתחת ל-16px גורם לזום
        // אוטומטי של כל הדף ב-focus, והדף נשאר מוזז גם אחרי היציאה מהשדה
        // (זה מה שנראה כמו "הרזולוציה משתנה כשכותבים"). מ-md ומעלה חוזרים
        // לגודל שבשפה העיצובית. אותו כלל חל על select/textarea.
        "flex h-12 w-full rounded-field border border-border-strong bg-surface px-3 py-2 text-base transition-colors placeholder:text-text-muted focus-visible:outline-none focus-visible:border-violet-500 focus-visible:[box-shadow:var(--focus-ring)] disabled:cursor-not-allowed disabled:bg-subtle disabled:text-grey-400 aria-invalid:border-danger md:h-10 md:text-[14.5px]",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
