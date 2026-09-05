-- ═══════════════════════════════════════════════════════════════════════
-- מעבר ל-Clerk — שלב 4: שלוש פונקציות היצירה (signup/join/invite)
-- ═══════════════════════════════════════════════════════════════════════
--
-- הוחרגו במפורש ממיגרציה 20260905000004 (שם הוסבר למה): הן כותבות
-- `id = auth.uid()`, כלומר משתמשות בזהות כ*ערך* להכניס, לא כשאילתה לסנן
-- לפיה. app_user_id() לא רלוונטית כאן — היא עונה "מי הפרופיל הקיים של
-- המבקש/ת", אבל ברגע הזה **אין עדיין פרופיל בכלל**.
--
-- אותו דפוס בדיוק בשלושתן, אז אותו שינוי בשלושתן:
--   v_uid := auth.uid()                         →  v_uid := gen_random_uuid()
--   (uuid אמיתי של auth.users, המשמש גם כמזהה הפרופיל)   (מזהה פרופיל חדש; אין עוד auth.users)
--   exists(profiles where id = v_uid)           →  exists(profiles where clerk_user_id = v_clerk_sub)
--   select email from auth.users where id=v_uid →  פרמטר p_email חדש (מ-currentUser() בקוד השרת —
--                                                    ר' link_clerk_identity על אותו עיקרון: המקור
--                                                    הוא Backend API מאומת של Clerk, לא auth.users
--                                                    שכבר לא קיים לזהות הזו)
--   insert (id, ...)                            →  insert (id, ..., clerk_user_id)
--
-- כל שאר הלוגיקה העסקית (בדיקות תוקף/מכסה/כפילות, audit_log, trusted_write
-- סביב ה-insert) זהה לחלוטין למקור — רק מקור הזהות והאימייל השתנו.

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
$$;

create or replace function accept_therapist_invite(
  p_token uuid,
  p_full_name text,
  p_phone text,
  p_email text
)
returns table (clinic_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_clerk_sub text := auth.jwt() ->> 'sub';
  v_uid uuid := gen_random_uuid();
  v_invite clinic_invites%rowtype;
begin
  if v_clerk_sub is null then
    raise exception 'FORBIDDEN';
  end if;
  if exists (select 1 from profiles where clerk_user_id = v_clerk_sub) then
    raise exception 'ALREADY_REGISTERED';
  end if;

  select * into v_invite from clinic_invites where token = p_token for update;
  if not found or v_invite.used_at is not null or v_invite.expires_at < now() then
    raise exception 'INVITE_INVALID';
  end if;

  if v_invite.role = 'therapist' then
    perform assert_within_plan_quota(v_invite.clinic_id, 'therapist');
  end if;

  perform set_config('cleana.trusted_write', 'on', true);
  insert into profiles (id, clinic_id, role, status, full_name, phone, email, terms_accepted_at, clerk_user_id)
  values (v_uid, v_invite.clinic_id, v_invite.role, 'active', p_full_name, p_phone, p_email, now(), v_clerk_sub);
  perform set_config('cleana.trusted_write', 'off', true);

  update clinic_invites set used_at = now(), used_by = v_uid where token = p_token;

  insert into audit_log (clinic_id, actor_id, action, entity, entity_id, after)
  values (v_invite.clinic_id, v_uid, 'invite_accepted', 'profiles', v_uid,
          jsonb_build_object('role', v_invite.role));

  return query select v_invite.clinic_id;
end;
$$;

create or replace function join_clinic_as_therapist(
  p_slug text,
  p_full_name text,
  p_phone text,
  p_email text
)
returns table (clinic_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_clerk_sub text := auth.jwt() ->> 'sub';
  v_uid uuid := gen_random_uuid();
  v_clinic clinics%rowtype;
begin
  if v_clerk_sub is null then
    raise exception 'FORBIDDEN';
  end if;
  if exists (select 1 from profiles where clerk_user_id = v_clerk_sub) then
    raise exception 'ALREADY_REGISTERED';
  end if;

  select * into v_clinic from clinics where slug = p_slug;
  if not found then
    raise exception 'CLINIC_NOT_FOUND';
  end if;
  if not v_clinic.published then
    raise exception 'CLINIC_NOT_PUBLISHED';
  end if;
  if v_clinic.status = 'suspended' then
    raise exception 'CLINIC_SUSPENDED';
  end if;

  perform assert_within_plan_quota(v_clinic.id, 'therapist');

  perform set_config('cleana.trusted_write', 'on', true);
  insert into profiles (id, clinic_id, role, status, full_name, phone, email, terms_accepted_at, clerk_user_id)
  values (v_uid, v_clinic.id, 'therapist', 'active', p_full_name, p_phone, p_email, now(), v_clerk_sub);
  perform set_config('cleana.trusted_write', 'off', true);

  insert into audit_log (clinic_id, actor_id, action, entity, entity_id, after)
  values (v_clinic.id, v_uid, 'joined_via_public_link', 'profiles', v_uid, '{}'::jsonb);

  return query select v_clinic.id;
end;
$$;

-- signup_clinic הישנה נשארה עם 4 פרמטרים (ללא p_owner_email) — ה-overload
-- הזה חייב להימחק במפורש, אחרת יש שתי גרסאות חופפות חלקית ב-PostgREST ולקוח
-- שקורא עם 4 פרמטרים יפעיל בטעות את הישנה שעדיין קוראת auth.uid().
drop function if exists signup_clinic(text, text, text, text);
drop function if exists accept_therapist_invite(uuid, text, text);
drop function if exists join_clinic_as_therapist(text, text, text);

revoke all on function signup_clinic(text, text, text, text, text) from public;
revoke all on function signup_clinic(text, text, text, text, text) from anon;
grant execute on function signup_clinic(text, text, text, text, text) to authenticated;

revoke all on function accept_therapist_invite(uuid, text, text, text) from public;
revoke all on function accept_therapist_invite(uuid, text, text, text) from anon;
grant execute on function accept_therapist_invite(uuid, text, text, text) to authenticated;

revoke all on function join_clinic_as_therapist(text, text, text, text) from public;
revoke all on function join_clinic_as_therapist(text, text, text, text) from anon;
grant execute on function join_clinic_as_therapist(text, text, text, text) to authenticated;
