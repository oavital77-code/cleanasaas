-- מקביל הפוך ל-link_clerk_identity (20260905000005): מנקה clerk_user_id
-- כשמשתמש/ת נמחק/ת ישירות ב-Clerk (דשבורד/API, לא דרך cleanasaas) —
-- ר' PROGRESS.md, "אין עדיין webhook user.deleted". בלי זה, clerk_user_id
-- היה נשאר "יתום" — לא שובר כלום היום (Clerk כבר לא יכיר את הזהות
-- הזו ולא ינפיק לה טוקן), אבל אם מישהו/י אחר/ת ירצה/תרצה בעתיד להשתמש
-- באותו clerk_user_id (בלתי סביר אבל לא בלתי אפשרי אצל Clerk) לא צריך
-- להשאיר רפרנס ישן. נשאר null, לא נמחק הפרופיל עצמו — היסטוריית
-- הזמנות/תשלומים חייבת לשרוד (בדיוק כמו הפילוסופיה של status='suspended'
-- ולא מחיקה, בכל שאר המערכת).
--
-- 🔴 enforce_profile_privilege_columns (trigger על profiles) כופה
-- new.clerk_user_id := old.clerk_user_id בלי cleana.trusted_write='on' —
-- בלי ה-RPC הזה, update ישיר על clerk_user_id (גם עם service role) היה
-- פשוט נהפך בחזרה בשקט על ידי ה-trigger. אותה תבנית בדיוק כמו
-- link_clerk_identity.
create or replace function clear_clerk_identity(p_clerk_user_id text)
returns setof profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_clinic_id uuid;
begin
  select id, clinic_id into v_id, v_clinic_id from profiles where clerk_user_id = p_clerk_user_id;
  if v_id is null then
    return;
  end if;

  perform set_config('cleana.trusted_write', 'on', true);

  update profiles set clerk_user_id = null where id = v_id;

  insert into audit_log (clinic_id, actor_id, action, entity, entity_id, after)
  values (v_clinic_id, null, 'clerk_user_deleted_webhook', 'profiles', v_id, jsonb_build_object('clerk_user_id', p_clerk_user_id));

  perform set_config('cleana.trusted_write', 'off', true);

  return query select * from profiles where id = v_id;
end;
$$;

revoke all on function clear_clerk_identity(text) from public, anon, authenticated;
grant execute on function clear_clerk_identity(text) to service_role;
