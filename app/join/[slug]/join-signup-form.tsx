"use client";

import { completeJoinAction } from "./actions";
import { ClerkSignupForm } from "@/components/clerk-signup-form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function JoinSignupForm({ slug }: { slug: string }) {
  return (
    <ClerkSignupForm
      submitLabel="הצטרפות"
      pendingLabel="רגע…"
      redirectTo="/"
      onSubmitBusinessLogic={(formData) => completeJoinAction(slug, formData)}
      extraFields={
        <>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="full_name">שם מלא</Label>
            <Input id="full_name" name="full_name" required />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="phone">טלפון</Label>
            <Input id="phone" name="phone" type="tel" required dir="ltr" />
          </div>
        </>
      }
    />
  );
}
