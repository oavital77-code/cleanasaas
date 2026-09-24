-- מצב ידני: בעל/ת הקליניקה רושם/ת תשלום על ססיה בפעולה אחת.
--
-- עד עכשיו ססיה שאושרה עברה ל-awaiting_payment וחיכתה לתשלום בחנות ה-Woo —
-- אבל approve_session לא יוצר שורת payments, create_session_initial_payment
-- ו-initiate_session_renewal_payment לא נקראו מאף מקום באפליקציה, והכפתור
-- "סימון כשולם" בעמוד התשלומים מוצג רק לשורת תשלום קיימת. כלומר ססיה שאושרה
-- לא יכלה להיות מסומנת כשולמה בממשק בכלל, וחידוש חודשי לא היה אפשרי.
--
-- הפונקציה הזו מרכיבה את הקיימות, בלי לוגיקה חדשה של תאריכים או סכומים:
--   awaiting_payment → create_session_initial_payment + admin_activate_session_cash_payment
--                      (פעיל; next_billing_date = התחלה + חודש; הזמנות ל-90 יום)
--   active / pending_cancellation / expired שהיה פעיל
--                    → initiate_session_renewal_payment + admin_mark_session_recurring_paid_cash
--                      (next_billing_date נדחה בחודש)
-- ססיה שפגה לפני שבכלל שולמה (הזמן להחזקת המשבצות עבר) לא מחודשת כאן —
-- המשבצות שלה כבר לא שמורות לה, ויוצרים ססיה חדשה.
create or replace function admin_record_session_payment(
  p_subscription_id uuid,
  p_method          payment_method,
  p_note            text default null
)
returns table (payment_id uuid, amount_total numeric, kind text)
language plpgsql security definer set search_path = public
as $$
declare
  v_clinic_id  uuid;
  v_sub        session_subscriptions%rowtype;
  v_payment_id uuid;
  v_total      numeric;
  v_kind       text;
  -- ייחודי (payments.payplus_transaction_uid unique), ומזוהה כרישום ידני.
  v_uid        text := 'manual-' || gen_random_uuid();
begin
  if not is_admin() then
    raise exception 'FORBIDDEN';
  end if;
  v_clinic_id := current_clinic_id();

  select * into v_sub from session_subscriptions
  where id = p_subscription_id and clinic_id = v_clinic_id
  for update;
  if not found then
    raise exception 'FORBIDDEN';
  end if;

  if v_sub.status = 'awaiting_payment' then
    select c.payment_id, c.amount_total into v_payment_id, v_total
    from create_session_initial_payment(p_subscription_id) c;
    perform admin_activate_session_cash_payment(v_payment_id, p_method, v_uid);
    v_kind := 'initial';
  elsif v_sub.status in ('active', 'pending_cancellation')
        or (v_sub.status = 'expired' and v_sub.next_billing_date is not null) then
    select r.payment_id, r.amount_total into v_payment_id, v_total
    from initiate_session_renewal_payment(p_subscription_id) r;
    perform admin_mark_session_recurring_paid_cash(v_payment_id, p_method, v_uid);
    v_kind := 'renewal';
  else
    raise exception 'INVALID_SUBSCRIPTION_STATUS';
  end if;

  insert into audit_log (clinic_id, actor_id, action, entity, entity_id, after)
  values (v_clinic_id, app_user_id(), 'session_payment_recorded', 'payments', v_payment_id,
          jsonb_build_object('kind', v_kind, 'method', p_method, 'amount_total', v_total,
                             'note', nullif(btrim(coalesce(p_note, '')), '')));

  return query select v_payment_id, v_total, v_kind;
end;
$$;

revoke all on function admin_record_session_payment(uuid, payment_method, text) from public, anon;
grant execute on function admin_record_session_payment(uuid, payment_method, text) to authenticated;
