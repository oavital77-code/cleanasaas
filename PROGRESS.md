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
מעביר trial שפג ל-`suspended`.

**✅ סליקה (9.9.2026, מיגרציות `20260909000001` … `20260909000004`):**
PayPlus, דף תשלום מאוחסן שמחייב את החודש הראשון ושומר את הכרטיס כטוקן
(`charge_method 1` + `create_token`). **חידושים שלנו, לא של PayPlus:** מודול
"הוראות קבע" לא מופעל על המסוף, אז ה-cron (`cleanup-holds`) קורא ל-
`platform_claim_due_renewals` (תופס שורות שתקופתן נגמרה, פעם ב-20 שעות) ומחייב
כל טוקן ב-`Transactions/Charge` (`use_token`, עם `terminal_uid`/`cashier_uid`
שנלכדו מה-callback של התשלום הראשון; `PAYPLUS_TERMINAL_UID`/`PAYPLUS_CASHIER_UID`
דורסים). סירוב → חסד 7 ימים עם ניסיון חוזר יומי; `more_info` מוגבל ל-19 תווים
ולכן הוא תווית — הזיהוי דרך `pending_page_request_uid`/הטוקן. `/admin/billing`
(פעולות שרת: `startPlatformCheckoutAction` → `platform_start_checkout`;
ביטול: `platform_request_cancellation` בלבד — שורה מבוטלת לא נתפסת לחיוב). ה-callback
(`/api/billing/payplus/callback`, ציבורי) מאמת כל עסקה מול
`PaymentPages/ipn` ורק אז `platform_apply_payment` (service-role בלבד):
`platform_payments` ייחודי לפי `transaction_uid` → כפילות = no-op; הצלחה
בסכום המנוי → `plan='pro'`, `status='active'`, חודש קדימה, הקליניקה חוזרת
מ-`suspended`; חיוב שנכשל במנוי פעיל → `past_due` + 7 ימי חסד.
`platform_billing_lifecycle` (ב-cron `cleanup-holds`): ביטולים שהבשילו,
חידוש שלא אושר תוך יומיים → חסד, חסד שנגמר → השעיה. מיילים לאדמיני
הקליניקה על הפעלה/כישלון. בדיקה: `supabase/tests/platform_billing_test.sql`
(+ `lib/payplus/index.test.ts`). המתאם `lib/payplus` הועתק מ-Cleana+ — לשמור
את השניים תואמים. **טרם נבדק מול סנדבוקס אמיתי של PayPlus** — שמות השדות
אומתו מול אינטגרציות אמיתיות, לא מול התיעוד; הרצת סנדבוקס אחת סוגרת את זה.
שתי המיגרציות (`…000001`, `…000002_platform_billing_grants_fix`) **הוחלו על
ה-DB החי** (9.9.2026) ומטריצת ההרשאות אומתה שם: anon=false על כל 4 ה-RPCs,
authenticated רק על checkout/cancellation, service_role על כולן. שלושה באגים
שהבדיקה המקומית תפסה לפני הפרודקשן: (1) `clinics.status` נכתב תחת
`cleana.trusted_write` (הטריגר `clinics_privilege_guard` החזיר אותו בשקט);
(2) `actor_id` מ-`app_user_id()` ולא `auth.uid()` (עם sub של Clerk `auth.uid()`
זורקת) + הסרת ה-FK הישן של `platform_audit_log.actor_id` ל-`auth.users`;
(3) revoke מ-anon בלי revoke מ-public לא עושה כלום — פעם רביעית.

**החלטת תמחור (8.9.2026):** מסלול בתשלום אחד — **₪209 לחודש כולל מע״מ** —
אחרי **30 ימי ניסיון** (מיגרציה `20260909000003_trial_30_days`, החלטת המשתמש
9.9.2026 — כמו ב-Cleana+; היה 14). דף הנחיתה (`TRIAL_DAYS`) מציג את אותו מספר.
ה-limits של basic/pro נשארים כמנגנון אכיפה בלבד; לא מוצגים ללקוח כשני מסלולים.
ה-checkout נבנה (ר' "סליקה" למעלה) על המתאם של Cleana+ (`click-na/src/lib/payplus.ts`):
דף תשלום מאוחסן עם הוראת קבע, אימות כל callback מול `PaymentPages/ipn`,
אידמפוטנטיות לפי `transaction_uid`. המחיר: `PLATFORM_PLAN_PRICE_ILS` (ברירת מחדל 209).

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

**בוצע מאז**: superadmin ראשון נוצר (oavital77@gmail.com) — קדם לו תיקון
אותו FK בדיוק כמו `profiles_id_fkey` (מיגרציה `20260906000001`,
`platform_admins.user_id → auth.users` היה חוסם insert לכל superadmin
עם זהות Clerk, בדיוק כמו שתועד למעלה שיקרה).

**עדיין לא בוצע**: בדיקת Woo webhook מקצה לקצה מול חנות אמיתית.

## ✅ 9. תנאי שימוש/מדיניות פרטיות + הגבלת grant_bonus_hours

תנאי שימוש (`app/terms`) ומדיניות פרטיות (`app/privacy`) נכתבו במלואם —
לא placeholder יותר.

`grant_bonus_hours` (מיגרציה `20260906000003`) — נבחרה אופציה (ב) מהחלטה
הפתוחה שהייתה כאן: cap קשיח (20 שעות לפעולה בודדת, `BONUS_HOURS_CAP_EXCEEDED`)
+ חסימה בזמן trial (`platform_subscriptions.plan = 'trial'` →
`BONUS_HOURS_BLOCKED_DURING_TRIAL`) + הדגשה ויזואלית ב-`/admin/audit`
(`ALERT_ACTIONS`, יחד עם `booking_created_retroactively` שכבר היה "alert"
רק בתיעוד ולא ב-UI בפועל). נבדק round-trip מלא מול ה-DB החי: cap, חסימת
trial, והצלחה אחרי דגל זמני ל-`plan='basic'` — עם ניקוי מלא וכולל
שחזור `plan` המקורי בסוף.

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
  פשוט בלי מיילים בפועל. אין Sentry עם tag `clinic_id` (המפרט §15 מבקש
  את זה — עוד לא חובר כי אין עדיין DSN אמיתי).

**PWA** — `app/manifest.ts` (Next.js file convention, `/manifest.webmanifest`
אוטומטי), `app/icon.tsx`/`app/apple-icon.tsx` (נוצרים דרך `ImageResponse`,
לא PNG סטטיים — אותו מוטיב בדיוק כמו `components/logo.tsx`), `public/sw.js`
+ `components/register-service-worker.tsx`. `middleware.ts` כבר החריג את
כל הנתיבים האלה מראש (ה-matcher היה מוכן לזה, לא נגעתי בו). 🔴 ה-service
worker במכוון **לא** offline-first — network-first בלבד, בלי caching של
תוכן דינמי (הזמנות/זמינות אסור שיוצגו מ-cache מיושן, ר' חוקי הברזל #2/#7)
— קיים רק כדי לספק את תנאי הסף ל"הוספה למסך הבית". נבדק סמוק-טסט מקומי
מול production build אמיתי (`npm run start`): שלושת ה-endpoints מחזירים
200 עם תוכן תקין, האייקון נבדק ויזואלית.
- **`clinic_payment_settings`**: הסודות (`woo_consumer_secret`,
  `woo_webhook_secret`) **מוצפנים** (מיגרציה `20260906000002`) —
  `bytea` + `pgcrypto` (`pgp_sym_encrypt`/`pgp_sym_decrypt`), מפתח ב-Supabase
  Vault (`vault.decrypted_secrets`, לא ב-env/קוד). כתיבה: `admin_set_clinic_woo_secrets`
  (SECURITY DEFINER, `is_admin()` + `current_clinic_id()` — לא מקבל clinic_id
  כפרמטר, אין וקטור הזרקה לקליניקה אחרת). קריאה מפוענחת: `get_clinic_woo_credentials`,
  `service_role` בלבד — נבדק ישירות (`auth.role()`) שקריאה עם JWT `authenticated`
  נדחית ב-FORBIDDEN. `lib/woo/rest-client.ts`/webhook route עודכנו לקרוא ל-RPC
  במקום `select` ישיר. נבדק round-trip מלא מול ה-DB החי (הצפנה→פענוח→ניקוי).
- **שעות פעילות**: `clinics.open_hour`/`close_hour` (מיגרציה `20260906000004`,
  ברירת מחדל 8/22 — התנהגות זהה לקודם למי שלא שינה). ברמת **קליניקה בלבד**,
  לא per-branch (כמו `timezone` שכבר קיים ברמה הזו) — פיצול ל-branch נשאר
  להרחבה עתידית אם תידרש בפועל. `lib/calendar.ts`'s `buildDaySlots` מקבל
  אותם כפרמטרים (ברירת מחדל 8/22 נשארת רק כ-fallback). UI לעריכה תחת
  `/admin/settings` (`updateClinicHoursAction` — update ישיר על `clinics`,
  אותה תבנית כמו `toggleClinicPublishedAction` הקיים).
- **Realtime — מחובר**: `availability_events` כבר היה ב-Realtime
  publication + RLS (`clinic_id = current_clinic_id()`, לא PII — אותה
  מדיניות כמו `public_availability`), רק חסר subscription בצד הלקוח.
  נוסף `components/realtime-availability-refresh.tsx` — `postgres_changes`
  על INSERT ל-`availability_events`, מסונן `clinic_id`, קורא ל-
  `router.refresh()` (לא state כפול בצד לקוח — אותה שאילתת Server Component
  ממשיכה לרוץ). מחובר גם ל-`/schedule` וגם ל-`/admin/board`. משתמש ב-
  `useSupabaseClient()` (`lib/supabase/client.ts`) שכבר היה קיים ומוכן,
  בלי קוד בפועל שמשתמש בו — עד עכשיו. 🔴 מוגבל למשתמשי Clerk (הטוקן מגיע
  מ-`useSession()` של Clerk) — משתמש/ת legacy לא מקבל/ת עדכון חי, רק את
  ההתנהגות הקודמת (בלי רגרסיה, פשוט בלי השיפור עד שיעבור/תעבור ל-Clerk).
- **טלפון**: `toE164Israel` הוא ישראל-בלבד — קליניקה עתידית מחוץ לישראל
  (spec §1) תצטרך ולידציה בין-לאומית.
- **superadmin ראשון — בוצע**: `oavital77@gmail.com` (ר' סעיף 8 למעלה,
  מיגרציה `20260906000001`). אין מסך הרשמה ל-superadmin נוסף (במתכוון —
  לא flow self-serve); הוספת superadmin נוסף עדיין ידנית עם service role.

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
- **webhook `user.deleted` — בוצע** (`app/api/webhooks/clerk/route.ts`,
  `@clerk/nextjs/webhooks`'s `verifyWebhook`). 🔴 **`user.created` נשאר
  במפורש לא מטופל** — בניגוד לדוגמת Click-na (single-tenant, כל signup
  שם יוצר ישר חשבון): ב-cleanasaas יצירת פרופיל תמיד עוברת דרך
  `signup_clinic`/`join_clinic_as_therapist`/`accept_therapist_invite`,
  שיש להן הקשר עסקי (שם קליניקה/טוקן הזמנה/role) שה-webhook הגולמי לא
  מכיר — טיפול שם היה יוצר פרופיל יתום בלי `clinic_id`.
  `clear_clerk_identity` (מיגרציה `20260906000005`, אותה תבנית בדיוק כמו
  `link_clerk_identity` — `SECURITY DEFINER` + `cleana.trusted_write`,
  כי `enforce_profile_privilege_columns` היה כופה את הערך הישן בחזרה בלי
  זה) מנתקת רק `clerk_user_id`, לא מוחקת את הפרופיל/ההיסטוריה. נבדק
  round-trip מלא מול ה-DB החי — **כולל תקלה קטנה בדרך**: הבדיקה הראשונה
  נעשתה בטעות מול הפרופיל האמיתי של המשתמש (`oavital77@gmail.com`) במקום
  פרופיל בדיקה נפרד; זוהתה מיד ותוקנה (`link_clerk_identity` בחזרה +
  ניקוי שורת ה-audit_log שנוצרה), בלי השפעה בפועל על היכולת להתחבר (מנגנון
  ה-auto-relink-by-email הקיים היה מתקן את זה ממילא בבקשה הבאה). דורש
  הגדרת endpoint ב-Clerk Dashboard (URL + `CLERK_WEBHOOK_SIGNING_SECRET`)
  — לא בוצע כאן, פעולה חיצונית למשתמש.

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

## ✅ 21. תשתית i18n: שפת ממשק אישית (`profiles.locale`) + מתג ב-`/profile`

בקשת המשתמש: מתג שפה (עברית/אנגלית) בהגדרות, דיפולט אנגלית. זה מתנגש
בפועל עם הכלל הנוקשה ב-`CLAUDE.md` ("עברית ו-RTL בכל ה-UI") — נבדק מול
המשתמש לפני כתיבת קוד: **תחולה** — כל האפליקציה הפנימית (מאחורי login),
לא רק דפי השיווק. **מיקום** — אישי (לא ברמת קליניקה), ב-`/profile`.

### למה זה לא "תרגם הכל בבת אחת"

תרגום מלא של כל מסכי האפליקציה (Dashboard + 9 מסכי מטפל/ת + 9 מסכי אדמין)
הוא עבודה גדולה בהרבה מ"מתג בהגדרות" ולא ריאלי במעבר אחד. הפתרון:
ארכיטקטורה הדרגתית שלא שוברת שום דבר באמצע הדרך —

- ה-`<html dir="rtl">` הגלובלי (`app/layout.tsx`) **לא זז בכלל**. דף
  שעדיין לא תורגם ממשיך תמיד עברית/RTL תקין, בלי תלות ב-locale של
  המשתמש/ת.
- `AppShell` (העטיפה המשותפת לכל מסך מחובר — צד מטפל/ת וצד אדמין כאחד)
  מקבל `locale` ומתרגם **רק את ה-chrome של עצמו**: תוויות ניווט, קישור
  מעבר בין הצדדים, כפתור/aria-label של יציאה, aria-labels של תפריט
  מובייל. `dir`/`lang` מוגדרים מקומית על ה-`<aside>`/`<header>`/מגירת
  המובייל, לא על ה-`<html>`.
- תוכן הדף עצמו (children) נשאר עברית עד שהוא עובר תרגום מפורש דף-דף —
  ראו סעיף "מה נותר" למטה.

### שינויי DB (מיגרציה `20260906000006`)

`profiles.locale text not null default 'en' check (locale in ('he','en'))`.
🔴 **לא** נעול ע"י `enforce_profile_privilege_columns` — אומת ע"י קריאת
`pg_get_functiondef` של הפונקציה החי (לא רק code review): הטריגר בכלל
לא נוגע ב-`locale`. משמעות: אין צורך ב-RPC ייעודי — `updateLocaleAction`
עושה `supabase.from("profiles").update({ locale })` ישיר על השורה של
עצמך, אותו דפוס בדיוק כמו `updateProfileAction` הקיים.

### שינויי אפליקציה

- **`lib/i18n.ts`** (חדש): `type Locale = "he" | "en"`, `dirFor()`,
  `normalizeLocale()` (מנרמל את ה-`string` הגולמי שחוזר מהטיפוסים
  שנוצרו — ה-check constraint לא משתקף בטיפוסי TS), ומילון תרגומים
  ל-chrome של `AppShell` בלבד (`getAppShellDict`).
- **`components/app-shell.tsx`**: `APP_NAV`/`ADMIN_NAV` עברו מ-`label`
  קבוע ל-`navKey` שנפתר מול המילון לפי `locale`; `dir`/`lang` על שלושת
  מכולות ה-chrome (סרגל דסקטופ, top bar מובייל, מגירת מובייל).
- **21 call sites של `<AppShell>`** (כל דף מחובר) — `locale={profile.locale}`
  נוסף לצד `fullName`. זמין בכולם בלי query נוסף: `requireTherapistProfile`/
  `requireClinicAdmin` כבר עושים `select("*")` על `profiles`.
- **`/profile`**: כרטיס חדש "שפת ממשק / Interface language" — `<select>`
  (עברית/English) + `updateLocaleAction` (`app/(app)/profile/actions.ts`).

**אימות**: `tsc --noEmit` ו-`npm run build` נקיים. `enforce_profile_privilege_columns`
נקרא ישירות מה-DB החי (read-only) לאימות שה-trigger לא נוגע ב-`locale` —
לא בוצעה כתיבת בדיקה על אחד משלושת הפרופילים האמיתיים הקיימים (למדנו
מהתקלה בסעיף 20: אין פרופילי בדיקה חד-פעמיים ב-DB הזה, אז שינוי ישיר
דרש להימנע ממנו).

### מה נותר (לא כלול כאן, בכוונה)

- פורמט תאריך/מטבע locale-aware (`date-fns` יודע `en-US`/`he`) — **לא
  נדרש בפועל**: הפורמט הקיים (`dd/MM/yyyy HH:mm`, ₪ ב-`Intl` `he-IL`)
  הוא מוסכמת אפליקציה קבועה (CLAUDE.md), לא עניין שפת ממשק, ומספרי
  לגמרי — אין הבדל ויזואלי בין locale he/en בפורמט הזה. לא שונה.
- שאר 19 המסכים (schedule, bookings, purchase, sessions, payments, וכל
  admin/*) — עדיין עברית תמיד, בכוונה, עד שיתורגמו בהדרגה כל אחד בנפרד.

## ✅ 22. תרגום `/dashboard` ו-`/profile` לאנגלית מלא

המשך ישיר לסעיף 21. שני הדפים שנבחרו במפורש (Dashboard = מסך הבית של
מטפל/ת, `/profile` = המסך שבו יושב מתג השפה עצמו) עברו מ-`<h1>`/תוויות
קשיחות בעברית ל-dictionaries חדשים ב-`lib/i18n.ts`: `getDashboardDict`
ו-`getProfileDict`, לצד `getAppShellDict` הקיים.

- שני הדפים עוטפים את ה-`children` שלהם (לא רק ה-`<AppShell>`) ב-
  `dir={dirFor(locale)} lang={locale}` — עכשיו שהתוכן עצמו מתורגם, זו
  הנקודה שבה דף "עובר" בפועל ל-RTL/LTR לפי locale, בהתאם לארכיטקטורה
  שתוארה בסעיף 21 ("דפים לא-מתורגמים נשארים RTL; מתורגמים הופכים
  בהדרגה").
- `formatCurrencyILS`/`formatDateTimeHe` לא שונו (ר' "מה נותר" למעלה —
  אלה מוסכמות פורמט, לא locale).
- `ROLE_LABEL` הישן (`profiles/page.tsx`) הוחלף ב-`t.roleValues` מה-
  dictionary.

**אימות**: `tsc --noEmit`, `npm run build`, `eslint` ו-`vitest` (46
טסטים) נקיים. לא בוצעה בדיקת דפדפן אמיתי (ר' מגבלת גישת רשת בסעיף 20).

### תיקון: מתג שפה חד-לחיצתי (בעקבות משוב המשתמש)

הגרסה הראשונה של כרטיס השפה הייתה `<select>` + כפתור "שמירה" נפרד —
שתי פעולות. המשתמש ציין שהציפייה הייתה לכפתור טוגל בלחיצה אחת; תוקן:

- `lib/i18n.ts`: `otherLocale(locale)` (מחזיר את השפה השנייה) ו-
  `LOCALE_NATIVE_NAME` (endonym קבוע — "עברית"/"English", לא תלוי
  ב-locale הנוכחי, כמו במתגי שפה סטנדרטיים כגון Wikipedia).
  `localeOptionHe`/`localeOptionEn` הוסרו מה-dictionary (לא נחוצים יותר).
- `/profile`: הכרטיס עכשיו `<form>` עם `<input type="hidden"
  name="locale" value={otherLocale(locale)}>` וכפתור submit יחיד ששמו
  הוא שם השפה שעוברים **אליה** (כפתור בעברית מציג "English" ולהפך) —
  לחיצה אחת, בלי שלב "שמירה" נפרד.

## ✅ 23. i18n — מעבר תרגום מלא + היפוך LTR אמיתי באנגלית

משוב המשתמש אחרי סעיף 22: (א) "לא הכל תורגם" — נכון, רק Dashboard/Profile;
(ב) "אנגלית = כל הממשק אנגלי, כולל הסרגל שנפתח משמאל" — כלומר לא
מספיק לתרגם טקסט; הפריסה כולה צריכה להתהפך ל-LTR.

### היפוך פריסה (AppShell)

- ה-wrapper החיצוני של `AppShell` מקבל `dir`/`lang` ב-SSR — הסרגל קופץ
  לשמאל באנגלית כבר ב-paint הראשון, בלי flash; כל ה-children (תוכן הדף)
  יורשים את הכיוון, אז ה-wrappers הפר-דף מסעיף 22 הוסרו (מיותרים).
- `useEffect` מסנכרן את `<html dir lang>` הגלובלי אחרי hydration (פס
  גלילה של הדפדפן, portals) ומחזיר `rtl`/`he` ב-cleanup — הדפים הציבוריים
  (login/signup/landing) נשארים עברית תמיד, וה-`<html>` ב-`app/layout.tsx`
  לא נגע. **לא** הועבר ל-root layout בכוונה: זה היה מכניס `auth()` +
  שאילתת profiles לכל דף ציבורי/סטטי (landing, /group, /privacy).
- חצי הניווט בלוח (קודם/הבא) מתחלפים לפי כיוון הקריאה.
- `text-right` קשיח בכותרות טבלאות → `text-start` (לוגי).

### תרגום מלא — 19 המסכים הנותרים + client components + שגיאות

`lib/i18n.ts` → תיקייה `lib/i18n/`: `index.ts` (ליבה, common, AppShell,
Dashboard, Profile), `app.ts` (schedule/bookings/purchase/payments/sessions),
`admin.ts` (9 מסכי אדמין), `context.tsx` (`LocaleProvider`/`useLocale` —
AppShell מספק, client components כמו SlotGrid/SlotBuilder/AssignForm
צורכים; server components מקבלים `profile.locale` ישירות). כל מילון
מוגדר בעברית ו-`const EN: typeof HE` מחייב את האנגלית לאותה צורה —
TypeScript תופס מפתח חסר.

- `common`: סטטוסים משותפים (הזמנה/תשלום/ססיה/פרופיל/תפקיד), ימים
  (קצר/ארוך + "יום X" רק בעברית), ו-`rpcErrors` — מפת קודי ה-RPC
  (נספח ב') להודעות, דרך `translateRpcError()`; החליף 3 מפות מקומיות
  כפולות (schedule/sessions/therapists actions).
- server actions מזהים locale מ-`profile` (`requireTherapistProfile`/
  `requireClinicAdmin`/`getAuthState`) ומחזירים הודעות מתורגמות; סיבת
  דחייה ריקה של ססיה נשמרת ב-DB לפי שפת האדמין ("לא צוין"/"Not specified").
- `dateFnsLocale()` — שמות ימים/חודשים (`EEEE`, `MMMM`) לפי שפה; פורמט
  מספרי (`dd/MM/yyyy`) ומטבע נשארו כמוסכמה (ר' סעיף 21).

**לא בהיקף (בכוונה)**: דפים ציבוריים (login/signup/landing/onboarding —
"מאחורי login" בלבד), widgets של Clerk (`heIL`), ו-**מיילים**
(`lib/email/templates.ts` — עדיין עברית לכל הנמענים; מועמד טבעי לשלב
הבא: לבחור תבנית לפי `profiles.locale` של הנמען/ת).

**אימות**: `tsc`, `eslint`, `vitest` (46), `npm run build` נקיים. סריקת
regex לעברית מחוץ להערות ב-`app/(app)`, `app/(admin)`, `components/`
מחזירה 0 שורות (נותרו רק הערות JSX רב-שורתיות בעברית — לא נראות למשתמש).

## ✅ 24. תזכורות WhatsApp למטפל/ת לפני הזמנה (שער QR — Green API / Whapi)

בקשת המשתמש: תזכורת אוטומטית מהוואטסאפ העסקי של מנהל/ת הקליניקה לוואטסאפ
של המטפל/ת, 24 שעות לפני ההזמנה, מופעלת מההגדרות.

### החלטת ספק — הוצגה למשתמש, נבחרה במפורש

שליחה "מהמספר של המנהל/ת" דורשת שער. הוצגו 4 מסלולים עם ההבדל המרכזי:
ב-**Meta Cloud API הרשמי** המספר נרשם ל-API ולא ניתן להמשיך להשתמש בו
באפליקציית WhatsApp Business בטלפון (+ Business verification, אישור
תבניות); ב-**שערי QR לא-רשמיים** (Green API / Whapi) הטלפון ממשיך לעבוד
כרגיל (קישור בסריקת QR כמו WhatsApp Web) — אבל זה **מנוגד לתנאי השימוש של
WhatsApp, עם סיכון חסימה של המספר העסקי**. המשתמש בחר בשער QR בידיעה על
הסיכון. 🔴 אם המספר ייחסם — זה הסיכון שנלקח כאן במכוון; המעבר ל-Meta
Cloud API אפשרי בעתיד עם provider חדש ב-`lib/whatsapp` בלי לשנות את
שאר המבנה.

### DB (מיגרציה `20260906000007`)

- `clinic_whatsapp_settings` (per-clinic): `enabled`, `provider`
  (`green_api`/`whapi`), `instance_id`, `api_url` (Green API מקצה כתובת
  ייעודית לכל instance — בלי זה קריאות היו נכשלות בפועל), **`api_token`
  bytea מוצפן** (pgcrypto + מפתח ייעודי `whatsapp_secrets_key` ב-Vault —
  אותה תבנית בדיוק כמו סודות Woo), `sender_phone` (תצוגה בלבד — השער
  שולח ממה שקושר אצלו), `hours_before` (1–72, ברירת מחדל 24), `template`
  עם `{name} {date} {time} {room} {branch} {clinic}`.
- `bookings.whatsapp_reminder_sent_at` — סימון נפרד מ-`reminder_sent_at`
  של המייל, כדי ששני הערוצים לא ישפיעו זה על זה.
- `admin_set_clinic_whatsapp_settings(...)` — אדמין הקליניקה בלבד, מצפין,
  null = "לא לגעת", וכותב `whatsapp_settings_updated` ל-audit_log (בלי
  טוקן/טלפון). `get_clinic_whatsapp_credentials(clinic_id)` — מפוענח,
  **service_role בלבד**.
- **נבדק מול ה-DB החי**: round-trip הצפנה/פענוח (80 בייט ciphertext →
  הטוקן המקורי דרך service_role), ו-`authenticated` נדחה ב-`FORBIDDEN`.
  הבדיקה כתבה שורת הגדרות + audit על הקליניקה האמיתית של המשתמש (אין
  קליניקת בדיקה) — **שתיהן נמחקו בסוף, אומת 0 שורות**.

### אפליקציה

- `lib/whatsapp/index.ts` — `sendWhatsAppText()` לשני הספקים (לא זורק,
  כמו `sendEmail`; אין טלפון/טוקן בלוגים), `renderReminderTemplate()`
  (+ vitest). `lib/whatsapp/reminders.ts` — שלב ה-WhatsApp של ה-cron:
  לולאה על קליניקות עם `enabled`, חלון `now → now+hours_before`, סימון
  `whatsapp_reminder_sent_at` בהצלחה + `whatsapp_reminder_sent` ב-audit;
  בכישלון `whatsapp_reminder_failed` (מודגש ⚠️ ב-/admin/audit) ובלי
  סימון → ניסיון חוזר בריצה הבאה.
- `app/api/cron/send-reminders` — קורא ל-`sendWhatsAppReminders` אחרי
  המיילים (כישלון קליניקה אחת לא מפיל את השאר).
- `/admin/settings` — כרטיס "תזכורות WhatsApp": הפעלה, ספק, Instance ID,
  API URL, טוקן (write-only, "•••• מוגדר"), מספר עסקי, שעות לפני, תבנית,
  ו-**"שליחת הודעת בדיקה אליי"** (`sendWhatsAppTestAction` — לטלפון של
  האדמין/ית עצמו/ה; הדרך לוודא שה-QR מקושר והטוקן תקין לפני שמטפל/ת
  אמיתי/ת תלוי/ה בזה). `createAdminClient` רק אחרי `requireClinicAdmin`,
  ה-clinicId ממנו ולא מהטופס.

### 🔴 מגבלה: תדירות ה-cron

`vercel.json` מגדיר את כל ה-crons **יומיים** (Vercel Hobby לא מאפשר
יותר — למרות ש-CLAUDE.md מדבר על "כל שעה"). לכן "24 שעות לפני" בפועל =
"בריצת הבוקר (07:00 UTC), כל ההזמנות שמתחילות ב-hours_before השעות
הבאות" — הזמנה ל-20:00 מחר תקבל תזכורת מחר ב-10:00, לא היום ב-20:00.
הקוד אידמפוטנטי; מעבר ל-Pro + cron שעתי (`0 * * * *`) יהפוך את זה
למדויק בלי שינוי קוד. מוסבר גם ב-UI (`whatsappCronNote`).

**אימות**: `tsc`, `eslint`, `vitest` (49), `npm run build` נקיים. **לא
נבדק**: שליחה אמיתית מול Green API/Whapi (אין חשבון/QR מקושר בסביבה
הזו) — לכן קיים כפתור הבדיקה בהגדרות.

## ✅ 25. סקירת "כאילו אני משתמש/ת" — ממצאים ותיקונים

סקירה מול ה-DB החי, הקוד, ו-Supabase advisors (07/09). **לא** הורצה
האפליקציה בדפדפן (אין `.env.local` בסביבה, אין גישת Vercel מהסשן).

### ממצאים שתוקנו

1. **רגרסיית אבטחה שלי (advisor):** `admin_set_clinic_whatsapp_settings`
   הייתה ניתנת להרצה ע"י `anon` — אותה תקלה בדיוק שתוקנה יום קודם ל-Woo
   (`revoke from public` לא מסיר את ה-grant הישיר של Supabase ל-anon),
   וחזרתי עליה. מיגרציה `20260907000001`. אומת: לפני anon/authenticated/
   postgres/service_role → אחרי בלי anon. לקח (בהערת המיגרציה): כל RPC
   חדש — `revoke ... from public, anon` מפורש.
2. **אי אפשר להכניס שעות למטפל/ת** (חוסם הפעלה): כרטיסייה נוצרה רק דרך
   Woo (0 קליניקות הגדירו) או `grant_bonus_hours` (חסום ב-trial — שתי
   הקליניקות ב-trial, תקרה 20ש', חינם). → `admin_issue_punch_card`
   (מיגרציה `20260907000002`): תשלום אמיתי (payment `paid` + method
   מזומן/bit/PayBox/אשראי-ידני/העברה), לפי מדרגה (מחירון, או סכום ידני
   להנחה) או מותאם (שעות+סכום); מע"מ נגזר מהסכום ששולם בפועל. **לא**
   חסום ב-trial (לא מתנה). audit `punch_card_issued_manually` מודגש ⚠️.
   UI ב-`/admin/therapists/[id]` (כרטיס "הנפקת כרטיסייה ידנית").
   נבדק חי: מדרגת 10ש' → ₪649 (55×10×1.18 ✓), payment+card נוצרו ונמחקו.
3. **כפתור "איפוס סיסמה" שבור:** קרא ל-`supabase.auth.resetPasswordForEmail`
   — כל 3 הפרופילים על Clerk, וה-client במצב Clerk זורק על `supabase.auth.*`
   (מתועד ב-`guards.ts`). הוסר: ה-action, הכפתור+העמודה בטבלה, מפתחות
   i18n, ומסך `/reset-password` (שריד Supabase Auth; `auth.users` = שורה
   אחת ישנה, כבר מקושרת ל-Clerk). איפוס סיסמה = "שכחתי סיסמה" של
   `<SignIn>` ב-/login.
4. **חסימת חדר בלי מסך:** `room_blocks` היה מוצג בלוח, אבל לא היה איך
   ליצור. → `admin_create_room_block` (דוחה חפיפה עם הזמנה מאושרת —
   `BLOCK_OVERLAPS_BOOKING`, האדמין מבטל קודם במודע; חפיפה עם חסימה →
   `BLOCK_OVERLAPS_BLOCK` מה-gist constraint) + `admin_delete_room_block`,
   audit לשניהם. כרטיס "חסימות חדר" ב-`/admin/board` (טופס + רשימת
   חסימות קרובות עם הסרה). נבדק חי: יצירה+מחיקה.
5. **הושלם / לא-הגיע/ה בלי דרך להגיע אליהם:** `admin_set_booking_status`
   (רק `completed`/`no_show`, רק הזמנה מאושרת שכבר התחילה; לא-הגיע/ה לא
   מחזיר שעות). נבדק חי: הזמנה עתידית → `BOOKING_NOT_STARTED` ✓.
6. **חריגות זמן בלי UI:** `record_overrun` קיים מהיום הראשון — עכשיו
   ב-`/admin/therapists/[id]`, על כל הזמנה מאושרת שהתחילה: כפתורי
   הושלם/לא-הגיע/ה + טופס "דקות חריגה" (מנכה מהפיקדון או יוצר payment
   `overrun` ממתין — התוצאה מוצגת). כרטיס "חריגות זמן" מציג את ההיסטוריה.
7. **`.env.example` בלי מפתחות Clerk** — `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
   ו-`CLERK_SECRET_KEY` נוספו בראש הקובץ (בלעדיהם האפליקציה לא עולה).
8. **Resend:** אומת דרך ה-API — שני דומיינים מאומתים עם שליחה פעילה
   (`cleana.co.il`, `mail.cleanagroup.app`). לא נשלח מייל בדיקה מכאן
   (דורש `from` שהמשתמש בוחר); `RESEND_FROM_EMAIL` ב-Vercel צריך להיות
   מאחד מהם.

### ממצאים שנבדקו ונמצאו תקינים

- **0 פונקציות ו-0 policies** חיות משתמשות ב-`auth.uid()` — מעבר Clerk
  נקי לגמרי (ה-`auth.uid()` בקבצי המיגרציה הישנים הוחלף ב-20260905000003).
- `public_availability` = SECURITY DEFINER view (advisor ERROR) — **מכוון**:
  כך זמינות נחשפת בלי לחשוף מי תפס (חוק #3). לא שונה.
- `is_admin`/`current_clinic_id`/`app_user_id`/`is_superadmin` ניתנות
  להרצה ע"י anon (advisor WARN) — מכוון, בתוך policies (ר' 20260904000001).
- `platform_admins` = 1 (הבעלים) — משימת "סופר-אדמין ראשון" סגורה.

**אימות**: `tsc`, `eslint`, `vitest` (49), `npm run build` נקיים. 4 ה-RPCs
החדשים נבדקו חי (כולל נתיבי דחייה); כל נתוני הבדיקה נמחקו (אומת: cards=1,
payments=0, blocks=0).

## ✅ 26. מיילים לפי שפת הנמען/ת

סוגר את הפער האחרון של ה-i18n (סעיף 23 "לא בהיקף"). `emailLayout` מקבל
`locale` (dir/lang/יישור/footer), וכל תבנית שמגיעה ל**נמען/ת יחיד/ה עם
פרופיל** מקבלת `locale?: string | null` (profiles.locale, מנורמל):
אישור/ביטול/תזכורת הזמנה, יתרה נמוכה, כרטיסייה פגה/נרכשה, ססיה אושרה/
נדחתה/חודשה/עומדת להסתיים (גרסת מטפל/ת), חיוב נכשל, חריגה, וקבלת פנים
לבעל/ת קליניקה (לפי ה-locale שנוצר ב-DB, לא קבוע בקוד).

**נשארו עברית בכוונה** (אין נמען/ת יחיד/ה עם העדפה): מיילים לקבוצת
אדמיני הקליניקה (בקשת ססיה, מטפל/ת הצטרף/ה, תזכורת חידוש — גרסת אדמין),
לסופר-אדמין (cron נכשל, materialization), ולרוכש/ת בחנות לפני הרשמה.

הקוראים (cron send-reminders, schedule/actions, admin/sessions/actions,
woo/process-order, signup) שולפים `locale` יחד עם `email` ומעבירים.

**אימות**: `tsc`, `eslint`, `vitest` (49), `npm run build` נקיים.

## ✅ 27. WhatsApp: מעבר ל-Meta Cloud API הרשמי + מסלול חצי-ידני (wa.me)

המשתמש חשש (בצדק) מחסימה בשער ה-QR הלא-רשמי (סעיף 24). הוצגו החלופות
(Meta רשמי עם מספר ייעודי / מייל בלבד / Web Push / חצי-ידני), והוחלט:
**Meta Cloud API** + **מסלול חצי-ידני** כגיבוי/חלופה בלי הקמה.

### Meta Cloud API (מיגרציה `20260907000003`)

- `provider` הצטמצם ל-`meta_cloud` בלבד; `instance_id` → `phone_number_id`,
  `api_url` הוסר, נוספו `template_name` + `template_lang`. הטוקן (Access
  Token קבוע של System User) נשאר מוצפן ב-`api_token`. RPCs הוחלפו (drop +
  create — חתימה/return שונים), anon revoked מפורשות.
- 🔴 **הודעה יזומה ב-Cloud API חייבת להיות תבנית מאושרת** (לא טקסט חופשי).
  החוזה: 6 פרמטרים בסדר קבוע `{{1}}` שם, `{{2}}` קליניקה, `{{3}}` תאריך,
  `{{4}}` שעה, `{{5}}` חדר, `{{6}}` סניף (`REMINDER_TEMPLATE_PARAMS` ב-
  `lib/whatsapp`). מסך ההגדרות מציג את גוף התבנית המומלץ להעתקה ל-Meta
  Business Manager (he/en), ו-vitest מוודא שהגוף המומלץ מכיל בדיוק
  `{{1}}`…`{{6}}`.
- `sendWhatsAppReminderTemplate()` — `POST graph.facebook.com/v21.0/{phone_number_id}/messages`,
  type template; שגיאת Meta (code + message) מוחזרת ל-UI של הבדיקה ונרשמת
  ב-audit בכישלון. פרמטרים מנוקים (Meta דוחה שורות חדשות/רווחים כפולים).
- כפתור "שליחת הודעת בדיקה אליי" שולח את התבנית האמיתית עם ערכי דוגמה.
- **opt-in/out למטפל/ת** (`profiles.whatsapp_reminders`, ברירת מחדל on;
  טוגל בלחיצה אחת ב-/profile). ה-cron והמסך הידני מכבדים אותו. דרישה של
  Meta, ומוריד דיווחי ספאם.

### מסלול חצי-ידני — `/admin/reminders` (פריט ניווט חדש "תזכורות")

רשימת כל ההזמנות המאושרות בטווח (24/48/72 שעות; ברירת מחדל `hours_before`).
לכל שורה: כפתור **WhatsApp** = קישור `wa.me/<phone>?text=<ההודעה מוכנה>`
(מהשדה `template` עם `{name}`… — שנשאר בדיוק בשביל זה) שפותח את הוואטסאפ
של המנהל/ת עם ההודעה; השליחה מהטלפון האמיתי — **אפס סיכון חסימה, אפס
הקמה**. אחרי השליחה: "סמן נשלח" → `admin_mark_whatsapp_reminder_sent`
(אותה עמודת סימון כמו ה-cron → אין כפילות; audit עם `provider: manual`).
תגיות: נשלח / מייל נשלח / ביקש/ה לא לקבל / אין טלפון.

**נבדק חי**: החתימה החדשה של ה-RPC + round-trip הצפנה (phone_number_id,
token, template_name/lang חוזרים מפוענחים ל-service_role); שורות הבדיקה
נמחקו (אומת 0). **לא נבדק**: שליחה אמיתית מול Meta (אין WABA בסביבה זו)
— לכן כפתור הבדיקה בהגדרות.

**אימות**: `tsc`, `eslint`, `vitest` (51), `npm run build` נקיים.

### מה צריך מהמשתמש כדי להפעיל את המסלול האוטומטי

1. Meta Business Manager → WhatsApp → מספר ייעודי לקליניקה (לא האישי).
2. ליצור תבנית Utility בשם (למשל) `booking_reminder`, שפה he, עם הגוף
   המומלץ מהמסך (6 משתנים בסדר). לחכות לאישור.
3. System User → Access Token קבוע עם הרשאת `whatsapp_business_messaging`.
4. להזין Phone Number ID + Token + שם/שפת תבנית ב-/admin/settings → "שליחת
   הודעת בדיקה אליי" → להדליק "שליחה אוטומטית".
עד אז: המסלול הידני ב-/admin/reminders עובד מיד.

### תיקון: מתג השפה בסרגל הצד (משוב המשתמש)

המתג ישב רק ב-/profile — שקיים רק בניווט של צד המטפל/ת. אדמין בפאנל לא
היה יכול לעבור לעברית בלי "חזרה לאפליקציה". עכשיו: כפתור בסרגל הצד עצמו
(דסקטופ — ליד שם המשתמש/ת ויציאה; מובייל — שורה במגירה מעל "יציאה"),
בשני הצדדים, מציג את שם השפה שעוברים אליה. `lib/i18n/actions.ts` —
`switchLocaleAction` (revalidate של כל ה-layout). הכרטיס ב-/profile נשאר.

## ✅ 28. שליטה במדרגות, תמונות לחדרים/קליניקה, ייבוא מטפלים/ות מ-Excel

בקשת המשתמש/ת (09/09): "לאפשר שליטה יותר בכרטיסיות… אם מישהו רוצה בכלל
מנוי חודשי?… תמונות לחדרים ולקליניקה… לטעון קבצי אקסל עם פרטים של
מטפלים — אם נדרש סידור מסוים, להסביר ולהנחות". מיגרציה אחת:
`20260907000005_tiers_images_import.sql` (הוחלה חי, טיפוסים חודשו).

### מדרגות כרטיסייה — עורך מלא (/admin/settings)

- כל שורה: **שעות** (עכשיו ניתנות לעריכה), ₪/שעה, פיקדון (שעות), **פעילה**,
  שמירה, **הסרה**. שורת "הוספת כרטיסייה" בתחתית. רשימה ריקה מותרת.
- הסרה: אם כבר נרכשו כרטיסיות מהמדרגה (FK RESTRICT `punch_cards.tier_id`)
  או שהיא ממופה למוצר Woo (`woo_product_tiers`) → **השבתה** במקום מחיקה,
  עם הודעה. אחרת מחיקה אמיתית (מדיניות `admin_delete_tiers` חדשה — היו רק
  insert/update). `unique(clinic_id, hours)` → הודעה "כבר קיימת כרטיסייה
  עם מספר השעות הזה". הודעות דרך `?notice=` (הטפסים הם server actions
  רגילים, כמו בשאר ההגדרות).
- **כל שיטות התשלום** ניזונות מאותן מדרגות: החנות (מיפוי מוצר→מדרגה),
  הנפקה ידנית מכרטיס המטפל/ת (מזומן/ביט/העברה — `admin_issue_punch_card`
  דורש `active`), והתצוגה למטפלים/ות (RLS `read_tiers`: active או אדמין).
  הערה כזו מופיעה גם במסך.
- **מודל ססיה אופציונלי**: כרטיס חדש "מודל ססיה (מנוי חודשי)" עם מתג
  הפעלה/כיבוי בלחיצה אחת (`clinics.sessions_enabled` — אותו דגל שה-onboarding
  מציב ו-`request_session` אוכף `SESSIONS_NOT_ENABLED`). כבוי → תמחור
  הססיה מוסתר, ומסך /sessions של המטפל/ת מציג "לא פעיל" (היה קיים).

### תמונות לחדרים ולקליניקה (/admin/rooms)

- `rooms.images text[]` היה קיים ולא בשימוש; נוסף `clinics.image_path`.
  ה-bucket `room-images` הפך ל-**public** (5MB, JPEG/PNG/WebP — נאכף גם
  ב-bucket וגם ב-`lib/storage/images.ts`), כי תמונת הקליניקה מוצגת בדף
  /join הציבורי בלי session. ב-DB נשמר נתיב בלבד; ה-URL נבנה ב-`publicImageUrl`.
- נתיבים `{clinic_id}/rooms/{room_id}/{uuid}.ext` ו-`{clinic_id}/clinic/{uuid}.ext`
  — תואמים למדיניות ה-storage הקיימת. הכתיבה ל-storage דרך service role
  **אחרי** `requireClinicAdmin` (הנתיב מ-clinicId של ה-guard, לא מהטופס);
  ה-DB דרך ה-client הרגיל תחת RLS. מחיקה/החלפה מסירה גם את הקובץ.
- UI: כרטיס "תמונת הקליניקה" בראש /admin/rooms; לכל חדר רצועת תמונות
  ממוזערות (עד 6) עם העלאה/הסרה. **תצוגה למטפלים/ות**: תמונת החדר
  (הראשונה) בכותרת העמודה בלוח (/schedule ו-/admin/board — `GridColumn.imageUrl`),
  תמונת הקליניקה ב-/join/[slug] ובראש /dashboard.
- `next.config.ts`: `experimental.serverActions.bodySizeLimit = "6mb"`
  (ברירת המחדל 1MB הייתה חוסמת העלאות). `<img>` רגיל (לא `next/image`) —
  Supabase Storage, בלי optimizer; eslint-disable מקומי עם הסבר.

### ייבוא מטפלים/ות מ-Excel/CSV (/admin/therapists/import)

- **המסך מסביר את הפורמט** (3 צעדים, טבלת דוגמה, הערות לכל עמודה) ומציע
  **תבנית CSV להורדה** (UTF-8+BOM → Excel פותח עברית נכון; route
  `/admin/therapists/import/template`). עמודות: שם מלא | טלפון | אימייל |
  שעות (רשות) | מקצוע (רשות). סדר חופשי; כותרות בעברית/אנגלית (מילון
  כינויים ב-`lib/import/therapists.ts`); עמודות זרות מתעלמים.
- פרסור: `.xlsx` דרך `read-excel-file/node` (`readSheet` — גיליון ראשון;
  מספר טלפון שאקסל הפך למספר ובלע את ה-0 מטופל ע"י `toE164Israel`), `.csv`
  דרך פרסר קטן משלנו (BOM, מרכאות, `;` כמפריד, CRLF). 9 בדיקות vitest.
  נבדק גם על xlsx אמיתי שנוצר בסקריפט.
- **תצוגה מקדימה לפני כתיבה**: טבלה עם סטטוס לכל שורה (חסר שם / טלפון /
  אימייל לא תקין / שעות / כפול בקובץ). אישור שולח רק את התקינות ל-RPC
  `admin_import_therapists(p_rows jsonb)` (SECURITY DEFINER, revoked
  public+anon): ולידציה חוזרת בצד ה-DB, שורה שגויה לא מפילה את השאר
  (תת-טרנזקציה), **אימייל שכבר קיים באותה קליניקה = דילוג** (העלאה חוזרת
  בטוחה), אימייל בקליניקה אחרת / טלפון כפול / מכסת תוכנית = שגיאה על השורה.
  `hours>0` → כרטיסייה בלי רשומת תשלום (כמו קליטת יתרה מ-Skedda), audit
  `punch_card_imported`; לכל פרופיל `therapist_imported`. תפקיד תמיד
  `therapist` (אדמין/ית רק דרך הזמנה ידנית — לא השתנה).
- **איך המיובאים נכנסים**: הפרופיל נוצר בלי `clerk_user_id`. בכניסה
  הראשונה — `link_clerk_identity` (ב-guards) מקשר לפי אימייל, **וגם**
  `join_clinic_as_therapist` / `accept_therapist_invite` עודכנו: אימייל
  של פרופיל מיובא באותה קליניקה → קישור (+עדכון שם/טלפון/תנאים, audit
  `pre_registered_profile_linked`) במקום נפילה על `profiles_email_key`.
  אימייל שכבר מקושר לחשבון אחר או מיובא בקליניקה אחרת →
  `EMAIL_ALREADY_REGISTERED` (מתורגם בטפסים). המסך מסביר את זה ומציג את
  קישור ההצטרפות. ברשימת המטפלים תג "טרם נרשם/ה" לפרופיל בלי Clerk.

**נבדק חי** (בטרנזקציה עם rollback, JWT מדומה של הבעלים): ייבוא 5 שורות
→ 2 נוספו, 1 דולגה (כפילות), 2 שגיאות (INVALID_INPUT, PHONE_EXISTS), כרטיסייה
אחת (10 שעות); ואז `join_clinic_as_therapist` עם sub מדומה ואותו אימייל
(באותיות גדולות) → הפרופיל קושר, השם עודכן, הכרטיסייה נשארה, audit נרשם,
0 פרופילים חדשים. הרשאות: שלושת ה-RPC — authenticated/service_role בלבד.

**לא נבדק בדפדפן** (כמו קודם — אין `.env.local` כאן): העלאת תמונה בפועל
דרך server action, וה-flow המלא של ייבוא מ-UI.

## ✅ 29. תיקון העלאת התמונות (server-side exception) + דשבורד אדמין מפורט

שני ממצאים מהמשתמש/ת (10/09, מהנייד).

### א. "Application error: a server-side exception has occurred" בהעלאת תמונה

**האבחון** (לוגים של Supabase, 08:00 UTC = 11:00 מקומי): דף /admin/rooms
נטען תקין (`clinics?select=name,image_path` → 200), ואז — **שום** בקשה
לא הגיעה ל-Storage, וגם לא בקשת ה-`profiles` ש-`requireClinicAdmin()`
עושה בתחילת כל פעולה. כלומר ה-Server Action **לא רץ בכלל**: הבקשה נדחתה
לפניו.

**השורש**: ל-Vercel יש תקרה קשיחה של ~4.5MB לגוף בקשה לפונקציה. היא
נאכפת ב-infra, לפני Next, **ולא ניתנת להגדלה** מ-next.config — כך
ש-`serverActions.bodySizeLimit` שהגדרנו (6mb) לא יכול היה לעזור. תמונה
מצולמת מאייפון עוברת בקלות את הרף, והמשתמש/ת קיבל/ה שגיאת שרת סתומה
במקום הודעה.

**התיקון — הקובץ לא עובר יותר דרך Server Action**:
1. **כיווץ בדפדפן** לפני הכל: `createImageBitmap` + canvas → הצלע הארוכה
   ל-1600px, JPEG באיכות 0.82. תמונה של 5MB הופכת ל-~300KB. בונוס: ה-canvas
   ממיר גם HEIC ל-JPEG. רשימת ה-`accept` כוללת רק jpeg/png/webp **בכוונה** —
   כך ספארי באייפון ממיר HEIC בעצמו כבר בבחירה (הוספת heic הייתה מבטלת את זה).
2. **signed upload URL**: server action קטן (`createRoomImageUploadUrlAction` /
   `createClinicImageUploadUrlAction`) מאמת אדמין/ית, בודק שהחדר שייך
   לקליניקה ושלא עברנו את מכסת התמונות, ומחזיר `{path, token}` — בלי הקובץ.
3. **העלאה ישירה** מהדפדפן ל-Supabase (`uploadToSignedUrl`) — עוקפת לגמרי
   את תקרת הגוף, וגם מהירה יותר (הבייטים לא עוברים דרך הפונקציה).
4. **צירוף**: `attachRoomImageAction` / `attachClinicImageAction` מקבלות את
   הנתיב בלבד ומאמתות אותו מול הקליניקה **והחדר** (`isRoomImagePath`) —
   הנתיב חוזר מהלקוח, אז מתקבל רק נתיב שאנחנו עצמנו היינו מייצרים.
   תמונת קליניקה קודמת נמחקת רק **אחרי** שהחדשה נשמרה.

`<ImageUpload>` (client) מציג מצב "מעלה…" ושגיאה מתורגמת במקום redirect.

**אותה מלכודת בייבוא מ-Excel**: הקובץ שם כן עובר כ-FormData לפעולה. הוספתי
בדיקת גודל **בדפדפן** (2MB) לפני השליחה, כי אחרת קובץ גדול היה מייצר את
אותה שגיאה סתומה. `bodySizeLimit` הורד ל-3mb עם הערה מפורשת שאסור להעלות
אותו כפתרון לקבצים גדולים.

### ב. דשבורד האדמין — שמות, לא רק מספרים

בקשת המשתמש/ת: "לפרט יותר, נגיד מטפל שנגמרת לו הכרטיסייה עם יתרה של פחות
משעתיים — תרשום את השמות". המסך היה 4 מספרים בלבד. עכשיו, מתחת לאריחים:

- **היום בקליניקה** — כל ההזמנות המאושרות של היום לפי שעה: שעה, שם המטפל/ת
  (קישור לכרטיס), חדר, ותגית מקור כשזו לא כרטיסייה.
- **מטפלים/ות שהיתרה שלהם/ן נגמרת** — שמות + יתרה, ממוינים מהנמוך. 🔴 הספירה
  היא **פר מטפל/ת ולא פר כרטיסייה** (שתי כרטיסיות כמעט-ריקות של אותה מטפלת
  הן התראה אחת, והסכום הוא מה שנשאר לה בפועל), ורק כרטיסיות **בתוקף**
  (`expires_at > now`) — שני באגים שהיו באריח הקודם.
- **בקשות ססיה שממתינות** — שמות + היקף שבועי.
- **כרטיסיות שפגות בקרוב** (30 יום) — שם, יתרה ותאריך. מוצג רק כשיש.
- **מטפלים/ות שטרם נרשמו** — פרופילים בלי `clerk_user_id` (יובאו/נוספו ולא
  נכנסו עדיין). מוצג רק כשיש.

אריח עם ערך שדורש טיפול (בקשות ממתינות / יתרה נמוכה) נצבע באדום.

**אימות**: `tsc`, `eslint`, `vitest` (89), `npm run build` נקיים. **לא נבדק
בדפדפן מכאן** — אין `.env.local` בסביבה הזו; ההעלאה עצמה טעונה בדיקה אחת
מהנייד אחרי הדיפלוי.

## מה הכי דחוף להמשיך בו

1. **לא נבדק בדפדפן** — כל המסכים החדשים (הנפקת כרטיסייה, חסימות, חריגות,
   תזכורות, עורך המדרגות, תמונות, ייבוא מ-Excel) ושינוי ה-LTR צריכים מעבר
   ויזואלי אחד אמיתי.
2. Sentry DSN (`NEXT_PUBLIC_SENTRY_DSN` ריק) — לפני משתמש/ת ראשון/ה.
3. WhatsApp אוטומטי: ההקמה ב-Meta (סעיף 27). ~~Green API~~ — הוסר;
   להזין Instance ID / API URL / טוקן ב-/admin/settings וללחוץ "שליחת
   הודעת בדיקה אליי". לשקול Vercel Pro לתזכורת מדויקת של 24 שעות.
2. מיילים לפי שפת הנמען/ת (`lib/email/templates.ts` עדיין עברית בלבד).
2. וידוא בפועל שמיילי Resend נשלחים (התשתית קיימת, לא נבדק end-to-end).
3. Sentry DSN — לא הוגדר בפרודקשן (`NEXT_PUBLIC_SENTRY_DSN` ריק).
4. חיבור endpoint ה-webhook (`user.deleted`) בדשבורד של Clerk —
   `app/api/webhooks/clerk/route.ts` קיים וב-build, אבל Clerk לא שולח
   אליו כלום עד שמגדירים Endpoint + `CLERK_WEBHOOK_SIGNING_SECRET`.
