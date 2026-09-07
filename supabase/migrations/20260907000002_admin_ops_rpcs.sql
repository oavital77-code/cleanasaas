-- פעולות אדמין שחסרו להפעלה יומיומית (ר' PROGRESS.md סעיף 25 — ממצאי
-- הסקירה): הנפקת כרטיסייה ידנית, חסימת חדרים, וסימון הושלם/לא-הגיע.
--
-- 🔴 לקח מ-20260907000001: כל פונקציה חדשה — revoke מפורש מ-anon, לא רק
-- מ-public (Supabase מעניקה EXECUTE ל-anon ישירות דרך default privileges).

-- ═══ 1. הנפקת כרטיסייה ידנית (מזומן / bit / העברה) ═══
-- עד עכשיו כרטיסייה נוצרה רק דרך claim_woo_pending_purchase (דורש חנות Woo)
-- או grant_bonus_hours (חסום ב-trial, תקרה 20ש', חינם). זה השאיר קליניקה
-- חדשה בלי שום דרך להכניס שעות למטפל/ת ששילם/ה במזומן. כאן: תשלום אמיתי
-- (payment 'paid' עם method), לא מתנה — ולכן *לא* חסום ב-trial. audit
-- בולט (punch_card_issued_manually מודגש ב-/admin/audit) כי זה עדיין מסלול
-- ידני שעוקף את החנות.
--
-- שני מצבים: לפי מדרגה (p_tier_id, מחיר המחירון; p_amount_total אופציונלי
-- להנחה) או מותאם (p_hours + p_amount_total). מע"מ נגזר תמיד מהסכום הסופי
-- ששולם בפועל, כדי ש-payments ישקף את מה שנכנס לקופה.
create or replace function admin_issue_punch_card(
  p_user_id uuid,
  p_tier_id uuid default null,
  p_hours numeric default null,
  p_amount_total numeric default null,
  p_method payment_method default 'cash',
  p_note text default null
)
returns table(punch_card_id uuid, payment_id uuid, hours numeric, amount_total numeric)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_clinic_id uuid;
  v_target_clinic uuid;
  v_tier punch_card_tiers%rowtype;
  v_vat_rate numeric;
  v_hours numeric;
  v_price numeric;
  v_deposit numeric;
  v_before_vat numeric;
  v_vat numeric;
  v_total numeric;
  v_card_id uuid;
  v_payment_id uuid;
begin
  if not is_admin() then
    raise exception 'FORBIDDEN';
  end if;
  v_clinic_id := current_clinic_id();

  select clinic_id into v_target_clinic from profiles where id = p_user_id;
  if v_target_clinic is null or v_target_clinic <> v_clinic_id then
    raise exception 'FORBIDDEN';
  end if;

  select (value#>>'{}')::numeric into v_vat_rate
  from app_settings where clinic_id = v_clinic_id and key = 'vat_rate';
  v_vat_rate := coalesce(v_vat_rate, 0.18);

  if p_tier_id is not null then
    select * into v_tier from punch_card_tiers
    where id = p_tier_id and clinic_id = v_clinic_id and active;
    if not found then
      raise exception 'TIER_NOT_FOUND';
    end if;
    v_hours := v_tier.hours;
    v_price := v_tier.price_per_hour;
    v_deposit := v_tier.deposit_hours * v_tier.price_per_hour;
    v_total := coalesce(
      p_amount_total,
      round((v_hours * v_price + v_deposit) * (1 + v_vat_rate), 2)
    );
  else
    if p_hours is null or p_hours <= 0 or p_hours > 100 then
      raise exception 'INVALID_HOURS';
    end if;
    if p_amount_total is null then
      raise exception 'INVALID_AMOUNT';
    end if;
    v_hours := p_hours;
    v_deposit := 0;
    v_total := p_amount_total;
    v_price := round((v_total / (1 + v_vat_rate)) / v_hours, 2);
  end if;

  if v_total < 0 then
    raise exception 'INVALID_AMOUNT';
  end if;
  v_before_vat := round(v_total / (1 + v_vat_rate), 2);
  v_vat := v_total - v_before_vat;

  insert into punch_cards (
    clinic_id, user_id, tier_id, hours_purchased, hours_remaining,
    price_per_hour, deposit_amount, deposit_remaining, expires_at, active
  ) values (
    v_clinic_id, p_user_id, p_tier_id, v_hours, v_hours,
    v_price, v_deposit, v_deposit, now() + interval '24 months', true
  ) returning id into v_card_id;

  insert into payments (
    clinic_id, user_id, type, status, method, amount_before_vat, vat_amount, amount_total,
    punch_card_id, payplus_transaction_uid, paid_at
  ) values (
    v_clinic_id, p_user_id, 'punch_card', 'paid', p_method, v_before_vat, v_vat, v_total,
    v_card_id, 'manual-' || v_card_id, now()
  ) returning id into v_payment_id;

  insert into audit_log (clinic_id, actor_id, action, entity, entity_id, after)
  values (v_clinic_id, app_user_id(), 'punch_card_issued_manually', 'punch_cards', v_card_id,
          jsonb_build_object('user_id', p_user_id, 'tier_id', p_tier_id, 'hours', v_hours,
                             'amount_total', v_total, 'method', p_method, 'note', p_note,
                             'payment_id', v_payment_id));

  return query select v_card_id, v_payment_id, v_hours, v_total;
end;
$$;

-- ═══ 2. חסימת חדר (תחזוקה/חג/שיפוץ) ═══
-- room_blocks קיים מהיום הראשון (מוצג בלוח, מזרים availability_events) —
-- אבל לא היה שום מסך/RPC ליצור חסימה. חסימה שחופפת הזמנה מאושרת נדחית
-- (BLOCK_OVERLAPS_BOOKING): האדמין מבטל קודם את ההזמנה במודע, לא "נעלים"
-- אותה מאחורי חסימה.
create or replace function admin_create_room_block(
  p_room_id uuid,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_reason text
)
returns table(block_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_clinic_id uuid;
  v_room_clinic uuid;
  v_block_id uuid;
begin
  if not is_admin() then
    raise exception 'FORBIDDEN';
  end if;
  v_clinic_id := current_clinic_id();
  if p_ends_at is null or p_starts_at is null or p_ends_at <= p_starts_at then
    raise exception 'INVALID_SLOT';
  end if;

  select clinic_id into v_room_clinic from rooms where id = p_room_id;
  if v_room_clinic is null or v_room_clinic <> v_clinic_id then
    raise exception 'ROOM_UNAVAILABLE';
  end if;

  if exists (
    select 1 from bookings
    where room_id = p_room_id and status = 'confirmed'
      and tstzrange(starts_at, ends_at, '[)') && tstzrange(p_starts_at, p_ends_at, '[)')
  ) then
    raise exception 'BLOCK_OVERLAPS_BOOKING';
  end if;

  begin
    insert into room_blocks (clinic_id, room_id, starts_at, ends_at, reason, created_by)
    values (v_clinic_id, p_room_id, p_starts_at, p_ends_at, coalesce(nullif(trim(p_reason), ''), '-'), app_user_id())
    returning id into v_block_id;
  exception when exclusion_violation then
    raise exception 'BLOCK_OVERLAPS_BLOCK';
  end;

  insert into audit_log (clinic_id, actor_id, action, entity, entity_id, after)
  values (v_clinic_id, app_user_id(), 'room_block_created', 'room_blocks', v_block_id,
          jsonb_build_object('room_id', p_room_id, 'starts_at', p_starts_at, 'ends_at', p_ends_at, 'reason', p_reason));

  return query select v_block_id;
end;
$$;

create or replace function admin_delete_room_block(p_block_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_clinic_id uuid;
  v_block room_blocks%rowtype;
begin
  if not is_admin() then
    raise exception 'FORBIDDEN';
  end if;
  v_clinic_id := current_clinic_id();

  select * into v_block from room_blocks where id = p_block_id and clinic_id = v_clinic_id;
  if not found then
    raise exception 'FORBIDDEN';
  end if;

  delete from room_blocks where id = p_block_id;

  insert into audit_log (clinic_id, actor_id, action, entity, entity_id, before)
  values (v_clinic_id, app_user_id(), 'room_block_deleted', 'room_blocks', p_block_id,
          jsonb_build_object('room_id', v_block.room_id, 'starts_at', v_block.starts_at, 'ends_at', v_block.ends_at, 'reason', v_block.reason));
end;
$$;

-- ═══ 3. סימון הזמנה כ-הושלם / לא הגיע/ה ═══
-- booking_status כלל את הערכים מהיום הראשון (מוצגים בכל מקום), אבל לא
-- הייתה דרך להגיע אליהם. רק הזמנה מאושרת שכבר התחילה. לא-הגיע/ה לא מחזיר
-- שעות (מדיניות ביטול: בתוך 24ש' נשרף — לא-הגיע/ה הוא המקרה הקיצוני).
create or replace function admin_set_booking_status(p_booking_id uuid, p_status booking_status)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_clinic_id uuid;
  v_booking bookings%rowtype;
begin
  if not is_admin() then
    raise exception 'FORBIDDEN';
  end if;
  v_clinic_id := current_clinic_id();
  if p_status not in ('completed', 'no_show') then
    raise exception 'INVALID_STATUS';
  end if;

  select * into v_booking from bookings where id = p_booking_id and clinic_id = v_clinic_id for update;
  if not found then
    raise exception 'FORBIDDEN';
  end if;
  if v_booking.status <> 'confirmed' then
    raise exception 'BOOKING_NOT_CONFIRMED';
  end if;
  if v_booking.starts_at > now() then
    raise exception 'BOOKING_NOT_STARTED';
  end if;

  update bookings set status = p_status where id = p_booking_id;

  insert into audit_log (clinic_id, actor_id, action, entity, entity_id, before, after)
  values (v_clinic_id, app_user_id(), 'booking_marked_' || p_status::text, 'bookings', p_booking_id,
          jsonb_build_object('status', 'confirmed'), jsonb_build_object('status', p_status));
end;
$$;

-- ═══ הרשאות — anon מפורש ═══
revoke all on function admin_issue_punch_card(uuid, uuid, numeric, numeric, payment_method, text) from public, anon;
revoke all on function admin_create_room_block(uuid, timestamptz, timestamptz, text) from public, anon;
revoke all on function admin_delete_room_block(uuid) from public, anon;
revoke all on function admin_set_booking_status(uuid, booking_status) from public, anon;
grant execute on function admin_issue_punch_card(uuid, uuid, numeric, numeric, payment_method, text) to authenticated;
grant execute on function admin_create_room_block(uuid, timestamptz, timestamptz, text) to authenticated;
grant execute on function admin_delete_room_block(uuid) to authenticated;
grant execute on function admin_set_booking_status(uuid, booking_status) to authenticated;
