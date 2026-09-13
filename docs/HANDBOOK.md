# Cleana (SaaS) — מדריך הפעלה, בנייה ותחזוקה

המסמך הזה הוא הדבר היחיד שצריך לקרוא כדי להריץ את המערכת, להבין למה היא
בנויה כך, ולתקן אותה כשמשהו נשבר. מצב ההתקדמות לפי משימות נמצא ב-
[`PROGRESS.md`](../PROGRESS.md); כאן מתועדת המערכת **כפי שהיא בנויה בפועל**.

המוצר האחות, Cleana+ (למטפלים עצמאיים), חי בריפו נפרד —
`oavital77-code/Click-na`. שני המוצרים נפגשים בדיוק בנקודה אחת, דשבורד
הבעלים, שמתועדת בפרק 11.

> **`cleana.co.il` היא מערכת אחרת.** המערכת החד־דיירית המקורית ("בקליניקה")
> רצה בפרודקשן ואינה קשורה לריפו הזה. הריפו הזה הוא בנייה חדשה לפי מפרט,
> לא fork, ואין לגעת במערכת המקורית מכאן בשום צורה.

---

## 1. מה זה

פלטפורמת SaaS **רב־דיירית** לניהול השכרת קליניקות. כל קליניקה היא "דייר"
(tenant) נפרד — הסניפים שלה, החדרים, המחירון, המטפלים ושיטת התשלום — והיא
נרשמת בעצמה בלי התערבות שלנו.

שלושה סוגי משתמשים:

| תפקיד | מה רואה |
| --- | --- |
| **מטפל** | היומן שלו, ההזמנות שלו, הכרטיסייה שלו. **לא רואה מטפל אחר** |
| **אדמין / בעלים** של קליניקה | הכל בקליניקה **שלו** בלבד — חדרים, מטפלים, תשלומים, דוחות |
| **superadmin** (אנחנו) | חוצה־קליניקות. `/superadmin`, וכן דשבורד הבעלים |

המודל העסקי: כרטיסיות שעות ומנויים לשעות חדר. מטפל מזמין חדר, שעות יורדות
מהכרטיסייה שלו לפי FIFO, וחריגה מהזמן נרשמת ומחויבת בנפרד.

---

## 2. ארכיטקטורה במבט אחד

```
   cleanagroup.app ─────────▶ middleware ─rewrite─▶ /group   (דף נחיתה של הקבוצה)
   cleanas.cleanagroup.app ─▶ האפליקציה
                                   │
   מטפל / אדמין (Clerk) ──────────▶│         ┌────────────────────────┐
   Vercel Cron ───────────────────▶│ Next 15 │────▶│ Supabase (Postgres) │
   WooCommerce webhook ───────────▶│  fra1   │     │  RLS + RPC          │
   PayPlus callback ──────────────▶└─────────┘     └────────────────────────┘
                                        │
                            Resend · Sentry · WhatsApp Cloud
```

| רכיב | בחירה | למה |
| --- | --- | --- |
| Framework | Next.js 15, App Router | |
| DB | Supabase Postgres, אזור פרנקפורט | RLS מספק בידוד דיירים ברמת ה-DB |
| זהות | **Clerk** | ר' האזהרה בפרק 5 — זה *לא* Supabase Auth |
| תשלומי קליניקות | WooCommerce, פר־קליניקה | כל קליניקה מחוברת לחנות שלה |
| תשלומי הפלטפורמה | PayPlus (טוקן) | ר' פרק 8 |
| מייל | Resend | |
| ניטור | Sentry, עם סינון PII | |
| אירוח | Vercel `fra1` + Vercel Cron | אותו אזור כמו ה-DB |

**עקרון־העל, והחוק החשוב ביותר במערכת כולה:**

> כל שורה בכל טבלה עסקית שייכת לקליניקה אחת (`clinic_id`), וה-`clinic_id`
> **תמיד** נגזר בצד השרת מזהות המשתמש — **לעולם לא מתקבל כפרמטר מהלקוח.**

כל דליפה בין קליניקות היא באג חמור מסוג אחד, ותמיד מאותו שורש: מישהו סמך
על ערך שהגיע מהדפדפן.

---

## 3. הרצה מקומית

**דרישות:** Node 22+. פרויקט Supabase (או Postgres מקומי — ר' למטה).

```bash
git clone https://github.com/oavital77-code/cleanasaas.git
cd cleanasaas

npm install
cp .env.example .env.local     # ואז למלא — ר' פרק 4
npm run dev                    # http://localhost:3000
```

**מיגרציות.** להריץ את `supabase/migrations/*.sql` **לפי סדר שמות הקבצים**
על פרויקט Supabase, או `supabase db push` אם ה-CLI מחובר. הסדר קריטי:
מיגרציות מאוחרות מניחות טבלאות ופונקציות של מוקדמות.

**בדיקה בלי פרויקט Supabase.** יש רתמה מקומית מלאה — ר'
[`supabase/tests/README.md`](../supabase/tests/README.md). `local_shim.sql`
מדמה את מה ש-Supabase מספק (סכמות `auth`, `app_user_id()`), וכך
`isolation_test.sql` ו-`platform_billing_test.sql` רצים מול Postgres רגיל.

פקודות:

| פקודה | מה עושה |
| --- | --- |
| `npm run dev` | שרת פיתוח |
| `npm run build` | בניית פרודקשן |
| `npm run lint` | ESLint |
| `npx tsc --noEmit` | בדיקת טיפוסים |
| `npm test` | בדיקות יחידה (91) |

---

## 4. משתני סביבה

הרשימה המלאה עם הסברים נמצאת ב-[`.env.example`](../.env.example). התקציר:

### חובה

| משתנה | מה זה |
| --- | --- |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` · `CLERK_SECRET_KEY` | זהות. בלעדיהם האפליקציה לא עולה בכלל |
| `NEXT_PUBLIC_SUPABASE_URL` · `NEXT_PUBLIC_SUPABASE_ANON_KEY` | חיבור בסיסי, כפוף ל-RLS |
| `SUPABASE_SERVICE_ROLE_KEY` | **עוקף RLS לגמרי.** ר' האזהרה למטה |
| `CRON_SECRET` | מאמת את Vercel Cron. בלעדיו ה-routes מחזירים 503 |
| `NEXT_PUBLIC_APP_URL` | מקור הפריסה — כל קישור מייל/ICS נבנה ממנו |

### פרודקשן

| משתנה | מה זה |
| --- | --- |
| `RESEND_API_KEY` · `RESEND_FROM_EMAIL` | מיילים |
| `CLERK_WEBHOOK_SIGNING_SECRET` | ל-`/api/webhooks/clerk` (`user.deleted` בלבד) |
| `PAYPLUS_API_KEY` · `PAYPLUS_SECRET_KEY` · `PAYPLUS_PAYMENT_PAGE_UID` | שלושתם או שהתשלום לא מוצע |
| `PLATFORM_PLAN_PRICE_ILS` | מחיר חודשי בש"ח. ברירת מחדל בקוד: **209** |
| `NEXT_PUBLIC_SENTRY_DSN` · `SENTRY_ORG` · `SENTRY_PROJECT` · `SENTRY_AUTH_TOKEN` | ניטור. בלי DSN — מנוטרל |
| `OWNER_STATS_SECRET` | סוד משותף לדשבורד הבעלים — ר' פרק 11 |

אופציונלי: `PAYPLUS_TERMINAL_UID`, `PAYPLUS_CASHIER_UID`, `PAYPLUS_BASE_URL`,
`CLEANAPLUS_STATS_URL`.

> ### 🔴 `SUPABASE_SERVICE_ROLE_KEY`
>
> המפתח הזה קורא וכותב **כל שורה של כל קליניקה**, ועוקף את כל מדיניות
> ה-RLS. הוא נקרא אך ורק דרך `createAdminClient()` ב-
> [`lib/supabase/admin.ts`](../lib/supabase/admin.ts), אך ורק בקוד שרת
> (`import "server-only"` בראש הקובץ אוכף את זה בזמן בנייה).
>
> **לעולם לא עם התחילית `NEXT_PUBLIC_`.** כל משתנה כזה נצרב ל-bundle של
> הדפדפן מעצם הגדרתו, כלומר מפורסם לכל מבקר באתר.
>
> אם דלף: Supabase → Settings → API → Rotate. מיד, לפני כל דבר אחר.

`WooCommerce` מוזן **פר־קליניקה** דרך `/admin/settings` ונשמר מוצפן בטבלה
`clinic_payment_settings` — אין ולא יהיו משתני Woo גלובליים.

---

## 5. זהות — הפרט שהכי מבלבל כאן

המערכת התחילה עם Supabase Auth ועברה ל-**Clerk**. המעבר הזה משאיר מלכודת
שחשוב להכיר:

```
Clerk session  ──▶  auth().userId  =  "user_2abc..."   (מחרוזת של Clerk)
                         │
                         ▼   profiles.clerk_user_id
                    profiles.id  =  uuid              ← זה מה שכל הקוד מסנן לפיו
```

ב-DB, המיפוי הזה הוא `app_user_id()`: היא לוקחת את `auth.jwt() ->> 'sub'`
ומחזירה את ה-`profiles.id` המתאים.

> **🔴 `auth.uid()` **זורקת** במערכת הזו.** היא מנסה להמיר את ה-`sub` ל-uuid,
> וה-`sub` של Clerk הוא מחרוזת כמו `user_2abc`, לא uuid. **כל פונקציית DB
> חדשה חייבת להשתמש ב-`app_user_id()`**, לעולם לא ב-`auth.uid()`.

בצד ה-TypeScript, [`lib/auth/guards.ts`](../lib/auth/guards.ts) הוא השער:

| פונקציה | מה מבטיחה |
| --- | --- |
| `requireTherapistProfile()` | מחובר + יש פרופיל. בלי → `/login`, באמצע הרשמה → `/onboarding`, מושעה → `/suspended` |
| `requireClinicAdmin()` | בנוסף `role in ('owner','admin')`, ו**מחזירה `clinicId` מפורשות** |
| `isSuperadmin(userId)` | קיים ב-`platform_admins` |

`requireClinicAdmin()` מחזירה את `clinicId` בכוונה תחילה — כדי שכל
route/action ישתמש בו ישירות ולא "ישכח" לסנן.

---

## 6. בידוד דיירים — שלוש שכבות

### שכבה 1: RLS

כל טבלה עסקית מוגנת ב-Row Level Security, והמדיניות נסמכת על
`current_clinic_id()` שנגזרת מ-`app_user_id()`. גם אם קוד האפליקציה ישכח
לסנן, ה-DB לא יחזיר שורה של קליניקה אחרת.

### שכבה 2: RPC בלבד לזרימות עסקיות

כל פעולה עסקית היא פונקציית Postgres, לא UPDATE מהלקוח. יש כ-60 כאלה —
`create_booking`, `approve_session`, `admin_issue_punch_card`,
`finalize_overrun_charge`, וכן הלאה. הסיבה: אטומיות. ירידת שעות מכרטיסייה
לפי FIFO, בדיקת מכסה ובדיקת חפיפה חייבות לקרות בטרנזקציה אחת, ולא בשלוש
קריאות מהדפדפן שאפשר לעצור באמצע.

### שכבה 3: שומרים ב-DB

- `assert_service_or_admin()` — נקראת בתוך RPCs מיוחסות.
- `enforce_clinic_privilege_columns()` / `enforce_profile_privilege_columns()` —
  טריגרים שמונעים שינוי של עמודות רגישות (`clinics.status`, `slug`, תפקיד)
  גם דרך נתיב שנראה תמים. כתיבה לגיטימית חייבת להכריז על עצמה ב-
  `set_config('cleana.trusted_write', 'on', true)`.

### 🔴 מלכודת ההרשאות של Postgres

**הבאג הזה הופיע בריפו הזה ארבע פעמים.** ב-Postgres, הרשאת `execute` על
פונקציה חדשה ניתנת ל-`public` כברירת מחדל. לכן:

```sql
-- ❌ לא עושה כלום. anon עדיין מריץ, דרך public.
revoke execute on function admin_do_something() from anon;

-- ✅ הדפוס הנכון
revoke all on function admin_do_something() from public, anon;
grant execute on function admin_do_something() to authenticated;
```

אחרי כל מיגרציה שנוגעת בהרשאות, לאמת בפועל:

```sql
select has_function_privilege('anon', 'admin_do_something()', 'execute');  -- חייב false
```

ולהריץ את Supabase Advisors (Database → Advisors).

---

## 7. ניתוב לפי host

פרויקט Vercel אחד מגיש שני דברים, לפי ה-host —
[`lib/hosts.ts`](../lib/hosts.ts), שנקרא רק מ-`middleware.ts`:

| host | מה מוגש |
| --- | --- |
| `cleanagroup.app` | דף הנחיתה של הקבוצה, ב-rewrite ל-`/group` |
| `cleanas.cleanagroup.app` | האפליקציה |
| `cleanaplus.cleanagroup.app` | Cleana+ — פרויקט Vercel אחר לגמרי |

על ה-host של הקבוצה מוגשים רק `/group`, `/terms` ו-`/privacy`. כל נתיב
אחר שם (למשל `/login`) שייך למוצר ולא לקבוצה, ולכן מופנה ל-Cleana באותו
נתיב. הלוגיקה היא פונקציה טהורה כדי שתיבדק ביחידה.

---

## 8. חיוב הפלטפורמה

זה החיוב ש**אנחנו** גובים מקליניקה על השימוש במערכת — נפרד לגמרי מ-
WooCommerce, שבו קליניקה גובה מהמטפלים שלה.

**209 ₪ לחודש כולל מע"מ** (`PLATFORM_PLAN_PRICE_ILS`), **30 יום התנסות**,
ואז **7 ימי חסד** לפני השעיה.

```
trialing ──(30 יום)──▶ grace ──(7 ימים)──▶ suspended → /suspended
    │                    │
    └──── שולם ──────────┴──▶ active ──(חיוב נכשל)──▶ grace
```

**למה טוקן ולא הוראת קבע:** מודול החיובים החוזרים של PayPlus לא מופעל
בחשבון. במקום זאת נשמר טוקן תשלום בחיוב הראשון, וה-cron שלנו מחייב אותו.
זה נותן שליטה מלאה על מועד החיוב ועל הניסיון החוזר, במחיר של אחריות: אם
ה-cron לא רץ, אף אחד לא מחויב.

**הזרימה, ומי אחראי למה:**

| שלב | איפה |
| --- | --- |
| פתיחת דף תשלום (`charge_method: 1`, `create_token: true`) | `platform_start_checkout` ← `lib/platform-billing.ts` |
| callback: הגבלת קצב → חתימת HMAC → אימות מול PayPlus → החלה | `app/api/billing/payplus/callback/route.ts` |
| זיכוי התקופה, שמירת הטוקן והמזהים | `platform_apply_payment` (RPC, service role בלבד) |
| תפיסת שורות לחידוש | `platform_claim_due_renewals` |
| חיוב הטוקן | `chargePlatformRenewals()` ← `app/api/cron/cleanup-holds` |
| התנסות שנגמרה, חסד שאזל, השעיה | `platform_billing_lifecycle` |

**מלכודות PayPlus שכבר עלו בדם:**

- `credit_terms: 1` **חובה** ב-`Transactions/Charge`. בלעדיו
  `credit-terms-incorrect`.
- `more_info` מוגבל ל-**19 תווים** — תווית, לא מזהה.
- טוקן שאבד מה-callback משוחזר רק דרך `Token/List` עם `terminal_uid` +
  `customer_uid`.
- קוד הצלחה הוא המחרוזת `"000"`.
- `terminal_uid` ו-`cashier_uid` הם קבועי חשבון שאף נקודת קצה לא מחזירה —
  הם מגיעים רק ב-callback, ובלעדיהם אי אפשר לחייב טוקן.

**מה מגן על הכסף:**

| סיכון | ההגנה |
| --- | --- |
| callback מזויף | חתימת HMAC על הגוף הגולמי **ובנוסף** אימות מול PayPlus |
| callback כפול | ייחודיות על `transaction_uid` ב-`platform_payments` |
| סכום שגוי | נבדק מול המחיר המוגדר לפני הזיכוי |
| שני cron יחד | `platform_claim_due_renewals` חותמת `last_charge_attempt_at` **באותה פקודת UPDATE** שמחזירה את השורה |
| callback שאבד | חידוש לא מאושר תוך יומיים מעביר לחסד |

`chargePlatformRenewals` עטופה ב-try/catch בתוך ה-cron: תקלה ב-PayPlus לא
מפילה את שאר העבודה המתוזמנת.

---

## 9. עבודות מתוזמנות

מוגדרות ב-[`vercel.json`](../vercel.json), וכולן עוברות דרך
[`lib/cron/guard.ts`](../lib/cron/guard.ts) שמאמת
`Authorization: Bearer <CRON_SECRET>`. בלי הסוד — **503, נכשל סגור
במכוון**: ה-routes האלה רצים ב-service role וכותבים על פני כל הקליניקות.

| שעה (UTC) | נתיב | מה עושה |
| --- | --- | --- |
| 01:00 | `materialize-sessions` | יוצר הזמנות קונקרטיות ממנויים חוזרים |
| 07:00 | `send-reminders` | תזכורות למטפלים |
| 11:00 | `poll-woo-orders` | משיכת הזמנות WooCommerce שה-webhook החמיץ |
| 13:00 | `cleanup-holds` | שחרור החזקות, **חידושי PayPlus**, מחזור החיים של החיוב |

`poll-woo-orders` קיים כי webhook הוא הבטחה, לא ערובה: חנות שהייתה למטה
בזמן ההודעה לא תשלח אותה שוב. המשיכה היומית היא הרשת מתחת.

---

## 10. אבטחה

מעבר לשלוש שכבות הבידוד בפרק 6:

**webhook של WooCommerce** (`/api/woo/webhook/[clinicId]`) — חתימת HMAC
מאומתת ב-`lib/woo/verify.ts` לפני כל עיבוד.

**callback של PayPlus** — חתימה **ואימות** מול PayPlus, כמפורט בפרק 8.

**Sentry** — PII מסונן לפני שליחה, `lib/sentry/scrub-pii.ts`. דוח שגיאה
ממערכת בריאות לא אמור לשאת שמות מטופלים לשירות חיצוני.

**הגבלת קצב** — `lib/rate-limit.ts`, על ה-callback ועל נתיבים פתוחים.

**`import "server-only"`** בראש כל מודול שנוגע ב-service role. ייבוא בטעות
מקומפוננטת לקוח נכשל **בזמן בנייה**, לא בזמן ריצה בפרודקשן.

מה שסורק אוטומטית, ומה שהסריקות **לא** מכסות: ר'
[`SECURITY.md`](../SECURITY.md). בקצרה — CodeQL ו-Gitleaks בודקים
TypeScript והיסטוריה, אבל **לא** את מדיניות ה-RLS, שהיא SQL. את זה בודקים
`supabase/tests/` ו-Supabase Advisors, ושניהם צריכים לרוץ אחרי כל מיגרציה
שנוגעת בהרשאות.

---

## 11. דשבורד הבעלים ומדרגות הרכישה

`/superadmin/owner` — מסך אחד שמראה מי קנה את **שני** המוצרים, מתי,
ובאיזה סטטוס. מוגן ב-`platform_admins`.

```
/superadmin/owner
    ├─ CleanaS:  קריאה ישירה ל-Supabase (service role)
    └─ Cleana+:  GET https://cleanaplus.cleanagroup.app/api/owner/stats
                 Authorization: Bearer <OWNER_STATS_SECRET>
```

שני המקורות נטענים בנפרד ונכשלים בנפרד — Cleana+ שלא נטען לא מסתיר את
נתוני CleanaS, והסיבה מוצגת על המסך.

**`OWNER_STATS_SECRET` חייב להיות אותו ערך בדיוק בשני פרויקטי Vercel**,
ואחרי הגדרה צריך **Redeploy** בשניהם:

| מה רואים | מה קרה |
| --- | --- |
| "OWNER_STATS_SECRET לא מוגדר" | חסר בצד הזה, או שלא נעשה Redeploy כאן |
| Cleana+ החזיר 503 | חסר בצד Cleana+, או שלא נעשה Redeploy שם |
| Cleana+ החזיר 401 | מוגדר בשניהם אבל הערכים שונים (בדרך כלל רווח נגרר) |

### מדרגות הרכישה

[`lib/owner/thresholds.ts`](../lib/owner/thresholds.ts) קושר כל שדרוג בתשלום
למספר המשתמשים הפעילים שמצדיק אותו, כדי שלא נקנה שירותים "ליתר ביטחון".
הדשבורד מציג מה **נדרש עכשיו**, מה **הבא בתור**, וכמה זה מסתכם לחודש.

| במשתמש ה־ | שירות | $ לחודש |
| --- | --- | --- |
| 1 | Supabase Pro | 25 |
| 15 | Resend Pro | 20 |
| 20 | Vercel Pro | 20 |
| 50 | Supabase compute Small | 15 |
| 50 | Sentry | 0 |
| 100 | Supabase PITR | 100 |
| 100 | Cleana+ DB pooler | 25 |
| 250 | Supabase compute Medium | 60 |
| 1000 | Clerk Pro | 25 |

"משתמש פעיל" = התנסות + משלם + חסד + בביטול + חינם־מדור־קודם, בשני
המוצרים יחד (`activeUsersOf()` ב-`lib/owner/stats.ts`).

---

## 12. פריסה

Vercel, פרויקט `cleanasaas`, אזור **`fra1`**, דומיין `cleanas.cleanagroup.app`
(וגם `cleanagroup.app` דרך ה-rewrite). דחיפה ל-`main` פורסת לפרודקשן.

**האזור חייב להישאר `fra1`.** ה-DB בפרנקפורט; פונקציה באזור אחר משלמת את
המרחק בכל שאילתה, ויש הרבה שאילתות בכל בקשה.

**רשימת בדיקה לפני פריסה:**

1. כל משתני פרק 4 מוגדרים ב-Vercel, scope **Production**.
2. כל המיגרציות הוחלו, **לפי סדר**, על פרויקט ה-Supabase של פרודקשן.
3. Supabase Advisors נקי (Database → Advisors).
4. `NEXT_PUBLIC_APP_URL` הוא המקור האמיתי.
5. `RESEND_FROM_EMAIL` על דומיין מאומת ב-Resend.
6. Webhook של Clerk מצביע ל-`/api/webhooks/clerk`.
7. ארבעת ה-cron מופיעים ב-Vercel → Settings → Cron Jobs.

---

## 13. Runbook

**"קליניקה רואה נתונים של קליניקה אחרת."** עצירת הכל. זו התקלה החמורה
ביותר במערכת. לבדוק לפי הסדר: (1) ה-RPC המעורבת — האם היא `security
definer` בלי בדיקת `clinic_id`? (2) האם הקוד קיבל `clinic_id` מהלקוח
במקום מ-`requireClinicAdmin()`? (3) `select has_function_privilege('anon',
...)` — ר' מלכודת ההרשאות בפרק 6.

**`function ... does not exist`.** כמעט תמיד מספר ארגומנטים שגוי אחרי
מיגרציה ששינתה חתימה — Postgres מזהה פונקציות לפי שם **וחתימה**. לוודא
שכל הקוראים עודכנו, כולל בדיקות ה-SQL.

**`auth.uid()` זורקת.** לא באג — הצפוי. להשתמש ב-`app_user_id()`. ר' פרק 5.

**שינוי ב-`clinics.status` "לא נתפס".** הטריגר
`enforce_clinic_privilege_columns()` החזיר אותו בשקט. כתיבה לגיטימית
חייבת לעטוף ב-`set_config('cleana.trusted_write', 'on', true)`.

**ה-cron לא רץ.** 401 = `CRON_SECRET` שונה בין Vercel לפרויקט. 503 = לא
מוגדר כלל — וזו התנהגות מכוונת.

**הזמנות WooCommerce לא נכנסות.** לבדוק את חתימת ה-webhook, ואז לחכות
ל-`poll-woo-orders` היומי שמושך מה שהוחמץ. סודות ה-Woo הם פר־קליניקה
ב-`clinic_payment_settings`, לא ב-env.

**תשלום נכשל עם `provider_error`.** ההודעה על המסך היא של PayPlus כלשונה,
במכוון. `THIS COMPANY DONT HAVE THE PERMISSION TO USE THE API` היא הרשאת
חשבון אצל PayPlus, לא באג אצלנו.

---

## 14. פרסום הריפו

הריפו מיועד להיות **ציבורי לצפייה** כדי לקבל את סריקות האבטחה של GitHub
בחינם. ציבורי אינו אומר מורשה לשימוש — ר' [`LICENSE`](../LICENSE).

לפני העברה לציבורי, ואחרי כל שינוי גדול:

1. `gitleaks git --config .gitleaks.toml --redact .` — נקי. זו הבדיקה
   שלא ניתן לבטל אחר כך: קומיט שפורסם, פורסם.
2. `git ls-files | grep '\.env'` מחזיר רק `.env.example`.
3. Settings → Advanced Security: להפעיל **Private vulnerability reporting**,
   **Dependabot alerts**, **Secret scanning + push protection**, ו-**Code
   scanning**. ל-CodeQL עדיף **default setup** — GitHub מתחזק אותו ואין קובץ
   workflow שיכול להירקב. זו הסיבה שאין כאן workflow משלנו ל-CodeQL.
4. Branch protection על `main`: לדרוש ש-CI יעבור.

שימו לב במיוחד: `supabase/migrations/` הופך לקריא לכולם, כלומר **מדיניות
ה-RLS שלנו נעשית ציבורית**. זה בסדר — אבטחה שנשענת על סודיות המדיניות
אינה אבטחה — אבל זה אומר שכל פער במדיניות גלוי לעין. פרק 6 הוא לא
תיעוד בלבד; הוא רשימת הבדיקה.
