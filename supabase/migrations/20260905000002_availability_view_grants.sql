-- ═══ צמצום הרשאות על public_availability (ממצא מסקירת אבטחה) ═══
--
-- ה-view הזה הוא נקודת התורפה הרגישה ביותר בסכמה: הוא זה שמממש את חוק #3
-- ב-CLAUDE.md (מטפל/ת לעולם לא רואה מטפל/ת אחר/ת). שתי נקודות שנמצאו:
--
-- 1. ל-anon היו הרשאות SELECT/INSERT/UPDATE/DELETE עליו (ברירת המחדל
--    הרחבה של Supabase ל-schema public). בפועל anon לא היה מקבל אף שורה
--    כי ה-view מסנן `r.clinic_id = current_clinic_id()`, ו-current_clinic_id()
--    מחזירה NULL בלי auth.uid() — אבל אין שום סיבה שההרשאה תהיה שם
--    מלכתחילה. עכשיו: SELECT ל-authenticated בלבד.
--
-- 2. הרשאות כתיבה (INSERT/UPDATE/DELETE) על view מסוג UNION ALL הן חסרות
--    משמעות (Postgres לא יכול לעדכן אותו אוטומטית) — אבל הן רעש שמסתיר
--    את ההרשאה האמיתית היחידה שחשובה כאן. מוסרות גם מ-authenticated.
--
-- ⚠️ ה-view נשאר במכוון SECURITY DEFINER (בלי security_invoker=true), למרות
-- שה-linter של Supabase מסמן את זה כ-ERROR. הסיבה: עם security_invoker
-- ה-RLS של הקורא/ת היה חל על bookings — ומדיניות own_bookings מחזירה רק
-- `user_id = auth.uid()`. כלומר מטפל/ת היה רואה משבצות של אחרים כ"פנויות"
-- ומנסה להזמין אותן שוב. בידוד רב-דיירי כאן נאכף ע"י תנאי ה-clinic_id
-- שבתוך ה-view עצמו, ולכן **אסור לשנות את הגדרת ה-view בלי לוודא שהתנאי
-- הזה נשאר**.

revoke all on public.public_availability from anon;
revoke all on public.public_availability from authenticated;
grant select on public.public_availability to authenticated;
