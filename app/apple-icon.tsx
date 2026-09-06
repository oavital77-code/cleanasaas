import { ImageResponse } from "next/og";

// iOS מצפה לריבוע מלא (בלי עיגול פינות בעצמנו) — הוא מפעיל את המסכה/הצל
// שלו על התמונה. גודל 180×180 הוא הסטנדרט של Apple ל-apple-touch-icon.
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
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
        }}
      >
        <div
          style={{
            width: 70,
            height: 70,
            borderRadius: "50%",
            border: "10px solid white",
          }}
        />
      </div>
    ),
    { ...size },
  );
}
