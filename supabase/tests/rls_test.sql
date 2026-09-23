-- RLS ברמת הסכמה: כל טבלה ב-public חייבת RLS פעילה, וטבלת הפניות הציבורית
-- סגורה לחלוטין בפני anon/authenticated — הדרך היחידה פנימה היא הטופס,
-- שעובר הגבלת קצב וולידציה. בלי זה, POST ישיר ל-/rest/v1/platform_leads
-- עם מפתח ה-anon (שחשוף בדפדפן) היה עוקף את שתיהן.
\set ON_ERROR_STOP on

begin;

do $$
declare
  v_missing text;
begin
  select string_agg(c.relname, ', ' order by c.relname) into v_missing
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relkind = 'r'
    and not c.relrowsecurity;

  if v_missing is not null then
    raise exception 'SECURITY: טבלאות ב-public בלי RLS: %', v_missing;
  end if;
  raise notice 'RLS פעילה על כל הטבלאות ב-public';
end $$;

-- anon מנסה לכתוב ליד ישירות — חייב להיכשל.
set role anon;
do $$
begin
  begin
    insert into platform_leads (name, phone) values ('spam', '+972500000000');
    raise exception 'SECURITY BUG: anon כתב ל-platform_leads ישירות';
  exception when insufficient_privilege then
    raise notice 'platform_leads סגורה לכתיבה ע"י anon כצפוי';
  end;
end $$;

-- ולא יכול לקרוא את הלידים של אחרים.
do $$
begin
  begin
    perform 1 from platform_leads limit 1;
    raise exception 'SECURITY BUG: anon קרא מ-platform_leads';
  exception when insufficient_privilege then
    raise notice 'platform_leads סגורה לקריאה ע"י anon כצפוי';
  end;
end $$;
reset role;

-- service_role (הטופס והדשבורד) כן מגיע.
set role service_role;
insert into platform_leads (name, phone) values ('בדיקה', '+972500000001');
do $$
begin
  if not exists (select 1 from platform_leads where name = 'בדיקה') then
    raise exception 'service_role לא הצליח לכתוב/לקרוא — הטופס והדשבורד יישברו';
  end if;
  raise notice 'service_role כותב וקורא לידים כצפוי';
end $$;
reset role;

rollback;
