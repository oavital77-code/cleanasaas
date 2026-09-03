-- Cleana SaaS — מחזור חיים של ססיה (מנוי), רב-דיירי
-- ר' baclinica-spec.md §3.2-3.3, §6.3-6.7 + SAASMIGRATIONSPEC §1 (clinic scoping).
--
-- הססיה היא מוצר היקף-קבוע: תמיד בדיוק session_base_hours שעות שבועיות
-- (ברירת מחדל 5, per-clinic ב-app_settings), במחיר session_base_price קבוע.
-- אין תמחור שולי לפי שעות. clinics.sessions_enabled מאפשר לקליניקה בלי
-- מודל ססיה בכלל לחסום את התכונה (spec §5, wizard).

-- ═══ בדיקת התנגשות למשבצת שבועית חוזרת על פני האופק ═══
-- room_id כבר שייך לקליניקה אחת בדיוק — אין סיכון חוצה-דיירים כאן כל עוד
-- הקוראים (request_session/admin_create_session) מוודאים ש-room_id שייך
-- לקליניקה של הקורא *לפני* שהם מגיעים לכאן.
create or replace function session_slot_conflicts(
  p_room_id uuid,
  p_weekday int,
  p_start_time time,
  p_end_time time,
  p_horizon_days int,
  p_exclude_subscription_id uuid default null
) returns boolean as $$
declare
  v_conflict boolean;
  v_tz text;
begin
  select c.timezone into v_tz from rooms r join clinics c on c.id = r.clinic_id where r.id = p_room_id;
  v_tz := coalesce(v_tz, 'Asia/Jerusalem');

  select exists (
    select 1
    from generate_series(0, p_horizon_days - 1) as offset_days
    where extract(dow from (current_date + offset_days)) = p_weekday
      and (
        exists (
          select 1 from bookings b
          where b.room_id = p_room_id
            and b.status = 'confirmed'
            and tstzrange(b.starts_at, b.ends_at, '[)') && tstzrange(
              ((current_date + offset_days)::text || ' ' || p_start_time::text)::timestamp at time zone v_tz,
              ((current_date + offset_days)::text || ' ' || p_end_time::text)::timestamp at time zone v_tz,
              '[)'
            )
        )
        or exists (
          select 1 from room_blocks rb
          where rb.room_id = p_room_id
            and tstzrange(rb.starts_at, rb.ends_at, '[)') && tstzrange(
              ((current_date + offset_days)::text || ' ' || p_start_time::text)::timestamp at time zone v_tz,
              ((current_date + offset_days)::text || ' ' || p_end_time::text)::timestamp at time zone v_tz,
              '[)'
            )
        )
      )
  ) into v_conflict;

  if v_conflict then
    return true;
  end if;

  select exists (
    select 1
    from session_slots ss
    join session_subscriptions s on s.id = ss.subscription_id
    where ss.room_id = p_room_id
      and ss.weekday = p_weekday
      and ss.start_time < p_end_time
      and p_start_time < ss.end_time
      and (p_exclude_subscription_id is null or s.id <> p_exclude_subscription_id)
      and (
        s.status in ('active', 'pending_cancellation')
        or (s.status in ('requested', 'awaiting_payment') and s.hold_expires_at > now())
      )
  ) into v_conflict;

  return v_conflict;
end;
$$ language plpgsql stable set search_path = public;

-- ═══ בקשת ססיה חדשה — 🔴 בלי בדיקת זמינות (הבקשה תמיד מגיעה לאדמין, גם אם
-- המשבצת תפוסה — לא לחשוף מידע על מטפל/ת אחר/ת). approve_session כן בודק. ═══
create or replace function request_session(p_slots jsonb, p_start_date date default null)
returns table (subscription_id uuid, weekly_hours numeric, monthly_price numeric) as $$
declare
  v_uid uuid := auth.uid();
  v_clinic_id uuid;
  v_status user_status;
  v_sessions_enabled boolean;
  v_slot jsonb;
  v_weekly_hours numeric := 0;
  v_hold_hours numeric;
  v_base_price numeric;
  v_base_hours numeric;
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

  select (value#>>'{}')::numeric into v_base_hours
  from app_settings where clinic_id = v_clinic_id and key = 'session_base_hours';
  v_base_hours := coalesce(v_base_hours, 5);

  if v_weekly_hours <> v_base_hours then
    raise exception 'SESSION_HOURS_FIXED';
  end if;

  select (value#>>'{}')::numeric into v_hold_hours from app_settings where clinic_id = v_clinic_id and key = 'session_hold_hours';
  select (value#>>'{}')::numeric into v_base_price from app_settings where clinic_id = v_clinic_id and key = 'session_base_price';
  v_hold_hours := coalesce(v_hold_hours, 72);
  v_base_price := coalesce(v_base_price, 600);

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
$$ language plpgsql security definer set search_path = public;

-- ═══ אישור בקשת ססיה — אדמין בלבד. p_term_months: 1/3/6/12 או null (ללא הגבלה) ═══
create or replace function approve_session(p_subscription_id uuid, p_term_months integer default null)
returns void as $$
declare
  v_clinic_id uuid;
  v_sub session_subscriptions%rowtype;
  v_slot record;
  v_hold_hours numeric;
  v_effective_end date;
begin
  select clinic_id into v_clinic_id from profiles where id = auth.uid();
  if not is_admin() then
    raise exception 'FORBIDDEN';
  end if;
  if p_term_months is not null and p_term_months not in (1, 3, 6, 12) then
    raise exception 'INVALID_TERM';
  end if;

  select * into v_sub from session_subscriptions
  where id = p_subscription_id and clinic_id = v_clinic_id for update;
  if not found or v_sub.status <> 'requested' then
    raise exception 'FORBIDDEN';
  end if;

  for v_slot in select * from session_slots where subscription_id = p_subscription_id loop
    if session_slot_conflicts(
      v_slot.room_id, v_slot.weekday, v_slot.start_time, v_slot.end_time, 90, p_subscription_id
    ) then
      raise exception 'ROOM_TAKEN';
    end if;
  end loop;

  select (value#>>'{}')::numeric into v_hold_hours from app_settings where clinic_id = v_clinic_id and key = 'session_hold_hours';
  v_hold_hours := coalesce(v_hold_hours, 72);

  if p_term_months is not null then
    v_effective_end := coalesce(v_sub.start_date, current_date) + (p_term_months || ' months')::interval;
  end if;

  update session_subscriptions
  set status = 'awaiting_payment',
      reviewed_by = auth.uid(),
      reviewed_at = now(),
      hold_expires_at = now() + (v_hold_hours || ' hours')::interval,
      effective_end_date = coalesce(v_effective_end, effective_end_date)
  where id = p_subscription_id;

  insert into audit_log (clinic_id, actor_id, action, entity, entity_id, after)
  values (v_clinic_id, auth.uid(), 'session_approved', 'session_subscriptions', p_subscription_id,
          jsonb_build_object('term_months', p_term_months, 'effective_end_date', v_effective_end));
end;
$$ language plpgsql security definer set search_path = public;

create or replace function reject_session(p_subscription_id uuid, p_reason text)
returns void as $$
declare
  v_clinic_id uuid;
begin
  select clinic_id into v_clinic_id from profiles where id = auth.uid();
  if not is_admin() then
    raise exception 'FORBIDDEN';
  end if;

  update session_subscriptions
  set status = 'rejected', reviewed_by = auth.uid(), reviewed_at = now(), rejection_reason = p_reason
  where id = p_subscription_id and clinic_id = v_clinic_id and status = 'requested';
  if not found then
    raise exception 'FORBIDDEN';
  end if;

  insert into audit_log (clinic_id, actor_id, action, entity, entity_id, after)
  values (v_clinic_id, auth.uid(), 'session_rejected', 'session_subscriptions', p_subscription_id,
          jsonb_build_object('reason', p_reason));
end;
$$ language plpgsql security definer set search_path = public;

-- ═══ אדמין קובע ססיה חופשית — בלי בדיקת התנגשות, ישר ל-awaiting_payment ═══
-- (התשלום עצמו לא מדולג — אותו מסלול תשלום בדיוק, ר' baclinica-spec §6.4.1)
create or replace function admin_create_session(
  p_user_id uuid,
  p_slots jsonb,
  p_start_date date default null,
  p_term_months integer default null
)
returns table (subscription_id uuid, weekly_hours numeric, monthly_price numeric) as $$
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
  v_start_date date;
  v_effective_end date;
  v_sub_id uuid;
begin
  select clinic_id into v_clinic_id from profiles where id = auth.uid();
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

  select (value#>>'{}')::numeric into v_base_hours from app_settings where clinic_id = v_clinic_id and key = 'session_base_hours';
  v_base_hours := coalesce(v_base_hours, 5);
  if v_weekly_hours <> v_base_hours then
    raise exception 'SESSION_HOURS_FIXED';
  end if;

  select (value#>>'{}')::numeric into v_hold_hours from app_settings where clinic_id = v_clinic_id and key = 'session_hold_hours';
  select (value#>>'{}')::numeric into v_base_price from app_settings where clinic_id = v_clinic_id and key = 'session_base_price';
  v_hold_hours := coalesce(v_hold_hours, 72);
  v_base_price := coalesce(v_base_price, 600);

  insert into session_subscriptions (
    clinic_id, user_id, status, weekly_hours, monthly_price, start_date, hold_expires_at, reviewed_by, reviewed_at,
    effective_end_date
  )
  values (
    v_clinic_id, p_user_id, 'awaiting_payment', v_weekly_hours, v_base_price, v_start_date,
    now() + (v_hold_hours || ' hours')::interval, auth.uid(), now(), v_effective_end
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
  values (v_clinic_id, auth.uid(), 'session_created_by_admin', 'session_subscriptions', v_sub_id,
          jsonb_build_object('user_id', p_user_id, 'weekly_hours', v_weekly_hours, 'start_date', v_start_date,
                              'term_months', p_term_months, 'effective_end_date', v_effective_end));

  return query select v_sub_id, v_weekly_hours, v_base_price;
end;
$$ language plpgsql security definer set search_path = public;

-- ═══ אדמין: קליטת מנוי שכבר שולם מחוץ למערכת (מעבר מפלטפורמה קודמת) —
-- נכנס ישר ל-active, בלי תשלום ראשוני. חריג יחיד ומפורש, ר' CLAUDE.md
-- המקורי "חריגה יחידה ומפורשת: קליטה ממערכת קודמת". ═══
create or replace function admin_create_session_prepaid(
  p_user_id uuid,
  p_slots jsonb,
  p_start_date date default null,
  p_term_months integer default null
)
returns table (subscription_id uuid) as $$
declare
  v_clinic_id uuid;
  v_target_clinic uuid;
  v_status user_status;
  v_slot jsonb;
  v_weekly_hours numeric := 0;
  v_base_price numeric;
  v_base_hours numeric;
  v_start_date date;
  v_effective_end date;
  v_sub_id uuid;
begin
  select clinic_id into v_clinic_id from profiles where id = auth.uid();
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

  select (value#>>'{}')::numeric into v_base_hours from app_settings where clinic_id = v_clinic_id and key = 'session_base_hours';
  v_base_hours := coalesce(v_base_hours, 5);
  if v_weekly_hours <> v_base_hours then
    raise exception 'SESSION_HOURS_FIXED';
  end if;

  select (value#>>'{}')::numeric into v_base_price from app_settings where clinic_id = v_clinic_id and key = 'session_base_price';
  v_base_price := coalesce(v_base_price, 600);

  insert into session_subscriptions (
    clinic_id, user_id, status, weekly_hours, monthly_price, start_date, next_billing_date,
    reviewed_by, reviewed_at, effective_end_date
  )
  values (
    v_clinic_id, p_user_id, 'active', v_weekly_hours, v_base_price, v_start_date,
    v_start_date + interval '1 month', auth.uid(), now(), v_effective_end
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
  values (v_clinic_id, auth.uid(), 'session_created_prepaid', 'session_subscriptions', v_sub_id,
          jsonb_build_object('user_id', p_user_id, 'weekly_hours', v_weekly_hours, 'start_date', v_start_date,
                              'term_months', p_term_months, 'effective_end_date', v_effective_end,
                              'note', 'שולם מחוץ למערכת — בלי חיוב ראשוני'));

  return query select v_sub_id;
end;
$$ language plpgsql security definer set search_path = public;

-- ═══ מילוי bookings אמיתיים ממשבצות ססיה חוזרות, רולינג p_horizon_days ═══
-- clinic_id נגזר מהמנוי עצמו (לא מהקורא) — נקראת גם מ-cron per-clinic loop.
create or replace function materialize_subscription_bookings(p_subscription_id uuid, p_horizon_days int)
returns void as $$
declare
  v_sub session_subscriptions%rowtype;
  v_slot record;
  v_offset int;
  v_occ_date date;
  v_tz text;
  v_starts_at timestamptz;
  v_ends_at timestamptz;
  v_hours numeric;
begin
  perform assert_service_or_admin();

  select * into v_sub from session_subscriptions where id = p_subscription_id;
  if not found then
    return;
  end if;
  if v_sub.status not in ('active', 'pending_cancellation') then
    return;
  end if;

  select timezone into v_tz from clinics where id = v_sub.clinic_id;
  v_tz := coalesce(v_tz, 'Asia/Jerusalem');

  for v_slot in select * from session_slots where subscription_id = p_subscription_id loop
    v_hours := extract(epoch from (v_slot.end_time - v_slot.start_time)) / 3600;

    for v_offset in 0..(p_horizon_days - 1) loop
      v_occ_date := current_date + v_offset;
      if extract(dow from v_occ_date) <> v_slot.weekday then
        continue;
      end if;
      if v_sub.start_date is not null and v_occ_date < v_sub.start_date then
        continue;
      end if;
      if v_sub.effective_end_date is not null and v_occ_date > v_sub.effective_end_date then
        continue;
      end if;

      v_starts_at := (v_occ_date::text || ' ' || v_slot.start_time::text)::timestamp at time zone v_tz;
      v_ends_at := (v_occ_date::text || ' ' || v_slot.end_time::text)::timestamp at time zone v_tz;

      if exists (
        select 1 from bookings
        where subscription_id = p_subscription_id
          and room_id = v_slot.room_id
          and starts_at = v_starts_at
      ) then
        continue;
      end if;

      begin
        insert into bookings (clinic_id, user_id, room_id, source, subscription_id, starts_at, ends_at, hours_charged)
        values (v_sub.clinic_id, v_sub.user_id, v_slot.room_id, 'session', p_subscription_id, v_starts_at, v_ends_at, v_hours);
      exception when exclusion_violation then
        insert into audit_log (clinic_id, actor_id, action, entity, entity_id, after)
        values (v_sub.clinic_id, null, 'session_materialization_conflict', 'session_subscriptions', p_subscription_id,
                jsonb_build_object('room_id', v_slot.room_id, 'starts_at', v_starts_at, 'ends_at', v_ends_at));
      end;
    end loop;
  end loop;
end;
$$ language plpgsql security definer set search_path = public;

-- ═══ cron יומי (per-clinic loop, ר' app/api/cron) — רולינג 90 יום לכל המנויים הפעילים ═══
create or replace function materialize_session_bookings()
returns void as $$
declare
  v_sub record;
begin
  perform assert_service_or_admin();

  for v_sub in
    select id from session_subscriptions where status in ('active', 'pending_cancellation')
  loop
    perform materialize_subscription_bookings(v_sub.id, 90);
  end loop;
end;
$$ language plpgsql security definer set search_path = public;

-- ═══ יצירת/חידוש תשלום ססיה — יזום ע"י המטפל/ת או האדמין (לא cron, אין חיוב טוקן אוטומטי) ═══
create or replace function create_session_initial_payment(p_subscription_id uuid)
returns table (payment_id uuid, amount_total numeric) as $$
declare
  v_sub session_subscriptions%rowtype;
  v_vat_rate numeric;
  v_vat numeric;
  v_total numeric;
  v_payment_id uuid;
begin
  select * into v_sub from session_subscriptions where id = p_subscription_id;
  if not found then
    raise exception 'FORBIDDEN';
  end if;
  if v_sub.user_id <> auth.uid() and not is_admin() then
    raise exception 'FORBIDDEN';
  end if;
  if is_admin() and v_sub.clinic_id <> (select clinic_id from profiles where id = auth.uid()) then
    raise exception 'FORBIDDEN';
  end if;
  if v_sub.status <> 'awaiting_payment' then
    raise exception 'PAYMENT_REQUIRED';
  end if;

  select (value#>>'{}')::numeric into v_vat_rate from app_settings where clinic_id = v_sub.clinic_id and key = 'vat_rate';
  v_vat_rate := coalesce(v_vat_rate, 0.18);
  v_vat := round(v_sub.monthly_price * v_vat_rate, 2);
  v_total := v_sub.monthly_price + v_vat;

  insert into payments (clinic_id, user_id, type, status, amount_before_vat, vat_amount, amount_total, subscription_id)
  values (v_sub.clinic_id, v_sub.user_id, 'session_initial', 'pending', v_sub.monthly_price, v_vat, v_total, p_subscription_id)
  returning id into v_payment_id;

  return query select v_payment_id, v_total;
end;
$$ language plpgsql security definer set search_path = public;

create or replace function initiate_session_renewal_payment(p_subscription_id uuid)
returns table (payment_id uuid, amount_total numeric) as $$
declare
  v_sub session_subscriptions%rowtype;
  v_vat_rate numeric;
  v_vat numeric;
  v_total numeric;
  v_payment_id uuid;
begin
  select * into v_sub from session_subscriptions where id = p_subscription_id;
  if not found then
    raise exception 'FORBIDDEN';
  end if;
  if v_sub.user_id <> auth.uid() and not is_admin() then
    raise exception 'FORBIDDEN';
  end if;
  if is_admin() and v_sub.clinic_id <> (select clinic_id from profiles where id = auth.uid()) then
    raise exception 'FORBIDDEN';
  end if;
  if v_sub.status not in ('active', 'pending_cancellation', 'expired') then
    raise exception 'INVALID_SUBSCRIPTION_STATUS';
  end if;
  if v_sub.effective_end_date is not null and v_sub.effective_end_date < current_date then
    raise exception 'SESSION_TERM_ENDED';
  end if;

  select (value#>>'{}')::numeric into v_vat_rate from app_settings where clinic_id = v_sub.clinic_id and key = 'vat_rate';
  v_vat_rate := coalesce(v_vat_rate, 0.18);
  v_vat := round(v_sub.monthly_price * v_vat_rate, 2);
  v_total := v_sub.monthly_price + v_vat;

  insert into payments (clinic_id, user_id, type, status, amount_before_vat, vat_amount, amount_total, subscription_id)
  values (v_sub.clinic_id, v_sub.user_id, 'session_recurring', 'pending', v_sub.monthly_price, v_vat, v_total, p_subscription_id)
  returning id into v_payment_id;

  return query select v_payment_id, v_total;
end;
$$ language plpgsql security definer set search_path = public;

-- ═══ הפעלת ססיה בעקבות תשלום (webhook/admin) — אידמפוטנטי ═══
create or replace function activate_session_payment(
  p_payment_id uuid,
  p_transaction_uid text,
  p_method payment_method,
  p_token_uid text default null,
  p_card_last4 text default null,
  p_card_expiry text default null,
  p_invoice_url text default null
)
returns void as $$
declare
  v_payment payments%rowtype;
begin
  perform assert_service_or_admin();

  select * into v_payment from payments where id = p_payment_id for update;
  if not found then
    raise exception 'PAYMENT_NOT_FOUND';
  end if;
  if v_payment.status = 'paid' then
    return; -- אידמפוטנטיות
  end if;
  if v_payment.type <> 'session_initial' or v_payment.subscription_id is null then
    raise exception 'INVALID_PAYMENT_TYPE';
  end if;

  update payments
  set status = 'paid', method = p_method, payplus_transaction_uid = p_transaction_uid,
      invoice_url = coalesce(p_invoice_url, invoice_url), paid_at = now()
  where id = p_payment_id;

  if p_token_uid is not null then
    perform set_config('cleana.trusted_write', 'on', true);
    update profiles
    set payplus_token_uid = p_token_uid,
        card_last4 = coalesce(p_card_last4, card_last4),
        card_expiry = coalesce(p_card_expiry, card_expiry)
    where id = v_payment.user_id;
    perform set_config('cleana.trusted_write', 'off', true);
  end if;

  update session_subscriptions
  set status = 'active',
      start_date = coalesce(start_date, current_date),
      next_billing_date = coalesce(start_date, current_date) + interval '1 month'
  where id = v_payment.subscription_id;

  perform materialize_subscription_bookings(v_payment.subscription_id, 90);

  insert into audit_log (clinic_id, actor_id, action, entity, entity_id, after)
  values (v_payment.clinic_id, v_payment.user_id, 'session_activated', 'session_subscriptions', v_payment.subscription_id,
          jsonb_build_object('transaction_uid', p_transaction_uid));
end;
$$ language plpgsql security definer set search_path = public;

create or replace function admin_activate_session_cash_payment(
  p_payment_id uuid,
  p_method payment_method,
  p_transaction_uid text
) returns void as $$
declare
  v_clinic_id uuid;
  v_payment payments%rowtype;
begin
  select clinic_id into v_clinic_id from profiles where id = auth.uid();
  if not is_admin() then
    raise exception 'FORBIDDEN';
  end if;

  select * into v_payment from payments
  where id = p_payment_id and clinic_id = v_clinic_id for update;
  if not found then
    raise exception 'PAYMENT_NOT_FOUND';
  end if;
  if v_payment.status = 'paid' then
    return;
  end if;
  if v_payment.type <> 'session_initial' or v_payment.subscription_id is null then
    raise exception 'INVALID_PAYMENT_TYPE';
  end if;

  update payments
  set status = 'paid', method = p_method, payplus_transaction_uid = p_transaction_uid, paid_at = now()
  where id = p_payment_id;

  update session_subscriptions
  set status = 'active',
      start_date = coalesce(start_date, current_date),
      next_billing_date = coalesce(start_date, current_date) + interval '1 month'
  where id = v_payment.subscription_id;

  perform materialize_subscription_bookings(v_payment.subscription_id, 90);

  insert into audit_log (clinic_id, actor_id, action, entity, entity_id, after)
  values (v_clinic_id, auth.uid(), 'session_activated_manually', 'session_subscriptions', v_payment.subscription_id,
          jsonb_build_object('payment_id', p_payment_id, 'method', p_method, 'transaction_uid', p_transaction_uid));
end;
$$ language plpgsql security definer set search_path = public;

create or replace function finalize_session_renewal(
  p_payment_id uuid,
  p_success boolean,
  p_transaction_uid text default null,
  p_invoice_url text default null,
  p_reason text default null,
  p_method payment_method default null
)
returns void as $$
declare
  v_payment payments%rowtype;
  v_sub session_subscriptions%rowtype;
  v_new_billing_date date;
begin
  perform assert_service_or_admin();

  select * into v_payment from payments where id = p_payment_id for update;
  if not found or v_payment.type <> 'session_recurring' or v_payment.subscription_id is null then
    raise exception 'PAYMENT_NOT_FOUND';
  end if;
  if v_payment.status <> 'pending' then
    return; -- אידמפוטנטיות
  end if;

  select * into v_sub from session_subscriptions where id = v_payment.subscription_id for update;

  if p_success then
    update payments
    set status = 'paid', method = coalesce(p_method, method), payplus_transaction_uid = p_transaction_uid,
        invoice_url = coalesce(p_invoice_url, invoice_url), paid_at = now()
    where id = p_payment_id;

    if v_sub.next_billing_date is not null and v_sub.next_billing_date >= current_date then
      v_new_billing_date := v_sub.next_billing_date + interval '1 month';
    else
      v_new_billing_date := current_date + interval '1 month';
    end if;

    update session_subscriptions
    set status = 'active', next_billing_date = v_new_billing_date, renewal_reminder_sent_at = null
    where id = v_sub.id;

    perform materialize_subscription_bookings(v_sub.id, 90);

    insert into audit_log (clinic_id, actor_id, action, entity, entity_id, after)
    values (v_sub.clinic_id, v_sub.user_id, 'session_renewal_paid', 'payments', p_payment_id,
            jsonb_build_object('next_billing_date', v_new_billing_date));
  else
    update payments
    set status = 'failed', failure_reason = p_reason, retry_count = retry_count + 1
    where id = p_payment_id;

    insert into audit_log (clinic_id, actor_id, action, entity, entity_id, after)
    values (v_sub.clinic_id, v_sub.user_id, 'session_renewal_failed', 'payments', p_payment_id,
            jsonb_build_object('reason', p_reason));
  end if;
end;
$$ language plpgsql security definer set search_path = public;

create or replace function admin_mark_session_recurring_paid_cash(
  p_payment_id uuid,
  p_method payment_method,
  p_transaction_uid text
) returns void as $$
declare
  v_clinic_id uuid;
  v_payment payments%rowtype;
  v_sub session_subscriptions%rowtype;
  v_new_billing_date date;
begin
  select clinic_id into v_clinic_id from profiles where id = auth.uid();
  if not is_admin() then
    raise exception 'FORBIDDEN';
  end if;

  select * into v_payment from payments
  where id = p_payment_id and clinic_id = v_clinic_id for update;
  if not found then
    raise exception 'PAYMENT_NOT_FOUND';
  end if;
  if v_payment.status = 'paid' then
    return;
  end if;
  if v_payment.type <> 'session_recurring' or v_payment.subscription_id is null then
    raise exception 'INVALID_PAYMENT_TYPE';
  end if;

  select * into v_sub from session_subscriptions where id = v_payment.subscription_id for update;

  update payments
  set status = 'paid', method = p_method, payplus_transaction_uid = p_transaction_uid, paid_at = now()
  where id = p_payment_id;

  if v_sub.next_billing_date is not null and v_sub.next_billing_date >= current_date then
    v_new_billing_date := v_sub.next_billing_date + interval '1 month';
  else
    v_new_billing_date := current_date + interval '1 month';
  end if;

  update session_subscriptions
  set status = 'active', next_billing_date = v_new_billing_date, renewal_reminder_sent_at = null
  where id = v_sub.id;

  perform materialize_subscription_bookings(v_sub.id, 90);

  insert into audit_log (clinic_id, actor_id, action, entity, entity_id, after)
  values (v_clinic_id, auth.uid(), 'session_renewal_paid_manually', 'payments', p_payment_id,
          jsonb_build_object('transaction_uid', p_transaction_uid, 'next_billing_date', v_new_billing_date));
end;
$$ language plpgsql security definer set search_path = public;

-- ═══ בקשת ביטול מנוי — 30 יום מראש ═══
create or replace function request_subscription_cancellation(p_subscription_id uuid)
returns table (effective_end_date date) as $$
declare
  v_sub session_subscriptions%rowtype;
  v_notice_days numeric;
  v_effective date;
begin
  select * into v_sub from session_subscriptions
  where id = p_subscription_id and user_id = auth.uid() for update;
  if not found then
    raise exception 'FORBIDDEN';
  end if;
  if v_sub.status <> 'active' then
    raise exception 'FORBIDDEN';
  end if;

  select (value#>>'{}')::numeric into v_notice_days from app_settings where clinic_id = v_sub.clinic_id and key = 'sub_cancel_notice_days';
  v_notice_days := coalesce(v_notice_days, 30);

  v_effective := v_sub.next_billing_date;
  if v_effective < (current_date + (v_notice_days || ' days')::interval)::date then
    v_effective := (v_effective + interval '1 month')::date;
  end if;

  update session_subscriptions
  set status = 'pending_cancellation', cancel_requested_at = now(), effective_end_date = v_effective
  where id = p_subscription_id;

  insert into audit_log (clinic_id, actor_id, action, entity, entity_id, after)
  values (v_sub.clinic_id, auth.uid(), 'session_cancellation_requested', 'session_subscriptions', p_subscription_id,
          jsonb_build_object('effective_end_date', v_effective));

  return query select v_effective;
end;
$$ language plpgsql security definer set search_path = public;

-- ═══ אדמין: חידוש טווח התחייבות שנסגר ═══
create or replace function admin_renew_session_term(p_subscription_id uuid, p_term_months integer)
returns void as $$
declare
  v_clinic_id uuid;
  v_sub session_subscriptions%rowtype;
  v_new_end date;
begin
  select clinic_id into v_clinic_id from profiles where id = auth.uid();
  if not is_admin() then
    raise exception 'FORBIDDEN';
  end if;
  if p_term_months not in (1, 3, 6, 12) then
    raise exception 'INVALID_TERM';
  end if;

  select * into v_sub from session_subscriptions
  where id = p_subscription_id and clinic_id = v_clinic_id for update;
  if not found or v_sub.status not in ('active', 'expired') then
    raise exception 'FORBIDDEN';
  end if;

  v_new_end := current_date + (p_term_months || ' months')::interval;

  update session_subscriptions set effective_end_date = v_new_end where id = p_subscription_id;

  perform materialize_subscription_bookings(p_subscription_id, 90);

  insert into audit_log (clinic_id, actor_id, action, entity, entity_id, after)
  values (v_clinic_id, auth.uid(), 'session_term_renewed', 'session_subscriptions', p_subscription_id,
          jsonb_build_object('term_months', p_term_months, 'effective_end_date', v_new_end));
end;
$$ language plpgsql security definer set search_path = public;

-- ═══ אדמין: סיום ההתקשרות בתום הטווח ═══
create or replace function admin_end_session_term(p_subscription_id uuid)
returns void as $$
declare
  v_clinic_id uuid;
begin
  select clinic_id into v_clinic_id from profiles where id = auth.uid();
  if not is_admin() then
    raise exception 'FORBIDDEN';
  end if;

  update session_subscriptions
  set status = 'cancelled',
      effective_end_date = least(coalesce(effective_end_date, current_date), current_date)
  where id = p_subscription_id and clinic_id = v_clinic_id and status in ('active', 'expired');
  if not found then
    raise exception 'FORBIDDEN';
  end if;

  insert into audit_log (clinic_id, actor_id, action, entity, entity_id, after)
  values (v_clinic_id, auth.uid(), 'session_term_ended_by_admin', 'session_subscriptions', p_subscription_id, '{}'::jsonb);
end;
$$ language plpgsql security definer set search_path = public;

-- ═══ כל שעה — ניקוי holds פגי תוקף + סגירת ביטולים/פקיעות (כל הקליניקות יחד — תחזוקה גלובלית) ═══
create or replace function expire_session_holds_and_cancellations()
returns void as $$
begin
  perform assert_service_or_admin();

  update session_subscriptions
  set status = 'expired'
  where status in ('requested', 'awaiting_payment') and hold_expires_at < now();

  update session_subscriptions
  set status = 'cancelled'
  where status = 'pending_cancellation' and effective_end_date < current_date;

  update session_subscriptions
  set status = 'expired'
  where status = 'active' and next_billing_date < current_date;
end;
$$ language plpgsql security definer set search_path = public;
