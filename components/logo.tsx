// סימן הלוגו (מריבוע מעוגל + טבעת, אותו מוטיב כמו mark-outline ברקעי
// השיווק ב-globals.css) + וורדמארק ב-Outfit (--font-outfit-logo). רכיב יחיד
// כדי שכל מסך — שיווק, אימות, ניווט פנימי — ישתמש באותו לוגו בדיוק.
const SIZES = {
  sm: { mark: 28, text: "text-base" },
  md: { mark: 36, text: "text-xl" },
  lg: { mark: 48, text: "text-2xl" },
} as const;

export function Logo({
  size = "md",
  withWordmark = true,
}: {
  size?: keyof typeof SIZES;
  withWordmark?: boolean;
}) {
  const { mark, text } = SIZES[size];
  return (
    <span className="inline-flex items-center gap-2.5 select-none">
      <svg width={mark} height={mark} viewBox="0 0 100 100" fill="none" aria-hidden="true">
        <rect x="4" y="4" width="92" height="92" rx="24" fill="var(--violet-500)" />
        <circle cx="50" cy="50" r="24" fill="none" stroke="white" strokeWidth="7" />
      </svg>
      {withWordmark && (
        <span
          className={`${text} font-semibold tracking-tight text-foreground`}
          style={{ fontFamily: "var(--font-outfit-logo)" }}
        >
          Cleana
        </span>
      )}
    </span>
  );
}
