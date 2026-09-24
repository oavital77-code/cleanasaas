-- תשלום הקליניקה לפלטפורמה (מיגרציה 20260909000001): אידמפוטנטיות, הפעלה,
-- חידוש שנכשל, ביטול, ומחזור החיים היומי. רץ בתוך begin...rollback.
\set ON_ERROR_STOP on
begin;

-- זהות Clerk: app_user_id() ממפה את ה-sub של ה-JWT ל-profiles.clerk_user_id
set role authenticated;
select set_config('cleana.test_role', 'authenticated', true);
select set_config('request.jwt.claims', '{"sub":"user_billing_owner"}', true);
select * from signup_clinic('Billing Clinic', 'billing-clinic', 'Owner', '0500000009', 'billing-owner@test.com');
select id as clinic_id into temp t_c from clinics where slug = 'billing-clinic';

-- 1. האדמין פותח דף תשלום
select platform_start_checkout('req_1');
do $$ begin
  assert (select pending_page_request_uid from platform_subscriptions where clinic_id = (select clinic_id from t_c)) = 'req_1', 'pending uid stored';
end $$;

-- 2. אדמין לא יכול "להפעיל" תשלום בעצמו
do $$ declare v_failed boolean := false; begin
  begin
    perform platform_apply_payment((select clinic_id from t_c), 'tx_forged', '000', 209, 209);
  exception when others then v_failed := true; end;
  assert v_failed, 'admin must not apply payments';
end $$;

-- 3. הקליניקה מושעית (כמו אחרי ניסיון שפג), ואז callback מאומת מפעיל אותה
reset role;
select set_config('cleana.trusted_write', 'on', true);
update clinics set status = 'suspended' where id = (select clinic_id from t_c);
select set_config('cleana.trusted_write', 'off', true);
update platform_subscriptions set status = 'past_due' where clinic_id = (select clinic_id from t_c);
select set_config('cleana.test_role', 'service_role', true);
select set_config('request.jwt.claims', '', true);

do $$ declare r text; begin
  r := platform_apply_payment(null, 'tx_1', '000', 209, 209, 'req_1', 'tok_1', 'cus_1', 'term_1', 'cash_1', '{"data":{"ok":true}}'::jsonb);
  assert r = 'activated', 'first payment activates (found by the pending page), got ' || r;
  r := platform_apply_payment((select clinic_id from t_c), 'tx_1', '000', 209, 209, 'req_1', 'tok_1');
  assert r = 'duplicate', 'same transaction twice is a no-op, got ' || r;
end $$;
do $$ declare s platform_subscriptions%rowtype; c clinics%rowtype; begin
  select * into s from platform_subscriptions where clinic_id = (select clinic_id from t_c);
  select * into c from clinics where id = (select clinic_id from t_c);
  assert s.status = 'active' and s.plan = 'pro', 'active pro';
  assert s.current_period_end > now() + interval '27 days', 'a month ahead';
  assert s.payplus_token_uid = 'tok_1' and s.payplus_customer_uid = 'cus_1' and s.payplus_terminal_uid = 'term_1' and s.payplus_cashier_uid = 'cash_1', 'card + account ids stored';
  assert s.pending_page_request_uid is null and s.grace_ends_at is null, 'pending cleared';
  assert c.status = 'active', 'clinic un-suspended';
  assert (select count(*) from platform_payments where clinic_id = s.clinic_id) = 1, 'one payment row';
end $$;

-- 4. סכום שגוי: נרשם, לא פותח כלום; קליניקה לא ידועה: מתעלמים
do $$ declare r text; begin
  r := platform_apply_payment(null, 'tx_wrong', '000', 5, 209, null, 'tok_1');
  assert r = 'amount_mismatch', 'wrong amount, got ' || r;
  -- מחיר ירד (209 → 179) בזמן שדף תשלום במחיר הישן היה פתוח: מי ששילם יותר
  -- מופעל. רק תשלום חסר נדחה (20260924000001).
  r := platform_apply_payment((select clinic_id from t_c), 'tx_old_price', '000', 209, 179);
  assert r = 'activated', 'paying the old, higher price still activates, got ' || r;
  r := platform_apply_payment((select clinic_id from t_c), 'tx_under', '000', 150, 179);
  assert r = 'amount_mismatch', 'paying less than the price is still refused, got ' || r;
  r := platform_apply_payment('00000000-0000-0000-0000-000000000000', 'tx_nobody', '000', 209, 209);
  assert r = 'unknown_clinic', 'unknown clinic, got ' || r;
end $$;

-- 5. חידוש שנכשל → חסד; חידוש מאוחר מרפא
do $$ declare r text; s platform_subscriptions%rowtype; begin
  r := platform_apply_payment(null, 'tx_fail', '004', 209, 209, null, 'tok_1');
  assert r = 'payment_failed', 'failed renewal (found by token), got ' || r;
  select * into s from platform_subscriptions where clinic_id = (select clinic_id from t_c);
  assert s.status = 'past_due' and s.grace_ends_at is not null, 'grace started';
  -- ניסיון חוזר שנכשל בתוך החסד: המועד לא זז
  r := platform_apply_payment((select clinic_id from t_c), 'tx_fail2', '004', 209, 209);
  assert r = 'payment_failed', 'retry failed, got ' || r;
  assert (select grace_ends_at from platform_subscriptions where clinic_id = (select clinic_id from t_c)) = s.grace_ends_at, 'grace deadline unchanged';
  r := platform_apply_payment((select clinic_id from t_c), 'tx_late', '000', 209, 209);
  assert r = 'activated', 'late renewal heals, got ' || r;
  select * into s from platform_subscriptions where clinic_id = (select clinic_id from t_c);
  assert s.status = 'active' and s.grace_ends_at is null, 'active again';
end $$;

-- 5b. תפיסת חידושים: פעיל שתקופתו נגמרה נתפס פעם אחת ב-20 שעות; מבוטל לא
reset role;
update platform_subscriptions set current_period_end = now() - interval '1 hour', last_charge_attempt_at = null where clinic_id = (select clinic_id from t_c);
select set_config('cleana.test_role', 'service_role', true);
do $$ declare n int; r record; begin
  select count(*) into n from platform_claim_due_renewals(now()) d where d.clinic_id = (select clinic_id from t_c);
  assert n = 1, 'due row claimed once, got ' || n;
  select * into r from platform_subscriptions where clinic_id = (select clinic_id from t_c);
  assert r.last_charge_attempt_at is not null, 'attempt stamped';
  select count(*) into n from platform_claim_due_renewals(now()) d where d.clinic_id = (select clinic_id from t_c);
  assert n = 0, 'not claimed twice the same day, got ' || n;
  select count(*) into n from platform_claim_due_renewals(now() + interval '1 day') d where d.clinic_id = (select clinic_id from t_c);
  assert n = 1, 'claimed again next day, got ' || n;
  -- הטוקן והמזהים שנשמרו חוזרים עם השורה
  select d.token_uid, d.terminal_uid into r from platform_claim_due_renewals(now() + interval '2 days') d where d.clinic_id = (select clinic_id from t_c);
  assert r.token_uid = 'tok_1' and r.terminal_uid = 'term_1', 'token and terminal returned';
end $$;
reset role;
update platform_subscriptions set current_period_end = now() + interval '20 days', last_charge_attempt_at = null where clinic_id = (select clinic_id from t_c);
select set_config('cleana.test_role', 'authenticated', true);
do $$ declare v_failed boolean := false; begin
  begin perform platform_claim_due_renewals(now()); exception when others then v_failed := true; end;
  assert v_failed, 'admin must not claim renewals';
end $$;

-- 6. ביטול ע"י האדמין → בתוקף בסוף התקופה; ה-cron סוגר
select set_config('cleana.test_role', 'authenticated', true);
select set_config('request.jwt.claims', '{"sub":"user_billing_owner"}', true);
select platform_request_cancellation();
do $$ declare s platform_subscriptions%rowtype; begin
  select * into s from platform_subscriptions where clinic_id = (select clinic_id from t_c);
  assert s.status = 'active' and s.cancel_at_period_end, 'flagged, still active';
end $$;
reset role;
update platform_subscriptions set current_period_end = now() - interval '1 hour' where clinic_id = (select clinic_id from t_c);
select set_config('cleana.test_role', 'service_role', true);
select set_config('request.jwt.claims', '', true);
do $$ declare c int; u int; s int; begin
  select * into c, u, s from platform_billing_lifecycle();
  assert c = 1 and u = 0 and s = 0, format('lifecycle canceled=%s unconfirmed=%s suspended=%s', c, u, s);
  assert (select status from platform_subscriptions where clinic_id = (select clinic_id from t_c)) = 'canceled', 'canceled';
  assert (select status from clinics where id = (select clinic_id from t_c)) = 'suspended', 'clinic suspended after cancellation';
end $$;

-- 7. חידוש שלא אושר: יומיים אחרי סוף התקופה → חסד; 7 ימים אחר כך → השעיה
reset role;
select set_config('cleana.trusted_write', 'on', true);
update clinics set status = 'active' where id = (select clinic_id from t_c);
select set_config('cleana.trusted_write', 'off', true);
update platform_subscriptions set status = 'active', cancel_at_period_end = false, grace_ends_at = null,
  current_period_end = now() - interval '3 days' where clinic_id = (select clinic_id from t_c);
select set_config('cleana.test_role', 'service_role', true);
do $$ declare c int; u int; s int; begin
  select * into c, u, s from platform_billing_lifecycle();
  assert u = 1, 'unconfirmed renewal caught';
  assert (select status from platform_subscriptions where clinic_id = (select clinic_id from t_c)) = 'past_due', 'past_due';
  assert (select status from clinics where id = (select clinic_id from t_c)) = 'active', 'still active during grace';
  select * into c, u, s from platform_billing_lifecycle();
  assert u = 0 and s = 0, 'idempotent while grace runs';
end $$;
reset role;
update platform_subscriptions set grace_ends_at = now() - interval '1 hour' where clinic_id = (select clinic_id from t_c);
select set_config('cleana.test_role', 'service_role', true);
do $$ declare c int; u int; s int; begin
  select * into c, u, s from platform_billing_lifecycle();
  assert s = 1, 'grace over → suspended';
  assert (select status from clinics where id = (select clinic_id from t_c)) = 'suspended', 'clinic suspended';
end $$;

do $$ begin raise notice 'platform billing OK'; end $$;
rollback;
