"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
// 🔴 מ-"@clerk/nextjs/legacy" ולא "@clerk/nextjs": בגרסה המותקנת (7.9.1)
// useSignUp() הרגיל מחזיר כברירת מחדל את ה-API החדש מבוסס-signals
// (SignUpFutureResource) — צורה שונה לגמרי מ-{ isLoaded, signUp, setActive
// } המתועד. ה-legacy import הוא הדרך הנתמכת לקבל את הצורה הקלאסית, שעליה
// כל הזרימה כאן בנויה (create → prepareEmailAddressVerification →
// attemptEmailAddressVerification → setActive).
import { useSignUp } from "@clerk/nextjs/legacy";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// רכיב משותף ל-3 מסכי ההרשמה (owner חדש, הצטרפות דרך קישור ציבורי,
// הצטרפות דרך הזמנה) — כולם צריכים בדיוק את אותה שרשרת: יצירת חשבון Clerk
// (headless, לא <SignUp> המוכן — כדי למזג עם שדות עסקיים במסך אחד לפי
// בקשת המשתמש/אופציה ב'), קוד אימות למייל אם Clerk דורש, הפעלת ה-session,
// ורק *אז* קריאה ל-RPC העסקי (signup_clinic/join_clinic_as_therapist/
// accept_therapist_invite) — כי הן קוראות auth.jwt()->>'sub' מה-session
// הפעיל, ולפני setActive() אין עדיין session בכלל.
//
// onSubmitBusinessLogic מקבל את אותו FormData שהוגש (השדות העסקיים +
// email/password) ומחזיר {error} אם ה-RPC נכשל — השגיאה מוצגת באותו מסך,
// בלי לאבד את החשבון שכבר נוצר ב-Clerk (חשוב: אם ה-RPC נכשל בגלל למשל
// SLUG_TAKEN, המשתמש/ת כבר מאומת/ת מול Clerk ולא צריך/ה לעבור את כל
// זרימת ההרשמה שוב — רק לתקן את השדה ולנסות שוב).
export function ClerkSignupForm({
  extraFields,
  submitLabel,
  pendingLabel,
  redirectTo,
  onSubmitBusinessLogic,
}: {
  extraFields: ReactNode;
  submitLabel: string;
  pendingLabel: string;
  redirectTo: string;
  onSubmitBusinessLogic: (formData: FormData) => Promise<{ error?: string } | void>;
}) {
  const { isLoaded, signUp, setActive } = useSignUp();
  const router = useRouter();

  const [pendingVerification, setPendingVerification] = useState(false);
  const [code, setCode] = useState("");
  const [formSnapshot, setFormSnapshot] = useState<FormData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function finishWithSession(sessionId: string, fd: FormData) {
    // setActive מוגדר תמיד בפועל בשלב הזה (תמיד נקרא אחרי isLoaded===true
    // ב-handleCreate/handleVerify) — הבדיקה כאן היא רק כדי לספק ל-TS.
    if (!setActive) return;
    await setActive({ session: sessionId });
    const result = await onSubmitBusinessLogic(fd);
    if (result?.error) {
      setError(result.error);
      return;
    }
    router.push(redirectTo);
    router.refresh();
  }

  async function handleCreate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!isLoaded || pending) return;
    setPending(true);
    setError(null);

    const fd = new FormData(e.currentTarget);
    const email = String(fd.get("email") ?? "").trim();
    const password = String(fd.get("password") ?? "");

    try {
      const result = await signUp.create({ emailAddress: email, password });
      if (result.status === "complete" && result.createdSessionId) {
        await finishWithSession(result.createdSessionId, fd);
        return;
      }
      // ברירת המחדל של Clerk דורשת אימות מייל בקוד — ממשיכים לשלב הבא.
      await signUp.prepareEmailAddressVerification({ strategy: "email_code" });
      setFormSnapshot(fd);
      setPendingVerification(true);
    } catch (err) {
      setError(clerkErrorMessage(err));
    } finally {
      setPending(false);
    }
  }

  async function handleVerify(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!isLoaded || pending || !formSnapshot) return;
    setPending(true);
    setError(null);

    try {
      const result = await signUp.attemptEmailAddressVerification({ code });
      if (result.status !== "complete" || !result.createdSessionId) {
        setError("הקוד לא נכון. בדקו ונסו שוב.");
        return;
      }
      await finishWithSession(result.createdSessionId, formSnapshot);
    } catch (err) {
      setError(clerkErrorMessage(err));
    } finally {
      setPending(false);
    }
  }

  if (pendingVerification) {
    return (
      <form onSubmit={handleVerify} className="flex flex-col gap-4">
        <p className="text-sm text-muted-foreground">שלחנו קוד אימות למייל שלך.</p>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="code">קוד אימות</Label>
          <Input
            id="code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            required
            dir="ltr"
            inputMode="numeric"
            autoComplete="one-time-code"
          />
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button type="submit" disabled={pending}>
          {pending ? "בודקים…" : "אימות והמשך"}
        </Button>
      </form>
    );
  }

  return (
    <form onSubmit={handleCreate} className="flex flex-col gap-4">
      {extraFields}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="email">מייל</Label>
        <Input id="email" name="email" type="email" required dir="ltr" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="password">סיסמה</Label>
        <Input id="password" name="password" type="password" minLength={8} required />
      </div>
      {error && <p className="rounded-field border border-danger-border bg-danger-bg px-3 py-2 text-sm text-danger">{error}</p>}
      {/* Clerk מרנדר כאן widget הגנה מפני בוטים (Cloudflare Turnstile) כשהוא
          מופעל בהגדרות ה-instance — נדרש ע"י signUp.create() בזרימה headless. */}
      <div id="clerk-captcha" />
      <Button type="submit" disabled={pending} className="mt-2">
        {pending ? pendingLabel : submitLabel}
      </Button>
    </form>
  );
}

function clerkErrorMessage(err: unknown): string {
  if (err && typeof err === "object" && "errors" in err) {
    const errors = (err as { errors?: { message?: string; longMessage?: string }[] }).errors;
    const first = errors?.[0];
    if (first?.longMessage || first?.message) return first.longMessage ?? first.message ?? "ההרשמה לא הצליחה";
  }
  return "ההרשמה לא הצליחה";
}
