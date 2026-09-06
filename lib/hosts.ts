/**
 * ניתוב לפי host — cleanagroup.app הוא דף-הנחיתה המשותף של הקבוצה, ומוגש
 * מהפרויקט הזה (ר' app/group/page.tsx). שני המוצרים עצמם יושבים על
 * תת-דומיינים נפרדים, כל אחד פרויקט Vercel עצמאי:
 *
 *   cleanagroup.app             → /group (הדף הזה, דרך rewrite)
 *   cleanas.cleanagroup.app     → Cleana (הריפו הזה)
 *   cleanaplus.cleanagroup.app  → Cleana+ (ריפו click-na — לא נוגעים בו מכאן)
 *
 * הלוגיקה פונקציה טהורה כדי שתיבדק ביחידה בלי Request/NextResponse.
 * middleware.ts הוא היחיד שקורא לה.
 */

const strip = (url: string) => url.replace(/\/+$/, "");

/** ה-hosts שמגישים את דף הנחיתה של הקבוצה (www מנותב על ידי Vercel ל-apex, אבל
 * אם הוא בכל זאת מגיע הנה — מתנהג זהה). */
export const GROUP_HOSTS: ReadonlySet<string> = new Set(["cleanagroup.app", "www.cleanagroup.app"]);

export const GROUP_URL = "https://cleanagroup.app";

/** כתובת Cleana. NEXT_PUBLIC_APP_URL היא הכתובת הציבורית של הפריסה הזו
 * (משמשת גם לקישורי מייל/ICS), ולכן מקור האמת; ברירת המחדל היא תת-הדומיין
 * החדש כדי שהקישור בדף הנחיתה לא יהיה תלוי בהגדרת env. */
export const CLEANA_URL = strip(process.env.NEXT_PUBLIC_APP_URL || "https://cleanas.cleanagroup.app");

export const CLEANA_PLUS_URL = "https://cleanaplus.cleanagroup.app";

/** הנתיבים היחידים שדף-הנחיתה מגיש בעצמו: הדף, ותנאים/פרטיות שה-footer שלו
 * מקשר אליהם. כל נתיב אחר על ה-host הזה (login, dashboard…) שייך למוצר ולא
 * לקבוצה — מופנה ל-Cleana באותו נתיב. */
const GROUP_PATHS: ReadonlySet<string> = new Set(["/group", "/terms", "/privacy"]);

export type HostRoute =
  | { kind: "next" }
  | { kind: "rewrite"; pathname: string }
  | { kind: "redirect"; url: string };

export function hostnameOf(host: string | null | undefined): string {
  return (host ?? "").split(":")[0].trim().toLowerCase();
}

/**
 * @param host      כותרת Host של הבקשה (יכולה לכלול port)
 * @param pathname  request.nextUrl.pathname
 * @param search    request.nextUrl.search ("" או "?x=y")
 * @param production true רק בפריסת production ב-Vercel — ה-redirect הקנוני
 *                  של /group אל cleanagroup.app לא רץ ב-preview/localhost,
 *                  אחרת אי אפשר לפתח את הדף מקומית.
 */
export function routeForHost(
  host: string | null | undefined,
  pathname: string,
  search: string,
  { production }: { production: boolean },
): HostRoute {
  const hostname = hostnameOf(host);

  if (GROUP_HOSTS.has(hostname)) {
    if (pathname === "/") return { kind: "rewrite", pathname: "/group" };
    if (GROUP_PATHS.has(pathname)) return { kind: "next" };
    return { kind: "redirect", url: `${CLEANA_URL}${pathname}${search}` };
  }

  // הכתובת הקנונית של דף הקבוצה היא ה-apex; /group על host של המוצר מפנה
  // אליה כדי שלא יהיו שתי כתובות לאותו דף (וכדי שקישורים ישנים
  // ל-cleanasaas.vercel.app/group ימשיכו לעבוד).
  if (pathname === "/group" && production) {
    return { kind: "redirect", url: `${GROUP_URL}/${search}` };
  }

  return { kind: "next" };
}
