-- הגנה בעומק על שלוש פונקציות SECURITY DEFINER שעד עכשיו הסתמכו אך ורק על
-- ה-GRANTs שלהן. ה-GRANTs נכונים (service_role בלבד, anon/authenticated
-- מורחקים במפורש), ולכן אין כאן חשיפה בפועל — אבל grant אחד שמישהו יוסיף
-- בטעות בעתיד, או `grant execute on all functions in schema public`
-- גורף, הופך אותן לזמינות לכל משתמש/ת מחובר/ת בלי שום בדיקה בפנים.
-- get_clinic_woo_credentials (20260906000002) כבר עושה בדיוק את זה —
-- אותה בדיקה, אותה הודעת שגיאה.
--
-- הגופים זהים לחלוטין למה שהיה, מלבד שורת הבדיקה בראש כל אחת.

-- 20260921000001
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
  if auth.role() <> 'service_role' then
    raise exception 'FORBIDDEN';
  end if;
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

-- 20260905000005
create or replace function link_clerk_identity(p_clerk_user_id text, p_email text)
returns setof profiles
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() <> 'service_role' then
    raise exception 'FORBIDDEN';
  end if;

  perform set_config('cleana.trusted_write', 'on', true);

  update profiles
  set clerk_user_id = p_clerk_user_id
  where email = p_email and clerk_user_id is null;

  perform set_config('cleana.trusted_write', 'off', true);

  return query select * from profiles where clerk_user_id = p_clerk_user_id;
end;
$$;

-- 20260906000005
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
  if auth.role() <> 'service_role' then
    raise exception 'FORBIDDEN';
  end if;

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

-- ה-GRANTs נשארים כפי שהיו; create or replace לא משנה אותם. נכתבים שוב רק
-- כדי שהקובץ הזה יהיה התמונה המלאה של מי רשאי/ת לקרוא לשלוש האלה.
revoke execute on function materialize_holiday_blocks(uuid, timestamptz[], timestamptz[], text[]) from public, anon, authenticated;
grant  execute on function materialize_holiday_blocks(uuid, timestamptz[], timestamptz[], text[]) to service_role;
revoke execute on function link_clerk_identity(text, text) from public, anon, authenticated;
grant  execute on function link_clerk_identity(text, text) to service_role;
revoke execute on function clear_clerk_identity(text) from public, anon, authenticated;
grant  execute on function clear_clerk_identity(text) to service_role;
