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

- **מיילים (Resend)**: `lib/email/*` הועבר מהמקור ומחובר בפועל — אישור/ביטול
  הזמנה (עם ICS מצורף), תזכורת 24 שעות, יתרה נמוכה, כרטיסייה פגה, בקשת/
  אישור/דחיית ססיה, חידוש ססיה מ-Woo, רכישת כרטיסייה ממתינה, קבלת פנים
  לקליניקה חדשה ב-signup, הודעה לאדמיני קליניקה על מטפל/ת חדש/ה (join/
  invite), והתראת cron שנכשל (לסופר-אדמינים, לא לאדמיני קליניקה — תקלת
  cron היא חוצת-קליניקות). `getAdminEmails`/`getSuperadminEmails`
  ב-`lib/email/recipients.ts` — clinic_id חובה בראשון, קריטי ל-חוק #3.
  🔴 בלי `RESEND_API_KEY`/`RESEND_FROM_EMAIL` אמיתיים ב-Vercel, `sendEmail`
  מתעד ל-console ומחזיר כישלון "רך" בלי לזרוק — האפליקציה ממשיכה לעבוד,
  פשוט בלי מיילים בפועל. אין PWA (manifest/service worker/icons), אין
  Sentry עם tag `clinic_id` (המפרט §15 מבקש את זה — עוד לא חובר כי אין
  עדיין DSN אמיתי).
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

## ✅ 15. באג אמיתי: לוח האדמין לא הראה אף הזמנה קיימת + שיבוץ מהלוח + סרגל sticky

- **הבאג האמיתי (לא cache, לא תאריך לא נכון)**: `/admin/board` הראה "פנוי"
  בכל תא, כולל משבצות עם הזמנה מאושרת שנוצרה דקות קודם לכן. אימתתי ישירות
  ב-DB (Supabase MCP): `bookings` יש לה **שתי** foreign keys ל-`profiles`
  (`user_id` ו-`cancelled_by`). embed לא-מפורש כמו `profiles(full_name)`
  דו-משמעי מבחינת PostgREST — הוא מחזיר שגיאת "more than one relationship
  was found", אבל הקוד קרא רק את `{ data }` מה-Promise.all ומעולם לא בדק
  `error`. אז `data` היה `null`, הפך ל-`[]`, וכל תא נראה "פנוי" בלי שום
  שגיאה גלויה — לוח שנה שמשקר שקט על תפוסה בפועל. תוקן בשלושה מקומות:
  `admin/board` (DayView+WeekView, `profiles!bookings_user_id_fkey`) ו-
  `admin/sessions` (`session_subscriptions` יש לה גם `reviewed_by` →
  `profiles!session_subscriptions_user_id_fkey`). נוסף גם `console.error`
  על כל שאילתה קריטית כזו, כדי שבאג דומה לא יישאר שקט שוב. **בדקתי את כל
  שאר ה-embeds של `profiles` בקוד** (`payments`, `audit_log`) — לשתיהן FK
  יחיד ל-profiles, לא דו-משמעיות, לא נגעתי.
- **שיבוץ ישיר מהלוח לאדמין**: `admin/board/admin-slot-grid.tsx` — אותו
  מנגנון בחירת טווח בשתי לחיצות כמו ב-`/schedule`, אבל עם `<Select>` לבחירת
  "עבור מי" קובעים את התור (עצמי או כל מטפל/ת אחר/ת ברשימת המשתמשים
  הפעילים) ושדה הערה, בפס האישור הצף. קורא ל-`adminAssignBookingAction`
  הקיים ישירות (Server Action כפונקציה, לא רק `<form>`). "שיבוץ ידני"
  (טופס מדויק) נשאר כאפשרות משלימה מתחת ללוח.
- **סרגל הניווט הצדדי בדסקטופ הפך ל-`sticky top-0 self-start h-screen`** —
  בלי `self-start` הוא נמתח לגובה כל השורה (כולל תוכן העמוד הארוך) בגלל
  `align-items: stretch` המובנה של flex, ואז `sticky` לא עוזר כי האלמנט
  כבר "ארוך" כמו כל הדף. `self-start` משחרר אותו לגובה הטבעי, ורק אז
  ה-sticky שומר אותו צמוד לראש המסך תוך גלילת התוכן שלצידו.

## ✅ 16. סקירת אבטחה — ממצאים ותיקונים

### תוקן

- **🔴 גבוה — 4 endpoints של cron היו פתוחים לחלוטין לאינטרנט.**
  `vercel.json` מגדיר 4 crons, ואף אחד מה-routes לא אימת דבר (`CRON_SECRET`
  לא הופיע בקוד בכלל). כולם רצים עם `createAdminClient()` — service role,
  עוקף RLS, כותב על פני **כל** הקליניקות. ניצול אפשרי: קריאה חוזרת
  ל-`send-reminders` מסמנת את כל התזכורות כ"נשלחו" (`reminder_sent_at`)
  ואז אף מטפל/ת לא מקבל/ת תזכורת 24 שעות; `materialize-sessions` מבצע
  כתיבה כבדה חוצת-קליניקות בכל קריאה (DoS/עלות); `poll-woo-orders` שורף
  את מכסת ה-API של WooCommerce של כל קליניקה. תוקן ב-`lib/cron/guard.ts`:
  אימות `Authorization: Bearer $CRON_SECRET` בהשוואת זמן-קבוע (דרך SHA-256
  כדי שגם אורך הסוד לא ידלוף), **fail closed** — בלי `CRON_SECRET` מוגדר
  ה-routes מחזירים 503 ולא רצים. 8 בדיקות יחידה נועלות את ההתנהגות
  (`lib/cron/guard.test.ts`).
- **🟠 בינוני — אין כותרות אבטחה.** נוספו ב-`next.config.ts`:
  `X-Frame-Options: DENY` + `CSP: frame-ancestors 'none'` (clickjacking),
  `nosniff`, `HSTS`, `Permissions-Policy`, ו-`Referrer-Policy:
  strict-origin-when-cross-origin` — האחרון קריטי דווקא בגלל
  `/api/ics/[token]`, שבו הטוקן יושב ב-URL עצמו והיה דולף בכותרת `Referer`
  לכל דומיין חיצוני שנלחץ מהדף.
- **🟡 נמוך — הרשאות עודפות על `public_availability`.** ל-`anon` היו
  SELECT+INSERT+UPDATE+DELETE על ה-view שמממש את חוק #3 (בפועל anon קיבל 0
  שורות, כי ה-view מסנן `current_clinic_id()` שמחזירה NULL בלי auth).
  מיגרציה `20260905000002`: `anon` ללא הרשאות כלל, `authenticated` עם
  SELECT בלבד. אומת אחרי ההחלה.

### נבדק ונמצא תקין (לא שונה)

- **בידוד רב-דיירי**: כל 24 הטבלאות עם RLS מופעל ומדיניות אחת לפחות. כל
  מדיניות מסננת `clinic_id = current_clinic_id()`. `profiles` SELECT מחזיר
  רק את עצמך (או אדמין בקליניקה שלך) — חוק #3 נאכף ברמת ה-DB, לא רק ב-UI.
- **הסלמת הרשאות**: למדיניות UPDATE על `profiles` אין `WITH CHECK` — אבל
  הטריגר `enforce_profile_privilege_columns` מחזיר `clinic_id`/`phone`/
  `email` תמיד לערך הישן, ו-`role`/`status`/`door_code`/פרטי כרטיס לערך
  הישן כשמדובר בעריכה עצמית או בלא-אדמין. כלומר מטפל/ת **לא** יכול/ה
  לקדם את עצמו/ה לאדמין או לעבור קליניקה דרך PostgREST. (הגנה בשכבה
  אחת — שווה להוסיף `WITH CHECK` כחגורה נוספת בעתיד.)
- **IDOR ב-RPCs**: כל 15 ה-RPCs שנבדקו מאמתים `auth.uid()` (או
  `is_superadmin()` שמאמת דרכו), וכולם עם `SET search_path` — אין חטיפת
  search_path. `cancel_booking` מסנן `user_id = v_uid`;
  `superadmin_list_clinics` זורק `FORBIDDEN` ללא superadmin.
- **Webhook של Woo**: HMAC-SHA256 על הגוף הגולמי, `timingSafeEqual`, בדיקת
  אורך, והאימות קורה **לפני** `JSON.parse` — לא מפרסרים קלט לא מאומת. סוד
  פר-קליניקה, ה-`clinicId` שבנתיב משמש רק לאיתור הסוד. Replay אפשרי
  תיאורטית אך אידמפוטנטי (`payplus_transaction_uid` UNIQUE).
- **`/api/ics/[token]`**: הטוקן הוא `gen_random_uuid()` (122 ביט) — לא
  ניתן לניחוש. מחזיר רק הזמנות של אותו פרופיל, בלי PII מעבר לשם החדר.
- **סודות**: רק `.env.example` ב-git, `.env*` ב-`.gitignore`,
  `lib/supabase/admin.ts` עם `import "server-only"` — ה-service role לא
  יכול להגיע ל-bundle של הדפדפן.
- **XSS**: אין `dangerouslySetInnerHTML`, `eval` או `new Function` בקוד.

### נותר פתוח (מתועד, לא תוקן)

- `clinic_payment_settings` שומר `woo_consumer_secret`/`woo_webhook_secret`
  כטקסט רגיל (מוגן ב-RLS בלבד) — הצפנה אמיתית לפני קליניקה אמיתית ראשונה.
- אין rate limiting על ה-endpoints הציבוריים (`/join/[slug]`, `/api/ics`).
- אין מסך לסיבוב (rotate) של `ics_token` אם הוא דלף.
- מדיניות `no_direct_insert`/`no_direct_update` על `bookings` מתירה
  בפועל כתיבה ישירה **לאדמין** דרך PostgREST — עוקפת את הלוגיקה של
  ה-RPC (חיוב שעות, audit). מוגבל לאדמין של אותה קליניקה, אבל מנוגד לרוח
  חוק #1.
- `auth_leaked_password_protection` כבוי ב-Supabase Auth (בדיקת סיסמאות
  מול HaveIBeenPwned) — הפעלה בלחיצה בדשבורד.

## ✅ 17. כותרת ועמודת שעה קבועות בלוח + לוגו מקשר לבית

- **`components/calendar-grid-styles.ts`** (חדש): טוקני sticky משותפים לשתי
  הרשתות, כדי ששני הצדדים יתנהגו זהה. שלושה דברים היו חייבים להשתנות יחד:
  1. **תיבת גלילה משלה לרשת** (`overflow-auto` + `max-h-[calc(100dvh-13rem)]`)
     במקום `overflow-x-auto` על ה-`CardContent` העוטף. בלי זה אי אפשר בכלל:
     ה-sticky של תא בטבלה נמדד מול ה-scroll container הקרוב ביותר, ולכן
     כשהגלילה האנכית הייתה של הדף כולו הכותרת פשוט לא הייתה נדבקת.
  2. **`border-separate` במקום `border-collapse`**: עם collapse הגבולות
     שייכים לרשת הטבלה ולא לתא, ונשארים מאחור כשהתא נדבק (קו כפול/חסר).
     הגבולות עברו לתאים עצמם.
  3. **`start-0` ולא `left-0`** לעמודת השעה — `inset-inline-start`, כלומר
     ימין ב-RTL, שם באמת יושבת העמודה הראשונה. אומת ב-CSS שנבנה:
     `.start-0{inset-inline-start:calc(var(--spacing)*0)}`.
  סדר ה-z: פינה (30) > כותרת (20) > עמודת שעה (10), וכל תא דביק עם רקע
  אטום — אחרת התוכן נגלל מתחתיו ונראה.
- **הלוגו הפך לקישור** בשלושת המקומות ב-`AppShell` (סרגל דסקטופ, כותרת
  מובייל, מגירה) — לדף הבית של הצד הנוכחי: `/admin` לאדמין, `/` למטפל/ת.

## 🔄 18. מעבר ל-Clerk — שלבים 1–2 (שכבת ה-DB) הושלמו

**הדגם**: Click-na (`oavital77-code/click-na`) — `@clerk/nextjs` + `heIL`
מ-`@clerk/localizations`, `<SignIn routing="path">` בנתיב catch-all,
`clerkMiddleware`, ו-webhook שמסנכרן `user.created`/`user.deleted` לטבלה.
**אבל** Click-na הוא Clerk + Prisma **בלי RLS** — ההרשאות שם נאכפות בקוד
האפליקציה (`getCurrentTherapist()` ממפה `clerkUserId` → שורה). ב-cleanasaas
ההרשאות נאכפות ב-DB: 24 טבלאות עם RLS ו-30 RPC, כולם על `auth.uid()`.
העתקה ישירה של דגם Click-na הייתה מוחקת את בידוד הדיירים — לכן Clerk נכנס
כאן כספק זהות ל-Supabase (Third-Party Auth), וה-RLS נשאר.

### 🔴 העובדה שקבעה את כל התכנון

```sql
-- ההגדרה של Supabase:
auth.uid() → select coalesce(..., claims ->> 'sub')::uuid
```
ה-sub של Clerk הוא `user_2abc...` — לא UUID. אימתתי מול ה-DB החי:
`auth.uid()` **זורקת** `invalid input syntax for type uuid`, היא לא מחזירה
NULL. כלומר אי אפשר להדליק את Clerk בדשבורד ולתקן את ה-DB אחר כך — ברגע
שהטוקן מתחלף, כל מדיניות וכל RPC קורסים יחד. ה-DB חייב לעבור **קודם**,
ובאופן שממשיך לעבוד עם הסשנים הקיימים.

### מה בוצע (מיגרציות `20260905000003`, `20260905000004`)

- `profiles.clerk_user_id text unique` — המיפוי בין משתמש Clerk לפרופיל.
- **`app_user_id()`** — פתרון הזהות היחיד, דו-מצבי. בכוונה **לא** קוראת
  ל-`auth.uid()`: היא קוראת את ה-sub הגולמי ועושה cast ל-uuid רק אחרי
  בדיקת ביטוי רגולרי, ואחרת ממפה דרך `clerk_user_id`.
- שלוש פונקציות הזהות (`current_clinic_id`, `is_admin`, `is_superadmin`)
  עברו אליה — וכל ~20 המדיניות שעוברות דרכן הפכו תואמות-Clerk בלי לגעת בהן.
- 8 המדיניות שהשתמשו ב-`auth.uid()` ישירות נכתבו מחדש (כולל
  `session_slots.own_slots` שהתגלתה רק בסריקה ממצה).
- טריגר ההגנה `enforce_profile_privilege_columns` הומר, ונוסף בו
  `clerk_user_id` לרשימת העמודות שלקוח לעולם לא יכול לשנות — אחרת אפשר
  היה "לחטוף" פרופיל של אחר ע"י מיפויו למשתמש Clerk שלי.
- 27 RPCs הומרו ל-`app_user_id()`. ההמרה נעשתה מתוך `pg_get_functiondef`
  ולא בהקלדה מחדש — 27 גופי פונקציות של לוגיקת כספים והרשאות זה יותר מדי
  שטח לשגיאת העתקה.

**אימות מול ה-DB החי**: sub של Supabase → נפתר לאותו פרופיל/קליניקה,
`is_admin()` עדיין true (אפס רגרסיה); sub של Clerk → מחזיר NULL בלי לזרוק;
0 מדיניות נותרו על `auth.uid()`; 32 פונקציות על `app_user_id()`.

### מה נשאר (שלב 3 — צד האפליקציה)

חוסם: יצירת אפליקציית Clerk + הפעלת Clerk כ-Third-Party Auth ב-Supabase.
אחר כך: `ClerkProvider` + `heIL`, `clerkMiddleware`, דפי `<SignIn>/<SignUp>`
בעברית, החלפת `lib/auth/guards.ts` ומקור הטוקן ב-`lib/supabase/server.ts`,
ושלוש פונקציות *יצירת* המשתמש (`signup_clinic`, `accept_therapist_invite`,
`join_clinic_as_therapist`) שהוחרגו במכוון — הן כותבות `id = auth.uid()`,
כלומר משתמשות בזהות כערך ולא כשאילתה, ומומרות יחד עם זרימת ההרשמה.

## ✅ 19. מעבר ל-Clerk — שלב 3 (צד האפליקציה) הושלם ל-/login

ממשיך את סעיף 18 (שכבת ה-DB הדו-מצבית). אפליקציית Clerk נפרדת נוצרה
(`CleanaSaaS`, לא `Cleana+` של Click-na — בכוונה: Third-Party Auth סומך על
**כל** טוקן חתום מאותו Clerk instance, ושני מוצרים נפרדים לא חולקים בסיס
משתמשים) וחוברה ל-Supabase דרך Third-Party Auth (לא JWT Templates — זה
הופסק באפריל 2025).

- **`app/layout.tsx`**: `ClerkProvider` עם `localization={heIL}` ו-
  `appearance` שממופה לטוקני העיצוב שלנו (`--violet-500`, `--font-heebo`,
  `--radius`) — כך שהווידג'טים של Clerk לא נראים כמו מוצר זר בתוך העמוד.
- **`middleware.ts`**: `clerkMiddleware` עוטף את ה-middleware הקיים.
  ריענון ה-session הישן של Supabase Auth נשאר בפנים — dual-mode.
- **`lib/supabase/server.ts`**: יש session של Clerk → client עם
  `accessToken: getToken` (Clerk כבר מנהל cookie session משלו). אין →
  נופל ל-client מבוסס-cookies הישן. **תקלה אמיתית שנתפסה כאן**: אם
  הפונקציה מחזירה union של שני ה-client instantiations בלי טיפוס guiding
  מפורש, TypeScript לא מאחד אותם ל-overload set קריא — `.from()`/`.rpc()`
  נשברים עם "expression is not callable" **בכל קובץ בקוד** שקורא
  ל-`createClient()`. תוקן עם `Promise<SupabaseClient<Database>>` מפורש.
- **`lib/auth/guards.ts`**: `loadAuthState` בודק קודם session של Clerk
  (מחפש `profiles.clerk_user_id`); רק בלעדיו נופל ל-`supabase.auth.getUser()`
  הישן. `userId` המוחזר תמיד `profiles.id` הפנימי, לא מזהה הזהות הגולמי.
- **`link_clerk_identity()` (מיגרציה `20260905000005`)**: קישור אוטומטי
  חד-פעמי בכניסה הראשונה — מי שהתחבר/ה לפני המעבר (יש לו/ה פרופיל עם
  `clerk_user_id is null`) מקושר/ת אוטומטית אם האימייל תואם, כדי לא לאבד
  גישה לקליניקה הקיימת. **שיקול אבטחה שנפתר כאן**: לא UPDATE ישיר מהקוד
  (chicken-and-egg עם RLS — `app_user_id()` עוד NULL לפני הקישור עצמו,
  והטריגר `enforce_profile_privilege_columns` חוסם שינוי `clerk_user_id`
  ממילא), וגם לא RPC שמקבל אימייל כפרמטר מהלקוח (משתמש/ת Clerk כלשהו/י
  היה/הייתה יכול/ה "לתפוס" פרופיל אדמין קיים רק בידיעת האימייל שלו/ה).
  הפתרון: RPC עם `SECURITY DEFINER`, מוגבל בהרשאות ל-`service_role` בלבד
  (`revoke ... from anon/authenticated`), נקרא מ-`guards.ts` עם האימייל
  שמגיע מ-`currentUser()` — קריאת Backend API מאומתת של Clerk, לא קלט לקוח.
- **`/login`**: הוחלף מטופס email/password מותאם ל-`<SignIn routing="path"
  path="/login">` בנתיב `[[...rest]]` (catch-all חובה — Clerk מנהל בעצמו
  תת-נתיבים כמו איפוס סיסמה). הקובץ הישן ואת ה-actions שלו נמחקו — השארה
  שלהם לצד הראוט החדש יצרה שני routes חופפים (`/login` הישן קדם לחדש).

**אימות**: `tsc`/`eslint`/`vitest` (21 בדיקות) נקיים, `npm run build`
עבר עם המפתח הציבורי האמיתי + מפתח סוד placeholder.

### מה נשאר (לא בוצע היום)

- **`/signup`** (יצירת קליניקה חדשה) ו-**`/join/[slug]`**/**`/invite/[token]`**
  (הצטרפות מטפל/ת) עדיין על הזרימה הישנה — שלושתם *יוצרים* פרופיל חדש עם
  `id = auth.uid()`, כלומר משתמשים בזהות כערך ולא כשאילתה, ולכן לא הומרו
  אוטומטית (ר' סעיף 18). צריך החלטת מוצר: `<SignUp>` המוכן של Clerk לפני
  הטופס, או טופס מותאם עם ה-hooks החשופים (`useSignUp`) שממוזג בעמוד אחד
  עם איסוף פרטי הקליניקה/ההזמנה.
- מסך `/reset-password` (Supabase Auth) לא נמחק — עדיין רלוונטי לסשנים
  ישנים בזמן המעבר; יתייתר כשכל המשתמשים יעברו ל-Clerk.
- לא הוגדר webhook `user.deleted`/`user.created` מ-Clerk (יש דוגמה
  ב-Click-na) — כרגע אין דבר שמנקה `clerk_user_id` אם משתמש/ת נמחק/ת
  מ-Clerk ישירות בדשבורד (מסלול נדיר, לא חוסם).

## ✅ 20. מעבר ל-Clerk — שלב 4: שלוש זרימות היצירה (owner + שני סוגי מטפל/ת)

ממשיך את סעיפים 18-19. זה הצד השני שהמערכת משרתת (חוץ ממנהל/ת הקליניקה
שכבר עבד/ה): מטפל/ת שמצטרף/ת דרך הקישור הציבורי או הזמנה ידנית. אופציה ב'
שנבחרה: מסך אחד ממזג יצירת חשבון + הפרטים העסקיים, לא <SignUp> המוכן של
Clerk + מסך נפרד.

### 🔴 באג חוסם אמיתי — לא תיאורטי, נתפס לפני כתיבת UI

לפני שנכתב קוד מסך אחד, כל שלוש ה-RPCs הומרו ונבדקו **ישירות מול ה-DB
החי** (Supabase MCP: sub מדומה של Clerk, קריאה אמיתית לפונקציה, ניקוי
מלא בסוף) — לא code review בלבד. הבדיקה הראשונה (`signup_clinic`) נכשלה:

```
ERROR: insert or update on table "profiles" violates foreign key
constraint "profiles_id_fkey" — Key (id)=(...) is not present in "users"
```

`profiles.id` היה עם `FOREIGN KEY ... REFERENCES auth.users(id) ON DELETE
CASCADE` — הנחה סמויה שהחזיקה תמיד עד עכשיו כי `id` היה תמיד `auth.uid()`
אמיתי. ברגע שפרופיל חדש נוצר עם `gen_random_uuid()` (אין יותר שורת
`auth.users` מאחורי זהות Clerk), ה-FK חוסם כל insert. תוקן במיגרציה
`20260905000007` (`alter table profiles drop constraint profiles_id_fkey`).
**נמצא FK זהה על `platform_admins.user_id` — לא תוקן** (לא רלוונטי
לזרימות של היום, רק למשימה "יצירת superadmin ראשון"; יתפוצץ באותו אופן
בדיוק אם ינסו ליצור superadmin עם זהות Clerk לפני שיתוקן).

אחרי התיקון: כל שלוש הפונקציות (`signup_clinic`, `join_clinic_as_therapist`,
`accept_therapist_invite`) נבדקו בהצלחה עד הסוף — כולל `app_user_id()`
ו-`is_admin()` שמתאמתים על התוצאה — ונוקו מה-DB בלי להשאיר שאריות.

### שינויי DB (מיגרציה `20260905000006`)

אותו דפוס בדיוק בשלושתן: `auth.uid()` (ערך אמיתי מ-`auth.users`) →
`gen_random_uuid()` + `clerk_user_id := auth.jwt()->>'sub'`; בדיקת
"ALREADY_REGISTERED" עברה מ-`id = v_uid` ל-`clerk_user_id = v_clerk_sub`;
האימייל (היה `select ... from auth.users`, שכבר לא רלוונטי) עבר לפרמטר
חדש (`p_email`/`p_owner_email`) שמגיע מ-`currentUser()` בקוד השרת — לא
משדה טופס, אותו עיקרון בדיוק כמו `link_clerk_identity()` (סעיף 19): מקור
מאומת של Clerk, לא קלט לקוח. שלוש הפונקציות הישנות (4 פרמטרים, בלי
`p_email`) נמחקו במפורש — `create or replace` עם imprint פרמטרים שונה
היה יוצר overload חופף ולא מחליף.

### שינויי אפליקציה

- **`components/clerk-signup-form.tsx`** (חדש, משותף לשלושת המסכים):
  `useSignUp` מ-**`@clerk/nextjs/legacy`** — 🔴 ממצא לא-מתועד: בגרסה
  המותקנת (7.9.1) `useSignUp()` הרגיל מחזיר כברירת מחדל API חדש
  מבוסס-signals (`SignUpFutureResource`), צורה שונה לגמרי מ-`{ isLoaded,
  signUp, setActive }` המתועד בדוגמאות הרשמיות. `/legacy` הוא הנתיב
  הנתמך לצורה הקלאסית. הרכיב מנהל: יצירת חשבון → קוד אימות מייל (אם
  Clerk דורש; מדלג אוטומטית אם `status === "complete"` מיד) →
  `setActive()` → קריאה ל-server action העסקי שמועבר לו (`onSubmitBusinessLogic`)
  רק **אחרי** שיש session פעיל — כי ה-RPCs קוראות `auth.jwt()->>'sub'`.
- **`/signup`**: הוחלף מ-`useActionState` + `supabase.auth.signUp()` +
  "אימות מייל דחוי דרך user_metadata + השלמה ב-/onboarding" ל-מסך אחד
  עם `<ClerkSignupForm>`. `signup_clinic` רץ מיד, לא יותר נדחה.
- **`/join/[slug]`, `/invite/[token]`**: אותה תבנית בדיוק (server actions
  חדשים `completeJoinAction`/`completeInviteAction`, forms מבוססי
  `<ClerkSignupForm>`). `completeJoinFromMetadata`/`completeInviteFromMetadata`
  הישנות נמחקו לגמרי.
- **`/onboarding`**: `completeSignupClinicFromMetadata()` נמחקה (כבר לא
  צריך — הקליניקה נוצרת בתוך `/signup` עצמו). `seedDefaultPricingAction`/
  `toggleSessionsAction` עברו מ-`supabase.auth.getUser()` גולמי (שמחזיר
  תמיד `null` לזהות Clerk — אין GoTrue session מאחורי client מבוסס-
  accessToken) ל-`requireTherapistProfile()`. שער הכניסה לעמוד עצמו עבר
  ל-`getAuthState()` עם fallback ל-`/signup` (לא `/onboarding` — זה היה
  יוצר redirect ללולאה על עצמו).

**אימות**: `tsc`/`eslint`/`vitest` (21) ו-`npm run build` נקיים. שלוש
ה-RPCs עברו בדיקת round-trip אמיתית מול ה-DB. **לא נבדק**: הזרימה
המלאה בדפדפן אמיתי (אין גישת רשת מהסביבה הזו ל-URL הפרוס) — כולל
CAPTCHA/bot-protection של Clerk, שרק דפדפן אמיתי יכול לעורר.

## מה הכי דחוף להמשיך בו

1. Email (Resend) — תזכורות/יתרה-נמוכה/חידוש ססיה מזוהות אבל לא נשלחות.
2. הצפנת `clinic_payment_settings` לפני חיבור קליניקה אמיתית ראשונה.
3. ToS/DPA + החלטה על `grant_bonus_hours` בהרשמה עצמאית — לפני פתיחה לציבור.
4. שעות פעילות per-clinic (כרגע קבוע 08:00–22:00) + PWA (manifest/SW).
