import { ImageResponse } from "next/og";

// Next.js מזהה app/icon.tsx אוטומטית ומגיש אותו כ-/icon (וגם כ-favicon
// המובנה) — נוצר בזמן ריצה/build דרך ImageResponse, לא PNG סטטי שצריך
// לתחזק בעצמו. אותו מוטיב בדיוק כמו components/logo.tsx (ריבוע מעוגל +
// טבעת) כדי שסימן האפליקציה בטלפון יהיה זהה ללוגו בתוך האפליקציה.
// ריפוד נוסף סביב הטבעת (r=20 במקום 24, בתוך viewBox 100) — "safe zone"
// ל-maskable icons: מערכת ההפעלה עשויה לחתוך למעגל, והתוכן חייב לשרוד את זה.
export const size = { width: 512, height: 512 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#7a5af8",
          borderRadius: 96,
        }}
      >
        <div
          style={{
            width: 200,
            height: 200,
            borderRadius: "50%",
            border: "28px solid white",
          }}
        />
      </div>
    ),
    { ...size },
  );
}
