import type { MetadataRoute } from "next";

// Next.js מזהה app/manifest.ts אוטומטית ומגיש אותו כ-/manifest.webmanifest
// + מזריק <link rel="manifest"> ל-<head> — אין צורך בקובץ JSON סטטי או
// בהוספה ידנית ב-layout.tsx. middleware.ts כבר מחריג את הנתיב הזה
// (ר' ה-matcher שם) — היה מוכן לזה מראש.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Cleana",
    short_name: "Cleana",
    description: "פלטפורמת ניהול השכרת קליניקות רב-דיירית",
    start_url: "/",
    display: "standalone",
    background_color: "#fbfbfd",
    theme_color: "#7a5af8",
    dir: "rtl",
    lang: "he",
    icons: [
      { src: "/icon", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
