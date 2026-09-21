-- חגי ישראל: הקליניקה בוחרת אילו ימים סגורים, והם הופכים לחסימות חדר
-- (room_blocks) עם reason 'holiday:<key>'. החישוב עצמו (לוח עברי) קורה
-- באפליקציה — lib/holidays.ts — ומוזן לכאן כמערכים; ה-DB רק שומר ואוכף,
-- כמו כל חסימה אחרת. ר' lib/holiday-blocks.ts.

alter table clinics
  add column if not exists block_holidays     boolean not null default true,
  add column if not exists block_holiday_eves boolean not null default false,
  add column if not exists block_chol_hamoed  boolean not null default false;

-- מקבלת את הרשימה הרצויה של ימים סגורים (טווחים ב-UTC + סיבה) לקליניקה
-- אחת, ומיישרת את room_blocks אליה: מוסיפה מה שחסר לכל חדר פעיל, ומוחקת
-- חסימות חג עתידיות שכבר לא במדיניות. חסימות ידניות (reason אחר) לא נוגעים.
-- 'on conflict do nothing' תופס גם את block_no_overlap (exclusion): חסימה
-- ידנית שכבר יושבת על אותו יום פשוט מנצחת.
create or replace function materialize_holiday_blocks(
  p_clinic_id uuid,
  p_starts    timestamptz[],
  p_ends      timestamptz[],
  p_reasons   text[]
)
returns table(inserted int, deleted int)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inserted int := 0;
  v_deleted  int := 0;
begin
  if p_clinic_id is null then
    raise exception 'INVALID_CLINIC';
  end if;
  if coalesce(array_length(p_starts, 1), 0) <> coalesce(array_length(p_ends, 1), 0)
     or coalesce(array_length(p_starts, 1), 0) <> coalesce(array_length(p_reasons, 1), 0) then
    raise exception 'INVALID_ARRAYS';
  end if;

  delete from room_blocks rb
  where rb.clinic_id = p_clinic_id
    and rb.reason like 'holiday:%'
    and rb.starts_at >= now()
    and not exists (
      select 1
      from unnest(p_starts, p_ends) as d(s, e)
      where d.s = rb.starts_at and d.e = rb.ends_at
    );
  get diagnostics v_deleted = row_count;

  insert into room_blocks (clinic_id, room_id, starts_at, ends_at, reason)
  select p_clinic_id, r.id, d.s, d.e, d.reason
  from rooms r
  cross join unnest(p_starts, p_ends, p_reasons) as d(s, e, reason)
  where r.clinic_id = p_clinic_id
    and r.active
    and not exists (
      select 1 from room_blocks x
      where x.room_id = r.id and x.starts_at = d.s and x.ends_at = d.e and x.reason = d.reason
    )
  on conflict do nothing;
  get diagnostics v_inserted = row_count;

  return query select v_inserted, v_deleted;
end;
$$;

-- service role בלבד: ה-cron והפעולה של אדמין הקליניקה קוראים לזה דרך
-- createAdminClient. משתמש מחובר לא יכול לזייף חסימות לקליניקה אחרת.
revoke execute on function materialize_holiday_blocks(uuid, timestamptz[], timestamptz[], text[]) from public, anon, authenticated;
grant  execute on function materialize_holiday_blocks(uuid, timestamptz[], timestamptz[], text[]) to service_role;
