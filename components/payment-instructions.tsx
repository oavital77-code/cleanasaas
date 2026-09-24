import { Wallet } from "lucide-react";

/**
 * איך משלמים לקליניקה — הטקסט שבעל/ת הקליניקה כתב/ה בהגדרות, או הודעת
 * ברירת מחדל אם עוד לא נכתב. מחליף את כפתור "לתשלום בחנות" (מצב ידני).
 */
export function PaymentInstructions({ text, title, fallback }: { text: string | null; title: string; fallback: string }) {
  return (
    <div className="flex gap-3 rounded-2xl border border-border bg-muted/40 p-4">
      <Wallet className="mt-0.5 size-5 shrink-0 text-violet-500" aria-hidden />
      <div className="flex min-w-0 flex-col gap-1">
        <p className="text-sm font-medium">{title}</p>
        <p className="text-sm leading-relaxed whitespace-pre-wrap text-muted-foreground">{text ?? fallback}</p>
      </div>
    </div>
  );
}
