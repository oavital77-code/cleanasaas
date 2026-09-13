-- תיקון נתונים: profiles.phone נשמר בפורמט מקומי (05XXXXXXXX) מטפסי ההרשמה
-- (signup / join / invite), למרות ש-toE164Israel קיים ב-lib/phone.ts (ושימש
-- רק את Woo). תוצאות בפועל (סקירה 07/09, צילום מסך של המשתמש):
--   • קישורי wa.me/Meta נכשלו — WhatsApp מפרש ספרות בלי קידומת מדינה
--     כ-username ("@0525550123 isn't on WhatsApp").
--   • שיוך רכישות Woo לפי טלפון (process-order משווה E.164 מול profiles.phone)
--     לא היה מוצא התאמה לעולם.
-- מכאן: שלושת הטפסים מנרמלים ל-E.164 לפני ה-RPC (ודוחים מספר לא תקין),
-- toWhatsAppDigits מנרמל גם הוא (הגנת-עומק), וכאן מתוקן הקיים.
--
-- phone נעול ע"י enforce_profile_privilege_columns → cleana.trusted_write.
select set_config('cleana.trusted_write', 'on', true);
update profiles set phone = '+972' || substr(phone, 2) where phone ~ '^0\d{9}$';
update profiles set phone = '+' || phone where phone ~ '^972\d{9}$';
select set_config('cleana.trusted_write', 'off', true);
