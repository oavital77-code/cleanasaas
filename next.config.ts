import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  // כותרות אבטחה — Next לא מוסיף אותן מעצמו.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // clickjacking: אסור להטמיע את האפליקציה ב-iframe זר (אין בה
          // שום מסך שנועד להטמעה).
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          // 🔴 קריטי בגלל /api/ics/[token]: הטוקן יושב ב-URL עצמו, ובלי
          // המדיניות הזו הוא היה דולף בכותרת Referer לכל דומיין חיצוני
          // שנלחץ מהדף. strict-origin-when-cross-origin שולח רק origin.
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-DNS-Prefetch-Control", value: "off" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
          // HSTS — Vercel מגיש רק ב-HTTPS ממילא; זה סוגר גם ניסיון downgrade.
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
        ],
      },
    ];
  },
};

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  // מבטל את הלוגים המפורטים של ה-plugin בזמן build.
  silent: true,
  // מעלה source maps ל-Sentry רק כשיש auth token מוגדר (build ב-CI/Vercel).
  // בלי token — ה-build ממשיך כרגיל, פשוט בלי source maps מפוענחים ב-Sentry.
  authToken: process.env.SENTRY_AUTH_TOKEN,
  // מסתיר את route ה-tunnel של Sentry מ-ad blockers; לא חובה אבל משפר אמינות דיווח.
  tunnelRoute: "/monitoring",
  webpack: {
    treeshake: {
      removeDebugLogging: true,
    },
  },
});
