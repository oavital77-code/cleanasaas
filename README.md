# Cleana SaaS

פלטפורמת SaaS רב-דיירית (multi-tenant) לניהול השכרת קליניקות — כל קליניקה
("דייר"/tenant) עם הסניפים, החדרים, המחירון ושיטת התשלום שלה, נרשמת בעצמה.

נבנתה בהשראת [`oavital77-code/claude-test`](https://github.com/oavital77-code/claude-test)
("בקליניקה" / Cleana המקורי) — מערכת חד-דיירית בפרודקשן שאין לגעת בה. הריפו
הזה הוא **בנייה חדשה לגמרי**, לא fork, לפי המפרט שהתקבל
(`SAASMIGRATIONSPEC.md` — לא נכלל בריפו, שמור אצל מי שהזמין את הפיתוח).

**להרצה, לתפעול ולתיקון תקלות — [`docs/HANDBOOK.md`](docs/HANDBOOK.md).**
לדיווח על פגיעת אבטחה — [`SECURITY.md`](SECURITY.md). לתנאי השימוש בקוד — [`LICENSE`](LICENSE).

**לפני כל משימה: קראו את `PROGRESS.md`** — מה בנוי, מה נבדק, ומה עדיין
נותר, לפי סדר העבודה שהמפרט עצמו ממליץ עליו.

## Stack

Next.js 15 (App Router) + TypeScript, Supabase (Postgres + RLS),
Tailwind + shadcn/ui (RTL), Vercel `fra1` + Vercel Cron, WooCommerce
(פר-קליניקה), Resend, Sentry, ו-PayPlus לחיוב הפלטפורמה עצמה.

**הזהות היא Clerk, לא Supabase Auth.** המערכת עברה, וזו המלכודת הנפוצה
ביותר כאן: `auth.uid()` **זורקת** בפונקציות ה-DB, כי ה-`sub` של Clerk הוא
מחרוזת ולא uuid. כל פונקציה חדשה חייבת להשתמש ב-`app_user_id()`.
ר' פרק 5 ב-[`docs/HANDBOOK.md`](docs/HANDBOOK.md).

## עקרון־על

כל שורה בכל טבלה עסקית שייכת לקליניקה אחת (`clinic_id`). ה-`clinic_id`
**תמיד** נגזר בצד השרת מזהות המשתמש (`app_user_id()` → `profiles.clinic_id`)
— אף פעם לא מתקבל כפרמטר מהלקוח. ר' `CLAUDE.md` לחוקי הברזל המלאים (חלקם עדיין תקפים
כמו שהם מהמערכת המקורית: RPC בלבד לזרימות עסקיות, מניעת חפיפה ברמת ה-DB,
FIFO על כרטיסיות, מטפל לא רואה מטפל אחר).

## הרצה מקומית

```bash
npm install
cp .env.example .env.local   # למלא פרטי פרויקט Supabase
npm run dev
```

יש להריץ את `supabase/migrations/*.sql` לפי הסדר על פרויקט Supabase (או
`supabase db push` אם מחובר CLI). לבדיקת הסכמה מול Postgres מקומי בלי
פרויקט Supabase בכלל — ר' `supabase/tests/README.md`.

## מבנה

```
app/
  signup/, onboarding/     → הרשמת owner + wizard הקמה
  invite/[token]/          → הצטרפות מטפל/ת דרך קישור הזמנה
  login/, suspended/
  schedule/                → הזמנת חדר + "ההזמנות שלי" (מינימלי)
  admin/settings/          → מחירים + שיטת תשלום (Woo) + הזמנות מטפלים
  superadmin/              → רשימת קליניקות, השעיה/הפעלה
  api/woo/webhook/[clinicId]/  → webhook Woo פר-קליניקה
  api/cron/                → materialize/reminders/cleanup/poll-woo, per-clinic loop
lib/
  supabase/   client/server/admin + types (ידני כרגע, ר' PROGRESS.md)
  auth/       requireClinicAdmin() וכו'
  time/       מקבל timezone כפרמטר (per-clinic, לא hardcoded)
  woo/        process-order/rest-client/verify/poll — הכל clinic-scoped
supabase/
  migrations/   סכמה + RLS + ~60 RPCs, ממוספר כרונולוגית
  tests/        harness replay מקומי + isolation smoke test (שתי קליניקות)
```
