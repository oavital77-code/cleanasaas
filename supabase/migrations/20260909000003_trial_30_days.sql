-- החלטת מוצר (9.9.2026): חודש ניסיון, כמו ב-Cleana+ — לא 14 יום.
-- signup_clinic מועתקת מ-20260905000006 ללא שינוי פרט לאורך הניסיון
-- (now() + interval '30 days'). דף הנחיתה (TRIAL_DAYS) מתעדכן יחד.
--
-- קליניקות שכבר בניסיון: מקבלות את אותו חודש מלא מיום ההרשמה — רק הרחבה,
-- אף אחת לא מתקצרת.

create or replace function signup_clinic(
  p_clinic_name text,
  p_slug text,
  p_owner_full_name text,
  p_owner_phone text,
  p_owner_email text
)
returns table (clinic_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_clerk_sub text := auth.jwt() ->> 'sub';
  v_uid uuid := gen_random_uuid();
  v_clinic_id uuid;
begin
  if v_clerk_sub is null then
    raise exception 'FORBIDDEN';
  end if;
  if exists (select 1 from profiles where clerk_user_id = v_clerk_sub) then
    raise exception 'ALREADY_REGISTERED';
  end if;
  if p_clinic_name is null or length(trim(p_clinic_name)) = 0 then
    raise exception 'INVALID_INPUT';
  end if;
  if p_slug !~ '^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$' then
    raise exception 'INVALID_SLUG';
  end if;

  begin
    insert into clinics (name, slug, status, timezone)
    values (trim(p_clinic_name), p_slug, 'trial', 'Asia/Jerusalem')
    returning id into v_clinic_id;
  exception when unique_violation then
    raise exception 'SLUG_TAKEN';
  end;

  perform set_config('cleana.trusted_write', 'on', true);
  insert into profiles (id, clinic_id, role, status, full_name, phone, email, terms_accepted_at, clerk_user_id)
  values (v_uid, v_clinic_id, 'owner', 'active', p_owner_full_name, p_owner_phone, p_owner_email, now(), v_clerk_sub);
  perform set_config('cleana.trusted_write', 'off', true);

  insert into platform_subscriptions (clinic_id, plan, status, current_period_end)
  values (v_clinic_id, 'trial', 'trialing', now() + interval '30 days');

  -- ברירות מחדל תואמות baclinica-spec.md §5.1 — ניתנות לעריכה חופשית ב-wizard/settings
  insert into app_settings (clinic_id, key, value) values
    (v_clinic_id, 'vat_rate', '0.18'),
    (v_clinic_id, 'buffer_minutes', '5'),
    (v_clinic_id, 'booking_horizon_days', '30'),
    (v_clinic_id, 'cancel_window_hours', '24'),
    (v_clinic_id, 'sub_cancel_notice_days', '30'),
    (v_clinic_id, 'session_base_price', '600'),
    (v_clinic_id, 'session_base_hours', '5'),
    (v_clinic_id, 'session_hold_hours', '72'),
    (v_clinic_id, 'woo_session_product_id', '0');

  insert into audit_log (clinic_id, actor_id, action, entity, entity_id, after)
  values (v_clinic_id, v_uid, 'clinic_signed_up', 'clinics', v_clinic_id,
          jsonb_build_object('name', p_clinic_name, 'slug', p_slug));

  return query select v_clinic_id;
end;
$$;


update platform_subscriptions
set current_period_end = greatest(current_period_end, created_at + interval '30 days'),
    updated_at = now()
where plan = 'trial' and status = 'trialing';
