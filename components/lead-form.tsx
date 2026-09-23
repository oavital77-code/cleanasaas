"use client";

import { useActionState } from "react";
import { ArrowRight, Check } from "lucide-react";
import { submitLeadAction, type LeadState } from "@/app/(app)/lead-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: LeadState = {};

/**
 * הדלת הרכה של דף הנחיתה. לצד "פתיחת קליניקה" — שדורש החלטה מלאה — זו
 * הדרך של מי שרוצה קודם לשאול. שם וטלפון בלבד חובה: כל שדה נוסף הוא
 * חיכוך, והטלפון הוא מה שבאמת מאפשר לחזור.
 */
export function LeadForm() {
  const [state, formAction, pending] = useActionState(submitLeadAction, initialState);

  if (state.success) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-3xl border border-success-fg/25 bg-success-bg px-6 py-10 text-center">
        <span className="inline-flex size-12 items-center justify-center rounded-2xl bg-success-fg/10 text-success-fg">
          <Check className="size-6" strokeWidth={2.5} aria-hidden />
        </span>
        <p className="text-lg font-bold text-success-fg">קיבלנו. נחזור אליכם.</p>
        <p className="max-w-sm text-sm leading-relaxed text-success-fg/80">
          בדרך כלל תוך יום עסקים אחד. אם זה דחוף, אפשר פשוט לפתוח קליניקה ולהתחיל — {" "}
          <a href="/signup" className="font-semibold underline underline-offset-2">
            30 הימים הראשונים בחינם
          </a>
          .
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="flex w-full flex-col gap-4 rounded-3xl border border-border bg-card p-6 shadow-sm md:p-8">
      {/* מלכודת בוטים: מוסתר מבני אדם ומקוראי מסך, וממולא כמעט תמיד ע"י בוטים. */}
      <div aria-hidden className="absolute h-0 w-0 overflow-hidden opacity-0">
        <label htmlFor="website">אתר</label>
        <input id="website" name="website" type="text" tabIndex={-1} autoComplete="off" />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="lead-name">שם *</Label>
          <Input id="lead-name" name="name" required autoComplete="name" maxLength={120} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="lead-phone">טלפון *</Label>
          <Input id="lead-phone" name="phone" type="tel" required autoComplete="tel" inputMode="tel" maxLength={40} dir="ltr" className="text-start" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="lead-email">מייל</Label>
          <Input id="lead-email" name="email" type="email" autoComplete="email" maxLength={254} dir="ltr" className="text-start" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="lead-clinic">שם הקליניקה</Label>
          <Input id="lead-clinic" name="clinic_name" autoComplete="organization" maxLength={160} />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="lead-message">משהו שכדאי שנדע?</Label>
        <textarea
          id="lead-message"
          name="message"
          rows={3}
          maxLength={2000}
          placeholder="כמה חדרים, כמה מטפלים/ות, ומה הכי מעצבן היום"
          className="w-full rounded-field border border-border-strong bg-surface px-3 py-2 text-base transition-colors placeholder:text-text-muted focus-visible:border-violet-500 focus-visible:outline-none focus-visible:[box-shadow:var(--focus-ring)] md:text-[14.5px]"
        />
      </div>

      <Button type="submit" size="lg" disabled={pending} className="h-12 w-full rounded-2xl font-semibold">
        {pending ? "שולח…" : "שלחו לי פרטים"}
        {!pending && <ArrowRight className="size-4 rtl:rotate-180" aria-hidden />}
      </Button>

      {state.error && <p className="text-sm font-medium text-destructive">{state.error}</p>}

      <p className="text-center text-xs leading-relaxed text-muted-foreground">
        הפרטים משמשים רק כדי לחזור אליכם בנוגע ל-Cleana. אפשר לראות איך אנחנו מטפלים במידע ב
        <a href="/privacy" className="underline underline-offset-2 hover:text-foreground">
          מדיניות הפרטיות
        </a>
        .
      </p>
    </form>
  );
}
