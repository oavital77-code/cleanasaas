# Cleana SaaS

פלטפורמת SaaS רב-דיירית (multi-tenant) לניהול השכרת קליניקות — כל קליניקה
("דייר"/tenant) עם הסניפים, החדרים, המחירון ושיטת התשלום שלה, נרשמת בעצמה.

נבנתה בהשראת [`oavital77-code/claude-test`](https://github.com/oavital77-code/claude-test)
("בקליניקה" / Cleana המקורי) — מערכת חד-דיירית בפרודקשן שאין לגעת בה. הריפו
הזה הוא **בנייה חדשה לגמרי**, לא fork, לפי המפרט שהתקבל
(`SAASMIGRATIONSPEC.md` — לא נכלל בריפו, שמור אצל מי שהזמין את הפיתוח).

**לפני כל משימה: קראו את `PROGRESS.md`** — מה בנוי, מה נבדק, ומה עדיין
נותר, לפי סדר העבודה שהמפרט עצמו ממליץ עליו.

## Stack

זהה למקור: Next.js 15 (App Router) + TypeScript, Supabase (Postgres,
Auth, RLS), Tailwind + shadcn/ui (RTL), Vercel + Vercel Cron, WooCommerce
(פר-קליניקה), Resend (טרם חובר).

## עקרון־על

כל שורה בכל טבלה עסקית שייכת לקליניקה אחת (`clinic_id`). ה-`clinic_id`
**תמיד** נגזר בצד השרת מ-`auth.uid()` → `profiles.clinic_id` — אף פעם לא
מתקבל כפרמטר מהלקוח. ר' `CLAUDE.md` לחוקי הברזל המלאים (חלקם עדיין תקפים
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
  migrations/   סכמה + RLS + ~35 RPCs, ממוספר כרונולוגית
  tests/        harness replay מקומי + isolation smoke test (שתי קליניקות)
```
