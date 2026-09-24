-- תשלום שגבוה מהמחיר הנוכחי מפעיל את המנוי; רק תשלום נמוך ממנו נדחה.
--
-- המחיר ירד מ-209 ל-179 (24.9.2026). קליניקה שפתחה דף תשלום של PayPlus לפני
-- השינוי ושילמה אחריו הייתה מגיעה ל-platform_apply_payment עם 209 מול
-- expected 179, מקבלת 'amount_mismatch' — כלומר משלמת ולא מופעלת. הבדיקה
-- נועדה לחסום תשלום חסר (עסקה מזויפת של 5 ₪, ר' platform_billing_test.sql),
-- לא תשלום עודף, ולכן היא הופכת מ"שווה" ל"לפחות". תשלום חסר עדיין נרשם
-- ונדחה בדיוק כמו קודם.
--
-- הגוף הועתק מ-20260909000004 כפי שהוא; השורה היחידה ששונתה היא v_amount_ok.

create or replace function platform_apply_payment(
  p_clinic_id        uuid,
  p_transaction_uid  text,
  p_status_code      text,
  p_amount           numeric,
  p_expected_amount  numeric,
  p_page_request_uid text default null,
  p_token_uid        text default null,
  p_customer_uid     text default null,
  p_terminal_uid     text default null,
  p_cashier_uid      text default null,
  p_raw              jsonb default null
)
returns text
language plpgsql security definer set search_path = public
as $$
declare
  v_sub platform_subscriptions%rowtype;
  v_success boolean;
  v_amount_ok boolean;
  v_now timestamptz := now();
  v_inserted int;
begin
  if auth.role() <> 'service_role' then
    raise exception 'FORBIDDEN';
  end if;
  if p_transaction_uid is null or p_status_code is null then
    raise exception 'INVALID_TRANSACTION';
  end if;

  -- של מי התשלום: הקליניקה כשהקורא יודע (חיוב שאנחנו יזמנו); דף התשלום
  -- שנפתח לה (תשלום ראשון); הכרטיס השמור שלה.
  select * into v_sub from platform_subscriptions where clinic_id = p_clinic_id;
  if not found and p_page_request_uid is not null then
    select * into v_sub from platform_subscriptions where pending_page_request_uid = p_page_request_uid;
  end if;
  if not found and p_token_uid is not null then
    select * into v_sub from platform_subscriptions where payplus_token_uid = p_token_uid;
  end if;
  if v_sub.clinic_id is null then
    return 'unknown_clinic';
  end if;

  v_success   := p_status_code = '000';
  v_amount_ok := p_expected_amount is null or p_amount is null or p_amount >= p_expected_amount - 0.01;

  insert into platform_payments
    (clinic_id, transaction_uid, page_request_uid, amount, status, status_code, paid_at, period_start, period_end, raw)
  values
    (v_sub.clinic_id, p_transaction_uid, p_page_request_uid, coalesce(p_amount, 0),
     case when v_success then 'succeeded' else 'failed' end, p_status_code,
     case when v_success then v_now end,
     case when v_success and v_amount_ok then v_now end,
     case when v_success and v_amount_ok then v_now + interval '1 month' end,
     p_raw)
  on conflict (transaction_uid) do nothing;
  get diagnostics v_inserted = row_count;
  if v_inserted = 0 then
    return 'duplicate';
  end if;

  if v_success and not v_amount_ok then
    return 'amount_mismatch';
  end if;

  if v_success then
    update platform_subscriptions
    set plan                     = 'pro',
        status                   = 'active',
        current_period_start     = v_now,
        current_period_end       = v_now + interval '1 month',
        grace_ends_at            = null,
        pending_page_request_uid = null,
        cancel_at_period_end     = false,
        payplus_token_uid        = coalesce(p_token_uid, payplus_token_uid),
        payplus_customer_uid     = coalesce(p_customer_uid, payplus_customer_uid),
        payplus_terminal_uid     = coalesce(p_terminal_uid, payplus_terminal_uid),
        payplus_cashier_uid      = coalesce(p_cashier_uid, payplus_cashier_uid),
        external_payment_id      = p_transaction_uid,
        updated_at               = v_now
    where clinic_id = v_sub.clinic_id;

    perform set_config('cleana.trusted_write', 'on', true);
    update clinics set status = 'active' where id = v_sub.clinic_id and status <> 'active';
    perform set_config('cleana.trusted_write', 'off', true);

    insert into platform_audit_log (action, clinic_id, before, after)
    values ('platform_payment_applied', v_sub.clinic_id,
            jsonb_build_object('plan', v_sub.plan, 'status', v_sub.status),
            jsonb_build_object('plan', 'pro', 'status', 'active', 'transaction_uid', p_transaction_uid, 'amount', p_amount));
    return 'activated';
  end if;

  -- חיוב שנכשל. בזמן ניסיון אין מה לשנות. במנוי פעיל — חסד מתחיל; ניסיון
  -- חוזר שנכשל בתוך החסד משאיר את המועד במקומו.
  if v_sub.status in ('active', 'past_due') and v_sub.current_period_start is not null then
    update platform_subscriptions
    set status = 'past_due',
        grace_ends_at = coalesce(v_sub.grace_ends_at, coalesce(v_sub.current_period_end, v_now) + interval '7 days'),
        updated_at = v_now
    where clinic_id = v_sub.clinic_id;
    insert into platform_audit_log (action, clinic_id, before, after)
    values ('platform_payment_failed', v_sub.clinic_id,
            jsonb_build_object('status', v_sub.status),
            jsonb_build_object('status', 'past_due', 'transaction_uid', p_transaction_uid, 'status_code', p_status_code));
    return 'payment_failed';
  end if;
  return 'failed_ignored';
end;
$$;
