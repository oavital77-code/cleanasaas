-- מצב ידני: בעל/ת הקליניקה רושם/ת תשלום על ססיה (20260924000002).
-- ססיה שאושרה חייבת להיות ניתנת לסימון כשולמה, חידוש חודשי חייב לדחות את
-- מועד החיוב, וקליניקה אחרת לא יכולה לגעת בזה. רץ בתוך begin...rollback.
\set ON_ERROR_STOP on
begin;

set role authenticated;
select set_config('cleana.test_role', 'authenticated', true);

select set_config('request.jwt.claims', '{"sub":"user_sess_owner"}', true);
select * from signup_clinic('Session Clinic', 'session-clinic', 'Owner S', '0500000011', 'sess-owner@test.com');
select id as clinic_id into temp t_sc from clinics where slug = 'session-clinic';
select id as owner_id into temp t_so from profiles where clinic_id = (select clinic_id from t_sc) and role = 'owner';

select set_config('request.jwt.claims', '{"sub":"user_other_owner"}', true);
select * from signup_clinic('Other Clinic', 'other-clinic', 'Owner O', '0500000012', 'other-owner@test.com');

-- הפעלת ססיות לקליניקה — כמו המתג בהגדרות.
reset role;
update clinics set sessions_enabled = true where id = (select clinic_id from t_sc);
set role authenticated;

select set_config('request.jwt.claims', '{"sub":"user_sess_owner"}', true);
select * from create_branch('Main', 'Address');
select * from create_room((select id from branches where clinic_id = (select clinic_id from t_sc)), 'Room 1', array['talk']::room_type[]);

-- ססיה של 5 שעות שבועיות (ברירת המחדל), שנוצרה ע"י האדמין — ממתינה לתשלום.
select subscription_id as sub_id into temp t_sub from admin_create_session(
  (select owner_id from t_so),
  jsonb_build_array(jsonb_build_object(
    'room_id', (select id from rooms where clinic_id = (select clinic_id from t_sc)),
    'weekday', 1, 'start_time', '09:00', 'end_time', '14:00'))
);
do $$ begin
  assert (select status from session_subscriptions where id = (select sub_id from t_sub)) = 'awaiting_payment', 'starts awaiting payment';
end $$;

-- 🔴 קליניקה אחרת לא רושמת תשלום על ססיה שאינה שלה.
select set_config('request.jwt.claims', '{"sub":"user_other_owner"}', true);
do $$ declare v_failed boolean := false; begin
  begin
    perform admin_record_session_payment((select sub_id from t_sub), 'cash');
  exception when others then v_failed := true; end;
  assert v_failed, 'SECURITY BUG: another clinic recorded a payment on this session';
end $$;

-- תשלום ראשון: הססיה נפתחת.
select set_config('request.jwt.claims', '{"sub":"user_sess_owner"}', true);
do $$ declare r record; s session_subscriptions%rowtype; begin
  select * into r from admin_record_session_payment((select sub_id from t_sub), 'bit', 'שולם בביט');
  assert r.kind = 'initial', 'first payment is the initial one, got ' || r.kind;
  assert r.amount_total = 708, 'amount is the monthly price with VAT (600 + 18%), got ' || r.amount_total;
  select * into s from session_subscriptions where id = (select sub_id from t_sub);
  assert s.status = 'active', 'session active after payment, got ' || s.status;
  assert s.next_billing_date = s.start_date + interval '1 month', 'next billing a month after start';
  assert (select method from payments where id = r.payment_id) = 'bit', 'method recorded';
  assert (select status from payments where id = r.payment_id) = 'paid', 'payment paid';
  raise notice 'initial session payment recorded and activated';
end $$;

-- תשלום חודשי: המועד הבא נדחה בחודש.
do $$ declare r record; v_before date; v_after date; begin
  select next_billing_date into v_before from session_subscriptions where id = (select sub_id from t_sub);
  select * into r from admin_record_session_payment((select sub_id from t_sub), 'other');
  assert r.kind = 'renewal', 'second payment is a renewal, got ' || r.kind;
  select next_billing_date into v_after from session_subscriptions where id = (select sub_id from t_sub);
  assert v_after = v_before + interval '1 month', 'renewal pushes the billing date a month';
  assert (select count(*) from payments where subscription_id = (select sub_id from t_sub) and status = 'paid') = 2, 'two paid payments';
  raise notice 'monthly renewal recorded, billing date moved a month';
end $$;

-- ססיה שהחזקת המשבצות שלה פגה בלי תשלום — לא "מחודשת" דרך כאן.
reset role;
update session_subscriptions set status = 'expired', next_billing_date = null where id = (select sub_id from t_sub);
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"user_sess_owner"}', true);
do $$ declare v_msg text; begin
  begin
    perform admin_record_session_payment((select sub_id from t_sub), 'cash');
    raise exception 'expected a refusal';
  exception when others then v_msg := sqlerrm; end;
  assert v_msg = 'INVALID_SUBSCRIPTION_STATUS', 'a never-paid expired session is refused, got ' || v_msg;
  raise notice 'session payment OK';
end $$;

reset role;
rollback;
