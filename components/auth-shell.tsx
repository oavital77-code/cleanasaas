import type { ReactNode } from "react";
import { BrandBackdrop } from "./brand-backdrop";
import { Logo } from "./logo";

// מעטפת אחידה למסכי אימות/onboarding-כניסה (login, signup, invite, suspended):
// רקע מקושט + לוגו ממורכז מעל כרטיס תוכן. עמוד בודד קורא ל-<AuthShell> ומעביר
// את הכרטיס/טופס שלו כ-children.
export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="relative flex flex-1 flex-col">
      <BrandBackdrop />
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 p-6">
        <div className="flex justify-center">
          <Logo size="lg" />
        </div>
        {children}
      </main>
    </div>
  );
}
