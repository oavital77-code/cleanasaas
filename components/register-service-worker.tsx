"use client";

import { useEffect } from "react";

// רישום ה-service worker (public/sw.js) — תנאי סף ל-"הוספה למסך הבית"
// באנדרואיד/כרום. פס"ד רשת-קודם בלי caching של תוכן דינמי (ר' sw.js) —
// לא offline-first, רק installability.
export function RegisterServiceWorker() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // כישלון רישום לא אמור לשבור את האפליקציה — פשוט לא תהיה ניתנת להתקנה.
    });
  }, []);

  return null;
}
