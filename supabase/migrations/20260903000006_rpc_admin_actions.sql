-- Cleana SaaS — פעולות אדמין: חריגות, לוח מלא, שיבוץ ידני (רב-דיירי)
-- ר' baclinica-spec.md §3.5, §6.8, §9.

create or replace function preview_overrun(p_booking_id uuid, p_minutes int)
returns table (
  hours numeric,
  price_per_hour numeric,
  amount numeric,
  deposit_available numeric,
  needs_charge boolean
) as $$
declare
  v_clinic_id uuid;
  v_booking bookings%rowtype;
  v_card punch_cards%rowtype;
  v_hours numeric;
  v_price numeric;
  v_amount numeric;
begin
  select clinic_id into v_clinic_id from profiles where id = auth.uid();
  if not is_admin() then
    raise exception 'FORBIDDEN';
  end if;

  select * into v_booking from bookings where id = p_booking_id and clinic_id = v_clinic_id;
  if not found then
    raise exception 'FORBIDDEN';
  end if;

  v_hours := ceil(greatest(p_minutes, 0)::numeric / 30) / 2;

  if v_booking.punch_card_id is not null then
    select * into v_card from punch_cards where id = v_booking.punch_card_id;
  else
    select * into v_card from punch_cards
    where user_id = v_booking.user_id and active order by expires_at asc limit 1;
  end if;

  if found then
    v_price := v_card.price_per_hour;
  else
    select punch_card_tiers.price_per_hour into v_price
    from punch_card_tiers where clinic_id = v_clinic_id and active order by punch_card_tiers.hours desc limit 1;
  end if;

  v_amount := v_hours * coalesce(v_price, 0);

  return query select
    v_hours, v_price, v_amount,
    coalesce(v_card.deposit_remaining, 0),
    coalesce(v_card.deposit_remaining, 0) < v_amount;
end;
$$ language plpgsql security definer stable set search_path = public;

-- ═══ רישום חריגה בפועל — ניכוי פיקדון מיידי, או payment ממתין (חיוב/מזומן ידני) ═══
create or replace function record_overrun(p_booking_id uuid, p_minutes int, p_note text)
returns table (overrun_id uuid, amount numeric, source overrun_source, payment_id uuid) as $$
declare
  v_clinic_id uuid;
  v_booking bookings%rowtype;
  v_card punch_cards%rowtype;
  v_hours numeric;
  v_price numeric;
  v_amount numeric;
  v_source overrun_source;
  v_payment_id uuid := null;
  v_vat_rate numeric;
  v_overrun_id uuid;
begin
  select clinic_id into v_clinic_id from profiles where id = auth.uid();
  if not is_admin() then
    raise exception 'FORBIDDEN';
  end if;
  if p_minutes is null or p_minutes <= 0 then
    raise exception 'INVALID_SLOT';
  end if;

  select * into v_booking from bookings where id = p_booking_id and clinic_id = v_clinic_id;
  if not found then
    raise exception 'FORBIDDEN';
  end if;

  v_hours := ceil(p_minutes::numeric / 30) / 2;

  if v_booking.punch_card_id is not null then
    select * into v_card from punch_cards where id = v_booking.punch_card_id for update;
  else
    select * into v_card from punch_cards
    where user_id = v_booking.user_id and active order by expires_at asc limit 1 for update;
  end if;

  if found then
    v_price := v_card.price_per_hour;
  else
    select price_per_hour into v_price from punch_card_tiers
    where clinic_id = v_clinic_id and active order by hours desc limit 1;
  end if;

  v_amount := v_hours * coalesce(v_price, 0);

  if found and v_card.deposit_remaining >= v_amount then
    update punch_cards set deposit_remaining = deposit_remaining - v_amount where id = v_card.id;
    v_source := 'deposit';
  else
    v_source := 'charge';
    select (value#>>'{}')::numeric into v_vat_rate from app_settings where clinic_id = v_clinic_id and key = 'vat_rate';
    v_vat_rate := coalesce(v_vat_rate, 0.18);

    insert into payments (clinic_id, user_id, type, status, amount_before_vat, vat_amount, amount_total)
    values (
      v_clinic_id, v_booking.user_id, 'overrun', 'pending',
      v_amount, round(v_amount * v_vat_rate, 2), v_amount + round(v_amount * v_vat_rate, 2)
    )
    returning id into v_payment_id;
  end if;

  insert into overrun_charges (clinic_id, user_id, booking_id, minutes, hours_charged, amount, source, payment_id, recorded_by, note)
  values (v_clinic_id, v_booking.user_id, p_booking_id, p_minutes, v_hours, v_amount, v_source, v_payment_id, auth.uid(), p_note)
  returning id into v_overrun_id;

  insert into audit_log (clinic_id, actor_id, action, entity, entity_id, after)
  values (v_clinic_id, auth.uid(), 'overrun_recorded', 'overrun_charges', v_overrun_id,
          jsonb_build_object('amount', v_amount, 'source', v_source));

  return query select v_overrun_id, v_amount, v_source, v_payment_id;
end;
$$ language plpgsql security definer set search_path = public;

-- ═══ סגירת חיוב חריגה (כשאין פיקדון) — הצלחה=שולם, כישלון=משעה (כמו כישלון חידוש) ═══
create or replace function finalize_overrun_charge(
  p_payment_id uuid,
  p_success boolean,
  p_transaction_uid text default null,
  p_reason text default null
)
returns void as $$
declare
  v_payment payments%rowtype;
begin
  perform assert_service_or_admin();

  select * into v_payment from payments where id = p_payment_id for update;
  if not found or v_payment.type <> 'overrun' then
    raise exception 'PAYMENT_NOT_FOUND';
  end if;
  if v_payment.status <> 'pending' then
    return; -- אידמפוטנטיות
  end if;

  if p_success then
    update payments
    set status = 'paid', payplus_transaction_uid = p_transaction_uid, paid_at = now()
    where id = p_payment_id;

    insert into audit_log (clinic_id, actor_id, action, entity, entity_id, after)
    values (v_payment.clinic_id, v_payment.user_id, 'overrun_charge_succeeded', 'payments', p_payment_id, '{}'::jsonb);
  else
    update payments set status = 'failed', failure_reason = p_reason where id = p_payment_id;

    perform set_config('cleana.trusted_write', 'on', true);
    update profiles set status = 'suspended' where id = v_payment.user_id;
    perform set_config('cleana.trusted_write', 'off', true);

    insert into audit_log (clinic_id, actor_id, action, entity, entity_id, after)
    values (v_payment.clinic_id, v_payment.user_id, 'overrun_charge_failed_suspended', 'payments', p_payment_id,
            jsonb_build_object('reason', p_reason));
  end if;
end;
$$ language plpgsql security definer set search_path = public;

-- ═══ ביטול הזמנה ע"י אדמין — עובד גם על הזמנות ססיה (חריג ידני) ═══
create or replace function admin_cancel_booking(p_booking_id uuid, p_refund_hours boolean default false)
returns void as $$
declare
  v_clinic_id uuid;
  v_booking bookings%rowtype;
begin
  select clinic_id into v_clinic_id from profiles where id = auth.uid();
  if not is_admin() then
    raise exception 'FORBIDDEN';
  end if;

  select * into v_booking from bookings where id = p_booking_id and clinic_id = v_clinic_id for update;
  if not found or v_booking.status <> 'confirmed' then
    raise exception 'BOOKING_PASSED';
  end if;

  if p_refund_hours and v_booking.punch_card_id is not null then
    update punch_cards
    set hours_remaining = hours_remaining + v_booking.hours_charged
    where id = v_booking.punch_card_id;
  end if;

  update bookings
  set status = 'cancelled_by_admin',
      cancelled_at = now(),
      cancelled_by = auth.uid(),
      hours_refunded = p_refund_hours
  where id = p_booking_id;

  insert into audit_log (clinic_id, actor_id, action, entity, entity_id, after)
  values (v_clinic_id, auth.uid(), 'booking_cancelled_by_admin', 'bookings', p_booking_id,
          jsonb_build_object('hours_refunded', p_refund_hours));
end;
$$ language plpgsql security definer set search_path = public;

-- ═══ שיבוץ ידני ע"י אדמין — ללא חיוב כרטיסייה (source='admin_comp') ═══
create or replace function admin_create_booking(
  p_user_id uuid,
  p_room_id uuid,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_note text default null
)
returns table (booking_id uuid) as $$
declare
  v_clinic_id uuid;
  v_target_clinic uuid;
  v_room_active boolean;
  v_room_clinic uuid;
  v_booking_id uuid;
begin
  select clinic_id into v_clinic_id from profiles where id = auth.uid();
  if not is_admin() then
    raise exception 'FORBIDDEN';
  end if;
  if p_ends_at <= p_starts_at then
    raise exception 'INVALID_SLOT';
  end if;

  select clinic_id into v_target_clinic from profiles where id = p_user_id;
  if v_target_clinic is null or v_target_clinic <> v_clinic_id then
    raise exception 'FORBIDDEN';
  end if;

  select active, clinic_id into v_room_active, v_room_clinic from rooms where id = p_room_id;
  if v_room_clinic is null or v_room_clinic <> v_clinic_id or not v_room_active then
    raise exception 'ROOM_UNAVAILABLE';
  end if;

  begin
    insert into bookings (clinic_id, user_id, room_id, source, starts_at, ends_at, hours_charged, admin_note)
    values (v_clinic_id, p_user_id, p_room_id, 'admin_comp', p_starts_at, p_ends_at,
            extract(epoch from (p_ends_at - p_starts_at)) / 3600, p_note)
    returning id into v_booking_id;
  exception when exclusion_violation then
    raise exception 'ROOM_TAKEN';
  end;

  insert into audit_log (clinic_id, actor_id, action, entity, entity_id, after)
  values (v_clinic_id, auth.uid(), 'booking_created_by_admin', 'bookings', v_booking_id,
          jsonb_build_object('user_id', p_user_id, 'room_id', p_room_id));

  return query select v_booking_id;
end;
$$ language plpgsql security definer set search_path = public;
