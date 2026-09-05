# סטטוס — מול סדר העבודה של SAASMIGRATIONSPEC.md §16

## ✅ 1. סכמה + RLS + storage scoping

- `clinics` + `clinic_id` על כל טבלה עסקית (`branches`, `rooms`, `bookings`,
  `punch_cards`, `punch_card_tiers`, `session_subscriptions`, `session_slots`,
  `payments`, `room_blocks`, `overrun_charges`, `audit_log`, `app_settings`,
  `woo_product_tiers`, `woo_pending_purchases`, `clinic_payment_settings`,
  `clinic_invites`).
- `profiles.phone` → `unique(clinic_id, phone)` (התיקון מסעיף 9 של המפרט).
  `profiles.email` נשאר unique גלובלי (ר' הסבר ב-migration `init_schema`).
- RLS: כל policy מוסיפה `clinic_id = current_clinic_id()`, שנגזרת תמיד
  מ-`auth.uid()`. `public_availability` ו-`availability_events` (Realtime)
  מסוננות clinic_id — נבדק שאין דליפה חוצה-דיירים (ר' `supabase/tests/`).
- Storage: bucket `room-images` הפך **פרטי** (במקור: ציבורי לגמרי) + מדיניות
  לפי `storage.foldername(name)[1] = clinic_id` — שינוי מכוון, מחמיר יותר
  מהמקור, לפי דרישת המפרט §10.
- **נבדק:** replay מלא מול Postgres מקומי + isolation smoke test (שתי
  קליניקות, כולל ניסיון "לפרוץ" בין קליניקות) — ר' `supabase/tests/README.md`.
  התהליך הזה תפס באג אמיתי (self-escalation דרך trigger שגוי) *לפני* שהגיע
  לאף מקום — בדיוק המתודולוגיה שהמפרט דרש בסעיף 15.

## ✅ 2. Onboarding

- `/signup` (email+password — **לא** טלפון+OTP כמו במקור; אין ספק SMS
  מוגדר לפלטפורמה עדיין, וזה החלטה סבירה לשלב זה, לא פשרה על אבטחה)
  → `signup_clinic` RPC (יוצר `clinics`+`profiles(owner)`+
  `platform_subscriptions(trial)`+`app_settings` ברירת מחדל, אטומי).
- `/onboarding`: wizard חד-עמודי (לא multi-step מונחה) — סניפים → חדרים →
  תמחור (ברירת מחדל = 5 המדרגות של Cleana, עריכה חופשית ב-`/admin/settings`)
  → הפעלת/כיבוי מודל ססיה. **לא** UX מלוטש כמו שהמפרט מתאר ("מסך הקמה
  מודרך") — פונקציונלי, לא מוקפד.
- `/invite/[token]`: הצטרפות מטפל/ת/אדמין דרך קישור, עם אכיפת מכסת
  `platform_plan_limits` בזמן ה-accept (לא רק ב-UI).

## ✅ 3. RPCs קריטיים

`create_booking`, `cancel_booking`, `claim_woo_pending_purchase`,
`grant_bonus_hours`, `admin_adjust_punch_card_hours`,
`admin_complete_deposit` — כולם clinic-scoped, כולל תיקון הבאג הקונקרטי
מסעיף 9 (חיפוש phone/email ב-`activateSessionFromWooOrder`/
`claim_woo_pending_purchase` מסונן `clinic_id` תמיד).

## ✅ 4. תשלומי המטופלים/מטפלים (Woo)

`clinic_payment_settings` (טקסט רגיל, לא מוצפן — ר' "מגבלות ידועות" למטה) +
`lib/woo/*` clinic-scoped + webhook פר-קליניקה
(`/api/woo/webhook/[clinicId]`) + polling per-clinic loop
(`lib/woo/poll.ts`, ריצה נמשכת גם אם קליניקה בודדת נכשלת). ממשק
`/admin/settings` לעריכת מחירים ופרטי Woo באותו מסך, כדרישת המפרט.

## ✅ 5. תשלום הקליניקה לפלטפורמה

`platform_plan_limits` (trial/basic/pro) + `platform_subscriptions` +
`assert_within_plan_quota()` נאכף ב-`create_branch`/`create_room`/
`accept_therapist_invite` (לא רק ב-UI). `expire_trial_subscriptions` (cron)
מעביר trial שפג ל-`suspended`. **אין עדיין** אינטגרציית סליקה אמיתית
(Stripe וכו') — הטבלאות/האכיפה קיימות, אבל אין checkout בפועל לתשלום
הקליניקה עצמה על המנוי שלה.

## ✅ 6. RPCs נותרים + Superadmin

ססיות: `request_session`, `approve_session`/`reject_session`,
`admin_create_session`(+`_prepaid`), `materialize_subscription_bookings`,
חידוש (`initiate_session_renewal_payment`/`finalize_session_renewal`),
טווח התחייבות (`admin_renew_session_term`/`admin_end_session_term`), ביטול
מנוי. ניהול: `record_overrun`/`preview_overrun`/`finalize_overrun_charge`,
`admin_cancel_booking`/`admin_create_booking`. Superadmin:
`platform_admins`, `is_superadmin()`, `superadmin_list_clinics`,
`superadmin_set_clinic_status`/`superadmin_set_plan`, `platform_audit_log`
נפרד. **אין impersonation** — הוחלט במפורש לא לבנות אותו ב-MVP (ר' הערה
ב-migration `superadmin`, תואם את האזהרה בסעיף 8 של המפרט: זו הנקודה הכי
רגישה מבחינת פרטיות).

## ✅ 7. Cron loop-per-clinic + routing

4 ה-cron jobs (`materialize-sessions`, `send-reminders`, `poll-woo-orders`,
`cleanup-holds`) רצים על כל הקליניקות יחד, עם try/catch פר-קליניקה/פר-מנוי
כדי שתקלה אחת לא תעצור את כולן. Routing: דומיין אחד + בחירת קליניקה אחרי
login (המלצת המפרט ל-MVP, §11) — `clinic_id` נגזר מ-`profiles`, לא
מ-subdomain. Middleware לא עושה rewrite לפי host יותר (זה היה קיים במקור
בשביל `admin.cleana.co.il`, שגם שם היה "מתוכנן, טרם הופעל").

## ✅ 8. פרויקט Supabase אמיתי מחובר

פרויקט ייעודי לגמרי (ארגון **Cleanaplus**, `hayqlgcnncuhugwkajve`,
eu-central-1) — **לא** אחד משני הפרויקטים שהיו כבר מחוברים לחשבון הקודם
(אחד מהם התברר להיות ה-DB **האמיתי של הפרודקשן** של המערכת החד-דיירית
המקורית — 24 הזמנות אמיתיות, 1580 `room_blocks` מייבוא Skedda; לא נגענו
בו כלל). כל 13 המיגרציות רצות עליו בהצלחה (`supabase/migrations/*.sql`,
כולל שלוש מיגרציות הקשחה חדשות — ר' למטה).

**`get_advisors` (security) הורץ ותוקן בפועל, לא רק ברמת עיקרון:**
- 46 RPCs היו EXECUTE-able גם ל-`anon` וגם דרך ה-grant הגורף ל-PUBLIC
  שסופאבייס נותנת אוטומטית בכל `create function`. תוקן: `revoke ... from
  public` + `grant ... to authenticated` רק לכ-30 ה-RPCs שדורשים משתמש
  מחובר בפועל; ~13 פונקציות עזר פנימיות (cron/webhook/triggers) לא
  קיבלו execute בחזרה לאף role חיצוני. `is_admin`/`is_superadmin`/
  `current_clinic_id` **לא נגעו בהם במתכוון** — הן חלק מביטויי RLS POLICY
  עצמם, וה-EXECUTE שלהן ל-anon+authenticated הכרחי כדי שהערכת policy לא
  תיפול. **ניסיון ראשון היה שגוי** (revoke מ-role ישיר בלי revoke מ-PUBLIC
  — לא עשה כלום בפועל; התגלה ע"י בדיקת `has_function_privilege()` ישירות,
  לא ע"י הרצת ה-linter מחדש בלבד).
- `btree_gist` הועבר מ-`public` ל-`extensions` (תואם `pgcrypto`) — אומת
  שאילוצי ה-EXCLUDE על `bookings`/`room_blocks` נשארו valid אחרי המעבר.
- הממצא היחיד שנשאר במתכוון: `public_availability` הוא view בסגנון
  SECURITY DEFINER (ERROR-level ב-linter) — זו בדיוק המנגנון שמאפשר
  למטפל/ת לראות תפוסת חדרים של מטפלים אחרים באותה קליניקה בלי לדעת מי
  הזמין; הופך ל-security_invoker היה שובר את זה. מתועד בהערה במיגרציית
  ה-RLS.

`lib/supabase/types.ts` הוחלף מטיוטה ידנית ל-**קובץ אמיתי שנוצר עם
`supabase gen types typescript` מול הפרויקט האמיתי** — עם Tables/Views/
Functions/Enums/CompositeTypes מלאים. שלושת ה-clients (`server.ts`/
`client.ts`/`admin.ts`) ו-`lib/woo/*` חוברו בחזרה ל-`Database` generic.
תיקן שתי שגיאות type-check אמיתיות שהיו סמויות עד עכשיו (`create_room`
עם מחרוזת גולמית במקום ה-enum `room_type`; `p_token_uid: null` שלא תואם
את הטיפוס `string | undefined` שסופאבייס מייצרת לפרמטר אופציונלי).
`npm install`/`tsc --noEmit`/`eslint`/`vitest`/`npm run build` — כולם
ירוקים מול הפרויקט האמיתי (URL + anon key אמיתיים ב-`.env.local`, לא
placeholder).

**בוצע מאז**: Auth URL Configuration הוגדר (site URL + redirect URLs, גם
ל-localhost וגם לדומיין הפריסה ב-Vercel), ופריסה ראשונה עלתה בהצלחה
ב-`https://cleanasaas.vercel.app` (Vercel git-linked לריפו — כל push ל-main
מפעיל דיפלוי אוטומטי). זרימת signup→email confirm→onboarding נבדקה ידנית
ועובדת מול הפרויקט האמיתי (קליניקת בדיקה נוצרה בפועל: `orc`/"אור קליניקה").

**עדיין לא בוצע**: יצירת superadmin ראשון (`insert into platform_admins
...` עם ה-service role), בדיקת Woo webhook מקצה לקצה מול חנות אמיתית.

## ⚠️ 9. מסמכי ToS/DPA + admin actions מסוכנות ל-self-serve

**לא בוצע כלל** — טקסט משפטי (ToS/DPA) לא נכתב, ו-`grant_bonus_hours` נשאר
זמין ל-owner על הקליניקה שלו/ה בלי cap/הגבלת trial (ר' הערה ב-migration
`rpc_booking_and_punch_cards`). לפני פתיחה לציבור: צריך להחליט בין (א) הסרת
"שעות מתנה" ל-MVP הרב-דיירי, או (ב) cap קשיח + audit בולט + חסימה בזמן
trial.

---

## ✅ 10. מפת מסכים מלאה לפי CLEANASITEMAPANDDESIGN.md

המשתמש שלח מסמך תכולה אמיתי (מפת מסכים/ניווט/עיצוב של Cleana המקורי) אחרי
שהעיצוב הראשוני כאן כבר עלה — והוא לא תאם: היו כ-9 מסכים במקום ~20+, וסרגל
ניווט עליון פשוט במקום שני "צדדים" נפרדים עם סרגל צד קבוע. תוקן במלואו:

- **שלד**: `app/(app)/*` ו-`app/(admin)/admin/*` — route groups אמיתיים,
  לא רק תיקיות שטוחות. `components/app-shell.tsx` — סרגל צד 220px קבוע
  בדסקטופ (RTL: `inset-inline-start`, כך שהוא מימין אוטומטית), תפריט
  המבורגר נשלף במובייל, אייקוני lucide-react. שני סטים שונים של פריטי
  ניווט (7 בצד מטפל/ת, 9 בצד אדמין) לפי המסמך, + קישור-צולב בין הצדדים.
  `AuthShell`/`AppHeader` הקודמים נשארו רק למסכים שבמפורש **לא** אמורים
  להיות בסרגל (`/login`, `/signup`, `/onboarding`, `/superadmin`, וכו').
- **צד מטפל/ת (7)**: `/` (דשבורד), `/schedule` (לוח **יום אמיתי** —
  רשת חדרים×משבצות-30-דק לפי `public_availability`, לחיצה על "פנוי"
  מזמינה ישירות; לא היה קיים קודם, רק טופס), `/bookings` (הופרד מ-
  `/schedule`), `/purchase` + `/purchase/success` + `/purchase/failure`,
  `/sessions` + `/sessions/new` (בונה משבצות משותף, `components/slot-
  builder.tsx`, גם לבקשת מטפל/ת וגם לקביעת אדמין), `/payments`,
  `/profile` (כולל קישור פיד ICS). + `/reset-password`, `/privacy` (מחוץ
  לסרגל, כמו במסמך).
- **צד אדמין (9)**: `/admin` (דשבורד ווידג'טים), `/admin/board` (לוח מלא
  חוצה-חדרים עם שמות מטפלים, ביטול, שיבוץ ידני דרך `admin_create_booking`),
  `/admin/therapists` + `/admin/therapists/[id]` (כרטיס מלא: כרטיסיות,
  הזמנות, תשלומים, ססיות, הערה פנימית, שינוי role/status, הענקת שעות,
  איפוס סיסמה), `/admin/sessions` (תור אישור/דחייה) + `/admin/sessions/new`
  (`admin_create_session` חופשי), `/admin/payments` (+ סימון תשלום ססיה
  כמזומן), `/admin/rooms` (CRUD סניפים/חדרים — כתיבה ישירה, לא RPC, מותר
  לפי CLAUDE.md #1), `/admin/settings` (הועבר, נשאר ממוקד תמחור/Woo בלבד —
  "הזמנת מטפלים" עברה ל-`/admin/therapists` כי זה שם המקום שלה במסמך),
  `/admin/reports` (מונים בסיסיים לחודש), `/admin/audit` (`audit_log`).
- **תשתית**: `/api/ics/[token]` — פיד ICS ציבורי לפי `profiles.ics_token`
  (admin client, כי אין session; מסונן לפרופיל בודד — לא חושף מטפל אחר).
  "שכחתי סיסמה" נוסף כטוגל בתוך `/login` (לא route נפרד, כמו במקור).
- **באג DST אמיתי שנתפס תוך כדי**: `createBookingAction` בנתה
  `new Date(\`${date}T${time}:00\`)` — מתפרש בשעון השרת (UTC ב-Vercel), לא
  שעון הקליניקה. נוסף `zonedDateTimeToUtc()` ל-`lib/time` (עוטף
  `date-fns-tz#fromZonedTime`) ותוקן בכל מקום שבונה `starts_at` מ-קלט
  תאריך+שעה (schedule, board, sessions).
- כל ה-9 מסכי אדמין + 7 מסכי מטפל/ת רק **מחברים UI** ל-RPCs/טבלאות
  שכבר היו קיימים ומוכנים מ-milestone RPCs — לא נדרשה שום מיגרציית DB
  חדשה בשביל זה.

`tsc --noEmit`/`eslint`/`vitest`/`npm run build` — כולם ירוקים, 34 routes
מקומפלים (היה 15 לפני).

## ✅ 11. תצוגות שבוע/חודש + קישור הצטרפות פומבי לקליניקה

שני שיפורים לפי משוב משתמש ישיר:

- **שבוע/חודש**: `/schedule` ו-`/admin/board` קיבלו מתג תצוגה יום/שבוע/
  חודש (`lib/calendar.ts` — עזרי תאריכים טהורים, בלי תלות ב-DB/timezone).
  שבוע = בחירת חדר בודד + 7 עמודות ימים (רשת חדרים×7-ימים לא הייתה
  נכנסת). חודש = רשת חודשית קלה (ספירת הזמנות ליום באדמין, נקודה לימים
  עם הזמנה עצמית אצל מטפל/ת) שמקפיצה לתצוגת היום ללחיצה — לא ניסתה
  להכיל את כל הפרטים inline.
- **הרשמת מטפלים**: המנגנון הישן (טוקן חד-פעמי לכל מטפל/ת) הוחלף
  ב**קישור הצטרפות קבוע** פר-קליניקה — `clinics.published` (עמודה
  חדשה) + RPC חדש `join_clinic_as_therapist(slug, full_name, phone)`
  (migration `20260905000001`). אדמין לוחץ "פרסום קליניקה" ב-
  `/admin/therapists` ומקבל `/join/<slug>` קבוע לשיתוף. 🔴 **חסום
  במתכוון ל-role='therapist' בלבד** — אין שום דרך לקבל הרשאת אדמין דרך
  הקישור הפומבי; הזמנת אדמין/ית ממשיכה אך ורק דרך המנגנון הישן
  (`clinic_invites`, טוקן חד-פעמי), שנשאר זמין למקרה בודד/רגיש. נבדק גם
  quota (`assert_within_plan_quota`), `published`, ו-`status != suspended`
  בתוך ה-RPC עצמו — לא רק ב-UI.
- **ממצא אבטחה אמיתי שנתפס תוך כדי**: אחרי `apply_migration` הראשוני,
  `has_function_privilege('anon', 'join_clinic_as_therapist', 'execute')`
  החזיר `true` למרות `revoke ... from public` באותה migration — בניגוד
  למה שקרה לכל שאר ה-RPCs באותו דפוס בדיוק (`20260904000002`, כולם
  אומתו `anon=false`). תוקן ע"י revoke מפורש נוסף `from anon` (לא רק
  `from public`); לא ברור המקור המדויק לחוסר-העקביות (מתועד ב-migration
  עצמה). **לקח**: `has_function_privilege()` על anon ו-authenticated —
  לבדוק בפועל אחרי כל RPC חדש, לא להניח שהדפוס חוזר על עצמו אוטומטית.

## ✅ 12. תקן מובייל אחיד (לא עוד תיקוני נקודה)

התלונה שהובילה לזה: "חלונית הכרטיס שלי משנה את הרזולוציה כשאני רושם
בחלוניות כתיבה". זו **לא** בעיית layout — זו התנהגות קשיחה של iOS Safari:
`focus` על שדה קלט עם `font-size < 16px` מזמזם את כל הדף, והדף נשאר מוזז
גם אחרי היציאה מהשדה. הפתרון הוא בטוקן, לא בעמוד.

מה נעשה, ברמת המערכת:

- `Input`/`Select`/`textarea`: `text-base` (16px) עד `md`, ומעליו חוזרים
  ל-`text-[14.5px]` של השפה העיצובית. כך המובייל לא מזמזם והדסקטופ לא
  משתנה. גובה `h-12` במובייל (≥44px אזור מגע), `md:h-10` בדסקטופ.
- **`components/ui/select.tsx` חדש**: 13 עותקים של אותו `className` הוחלפו
  ברכיב אחד. זו הסיבה שהתיקון הקודם "שבר משהו אחר" — כל select חדש היה
  צריך לזכור את הכללים לבד. עכשיו הם מובנים.
- `body`: `overflow-x: clip` (עם `hidden` כ-fallback) ולא `hidden` בלבד —
  `hidden` הופך את body ל-scroll container ושובר `position: sticky` של
  צאצאים. זו הייתה רגרסיה שהכנסתי בסבב הקודם.
- `html { -webkit-text-size-adjust: 100% }` — מונע הגדלת טקסט אוטומטית
  בסיבוב מסך.
- `AppShell`: `min-w-0` על עמודת התוכן (מלכודת `min-width:auto` של flex —
  טבלה רחבה דחפה את כל העמודה מעבר לרוחב המסך), נעילת גלילת body כשהמגירה
  פתוחה, `overscroll-contain`, סגירה ב-Escape וסגירה אוטומטית במעבר
  לדסקטופ.
- לוחות זמנים: תאי מגע `h-11` במובייל / `md:h-8` בדסקטופ, כפתור ה-X של
  הביטול קיבל אזור מגע 32px, ותצוגת שבוע מקבלת `min-w-[680px]` ותצוגת יום
  `minWidth` דינמי לפי מספר החדרים — גלילה אופקית במקום עמודות מרוסקות.
- `@media (pointer: coarse)`: `touch-action: manipulation` על כפתורים —
  ביטול השהיית 300ms של double-tap.

## מגבלות/פשרות ידועות (לא כיסוי מלא של הספק המקורי)

- **אין עדיין**: מיילים (Resend) — `lib/email/*` מהמקור לא הועבר. ה-cron
  של תזכורות מזהה ומסמן (`*_notified_at`) אבל לא שולח בפועל. אין PWA
  (manifest/service worker/icons), אין Sentry עם tag `clinic_id` (המפרט
  §15 מבקש את זה — עוד לא חובר כי אין עדיין DSN אמיתי).
- **`clinic_payment_settings`**: הסודות (`woo_consumer_secret`,
  `woo_webhook_secret`) מאוחסנים כטקסט רגיל, מוגנים רק ב-RLS (admin +
  clinic_id שלו). לפני production: הצפנה אמיתית (pgsodium/Supabase Vault).
- **שעות פעילות**: `/schedule` ו-`/admin/board` משתמשים ב-08:00–22:00
  קבוע בקוד — אין עדיין שדה "שעות פעילות" per-clinic/per-branch (מסומן
  [לאפיון] ב-CLEANASITEMAPANDDESIGN.md, סעיף א').
- **Realtime**: הטבלה/triggers (`availability_events`) קיימים ב-DB אבל
  אין subscription בצד ה-UI — לוח הזמנים מתעדכן ב-revalidatePath (רענון
  בקשה), לא בזמן אמת בין משתמשים.
- **טלפון**: `toE164Israel` הוא ישראל-בלבד — קליניקה עתידית מחוץ לישראל
  (spec §1) תצטרך ולידציה בין-לאומית.
- **superadmin ראשון**: אין מסך הרשמה ל-superadmin (במתכוון — זה לא flow
  self-serve). יש להכניס ידנית: `insert into platform_admins (user_id,
  full_name) values ('<auth-user-id>', '<name>');` עם ה-service role.

## ✅ 13. ניקוי קישורי הזמנה, קריאות הזמנות מבוטלות, בחירת משבצות ויזואלית

- **`/admin/therapists`**: כל שורת "הזמנה ידנית" מקבלת כפתור ביטול (X) —
  `revokeInviteAction` מוחק ישירות מ-`clinic_invites` (מחוץ לרשימת
  הכתיבה-הישירה-האסורה של CLAUDE.md; RLS `admin_manage_invites` כבר מגביל
  לאדמין ולקליניקה שלו/ה). כפתור "ניקוי קישורים שנוצלו/פג תוקפם"
  (`clearUsedInvitesAction`) מופיע רק כשיש מה לנקות.
- **סטטוס הזמנה קריא לאדמין**: `/admin/therapists/[id]` ו-`/admin/audit`
  הציגו את ה-enum הגולמי מה-DB (`cancelled_by_user`, `booking_cancelled`
  וכו') — אדמין לא היה מבחין בקלות אילו הזמנות בוטלו ועל ידי מי. שני
  המסכים מציגים עכשיו תווית עברית + צבע, עם מפה שמכסה את כל ה-actions
  שנכתבים בפועל ל-audit_log.
- **בחירת משבצות ויזואלית ב-`/schedule`** (יום/שבוע): הוחלף מודל "לחיצה =
  שעה אחת מיידית" ברכיב `SlotGrid` (`app/(app)/schedule/slot-grid.tsx`) —
  לחיצה ראשונה = התחלה, לחיצה שניה (אותו חדר/יום) = סיום, כל מה שביניהן
  נבחר אוטומטית (נעצר בתא הראשון שאינו פנוי), ופס תחתון צף מציג משך
  ותאריך/שעה עם אישור/ביטול — בדיוק ההתנהגות של cleana.co.il המקורית.
  ה-Server Component עדיין קובע את כל מצב התא (past/mine/taken/blocked/
  available) לפי `public_availability`/`bookings`; הרכיב הלקוח רק מנהל
  את הבחירה ומפעיל את `createBookingAction` הקיים ישירות (Server Action
  קרוא כפונקציה רגילה, לא רק דרך `<form>`). "הזמנה ידנית" (טופס מדויק
  עם שעת התחלה/משך חופשיים) נשארה כאפשרות משלימה.

## ✅ 14. פס אישור צף fixed + סרגל עליון sticky במובייל

- **פס אישור הבחירה** (`SlotGrid`): היה `sticky` בתוך תיבת הטבלה (עלול
  "לברוח" עם גלילת שאר הדף). הוחלף ל-`position: fixed` אמיתי לתחתית
  המסך (`z-40`, מתחת למגירת הניווט שב-`z-50`, מעל ה-header שב-`z-30`),
  עם ריפוד `env(safe-area-inset-bottom)` לאייפונים עם home indicator.
  נוסף מרווח (spacer) בזרימה הרגילה כשיש בחירה פעילה, כדי שהפס לא יכסה
  את השורה האחרונה של הלוח.
- **הסרגל העליון במובייל** (`AppShell`, הלוגו + כפתור ההמבורגר): הפך
  ל-`sticky top-0 z-30` — נשאר צמוד לראש המסך גם כשגוללים את התוכן.
  תלוי ב-`overflow-x: clip` על `body` (לא `hidden`) מהתיקון הקודם —
  `hidden` היה הופך את body ל-scroll container חדש ומבטל sticky של
  צאצא, בדיוק כמו שקרה לסרגל הזה לפני כן.

## מה הכי דחוף להמשיך בו

1. Email (Resend) — תזכורות/יתרה-נמוכה/חידוש ססיה מזוהות אבל לא נשלחות.
2. הצפנת `clinic_payment_settings` לפני חיבור קליניקה אמיתית ראשונה.
3. ToS/DPA + החלטה על `grant_bonus_hours` בהרשמה עצמאית — לפני פתיחה לציבור.
4. שעות פעילות per-clinic (כרגע קבוע 08:00–22:00) + PWA (manifest/SW).
