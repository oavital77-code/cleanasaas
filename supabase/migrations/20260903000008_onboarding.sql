-- Cleana SaaS — Onboarding: הרשמת owner + הזמנת מטפלים (SAASMIGRATIONSPEC §5)
--
-- זרימה: (1) המשתמש נרשם קודם דרך Supabase Auth (signUp/OTP) — זה יוצר שורת
-- auth.users, אבל עדיין אין profiles/clinics. (2) הלקוח קורא ל-signup_clinic
-- עם auth.uid() כבר קיים, וזו יוצרת אטומית clinics+profiles(owner)+
-- platform_subscriptions+app_settings ברירת מחדל. 🔴 אין INSERT ישיר של
-- הלקוח לאף אחת מהטבלאות האלה — profiles.admin_insert_profile דורשת
-- is_admin() שעדיין לא קיים בשלב הזה, אז זו חייבת לעבור RPC.

create or replace function signup_clinic(
  p_clinic_name text,
  p_slug text,
  p_owner_full_name text,
  p_owner_phone text
)
returns table (clinic_id uuid) as $$
declare
  v_uid uuid := auth.uid();
  v_email text;
  v_clinic_id uuid;
begin
  if v_uid is null then
    raise exception 'FORBIDDEN';
  end if;
  if exists (select 1 from profiles where id = v_uid) then
    raise exception 'ALREADY_REGISTERED';
  end if;
  if p_clinic_name is null or length(trim(p_clinic_name)) = 0 then
    raise exception 'INVALID_INPUT';
  end if;
  if p_slug !~ '^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$' then
    raise exception 'INVALID_SLUG';
  end if;

  select email into v_email from auth.users where id = v_uid;

  begin
    insert into clinics (name, slug, status, timezone)
    values (trim(p_clinic_name), p_slug, 'trial', 'Asia/Jerusalem')
    returning id into v_clinic_id;
  exception when unique_violation then
    raise exception 'SLUG_TAKEN';
  end;

  perform set_config('cleana.trusted_write', 'on', true);
  insert into profiles (id, clinic_id, role, status, full_name, phone, email, terms_accepted_at)
  values (v_uid, v_clinic_id, 'owner', 'active', p_owner_full_name, p_owner_phone, v_email, now());
  perform set_config('cleana.trusted_write', 'off', true);

  insert into platform_subscriptions (clinic_id, plan, status, current_period_end)
  values (v_clinic_id, 'trial', 'trialing', now() + interval '14 days');

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
$$ language plpgsql security definer set search_path = public;

-- ═══ הזמנת מטפלים/אדמינים — קישור הזמנה (טוקן), לא בדיקת גישה ידנית ═══
create table clinic_invites (
  token       uuid primary key default gen_random_uuid(),
  clinic_id   uuid not null references clinics(id) on delete cascade,
  role        user_role not null default 'therapist' check (role in ('admin', 'therapist')),
  created_by  uuid references profiles(id),
  created_at  timestamptz default now(),
  expires_at  timestamptz not null default now() + interval '14 days',
  used_at     timestamptz,
  used_by     uuid references profiles(id)
);
create index on clinic_invites (clinic_id);

alter table clinic_invites enable row level security;
create policy admin_manage_invites on clinic_invites for all
  using (is_admin() and clinic_id = current_clinic_id());

create or replace function create_therapist_invite(p_role user_role default 'therapist')
returns table (token uuid, expires_at timestamptz) as $$
declare
  v_clinic_id uuid;
  v_token uuid;
  v_expires timestamptz;
begin
  select clinic_id into v_clinic_id from profiles where id = auth.uid();
  if not is_admin() then
    raise exception 'FORBIDDEN';
  end if;
  if p_role not in ('admin', 'therapist') then
    raise exception 'INVALID_INPUT';
  end if;

  insert into clinic_invites (clinic_id, role, created_by)
  values (v_clinic_id, p_role, auth.uid())
  returning clinic_invites.token, clinic_invites.expires_at into v_token, v_expires;

  return query select v_token, v_expires;
end;
$$ language plpgsql security definer set search_path = public;

-- נקרא ע"י המוזמן/ת אחרי שנרשם/ה ל-Supabase Auth (auth.uid() כבר קיים),
-- לפני שיש profile. מכסת מטפלים לפי התוכנית נאכפת כאן — הרגע היחיד שבו
-- באמת נוצר פרופיל therapist חדש.
create or replace function accept_therapist_invite(
  p_token uuid,
  p_full_name text,
  p_phone text
)
returns table (clinic_id uuid) as $$
declare
  v_uid uuid := auth.uid();
  v_invite clinic_invites%rowtype;
  v_email text;
begin
  if v_uid is null then
    raise exception 'FORBIDDEN';
  end if;
  if exists (select 1 from profiles where id = v_uid) then
    raise exception 'ALREADY_REGISTERED';
  end if;

  select * into v_invite from clinic_invites where token = p_token for update;
  if not found or v_invite.used_at is not null or v_invite.expires_at < now() then
    raise exception 'INVITE_INVALID';
  end if;

  if v_invite.role = 'therapist' then
    perform assert_within_plan_quota(v_invite.clinic_id, 'therapist');
  end if;

  select email into v_email from auth.users where id = v_uid;

  perform set_config('cleana.trusted_write', 'on', true);
  insert into profiles (id, clinic_id, role, status, full_name, phone, email, terms_accepted_at)
  values (v_uid, v_invite.clinic_id, v_invite.role, 'active', p_full_name, p_phone, v_email, now());
  perform set_config('cleana.trusted_write', 'off', true);

  update clinic_invites set used_at = now(), used_by = v_uid where token = p_token;

  insert into audit_log (clinic_id, actor_id, action, entity, entity_id, after)
  values (v_invite.clinic_id, v_uid, 'invite_accepted', 'profiles', v_uid,
          jsonb_build_object('role', v_invite.role));

  return query select v_invite.clinic_id;
end;
$$ language plpgsql security definer set search_path = public;
