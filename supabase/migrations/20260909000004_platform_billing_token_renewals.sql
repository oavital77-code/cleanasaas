-- חידושים לפי טוקן במקום הוראת קבע של PayPlus.
--
-- ההחלטה (9.9.2026): מודול "הוראות קבע" של PayPlus אינו מופעל על המסוף (ודורש
-- הרשאה/עלות). במקום זה דף התשלום מחייב את החודש הראשון כחיוב רגיל ושומר את
-- הכרטיס כטוקן (create_token), וה-cron שלנו מחייב את הטוקן בסוף כל תקופה
-- (Transactions/Charge עם use_token). לחיוב כזה דרושים גם terminal_uid ו-
-- cashier_uid של החשבון — הם מגיעים ב-callback של התשלום הראשון ונשמרים כאן.
--
-- ה-DB נשאר מקור האמת: platform_apply_payment היא היחידה שמזיזה מנוי;
-- platform_claim_due_renewals "תופסת" שורות לחיוב (חותמת last_charge_attempt_at
-- בתוך אותה פקודה) כך ששתי ריצות cron חופפות לא יחייבו פעמיים.

alter table platform_subscriptions
  drop column if exists payplus_recurring_uid,
  add column if not exists payplus_token_uid       text,
  add column if not exists payplus_terminal_uid    text,
  add column if not exists payplus_cashier_uid     text,
  add column if not exists last_charge_attempt_at  timestamptz;

alter table platform_payments drop column if exists recurring_uid;

-- החתימה משתנה (token במקום recurring) — הישנה יורדת כדי שלא יישארו שתיים.
drop function if exists platform_apply_payment(uuid, text, text, numeric, numeric, text, text, text, jsonb);

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
  v_amount_ok := p_expected_amount is null or p_amount is null or abs(p_amount - p_expected_amount) < 0.01;

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

-- ═══ שורות שהגיע זמנן לחיוב — נתפסות ומוחזרות בפקודה אחת ═══
-- פעיל שתקופתו נגמרה, או בחסד אחרי חיוב שנכשל (ניסיון חוזר פעם ביום עד סוף
-- החסד). מי שאין לו כרטיס שמור מוחזר בכל זאת (עם null) כדי שהאפליקציה תדע
-- לספור אותו; רשת הביטחון של "חידוש שלא אושר" ב-lifecycle תופסת אותו.
create or replace function platform_claim_due_renewals(p_now timestamptz default now())
returns table (
  clinic_id uuid,
  token_uid text,
  customer_uid text,
  terminal_uid text,
  cashier_uid text
)
language plpgsql security definer set search_path = public
as $$
begin
  if auth.role() <> 'service_role' then
    raise exception 'FORBIDDEN';
  end if;
  return query
  update platform_subscriptions ps
  set last_charge_attempt_at = p_now, updated_at = p_now
  where ps.current_period_start is not null
    and ps.current_period_end is not null and ps.current_period_end <= p_now
    and not ps.cancel_at_period_end
    and (ps.last_charge_attempt_at is null or ps.last_charge_attempt_at <= p_now - interval '20 hours')
    and (ps.status = 'active'
         or (ps.status = 'past_due' and ps.grace_ends_at is not null and ps.grace_ends_at > p_now))
  returning ps.clinic_id, ps.payplus_token_uid, ps.payplus_customer_uid, ps.payplus_terminal_uid, ps.payplus_cashier_uid;
end;
$$;

-- הרשאות: revoke מ-public+anon (הלקח מ-20260909000002), grant מפורש ל-service בלבד.
revoke all on function
  platform_apply_payment(uuid, text, text, numeric, numeric, text, text, text, text, text, jsonb),
  platform_claim_due_renewals(timestamptz)
from public, anon, authenticated;
grant execute on function
  platform_apply_payment(uuid, text, text, numeric, numeric, text, text, text, text, text, jsonb),
  platform_claim_due_renewals(timestamptz)
to service_role;
