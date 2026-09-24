-- ססיה בטווח גמיש (20260925000001): מינימום ומקסימום שעות שבועיות, מחיר לשעה.
-- קליניקה שלא שינתה כלום מתנהגת בדיוק כמו קודם (5 שעות, ₪600).
\set ON_ERROR_STOP on
begin;

set role authenticated;
select set_config('cleana.test_role', 'authenticated', true);
select set_config('request.jwt.claims', '{"sub":"user_range_owner"}', true);
select * from signup_clinic('Range Clinic', 'range-clinic', 'Owner R', '0500000021', 'range-owner@test.com');
select id as clinic_id into temp t_rc from clinics where slug = 'range-clinic';
select id as owner_id into temp t_ro from profiles where clinic_id = (select clinic_id from t_rc) and role = 'owner';

reset role;
update clinics set sessions_enabled = true where id = (select clinic_id from t_rc);
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"user_range_owner"}', true);
select * from create_branch('Main', 'Address');
select * from create_room((select id from branches where clinic_id = (select clinic_id from t_rc)), 'Room 1', array['talk']::room_type[]);
select id as room_id into temp t_rr from rooms where clinic_id = (select clinic_id from t_rc);

-- סלוט אחד ביום weekday בין start ל-end, כ-jsonb לפונקציות.
create temp table t_slot as select 1 as dummy;
create or replace function pg_temp.slots(p_weekday int, p_start text, p_end text) returns jsonb language sql as $$
  select jsonb_build_array(jsonb_build_object(
    'room_id', (select room_id from t_rr), 'weekday', p_weekday, 'start_time', p_start, 'end_time', p_end));
$$;

-- 1. בלי שינוי הגדרות: 5 שעות בדיוק, ₪600 — כמו לפני המיגרציה.
do $$ declare r record; v_msg text; begin
  select * into r from admin_create_session((select owner_id from t_ro), pg_temp.slots(1, '09:00', '14:00'));
  assert r.monthly_price = 600, 'untouched clinic: 5 hours still costs 600, got ' || r.monthly_price;
  begin
    perform admin_create_session((select owner_id from t_ro), pg_temp.slots(2, '09:00', '13:00'));
    v_msg := 'accepted';
  exception when others then v_msg := sqlerrm; end;
  assert v_msg = 'SESSION_HOURS_OUT_OF_RANGE', 'untouched clinic: 4 hours still refused, got ' || v_msg;
  raise notice 'untouched clinic behaves as before (5 hours, 600)';
end $$;

-- 2. הקליניקה פותחת טווח: 3–10 שעות, ₪120 לשעה שבועית.
insert into app_settings (clinic_id, key, value) values
  ((select clinic_id from t_rc), 'session_min_hours', '3'),
  ((select clinic_id from t_rc), 'session_max_hours', '10'),
  ((select clinic_id from t_rc), 'session_price_per_hour', '120')
on conflict (clinic_id, key) do update set value = excluded.value;

do $$ declare r record; v_msg text; begin
  -- 7 שעות → 7 × 120 = 840
  select * into r from admin_create_session((select owner_id from t_ro), pg_temp.slots(3, '09:00', '16:00'));
  assert r.weekly_hours = 7 and r.monthly_price = 840, 'seven hours at 120 = 840, got ' || r.monthly_price;
  -- 3.5 שעות — חצאי שעה מותרים, בקצה התחתון
  select * into r from admin_create_session((select owner_id from t_ro), pg_temp.slots(4, '09:00', '12:30'));
  assert r.monthly_price = 420, 'three and a half hours = 420, got ' || r.monthly_price;
  -- מתחת למינימום
  begin
    perform admin_create_session((select owner_id from t_ro), pg_temp.slots(5, '09:00', '11:00'));
    v_msg := 'accepted';
  exception when others then v_msg := sqlerrm; end;
  assert v_msg = 'SESSION_HOURS_OUT_OF_RANGE', 'two hours is under the minimum, got ' || v_msg;
  raise notice 'range 3–10 at 120/hour priced and enforced';
end $$;

-- 3. אותו כלל במסלול של המטפל/ת (request_session).
do $$ declare r record; begin
  select * into r from request_session(pg_temp.slots(0, '08:00', '14:00'));
  assert r.weekly_hours = 6 and r.monthly_price = 720, 'therapist request of six hours = 720, got ' || r.monthly_price;
  raise notice 'session range OK';
end $$;

reset role;
rollback;
