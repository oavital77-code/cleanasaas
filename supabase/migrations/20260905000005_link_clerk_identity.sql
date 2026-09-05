-- ═══════════════════════════════════════════════════════════════════════
-- קישור אוטומטי חד-פעמי: פרופיל קיים מ-Supabase Auth ← חשבון Clerk חדש
-- ═══════════════════════════════════════════════════════════════════════
--
-- בלי זה, מי שהתחבר לפני המעבר (auth.users) "יאבד" את הקליניקה שלו/ה
-- בכניסה הראשונה דרך Clerk — Clerk יוצר sub חדש שלא קיים באף profiles.id.
-- הפתרון: אם קיים פרופיל עם אותו אימייל שעדיין לא מקושר לשום clerk_user_id
-- (NULL), מקשרים אוטומטית בהתחברות הראשונה.
--
-- 🔴 למה RPC עם SECURITY DEFINER ולא UPDATE ישיר מהקוד:
--   1. app_user_id() של המשתמש/ת עוד NULL ברגע הזה (clerk_user_id עוד לא
--      קיים) — מדיניות edit_profile דורשת app_user_id() = id, אז UPDATE
--      רגיל דרך ה-client היה נדחה ע"י RLS (chicken-and-egg).
--   2. הטריגר enforce_profile_privilege_columns מחזיר clerk_user_id לערך
--      הישן תמיד, חוץ מכשdb.trusted_write='on' — וזה חייב לקרות באותה
--      טרנזקציה בדיוק כמו ה-update, לא בקריאת PostgREST נפרדת.
--
-- ⚠️ ה-email חייב להגיע מ-currentUser() של Clerk (Backend API עם ה-secret
-- key בקוד השרת) ולעולם לא מקלט לקוח — אחרת משתמש/ת Clerk כלשהו/י היה
-- יכול/ה "לתפוס" פרופיל של אדמין קיים רק בידיעת האימייל שלו/ה. לכן
-- ההרשאה על הפונקציה הזו מוגבלת ל-service_role בלבד — אין לה שום דרך
-- להיקרא ישירות מהדפדפן או מ-authenticated.
create or replace function link_clerk_identity(p_clerk_user_id text, p_email text)
returns setof profiles
language plpgsql
security definer
set search_path = public
as $$
begin
  perform set_config('cleana.trusted_write', 'on', true);

  update profiles
  set clerk_user_id = p_clerk_user_id
  where email = p_email and clerk_user_id is null;

  perform set_config('cleana.trusted_write', 'off', true);

  return query select * from profiles where clerk_user_id = p_clerk_user_id;
end;
$$;

revoke all on function link_clerk_identity(text, text) from public;
revoke all on function link_clerk_identity(text, text) from anon;
revoke all on function link_clerk_identity(text, text) from authenticated;
grant execute on function link_clerk_identity(text, text) to service_role;
