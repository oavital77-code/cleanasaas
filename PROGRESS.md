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

## ⚠️ 8. QA מקצה לקצה

בוצע QA ברמת ה-DB (isolation smoke test, שתי קליניקות, ניסיון פריצה מכוון).
**לא בוצע**: הרצת `npm install && npm run build`/`npm run dev` בפועל מול
פרויקט Supabase אמיתי, ובדיקה ידנית של הזרימות ב-UI בדפדפן. יש להריץ את
זה לפני production אמיתי.

## ⚠️ 9. מסמכי ToS/DPA + admin actions מסוכנות ל-self-serve

**לא בוצע כלל** — טקסט משפטי (ToS/DPA) לא נכתב, ו-`grant_bonus_hours` נשאר
זמין ל-owner על הקליניקה שלו/ה בלי cap/הגבלת trial (ר' הערה ב-migration
`rpc_booking_and_punch_cards`). לפני פתיחה לציבור: צריך להחליט בין (א) הסרת
"שעות מתנה" ל-MVP הרב-דיירי, או (ב) cap קשיח + audit בולט + חסימה בזמן
trial.

---

## מגבלות/פשרות ידועות (לא כיסוי מלא של הספק המקורי)

- **אין עדיין**: מיילים (Resend) — `lib/email/*` מהמקור לא הועבר. ה-cron
  של תזכורות מזהה ומסמן (`*_notified_at`) אבל לא שולח בפועל.
  אין ICS, אין PWA (manifest/service worker/icons), אין Sentry עם tag
  `clinic_id` (המפרט §15 מבקש את זה — עוד לא חובר כי אין עדיין DSN אמיתי).
- **`clinic_payment_settings`**: הסודות (`woo_consumer_secret`,
  `woo_webhook_secret`) מאוחסנים כטקסט רגיל, מוגנים רק ב-RLS (admin +
  clinic_id שלו). לפני production: הצפנה אמיתית (pgsodium/Supabase Vault).
- **`lib/supabase/types.ts`**: נכתב ידנית (אין עדיין פרויקט Supabase מחובר
  להריץ מולו `supabase gen types typescript`). להחליף מיד כשיש פרויקט אמיתי.
- **UI**: פונקציונלי, לא מוקפד. אין תצוגת יומן/לוח שבועי אמיתית (spec §8.3
  — "הלב" של האפליקציה), אין Realtime מחובר בצד ה-UI (הטבלה/ה-triggers
  קיימים ב-DB), אין מסכי דוחות/ביקורת/היסטוריית תשלומים לאדמין, אין עריכת
  פרופיל עצמית למטפל/ת.
- **טלפון**: `toE164Israel` הוא ישראל-בלבד — קליניקה עתידית מחוץ לישראל
  (spec §1) תצטרך ולידציה בין-לאומית.
- **superadmin ראשון**: אין מסך הרשמה ל-superadmin (במתכוון — זה לא flow
  self-serve). יש להכניס ידנית: `insert into platform_admins (user_id,
  full_name) values ('<auth-user-id>', '<name>');` עם ה-service role.

## מה הכי דחוף להמשיך בו

1. Email (Resend) + ICS — כי בלעדיהם חלק גדול מ-§10 של המפרט המקורי לא קיים.
2. UI ליומן/לוח אמיתי (spec §8.3) — הטופס הנוכחי ב-`/schedule` פונקציונלי
   אך לא שימיש בפועל ע"י ~300 מטפלים.
3. הצפנת `clinic_payment_settings` לפני חיבור קליניקה אמיתית ראשונה.
4. ToS/DPA + החלטה על `grant_bonus_hours` בהרשמה עצמאית — לפני פתיחה לציבור.
