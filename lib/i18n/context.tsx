"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { Locale } from "./index";

// locale ל-client components שמתחת ל-AppShell (SlotGrid, BookingForm,
// SlotBuilder, AdminSlotGrid, AssignForm, LeadForm…). Server components
// לא צריכים את זה — יש להם profile.locale ישירות מ-requireTherapistProfile.
//
// ברירת מחדל "he" (לא "en") — אותה רשת ביטחון כמו normalizeLocale: רכיב
// שמורנדר מחוץ ל-AppShell (לא אמור לקרות) יראה עברית, כמו שאר הדפים
// הציבוריים.
const LocaleContext = createContext<Locale>("he");

export function LocaleProvider({ locale, children }: { locale: Locale; children: ReactNode }) {
  return <LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider>;
}

export function useLocale(): Locale {
  return useContext(LocaleContext);
}
