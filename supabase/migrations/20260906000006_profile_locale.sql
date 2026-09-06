-- שפת ממשק אישית לכל משתמש/ת (לא ברמת קליניקה) — נבחר ב-/profile.
-- ברירת מחדל אנגלית (לפי בקשת המשתמש) — גם לפרופילים קיימים, לא רק
-- חדשים; מי שרוצה עברית פשוט יחליף/תחליף דרך /profile.
--
-- 🔴 לא נעול ע"י enforce_profile_privilege_columns (ולא צריך להיות —
-- זו העדפת תצוגה אישית, לא שדה privilege כמו role/status/door_code).
alter table profiles
  add column locale text not null default 'en' check (locale in ('he', 'en'));
