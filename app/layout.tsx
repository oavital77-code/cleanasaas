import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Heebo, IBM_Plex_Mono, Outfit } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { heIL } from "@clerk/localizations";
import "./globals.css";

const heebo = Heebo({
  variable: "--font-heebo",
  subsets: ["hebrew", "latin"],
});

// לוורדמארק הלוגו בלבד — לא פונט הגוף הכללי, שנשאר Heebo.
const outfit = Outfit({
  variable: "--font-outfit-logo",
  subsets: ["latin"],
  weight: ["500", "600"],
});

// למזהים/קודים טכניים בלבד (מספרי הזמנה, קוד דלת) — לא לטקסט רגיל.
const ibmPlexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "Cleana SaaS",
  description: "פלטפורמת ניהול השכרת קליניקות רב-דיירית",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#7A5AF8",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    // heIL: כל הטקסטים המובנים של רכיבי Clerk (<SignIn>/<SignUp>/<UserButton>)
    // בעברית. appearance מיישר את הצבע/גופן/רדיוס לשפה העיצובית שלנו —
    // בלי זה הווידג'טים של Clerk היו נראים כמו מוצר אחר בתוך העמוד.
    <ClerkProvider
      localization={heIL}
      appearance={{
        variables: {
          colorPrimary: "#7a5af8",
          fontFamily: "var(--font-heebo)",
          borderRadius: "10px",
        },
      }}
    >
      <html
        lang="he"
        dir="rtl"
        className={`${heebo.variable} ${outfit.variable} ${ibmPlexMono.variable} h-full antialiased`}
      >
        <body className="min-h-full flex flex-col">{children}</body>
      </html>
    </ClerkProvider>
  );
}
