-- התאמת מייל של הזמנת Woo לפרופיל נעשתה עד עכשיו ב-
-- `.ilike("email", params.email)` על כתובת שמגיעה מבחוץ (billing.email של
-- ההזמנה). ב-ILIKE התווים `%` ו-`_` הם תווים כלליים, ולכן כתובת כמו
-- `a_b@example.com` מתאימה גם ל-`axb@example.com`, ו-`%@example.com` מתאים
-- לכל מי שיש לו מייל בדומיין הזה — כלומר ססיה של הזמנה אחת יכולה להיות
-- מופעלת למטפל/ת אחר/ת באותה קליניקה (ה-scope ל-clinic_id מונע דליפה בין
-- קליניקות, אבל לא בתוך אחת).
--
-- PostgREST לא יודע לסנן על `lower(email)`, ולכן העמודה המחושבת: ההשוואה
-- נעשית ב-`.eq("email_lower", ...)` — התאמה מדויקת, ללא תווים כלליים, ועם
-- אינדקס. זו אותה סמנטיקה שה-RPCs כאן כבר משתמשים בה
-- (`lower(email) = lower(p_email)` ב-20260907000005).
alter table profiles
  add column if not exists email_lower text generated always as (lower(email)) stored;

create index if not exists profiles_clinic_email_lower_idx on profiles (clinic_id, email_lower);
