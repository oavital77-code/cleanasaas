-- ═══════════════════════════════════════════════════════════════════════
-- שלב 2 מתוך המעבר ל-Clerk: המרת ה-RPCs לשכבת הזהות הדו-מצבית
-- ═══════════════════════════════════════════════════════════════════════
--
-- ר' ההסבר המלא ב-20260905000003: auth.uid() עושה `::uuid` ולכן *זורקת*
-- על ה-sub של Clerk. כל פונקציה שנוגעת בה חייבת לעבור ל-app_user_id().
--
-- למה DO block ולא 27 פונקציות כתובות מחדש:
-- ההמרה היא החלפת מחרוזת אחת ויחידה בתוך גוף קיים ובדוק. שכתוב ידני של
-- 27 גופי פונקציות (חלקם 100+ שורות של לוגיקת תשלומים וססיות) היה מכניס
-- סיכון אמיתי לשגיאת העתקה בקוד שאוכף כסף והרשאות. pg_get_functiondef
-- מחזיר את ההגדרה המדויקת כפי שהיא ב-DB, וההחלפה מתבצעת עליה.
--
-- 🔴 שלוש פונקציות מוחרגות במפורש — signup_clinic,
-- accept_therapist_invite, join_clinic_as_therapist. הן *יוצרות* פרופיל
-- חדש עם `id = auth.uid()`, כלומר משתמשות בזהות כמקור לערך שנכתב, לא
-- כשאילתה. ברגע שהזהות מגיעה מ-Clerk אין כלל שורה ב-auth.users, ו-
-- app_user_id() מחזירה NULL בדיוק ברגע שבו הפרופיל עוד לא קיים — החלפה
-- מכנית שם הייתה מייצרת פרופיל עם id ריק. הן מומרות בשלב 3, יחד עם
-- זרימת ההרשמה בצד האפליקציה.

do $$
declare
  fn record;
  converted int := 0;
begin
  for fn in
    select p.oid, p.proname, pg_get_functiondef(p.oid) as def
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prokind = 'f'
      and pg_get_functiondef(p.oid) like '%auth.uid()%'
      and p.proname not in ('signup_clinic', 'accept_therapist_invite', 'join_clinic_as_therapist')
  loop
    execute replace(fn.def, 'auth.uid()', 'app_user_id()');
    converted := converted + 1;
  end loop;

  raise notice 'הומרו % פונקציות ל-app_user_id()', converted;
end $$;
