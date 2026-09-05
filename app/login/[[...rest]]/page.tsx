import { SignIn } from "@clerk/nextjs";
import { AuthShell } from "@/components/auth-shell";

// [[...rest]] (catch-all אופציונלי) חובה כאן: <SignIn routing="path"> מנהל
// בעצמו תת-נתיבים פנימיים (איפוס סיסמה, קוד אימות וכו') מתחת ל-/login —
// route רגיל לא היה תופס אותם.
export default function LoginPage() {
  return (
    <AuthShell>
      <SignIn routing="path" path="/login" signUpUrl="/signup" fallbackRedirectUrl="/" />
    </AuthShell>
  );
}
