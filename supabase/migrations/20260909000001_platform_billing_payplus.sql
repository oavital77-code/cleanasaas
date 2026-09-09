-- Cleana SaaS — תשלום הקליניקה לפלטפורמה דרך PayPlus (PROGRESS.md §5, החלטת
-- תמחור 8.9.2026: מסלול בתשלום אחד, ₪209/חודש כולל מע"מ, אחרי 30 ימי ניסיון).
--
-- העיקרון זהה ל-Cleana+: הכסף נכנס דרך דף תשלום מאוחסן של PayPlus עם הוראת
-- קבע; ה-callback לא נאמן — הקוד מאמת כל עסקה מול PayPlus (PaymentPages/ipn)
-- ורק אז קורא ל-platform_apply_payment. השורה ב-platform_payments ייחודית
-- לפי transaction_uid, כך שמסירה כפולה היא no-op; והמנוי משתנה רק כאן, בפונקציה
-- אחת, עם audit.
--
-- 🔴 platform_apply_payment ו-platform_billing_lifecycle הן service-role בלבד
-- (לא assert_service_or_admin): אדמין של קליניקה שיכול "להפעיל" תשלום לעצמו
-- הוא בדיוק החור שאסור לפתוח. השאר — is_admin() על הקליניקה שלו בלבד.

alter table platform_subscriptions
  add column if not exists current_period_start     timestamptz,
  add column if not exists cancel_at_period_end     boolean not null default false,
  -- אחרי חידוש שנכשל: הדשבורד פתוח עד כאן, ואז הקליניקה מושעית.
  add column if not exists grace_ends_at            timestamptz,
  -- הידית של PayPlus על הוראת הקבע — לשם נשלח ביטול.
  add column if not exists payplus_recurring_uid    text unique,
  add column if not exists payplus_customer_uid     text,
  -- דף התשלום האחרון שנפתח לקליניקה: מאפשר ל-callback למצוא אותה גם אם
  -- more_info לא חזר.
  add column if not exists pending_page_request_uid text;

create table if not exists platform_payments (
  id               uuid primary key default gen_random_uuid(),
  clinic_id        uuid not null references clinics(id) on delete cascade,
  provider         text not null default 'payplus',
  -- מזהה העסקה של PayPlus. ייחודי → callback חוזר לא עושה כלום.
  transaction_uid  text not null unique,
  page_request_uid text,
  recurring_uid    text,
  amount           numeric(10,2) not null,
  currency         text not null default 'ILS',
  status           text not null check (status in ('succeeded', 'failed', 'refunded')),
  status_code      text,
  paid_at          timestamptz,
  period_start     timestamptz,
  period_end       timestamptz,
  -- העסקה כפי ש-PayPlus החזירה אותה באימות, לביקורת.
  raw              jsonb,
  created_at       timestamptz not null default now()
);
create index if not exists platform_payments_clinic_created_idx on platform_payments (clinic_id, created_at desc);

alter table platform_payments enable row level security;
drop policy if exists read_own_platform_payments on platform_payments;
create policy read_own_platform_payments on platform_payments for select
  using (clinic_id = current_clinic_id() or is_superadmin());
-- כתיבה: service role בלבד (עוקף RLS), דרך platform_apply_payment.

-- ═══ 1. פתיחת דף תשלום — האדמין זוכר איזה דף נפתח לקליניקה שלו ═══
create or replace function platform_start_checkout(p_page_request_uid text)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_clinic_id uuid;
begin
  if not is_admin() then
    raise exception 'FORBIDDEN';
  end if;
  v_clinic_id := current_clinic_id();

  update platform_subscriptions
  set pending_page_request_uid = p_page_request_uid, updated_at = now()
  where clinic_id = v_clinic_id;
  if not found then
    raise exception 'FORBIDDEN';
  end if;

  insert into platform_audit_log (actor_id, action, clinic_id, after)
  values (app_user_id(), 'platform_checkout_started', v_clinic_id, jsonb_build_object('page_request_uid', p_page_request_uid));
end;
$$;

-- ═══ 2. עסקה שאומתה מול PayPlus — הפונקציה היחידה שמזיזה את המנוי ═══
-- מחזירה: activated | payment_failed | failed_ignored | duplicate |
--         unknown_clinic | amount_mismatch
create or replace function platform_apply_payment(
  p_clinic_id        uuid,
  p_transaction_uid  text,
  p_status_code      text,
  p_amount           numeric,
  p_expected_amount  numeric,
  p_page_request_uid text default null,
  p_recurring_uid    text default null,
  p_customer_uid     text default null,
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

  -- של מי התשלום: more_info נושא את clinic_id; דף התשלום שנפתח הוא הגיבוי;
  -- הוראת קבע קיימת — לחידושים.
  select * into v_sub from platform_subscriptions where clinic_id = p_clinic_id;
  if not found and p_page_request_uid is not null then
    select * into v_sub from platform_subscriptions where pending_page_request_uid = p_page_request_uid;
  end if;
  if not found and p_recurring_uid is not null then
    select * into v_sub from platform_subscriptions where payplus_recurring_uid = p_recurring_uid;
  end if;
  if v_sub.clinic_id is null then
    return 'unknown_clinic';
  end if;

  v_success   := p_status_code = '000';
  v_amount_ok := p_expected_amount is null or p_amount is null or abs(p_amount - p_expected_amount) < 0.01;

  insert into platform_payments
    (clinic_id, transaction_uid, page_request_uid, recurring_uid, amount, status, status_code, paid_at, period_start, period_end, raw)
  values
    (v_sub.clinic_id, p_transaction_uid, p_page_request_uid, p_recurring_uid, coalesce(p_amount, 0),
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
    -- כסף אמיתי נרשם, אבל לא בסכום של המנוי — לא פותח כלום.
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
        payplus_recurring_uid    = coalesce(p_recurring_uid, payplus_recurring_uid),
        payplus_customer_uid     = coalesce(p_customer_uid, payplus_customer_uid),
        external_payment_id      = p_transaction_uid,
        updated_at               = v_now
    where clinic_id = v_sub.clinic_id;

    -- קליניקה שהושעתה על תשלום חוזרת לחיים. השעיה ידנית של superadmin
    -- נראית אותו דבר בטבלה — זה מכוון: תשלום הוא תשובה גם לזה.
    -- clinics.status מוגן בטריגר (clinics_privilege_guard) — כמו signup_clinic,
    -- כותבים אותו רק תחת cleana.trusted_write.
    perform set_config('cleana.trusted_write', 'on', true);
    update clinics set status = 'active' where id = v_sub.clinic_id and status <> 'active';
    perform set_config('cleana.trusted_write', 'off', true);

    insert into platform_audit_log (action, clinic_id, before, after)
    values ('platform_payment_applied', v_sub.clinic_id,
            jsonb_build_object('plan', v_sub.plan, 'status', v_sub.status),
            jsonb_build_object('plan', 'pro', 'status', 'active', 'transaction_uid', p_transaction_uid, 'amount', p_amount));
    return 'activated';
  end if;

  -- חיוב שנכשל. בזמן ניסיון אין מה לשנות — עדיין לא שילמו. במנוי פעיל זה
  -- חידוש שנכשל: מתחיל חסד.
  if v_sub.status = 'active' then
    update platform_subscriptions
    set status = 'past_due',
        grace_ends_at = coalesce(v_sub.current_period_end, v_now) + interval '7 days',
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

-- ═══ 3. ביטול — נכנס לתוקף בסוף התקופה ששולמה ═══
-- הקוד עוצר את הוראת הקבע ב-PayPlus *לפני* שקורא לכאן; כאן רק מסמנים.
create or replace function platform_request_cancellation()
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_clinic_id uuid;
  v_sub platform_subscriptions%rowtype;
begin
  if not is_admin() then
    raise exception 'FORBIDDEN';
  end if;
  v_clinic_id := current_clinic_id();
  select * into v_sub from platform_subscriptions where clinic_id = v_clinic_id;
  if not found or v_sub.status <> 'active' or v_sub.cancel_at_period_end then
    raise exception 'SUBSCRIPTION_NOT_ACTIVE';
  end if;

  update platform_subscriptions
  set cancel_at_period_end = true, updated_at = now()
  where clinic_id = v_clinic_id;

  insert into platform_audit_log (actor_id, action, clinic_id, after)
  values (app_user_id(), 'platform_cancellation_requested', v_clinic_id,
          jsonb_build_object('period_end', v_sub.current_period_end));
end;
$$;

-- ═══ 4. cron יומי: ביטולים שהבשילו, חידושים שלא אושרו, חסד שנגמר ═══
-- הניסיון עצמו מטופל ב-expire_trial_subscriptions (קיים). כאן — מנויים
-- ששולמו: PayPlus מחייב ומדווח ל-callback; אם הדיווח לא הגיע יומיים אחרי
-- סוף התקופה, זה נחשב לא-שולם (חסד, ואז השעיה) — כדי ש-callback אבוד לא
-- יהיה שירות חינם לנצח. callback מאוחר מפעיל מחדש דרך platform_apply_payment.
create or replace function platform_billing_lifecycle()
returns table (canceled int, unconfirmed int, suspended int)
language plpgsql security definer set search_path = public
as $$
declare
  v_canceled int := 0;
  v_unconfirmed int := 0;
  v_suspended int := 0;
  r record;
begin
  if auth.role() <> 'service_role' then
    raise exception 'FORBIDDEN';
  end if;

  -- (א) ביטול שהתקופה שלו נגמרה
  for r in
    select clinic_id from platform_subscriptions
    where status = 'active' and cancel_at_period_end and current_period_end is not null and current_period_end <= now()
  loop
    update platform_subscriptions set status = 'canceled', updated_at = now() where clinic_id = r.clinic_id;
    perform set_config('cleana.trusted_write', 'on', true);
    update clinics set status = 'suspended' where id = r.clinic_id and status <> 'suspended';
    perform set_config('cleana.trusted_write', 'off', true);
    insert into platform_audit_log (action, clinic_id, after) values ('platform_subscription_ended', r.clinic_id, jsonb_build_object('reason', 'canceled'));
    v_canceled := v_canceled + 1;
  end loop;

  -- (ב) תקופה ששולמה נגמרה ואף חידוש לא אושר תוך יומיים
  for r in
    select clinic_id, current_period_end from platform_subscriptions
    where status = 'active' and not cancel_at_period_end
      and current_period_end is not null and current_period_end <= now() - interval '2 days'
  loop
    update platform_subscriptions
    set status = 'past_due', grace_ends_at = r.current_period_end + interval '7 days', updated_at = now()
    where clinic_id = r.clinic_id;
    insert into platform_audit_log (action, clinic_id, after) values ('platform_renewal_unconfirmed', r.clinic_id, jsonb_build_object('period_end', r.current_period_end));
    v_unconfirmed := v_unconfirmed + 1;
  end loop;

  -- (ג) חסד שנגמר → הקליניקה מושעית (הכניסה עובדת; הזמנות חדשות לא)
  for r in
    select ps.clinic_id from platform_subscriptions ps join clinics c on c.id = ps.clinic_id
    where ps.status = 'past_due' and ps.grace_ends_at is not null and ps.grace_ends_at <= now() and c.status <> 'suspended'
  loop
    perform set_config('cleana.trusted_write', 'on', true);
    update clinics set status = 'suspended' where id = r.clinic_id;
    perform set_config('cleana.trusted_write', 'off', true);
    insert into platform_audit_log (action, clinic_id, after) values ('platform_grace_ended', r.clinic_id, '{}'::jsonb);
    v_suspended := v_suspended + 1;
  end loop;

  return query select v_canceled, v_unconfirmed, v_suspended;
end;
$$;

-- ═══ הרשאות (לקח מ-20260907000001: revoke מפורש מ-anon על כל פונקציה חדשה) ═══
revoke execute on function
  platform_start_checkout(text),
  platform_request_cancellation()
from anon;

-- service-role בלבד: גם authenticated לא קורא לזה ישירות.
revoke execute on function
  platform_apply_payment(uuid, text, text, numeric, numeric, text, text, text, jsonb),
  platform_billing_lifecycle()
from anon, authenticated;
