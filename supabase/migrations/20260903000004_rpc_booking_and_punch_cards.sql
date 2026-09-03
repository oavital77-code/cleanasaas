-- Cleana SaaS — RPCs קריטיים: מנוע הזמנות + כרטיסיות (SAASMIGRATIONSPEC §3, סעיף 1)
--
-- 🔴 בכל פונקציה: v_clinic_id נגזר תמיד מ-profiles של auth.uid() — אף פעם
-- לא מתקבל כפרמטר. וכל UUID שמגיע כפרמטר מהלקוח (room_id, tier_id וכו')
-- מאומת שהוא שייך לאותה קליניקה בדיוק לפני שמשתמשים בו — אחרת לקוח (או באג)
-- יכול להעביר room_id של קליניקה אחרת ו"להזמין" שם חדר.

create or replace function create_booking(
  p_room_id uuid,
  p_starts_at timestamptz,
  p_ends_at timestamptz
)
returns table (
  booking_id uuid,
  hours_charged numeric,
  hours_remaining numeric
) as $$
declare
  v_uid uuid := auth.uid();
  v_clinic_id uuid;
  v_status user_status;
  v_hours numeric;
  v_horizon_days int;
  v_room_active boolean;
  v_room_clinic uuid;
  v_card punch_cards%rowtype;
  v_has_hours boolean;
  v_booking_id uuid;
  v_is_retroactive boolean;
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
  -- Trial שפג/לא שולם → קליניקה מושעית: לוגין עדיין עובד, אבל בלי הזמנות
  -- חדשות (SAASMIGRATIONSPEC §7).
  if exists (select 1 from clinics where id = v_clinic_id and status = 'suspended') then
    raise exception 'CLINIC_SUSPENDED';
  end if;

  -- ולידציות זמן (baclinica-spec.md §3.7 — נשאר נכון כמו שהוא)
  if extract(epoch from p_starts_at)::bigint % 1800 <> 0 then
    raise exception 'INVALID_SLOT';
  end if;
  if p_ends_at <= p_starts_at
     or p_ends_at - p_starts_at < interval '30 minutes'
     or p_ends_at - p_starts_at > interval '8 hours' then
    raise exception 'INVALID_SLOT';
  end if;
  -- הזמנה רטרואקטיבית (כרטיסייה בלבד) — עד 30 יום אחורה, ר' CLAUDE.md המקורי.
  if p_starts_at <= now() - interval '30 days' then
    raise exception 'TOO_FAR_PAST';
  end if;
  v_is_retroactive := p_starts_at <= now();

  select (value#>>'{}')::int into v_horizon_days
  from app_settings where clinic_id = v_clinic_id and key = 'booking_horizon_days';
  v_horizon_days := coalesce(v_horizon_days, 30);
  if p_starts_at > now() + (v_horizon_days || ' days')::interval then
    raise exception 'TOO_FAR_AHEAD';
  end if;

  -- חפיפה עצמית
  if exists (
    select 1 from bookings
    where user_id = v_uid and status = 'confirmed'
      and tstzrange(starts_at, ends_at, '[)') && tstzrange(p_starts_at, p_ends_at, '[)')
  ) then
    raise exception 'SELF_OVERLAP';
  end if;

  -- זמינות החדר — 🔴 חייב לשייך ל-v_clinic_id, לא רק "קיים ופעיל"
  select active, clinic_id into v_room_active, v_room_clinic from rooms where id = p_room_id;
  if v_room_clinic is null or v_room_clinic <> v_clinic_id or not v_room_active then
    raise exception 'ROOM_UNAVAILABLE';
  end if;
  if exists (
    select 1 from room_blocks
    where room_id = p_room_id
      and tstzrange(starts_at, ends_at, '[)') && tstzrange(p_starts_at, p_ends_at, '[)')
  ) then
    raise exception 'ROOM_UNAVAILABLE';
  end if;

  v_hours := extract(epoch from (p_ends_at - p_starts_at)) / 3600;

  -- בחירת כרטיסייה — FIFO, פיקדון שלם, עם נעילת שורה (baclinica-spec.md §6.1)
  select * into v_card from punch_cards
  where user_id = v_uid
    and active
    and expires_at > p_ends_at
    and punch_cards.hours_remaining >= v_hours
    and deposit_remaining = deposit_amount
  order by expires_at asc
  limit 1
  for update;

  if not found then
    select exists (
      select 1 from punch_cards
      where user_id = v_uid and active and expires_at > p_ends_at and punch_cards.hours_remaining >= v_hours
    ) into v_has_hours;

    if v_has_hours then
      raise exception 'DEPOSIT_DEPLETED';
    else
      raise exception 'NO_CREDIT';
    end if;
  end if;

  update punch_cards set hours_remaining = punch_cards.hours_remaining - v_hours where id = v_card.id;

  begin
    insert into bookings (clinic_id, user_id, room_id, source, punch_card_id, starts_at, ends_at, hours_charged)
    values (v_clinic_id, v_uid, p_room_id, 'punch_card', v_card.id, p_starts_at, p_ends_at, v_hours)
    returning id into v_booking_id;
  exception when exclusion_violation then
    raise exception 'ROOM_TAKEN';
  end;

  insert into audit_log (clinic_id, actor_id, action, entity, entity_id, after)
  values (
    v_clinic_id, v_uid,
    case when v_is_retroactive then 'booking_created_retroactively' else 'booking_created' end,
    'bookings', v_booking_id,
    jsonb_build_object('room_id', p_room_id, 'starts_at', p_starts_at, 'ends_at', p_ends_at, 'hours', v_hours)
  );

  return query
    select v_booking_id, v_hours, (v_card.hours_remaining - v_hours);
end;
$$ language plpgsql security definer set search_path = public;

create or replace function cancel_booking(p_booking_id uuid)
returns table (hours_refunded boolean) as $$
declare
  v_uid uuid := auth.uid();
  v_booking bookings%rowtype;
  v_cancel_window_hours numeric;
  v_hours_before numeric;
  v_refunded boolean;
begin
  if v_uid is null then
    raise exception 'FORBIDDEN';
  end if;

  select * into v_booking from bookings where id = p_booking_id and user_id = v_uid for update;
  if not found then
    raise exception 'FORBIDDEN';
  end if;

  if v_booking.status <> 'confirmed' then
    raise exception 'BOOKING_PASSED';
  end if;

  -- 🔴 מפגש ססיה — לעולם לא ניתן לביטול ע"י המטפל/ת
  if v_booking.source = 'session' then
    raise exception 'SESSION_NOT_CANCELLABLE';
  end if;

  if v_booking.starts_at <= now() then
    raise exception 'BOOKING_PASSED';
  end if;

  select (value#>>'{}')::numeric into v_cancel_window_hours
  from app_settings where clinic_id = v_booking.clinic_id and key = 'cancel_window_hours';
  v_cancel_window_hours := coalesce(v_cancel_window_hours, 24);

  v_hours_before := extract(epoch from (v_booking.starts_at - now())) / 3600;
  v_refunded := v_hours_before >= v_cancel_window_hours;

  if v_refunded and v_booking.punch_card_id is not null then
    update punch_cards
    set hours_remaining = hours_remaining + v_booking.hours_charged
    where id = v_booking.punch_card_id;
  end if;

  update bookings
  set status = 'cancelled_by_user',
      cancelled_at = now(),
      cancelled_by = v_uid,
      hours_refunded = v_refunded
  where id = p_booking_id;

  insert into audit_log (clinic_id, actor_id, action, entity, entity_id, after)
  values (v_booking.clinic_id, v_uid, 'booking_cancelled', 'bookings', p_booking_id,
          jsonb_build_object('hours_refunded', v_refunded));

  return query select v_refunded;
end;
$$ language plpgsql security definer set search_path = public;

-- ═══ הפעלת רכישות Woo ממתינות תואמות (טלפון/מייל) על פרופיל חדש/קיים ═══
-- 🔴 סעיף 9 של SAASMIGRATIONSPEC: הבאג הקונקרטי במערכת המקורית
-- (activateSessionFromWooOrder מחפש profiles.phone בלי סינון קליניקה) מתוקן
-- כאן במקור: ההתאמה תמיד מסוננת ל-clinic_id = v_profile.clinic_id, כך
-- שתשלום שהתקבל בחנות של קליניקה A לעולם לא יתאים לפרופיל בקליניקה B, גם
-- אם הטלפון זהה במקרה.
create or replace function claim_woo_pending_purchase()
returns table (claimed_count int, hours_granted numeric) as $$
declare
  v_profile profiles%rowtype;
  v_pending woo_pending_purchases%rowtype;
  v_tier punch_card_tiers%rowtype;
  v_vat_rate numeric;
  v_price numeric;
  v_deposit numeric;
  v_before_vat numeric;
  v_vat numeric;
  v_card_id uuid;
  v_payment_id uuid;
  v_count int := 0;
  v_hours numeric := 0;
  v_unit_amount numeric;
  v_i int;
begin
  select * into v_profile from profiles where id = auth.uid();
  if not found then
    raise exception 'FORBIDDEN';
  end if;

  select (value#>>'{}')::numeric into v_vat_rate
  from app_settings where clinic_id = v_profile.clinic_id and key = 'vat_rate';
  v_vat_rate := coalesce(v_vat_rate, 0.18);

  for v_pending in
    select * from woo_pending_purchases
    where clinic_id = v_profile.clinic_id
      and status = 'pending'
      and expires_at > now()
      and (
        (phone is not null and phone = v_profile.phone)
        or (email is not null and lower(email) = lower(v_profile.email))
      )
    order by created_at asc
    for update
  loop
    select * into v_tier from punch_card_tiers
    where id = v_pending.tier_id and clinic_id = v_profile.clinic_id;
    if not found then
      continue; -- מדרגה נמחקה בינתיים — נשאר ל-admin לטפל ידנית
    end if;

    v_price := v_tier.hours * v_tier.price_per_hour;
    v_deposit := v_tier.deposit_hours * v_tier.price_per_hour;
    v_before_vat := v_price + v_deposit;
    v_vat := round(v_before_vat * v_vat_rate, 2);
    v_unit_amount := round(v_pending.amount_total / v_pending.quantity, 2);

    for v_i in 1..v_pending.quantity loop
      insert into punch_cards (
        clinic_id, user_id, tier_id, hours_purchased, hours_remaining,
        price_per_hour, deposit_amount, deposit_remaining, expires_at, active
      ) values (
        v_profile.clinic_id, v_profile.id, v_tier.id, v_tier.hours, v_tier.hours,
        v_tier.price_per_hour, v_deposit, v_deposit, now() + interval '24 months', true
      ) returning id into v_card_id;

      insert into payments (
        clinic_id, user_id, type, status, method, amount_before_vat, vat_amount, amount_total,
        punch_card_id, payplus_transaction_uid, paid_at
      ) values (
        v_profile.clinic_id, v_profile.id, 'punch_card', 'paid', 'other', v_before_vat, v_vat, v_unit_amount,
        v_card_id, 'woo-' || v_pending.id || '-' || v_i, now()
      ) returning id into v_payment_id;

      insert into audit_log (clinic_id, actor_id, action, entity, entity_id, after)
      values (v_profile.clinic_id, v_profile.id, 'woo_purchase_claimed', 'punch_cards', v_card_id,
              jsonb_build_object('woo_order_id', v_pending.woo_order_id, 'payment_id', v_payment_id));

      v_count := v_count + 1;
      v_hours := v_hours + v_tier.hours;
    end loop;

    update woo_pending_purchases
    set status = 'claimed', claimed_by = v_profile.id, claimed_at = now()
    where id = v_pending.id;
  end loop;

  return query select v_count, v_hours;
end;
$$ language plpgsql security definer set search_path = public;

-- ═══ אדמין: השלמת פיקדון ידנית ═══
create or replace function admin_complete_deposit(p_punch_card_id uuid)
returns void as $$
declare
  v_clinic_id uuid;
  v_card punch_cards%rowtype;
begin
  select clinic_id into v_clinic_id from profiles where id = auth.uid();
  if not is_admin() then
    raise exception 'FORBIDDEN';
  end if;

  select * into v_card from punch_cards
  where id = p_punch_card_id and clinic_id = v_clinic_id for update;
  if not found then
    raise exception 'FORBIDDEN';
  end if;

  update punch_cards set deposit_remaining = deposit_amount where id = p_punch_card_id;

  insert into audit_log (clinic_id, actor_id, action, entity, entity_id, after)
  values (v_clinic_id, auth.uid(), 'deposit_completed_manually', 'punch_cards', p_punch_card_id,
          jsonb_build_object('deposit_amount', v_card.deposit_amount));
end;
$$ language plpgsql security definer set search_path = public;

-- ═══ אדמין: הענקת שעות מתנה — כרטיסייה ללא תשלום, פיקדון 0 ═══
-- ⚠️ ר' SAASMIGRATIONSPEC §12: בהרשמה עצמאית, owner יכול תיאורטית להעניק
-- לעצמו שעות חינמיות בלי הגבלה. לא חוסמים כרגע ב-MVP (החלטה מפורשת: אין
-- הגבלה טכנית נוספת מעבר להיות admin/owner של הקליניקה עצמה — ר' PROGRESS.md
-- לדיון על cap/trial-block עתידי).
create or replace function grant_bonus_hours(p_user_id uuid, p_hours numeric, p_note text)
returns table (punch_card_id uuid) as $$
declare
  v_clinic_id uuid;
  v_target_clinic uuid;
  v_card_id uuid;
begin
  select clinic_id into v_clinic_id from profiles where id = auth.uid();
  if not is_admin() then
    raise exception 'FORBIDDEN';
  end if;
  if p_hours is null or p_hours <= 0 then
    raise exception 'INVALID_SLOT';
  end if;

  select clinic_id into v_target_clinic from profiles where id = p_user_id;
  if v_target_clinic is null or v_target_clinic <> v_clinic_id then
    raise exception 'FORBIDDEN';
  end if;

  insert into punch_cards (
    clinic_id, user_id, tier_id, hours_purchased, hours_remaining,
    price_per_hour, deposit_amount, deposit_remaining, expires_at, active
  ) values (
    v_clinic_id, p_user_id, null, p_hours, p_hours, 0, 0, 0, now() + interval '24 months', true
  ) returning id into v_card_id;

  insert into audit_log (clinic_id, actor_id, action, entity, entity_id, after)
  values (v_clinic_id, auth.uid(), 'bonus_hours_granted', 'punch_cards', v_card_id,
          jsonb_build_object('user_id', p_user_id, 'hours', p_hours, 'note', p_note));

  return query select v_card_id;
end;
$$ language plpgsql security definer set search_path = public;

-- ═══ אדמין: התאמת שעות על כרטיסייה קיימת ═══
create or replace function admin_adjust_punch_card_hours(
  p_card_id uuid,
  p_hours_delta numeric,
  p_note text
) returns void as $$
declare
  v_clinic_id uuid;
  v_card punch_cards%rowtype;
  v_new_hours numeric;
begin
  select clinic_id into v_clinic_id from profiles where id = auth.uid();
  if not is_admin() then
    raise exception 'FORBIDDEN';
  end if;
  if p_hours_delta = 0 then
    raise exception 'INVALID_SLOT';
  end if;

  select * into v_card from punch_cards
  where id = p_card_id and clinic_id = v_clinic_id for update;
  if not found then
    raise exception 'FORBIDDEN';
  end if;

  v_new_hours := v_card.hours_remaining + p_hours_delta;
  if v_new_hours < 0 then
    raise exception 'INSUFFICIENT_HOURS';
  end if;

  update punch_cards set hours_remaining = v_new_hours where id = p_card_id;

  insert into audit_log (clinic_id, actor_id, action, entity, entity_id, after)
  values (v_clinic_id, auth.uid(), 'admin_adjusted_punch_card_hours', 'punch_cards', p_card_id,
          jsonb_build_object('delta', p_hours_delta, 'new_hours_remaining', v_new_hours, 'note', p_note));
end;
$$ language plpgsql security definer set search_path = public;
