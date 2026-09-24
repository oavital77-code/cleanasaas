-- ססיה בטווח גמיש: בעל/ת הקליניקה קובע/ת מינימום ומקסימום שעות שבועיות ומחיר
-- לשעה שבועית (לחודש, לפני מע"מ), והמחיר החודשי של ססיה = שעות × מחיר לשעה.
--
-- עד עכשיו request_session, admin_create_session ו-admin_create_session_prepaid
-- דרשו שסך השעות יהיה *בדיוק* session_base_hours (SESSION_HOURS_FIXED), והמחיר
-- היה session_base_price קבוע. עכשיו: min ≤ שעות ≤ max, אחרת
-- SESSION_HOURS_OUT_OF_RANGE, והמחיר מחושב.
--
-- אין שינוי התנהגות לאף קליניקה קיימת: session_pricing נופל חזרה להגדרות הישנות
-- — min = max = session_base_hours, מחיר לשעה = session_base_price / hours —
-- וכל קליניקה נזרעה ב-5 / 600 (signup_clinic), כלומר 5–5 שעות ב-120 ₪ = 600, כמו
-- היום. הטווח משתנה רק כשהאדמין שומר את ההגדרות החדשות.
--
-- שלוש הפונקציות הופקו מה-DB כפי שהוא (pg_get_functiondef, אחרי ההמרה ל-
-- app_user_id() ב-20260905000004 — לא מקובצי המיגרציה המקוריים, שעדיין מראים
-- auth.uid()). מה ששונה בכל אחת: הצהרת שלושה משתנים, בדיקת השעות, וחישוב המחיר.

create or replace function session_pricing(p_clinic_id uuid)
returns table (min_hours numeric, max_hours numeric, price_per_hour numeric)
language sql stable set search_path = public
as $$
  with s as (
    select
      max(case when key = 'session_min_hours'      then (value#>>'{}')::numeric end) as min_h,
      max(case when key = 'session_max_hours'      then (value#>>'{}')::numeric end) as max_h,
      max(case when key = 'session_price_per_hour' then (value#>>'{}')::numeric end) as per_h,
      max(case when key = 'session_base_hours'     then (value#>>'{}')::numeric end) as base_h,
      max(case when key = 'session_base_price'     then (value#>>'{}')::numeric end) as base_p
    from app_settings
    where clinic_id = p_clinic_id
  )
  select
    coalesce(min_h, base_h, 5),
    coalesce(max_h, base_h, 5),
    coalesce(per_h, round(coalesce(base_p, 600) / nullif(coalesce(base_h, 5), 0), 2), 120)
  from s;
$$;

-- פנימית בלבד: נקראת מתוך פונקציות SECURITY DEFINER. הממשק קורא את
-- app_settings של הקליניקה שלו ישירות (lib/session-pricing.ts, אותה נפילה חזרה).
revoke all on function session_pricing(uuid) from public, anon, authenticated;

-- request_session
CREATE OR REPLACE FUNCTION public.request_session(p_slots jsonb, p_start_date date DEFAULT NULL::date)
 RETURNS TABLE(subscription_id uuid, weekly_hours numeric, monthly_price numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_uid uuid := app_user_id();
  v_clinic_id uuid;
  v_status user_status;
  v_sessions_enabled boolean;
  v_slot jsonb;
  v_weekly_hours numeric := 0;
  v_hold_hours numeric;
  v_base_price numeric;
  v_base_hours numeric;
  v_min_hours numeric;
  v_max_hours numeric;
  v_price_per_hour numeric;
  v_start_date date;
  v_sub_id uuid;
begin
  if v_uid is null then
    raise exception 'FORBIDDEN';
  end if;

  select clinic_id, status into v_clinic_id, v_status from profiles where id = v_uid;
  if v_clinic_id is null then
    raise exception 'FORBIDDEN';
  end if;
  if v_status <> 'active' then
    raise exception 'USER_SUSPENDED';
  end if;
  if exists (select 1 from clinics where id = v_clinic_id and status = 'suspended') then
    raise exception 'CLINIC_SUSPENDED';
  end if;

  select sessions_enabled into v_sessions_enabled from clinics where id = v_clinic_id;
  if not coalesce(v_sessions_enabled, false) then
    raise exception 'SESSIONS_NOT_ENABLED';
  end if;

  if p_slots is null or jsonb_array_length(p_slots) = 0 then
    raise exception 'INVALID_SLOT';
  end if;

  if p_start_date is not null and p_start_date < current_date then
    raise exception 'INVALID_START_DATE';
  end if;
  v_start_date := coalesce(p_start_date, current_date);

  for v_slot in select * from jsonb_array_elements(p_slots) loop
    if (v_slot->>'weekday')::int not between 0 and 6 then
      raise exception 'INVALID_SLOT';
    end if;
    if (v_slot->>'end_time')::time <= (v_slot->>'start_time')::time then
      raise exception 'INVALID_SLOT';
    end if;
    if extract(epoch from (v_slot->>'start_time')::time)::int % 1800 <> 0
       or extract(epoch from (v_slot->>'end_time')::time)::int % 1800 <> 0 then
      raise exception 'INVALID_SLOT';
    end if;
    -- 🔴 החדר חייב להיות בתוך הקליניקה של המטפל/ת המבקש/ת
    if not exists (
      select 1 from rooms where id = (v_slot->>'room_id')::uuid and clinic_id = v_clinic_id and active
    ) then
      raise exception 'ROOM_UNAVAILABLE';
    end if;

    v_weekly_hours := v_weekly_hours
      + extract(epoch from ((v_slot->>'end_time')::time - (v_slot->>'start_time')::time)) / 3600;
  end loop;

  select sp.min_hours, sp.max_hours, sp.price_per_hour into v_min_hours, v_max_hours, v_price_per_hour
  from session_pricing(v_clinic_id) sp;
  if v_weekly_hours < v_min_hours or v_weekly_hours > v_max_hours then
    raise exception 'SESSION_HOURS_OUT_OF_RANGE';
  end if;

  select (value#>>'{}')::numeric into v_hold_hours from app_settings where clinic_id = v_clinic_id and key = 'session_hold_hours';
  v_hold_hours := coalesce(v_hold_hours, 72);
  v_base_price := round(v_weekly_hours * v_price_per_hour, 2);

  insert into session_subscriptions (clinic_id, user_id, status, weekly_hours, monthly_price, start_date, hold_expires_at)
  values (v_clinic_id, v_uid, 'requested', v_weekly_hours, v_base_price, v_start_date, now() + (v_hold_hours || ' hours')::interval)
  returning id into v_sub_id;

  for v_slot in select * from jsonb_array_elements(p_slots) loop
    insert into session_slots (clinic_id, subscription_id, room_id, weekday, start_time, end_time)
    values (
      v_clinic_id, v_sub_id,
      (v_slot->>'room_id')::uuid,
      (v_slot->>'weekday')::int,
      (v_slot->>'start_time')::time,
      (v_slot->>'end_time')::time
    );
  end loop;

  insert into audit_log (clinic_id, actor_id, action, entity, entity_id, after)
  values (v_clinic_id, v_uid, 'session_requested', 'session_subscriptions', v_sub_id,
          jsonb_build_object('weekly_hours', v_weekly_hours, 'monthly_price', v_base_price, 'start_date', v_start_date));

  return query select v_sub_id, v_weekly_hours, v_base_price;
end;
$function$;

-- admin_create_session
CREATE OR REPLACE FUNCTION public.admin_create_session(p_user_id uuid, p_slots jsonb, p_start_date date DEFAULT NULL::date, p_term_months integer DEFAULT NULL::integer)
 RETURNS TABLE(subscription_id uuid, weekly_hours numeric, monthly_price numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_clinic_id uuid;
  v_target_clinic uuid;
  v_status user_status;
  v_sessions_enabled boolean;
  v_slot jsonb;
  v_weekly_hours numeric := 0;
  v_hold_hours numeric;
  v_base_price numeric;
  v_base_hours numeric;
  v_min_hours numeric;
  v_max_hours numeric;
  v_price_per_hour numeric;
  v_start_date date;
  v_effective_end date;
  v_sub_id uuid;
begin
  select clinic_id into v_clinic_id from profiles where id = app_user_id();
  if not is_admin() then
    raise exception 'FORBIDDEN';
  end if;
  if p_term_months is not null and p_term_months not in (1, 3, 6, 12) then
    raise exception 'INVALID_TERM';
  end if;

  select clinic_id, status into v_target_clinic, v_status from profiles where id = p_user_id;
  if v_target_clinic is null or v_target_clinic <> v_clinic_id then
    raise exception 'FORBIDDEN';
  end if;
  if v_status <> 'active' then
    raise exception 'USER_SUSPENDED';
  end if;
  if exists (select 1 from clinics where id = v_clinic_id and status = 'suspended') then
    raise exception 'CLINIC_SUSPENDED';
  end if;

  select sessions_enabled into v_sessions_enabled from clinics where id = v_clinic_id;
  if not coalesce(v_sessions_enabled, false) then
    raise exception 'SESSIONS_NOT_ENABLED';
  end if;

  if p_slots is null or jsonb_array_length(p_slots) = 0 then
    raise exception 'INVALID_SLOT';
  end if;

  if p_start_date is not null and p_start_date < current_date then
    raise exception 'INVALID_START_DATE';
  end if;
  v_start_date := coalesce(p_start_date, current_date);

  if p_term_months is not null then
    v_effective_end := v_start_date + (p_term_months || ' months')::interval;
  end if;

  for v_slot in select * from jsonb_array_elements(p_slots) loop
    if (v_slot->>'weekday')::int not between 0 and 6 then
      raise exception 'INVALID_SLOT';
    end if;
    if (v_slot->>'end_time')::time <= (v_slot->>'start_time')::time then
      raise exception 'INVALID_SLOT';
    end if;
    if extract(epoch from (v_slot->>'start_time')::time)::int % 1800 <> 0
       or extract(epoch from (v_slot->>'end_time')::time)::int % 1800 <> 0 then
      raise exception 'INVALID_SLOT';
    end if;
    if not exists (
      select 1 from rooms where id = (v_slot->>'room_id')::uuid and clinic_id = v_clinic_id and active
    ) then
      raise exception 'ROOM_UNAVAILABLE';
    end if;

    v_weekly_hours := v_weekly_hours
      + extract(epoch from ((v_slot->>'end_time')::time - (v_slot->>'start_time')::time)) / 3600;
  end loop;

  select sp.min_hours, sp.max_hours, sp.price_per_hour into v_min_hours, v_max_hours, v_price_per_hour
  from session_pricing(v_clinic_id) sp;
  if v_weekly_hours < v_min_hours or v_weekly_hours > v_max_hours then
    raise exception 'SESSION_HOURS_OUT_OF_RANGE';
  end if;

  select (value#>>'{}')::numeric into v_hold_hours from app_settings where clinic_id = v_clinic_id and key = 'session_hold_hours';
  v_hold_hours := coalesce(v_hold_hours, 72);
  v_base_price := round(v_weekly_hours * v_price_per_hour, 2);

  insert into session_subscriptions (
    clinic_id, user_id, status, weekly_hours, monthly_price, start_date, hold_expires_at, reviewed_by, reviewed_at,
    effective_end_date
  )
  values (
    v_clinic_id, p_user_id, 'awaiting_payment', v_weekly_hours, v_base_price, v_start_date,
    now() + (v_hold_hours || ' hours')::interval, app_user_id(), now(), v_effective_end
  )
  returning id into v_sub_id;

  for v_slot in select * from jsonb_array_elements(p_slots) loop
    insert into session_slots (clinic_id, subscription_id, room_id, weekday, start_time, end_time)
    values (
      v_clinic_id, v_sub_id,
      (v_slot->>'room_id')::uuid,
      (v_slot->>'weekday')::int,
      (v_slot->>'start_time')::time,
      (v_slot->>'end_time')::time
    );
  end loop;

  insert into audit_log (clinic_id, actor_id, action, entity, entity_id, after)
  values (v_clinic_id, app_user_id(), 'session_created_by_admin', 'session_subscriptions', v_sub_id,
          jsonb_build_object('user_id', p_user_id, 'weekly_hours', v_weekly_hours, 'start_date', v_start_date,
                              'term_months', p_term_months, 'effective_end_date', v_effective_end));

  return query select v_sub_id, v_weekly_hours, v_base_price;
end;
$function$;

-- admin_create_session_prepaid
CREATE OR REPLACE FUNCTION public.admin_create_session_prepaid(p_user_id uuid, p_slots jsonb, p_start_date date DEFAULT NULL::date, p_term_months integer DEFAULT NULL::integer)
 RETURNS TABLE(subscription_id uuid)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_clinic_id uuid;
  v_target_clinic uuid;
  v_status user_status;
  v_slot jsonb;
  v_weekly_hours numeric := 0;
  v_base_price numeric;
  v_base_hours numeric;
  v_min_hours numeric;
  v_max_hours numeric;
  v_price_per_hour numeric;
  v_start_date date;
  v_effective_end date;
  v_sub_id uuid;
begin
  select clinic_id into v_clinic_id from profiles where id = app_user_id();
  if not is_admin() then
    raise exception 'FORBIDDEN';
  end if;
  if p_term_months is not null and p_term_months not in (1, 3, 6, 12) then
    raise exception 'INVALID_TERM';
  end if;

  select clinic_id, status into v_target_clinic, v_status from profiles where id = p_user_id;
  if v_target_clinic is null or v_target_clinic <> v_clinic_id then
    raise exception 'FORBIDDEN';
  end if;
  if v_status <> 'active' then
    raise exception 'USER_SUSPENDED';
  end if;

  if p_slots is null or jsonb_array_length(p_slots) = 0 then
    raise exception 'INVALID_SLOT';
  end if;

  if p_start_date is not null and p_start_date < current_date then
    raise exception 'INVALID_START_DATE';
  end if;
  v_start_date := coalesce(p_start_date, current_date);

  if p_term_months is not null then
    v_effective_end := v_start_date + (p_term_months || ' months')::interval;
  end if;

  for v_slot in select * from jsonb_array_elements(p_slots) loop
    if (v_slot->>'weekday')::int not between 0 and 6 then
      raise exception 'INVALID_SLOT';
    end if;
    if (v_slot->>'end_time')::time <= (v_slot->>'start_time')::time then
      raise exception 'INVALID_SLOT';
    end if;
    if extract(epoch from (v_slot->>'start_time')::time)::int % 1800 <> 0
       or extract(epoch from (v_slot->>'end_time')::time)::int % 1800 <> 0 then
      raise exception 'INVALID_SLOT';
    end if;
    if not exists (
      select 1 from rooms where id = (v_slot->>'room_id')::uuid and clinic_id = v_clinic_id and active
    ) then
      raise exception 'ROOM_UNAVAILABLE';
    end if;

    v_weekly_hours := v_weekly_hours
      + extract(epoch from ((v_slot->>'end_time')::time - (v_slot->>'start_time')::time)) / 3600;
  end loop;

  select sp.min_hours, sp.max_hours, sp.price_per_hour into v_min_hours, v_max_hours, v_price_per_hour
  from session_pricing(v_clinic_id) sp;
  if v_weekly_hours < v_min_hours or v_weekly_hours > v_max_hours then
    raise exception 'SESSION_HOURS_OUT_OF_RANGE';
  end if;

  v_base_price := round(v_weekly_hours * v_price_per_hour, 2);

  insert into session_subscriptions (
    clinic_id, user_id, status, weekly_hours, monthly_price, start_date, next_billing_date,
    reviewed_by, reviewed_at, effective_end_date
  )
  values (
    v_clinic_id, p_user_id, 'active', v_weekly_hours, v_base_price, v_start_date,
    v_start_date + interval '1 month', app_user_id(), now(), v_effective_end
  )
  returning id into v_sub_id;

  for v_slot in select * from jsonb_array_elements(p_slots) loop
    insert into session_slots (clinic_id, subscription_id, room_id, weekday, start_time, end_time)
    values (
      v_clinic_id, v_sub_id,
      (v_slot->>'room_id')::uuid,
      (v_slot->>'weekday')::int,
      (v_slot->>'start_time')::time,
      (v_slot->>'end_time')::time
    );
  end loop;

  perform materialize_subscription_bookings(v_sub_id, 90);

  insert into audit_log (clinic_id, actor_id, action, entity, entity_id, after)
  values (v_clinic_id, app_user_id(), 'session_created_prepaid', 'session_subscriptions', v_sub_id,
          jsonb_build_object('user_id', p_user_id, 'weekly_hours', v_weekly_hours, 'start_date', v_start_date,
                              'term_months', p_term_months, 'effective_end_date', v_effective_end,
                              'note', 'שולם מחוץ למערכת — בלי חיוב ראשוני'));

  return query select v_sub_id;
end;
$function$;
