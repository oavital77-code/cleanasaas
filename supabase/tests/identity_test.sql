-- שומר על שכבת הזהות: שהיא נשארת app_user_id(), ושלוש הפונקציות של
-- service_role נשארות סגורות. להריץ עם local_shim + כל המיגרציות
-- (supabase/tests/run.sh עושה את זה).
\set ON_ERROR_STOP on

begin;

-- 🔴 auth.uid() עושה ::uuid על ה-sub של ה-JWT, ולכן *זורקת* על מזהה של
-- Clerk (`user_2abc...`). כל שימוש בה בפונקציה ציבורית הוא באג בהמתנה.
-- ההמרה ההיסטורית (20260905000004) נעשתה ע"י DO block שמשכתב גופים קיימים,
-- ולכן קובצי המיגרציה *עדיין מראים* auth.uid() — מי שיעתיק מהם
-- `create or replace` יחזיר את הבאג בשקט. הבדיקה הזו היא מה שיתפוס אותו.
do $$
declare
  v_names text;
begin
  select string_agg(p.proname, ', ' order by p.proname) into v_names
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.prokind = 'f'
    and pg_get_functiondef(p.oid) like '%auth.uid()%';

  if v_names is not null then
    raise exception 'REGRESSION: פונקציות ב-public חזרו להשתמש ב-auth.uid() (זורקת על sub של Clerk): %', v_names;
  end if;
  raise notice 'identity OK: אף פונקציה ב-public לא משתמשת ב-auth.uid()';
end $$;

-- app_user_id() עובדת על sub של Clerk ועל uuid כאחד (שכבה דו-מצבית).
do $$
declare
  v_uuid uuid := '3f0b6c1e-1f2a-4c3d-9e8f-0a1b2c3d4e5f';
begin
  perform set_config('request.jwt.claims', '{"sub":"user_2abcDEF"}', true);
  if app_user_id() is not null then
    raise exception 'app_user_id() החזירה ערך ל-sub של Clerk שאינו מקושר לאף פרופיל';
  end if;

  perform set_config('request.jwt.claims', format('{"sub":"%s"}', v_uuid), true);
  if app_user_id() <> v_uuid then
    raise exception 'app_user_id() לא מחזירה sub בצורת uuid כמו שהוא';
  end if;
  raise notice 'app_user_id() OK בשני המצבים';
end $$;

-- שלוש הפונקציות שהקוד קורא להן רק עם service role: לא ניתנות להרצה ע"י
-- anon/authenticated, וגם בודקות בעצמן (הגנה בעומק, 20260921000003).
do $$
declare
  fn text;
  v_sig text;
begin
  foreach fn in array array['materialize_holiday_blocks', 'link_clerk_identity', 'clear_clerk_identity', 'get_clinic_woo_credentials']
  loop
    select p.oid::regprocedure::text into v_sig
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = fn;

    if v_sig is null then
      raise exception 'הפונקציה % לא קיימת', fn;
    end if;
    if has_function_privilege('anon', v_sig, 'execute') or has_function_privilege('authenticated', v_sig, 'execute') then
      raise exception 'SECURITY: % ניתנת להרצה ע"י anon/authenticated', fn;
    end if;
    if not has_function_privilege('service_role', v_sig, 'execute') then
      raise exception '% כבר לא ניתנת להרצה ע"י service_role — הקוד השרתי יישבר', fn;
    end if;

    if (select pg_get_functiondef(p.oid) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public' and p.proname = fn) not like '%service_role%' then
      raise exception 'DEFENCE IN DEPTH: ל-% אין בדיקת service_role בתוך הגוף', fn;
    end if;
  end loop;
  raise notice 'service-role functions OK (grants + בדיקה פנימית)';
end $$;

-- והבדיקה בפועל: authenticated שמנסה להריץ אותן נדחה.
set role authenticated;
select set_config('cleana.test_role', 'authenticated', true);
do $$
begin
  begin
    perform materialize_holiday_blocks('3f0b6c1e-1f2a-4c3d-9e8f-0a1b2c3d4e5f', array[]::timestamptz[], array[]::timestamptz[], array[]::text[]);
    raise exception 'SECURITY BUG: authenticated הצליח/ה להריץ materialize_holiday_blocks';
  exception when insufficient_privilege or undefined_function then
    raise notice 'materialize_holiday_blocks חסומה ל-authenticated כצפוי';
  end;
end $$;
reset role;

rollback;
