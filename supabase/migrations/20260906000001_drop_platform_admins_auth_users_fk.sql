-- אותו באג בדיוק כמו profiles_id_fkey (מיגרציה 20260905000007): FK ל-
-- auth.users(id) שהיה תלוי בהנחה הסמויה ש-user_id הוא תמיד auth.uid()
-- אמיתי. פרופיל שנוצר עם gen_random_uuid() (זהות Clerk, ר' 20260905000006)
-- אין לו שורת auth.users מאחוריו בכלל — insert לתוך platform_admins עבור
-- superadmin כזה/כזאת היה נכשל ב-foreign key violation, בדיוק כמו שקרה
-- ב-signup_clinic לפני שהתוקן. מתועד כ"נמצא, לא תוקן" ב-PROGRESS.md
-- (סעיף 20) — זו הפעם שבה זה סוף-סוף רלוונטי.
alter table platform_admins drop constraint platform_admins_user_id_fkey;
