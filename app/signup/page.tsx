"use client";

import Link from "next/link";
import { completeSignupClinicAction } from "./actions";
import { ClerkSignupForm } from "@/components/clerk-signup-form";
import { AuthShell } from "@/components/auth-shell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// מסך אחד ממזג יצירת חשבון Clerk (headless — לא <SignUp> המוכן, כדי לשלב
// עם השדות העסקיים) + פרטי הקליניקה. signup_clinic (RPC) רץ רק אחרי
// setActive() בתוך <ClerkSignupForm> — ר' שם למה.
export default function SignupPage() {
  return (
    <AuthShell>
      <Card className="shadow-e2">
        <CardHeader className="text-center">
          <CardTitle className="text-xl">פתיחת קליניקה חדשה</CardTitle>
          <CardDescription>
            פותחים חשבון לקליניקה. את הסניפים, החדרים והמחירים מגדירים בשלב הבא.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ClerkSignupForm
            submitLabel="המשך"
            pendingLabel="פותחים את הקליניקה…"
            redirectTo="/onboarding"
            onSubmitBusinessLogic={completeSignupClinicAction}
            extraFields={
              <>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="clinic_name">שם הקליניקה</Label>
                  <Input id="clinic_name" name="clinic_name" required />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="slug">כתובת באנגלית לקישור הקליניקה</Label>
                  <Input
                    id="slug"
                    name="slug"
                    placeholder="my-clinic"
                    pattern="[a-z0-9][a-z0-9-]{1,48}[a-z0-9]"
                    required
                    dir="ltr"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="owner_full_name">השם המלא שלך</Label>
                  <Input id="owner_full_name" name="owner_full_name" required />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="owner_phone">טלפון</Label>
                  <Input id="owner_phone" name="owner_phone" type="tel" required dir="ltr" />
                </div>
              </>
            }
          />
        </CardContent>
      </Card>

      <p className="text-center text-sm text-muted-foreground">
        כבר יש לך חשבון?{" "}
        <Link href="/login" className="font-medium text-violet-600 underline underline-offset-4">
          כניסה
        </Link>
      </p>
    </AuthShell>
  );
}
