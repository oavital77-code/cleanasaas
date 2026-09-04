// כתמי הרקע המטושטשים + קווי/טבעות הקישוט של מסכי השיווק/אימות
// (.bg-decor וילדיו, מוגדרים ב-globals.css). fixed + z-index שלילי, אז
// אפשר להטמיע בכל עמוד בלי להשפיע על הפריסה שלו.
export function BrandBackdrop() {
  return (
    <div className="bg-decor" aria-hidden="true">
      <span className="blob-1" />
      <span className="blob-2" />
      <span className="blob-3" />
      <span className="mark-outline" />
      <span className="line-1" />
      <span className="line-2" />
      <span className="ring-1" />
      <span className="ring-2" />
    </div>
  );
}
