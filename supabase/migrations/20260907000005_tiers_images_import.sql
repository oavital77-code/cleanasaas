-- שלושה פיצ'רים שביקש/ה המשתמש/ת (09/09):
--   (א) שליטה מלאה במדרגות כרטיסייה — הוספה/הסרה/עריכת שעות. חסרה רק
--       מדיניות DELETE (insert/update כבר קיימות). מחיקה נחסמת ע"י FK של
--       punch_cards.tier_id (RESTRICT) כשיש כרטיסיות על המדרגה — האפליקציה
--       נופלת ל"השבתה" במקרה כזה.
--   (ב) תמונות לחדרים ולקליניקה — rooms.images כבר קיים (לא היה בשימוש);
--       נוסף clinics.image_path. ה-bucket room-images הופך ל-public (תמונת
--       הקליניקה מוצגת בדף /join הציבורי, בלי session), עם הגבלת גודל
--       וסוגי קובץ. מדיניות ה-storage הקיימת (admin + תיקיית clinic_id)
--       נשארת — האפליקציה כותבת דרך service role אחרי requireClinicAdmin.
--   (ג) ייבוא מטפלים/ות מקובץ Excel/CSV — admin_import_therapists יוצר
--       פרופילים בלי זהות Clerk (clerk_user_id null); הקישור קורה כשהם
--       נכנסים בפעם הראשונה: link_clerk_identity (ב-guards) לפי אימייל,
--       וגם join_clinic_as_therapist / accept_therapist_invite מעודכנות
--       כאן כך שפרופיל כזה מקושר במקום להיזרק על unique(email).

-- ---------------------------------------------------------------------------
-- (א) מדרגות כרטיסייה
-- ---------------------------------------------------------------------------
create policy admin_delete_tiers on punch_card_tiers
  for delete using (is_admin() and clinic_id = current_clinic_id());

-- ---------------------------------------------------------------------------
-- (ב) תמונות
-- ---------------------------------------------------------------------------
alter table clinics add column if not exists image_path text;

update storage.buckets
set public = true,
    file_size_limit = 5242880,
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']
where id = 'room-images';

-- ---------------------------------------------------------------------------
-- (ג) ייבוא מטפלים/ות
-- ---------------------------------------------------------------------------
-- p_rows: jsonb array של {full_name, phone (E.164), email, hours?, profession?}.
-- מחזיר {inserted, skipped, errors:[{row, code}]}. כל שורה בתת-טרנזקציה
-- משלה — שורה שגויה לא מפילה את השאר. קודים: EMAIL_IN_OTHER_CLINIC,
-- PHONE_EXISTS, PLAN_LIMIT_THERAPISTS, INVALID_INPUT. אימייל שכבר קיים
-- באותה קליניקה → skipped (לא שגיאה — ייבוא חוזר של אותו קובץ הוא idempotent).
-- hours>0 → כרטיסייה "מיובאת" בלי רשומת תשלום (כמו קליטה מ-Skedda —
-- היתרה כבר שולמה במערכת הקודמת), עם audit נפרד לשקיפות.
create or replace function admin_import_therapists(p_rows jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_clinic_id uuid;
  v_actor uuid;
  v_row jsonb;
  v_idx int := 0;
  v_inserted int := 0;
  v_skipped int := 0;
  v_errors jsonb := '[]'::jsonb;
  v_full_name text;
  v_phone text;
  v_email text;
  v_hours numeric;
  v_profession text;
  v_uid uuid;
  v_card_id uuid;
  v_existing_clinic uuid;
begin
  if not is_admin() then
    raise exception 'FORBIDDEN';
  end if;
  v_clinic_id := current_clinic_id();
  v_actor := app_user_id();

  if p_rows is null or jsonb_typeof(p_rows) <> 'array' then
    raise exception 'INVALID_INPUT';
  end if;
  if jsonb_array_length(p_rows) > 500 then
    raise exception 'TOO_MANY_ROWS';
  end if;

  perform set_config('cleana.trusted_write', 'on', true);

  for v_row in select * from jsonb_array_elements(p_rows) loop
    v_idx := v_idx + 1;
    begin
      v_full_name := nullif(trim(v_row->>'full_name'), '');
      v_phone := nullif(trim(v_row->>'phone'), '');
      v_email := lower(nullif(trim(v_row->>'email'), ''));
      v_hours := coalesce(nullif(v_row->>'hours', '')::numeric, 0);
      v_profession := nullif(trim(v_row->>'profession'), '');

      if v_full_name is null or v_phone is null or v_email is null
         or v_phone !~ '^\+[1-9]\d{6,14}$'
         or v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'
         or v_hours < 0 or v_hours > 1000 then
        raise exception 'INVALID_INPUT';
      end if;

      select clinic_id into v_existing_clinic from profiles where email = v_email;
      if found then
        if v_existing_clinic = v_clinic_id then
          v_skipped := v_skipped + 1;
          continue;
        end if;
        raise exception 'EMAIL_IN_OTHER_CLINIC';
      end if;
      if exists (select 1 from profiles where clinic_id = v_clinic_id and phone = v_phone) then
        raise exception 'PHONE_EXISTS';
      end if;

      perform assert_within_plan_quota(v_clinic_id, 'therapist');

      v_uid := gen_random_uuid();
      insert into profiles (id, clinic_id, role, status, full_name, phone, email, profession, clerk_user_id)
      values (v_uid, v_clinic_id, 'therapist', 'active', v_full_name, v_phone, v_email, v_profession, null);

      insert into audit_log (clinic_id, actor_id, action, entity, entity_id, after)
      values (v_clinic_id, v_actor, 'therapist_imported', 'profiles', v_uid,
              jsonb_build_object('row', v_idx));

      if v_hours > 0 then
        insert into punch_cards (
          clinic_id, user_id, tier_id, hours_purchased, hours_remaining,
          price_per_hour, deposit_amount, deposit_remaining, expires_at, active
        ) values (
          v_clinic_id, v_uid, null, v_hours, v_hours,
          0, 0, 0, now() + interval '24 months', true
        ) returning id into v_card_id;

        insert into audit_log (clinic_id, actor_id, action, entity, entity_id, after)
        values (v_clinic_id, v_actor, 'punch_card_imported', 'punch_cards', v_card_id,
                jsonb_build_object('user_id', v_uid, 'hours', v_hours, 'row', v_idx));
      end if;

      v_inserted := v_inserted + 1;
    exception
      when others then
        v_errors := v_errors || jsonb_build_object('row', v_idx, 'code', sqlerrm);
    end;
  end loop;

  perform set_config('cleana.trusted_write', 'off', true);

  return jsonb_build_object('inserted', v_inserted, 'skipped', v_skipped, 'errors', v_errors);
end;
$$;

-- 🔴 revoke גם מ-anon במפורש (לקח מ-20260906200000 / 20260907000001).
revoke all on function admin_import_therapists(jsonb) from public, anon;

-- ---------------------------------------------------------------------------
-- (ג') הצטרפות של מטפל/ת שיובא/ה מראש — קישור במקום insert חדש
-- ---------------------------------------------------------------------------
-- אותו טופס בדיוק (/join/[slug] או /invite/[token]); אם קיים פרופיל עם אותו
-- אימייל בלי clerk_user_id — מקשרים אותו (ומעדכנים שם/טלפון/תנאים), במקום
-- לנסות insert שהיה נופל על profiles_email_key. אימייל שכבר מקושר לחשבון
-- אחר, או פרופיל שיובא בקליניקה אחרת → EMAIL_ALREADY_REGISTERED (ברור
-- יותר מ-unique_violation גולמי).
create or replace function join_clinic_as_therapist(p_slug text, p_full_name text, p_phone text, p_email text)
returns table(clinic_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_clerk_sub text := auth.jwt() ->> 'sub';
  v_uid uuid := gen_random_uuid();
  v_clinic clinics%rowtype;
  v_existing profiles%rowtype;
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

  select * into v_existing from profiles where lower(email) = lower(p_email) for update;
  if found then
    if v_existing.clerk_user_id is not null or v_existing.clinic_id <> v_clinic.id then
      raise exception 'EMAIL_ALREADY_REGISTERED';
    end if;
    perform set_config('cleana.trusted_write', 'on', true);
    update profiles
    set clerk_user_id = v_clerk_sub, full_name = p_full_name, phone = p_phone,
        terms_accepted_at = now()
    where id = v_existing.id;
    perform set_config('cleana.trusted_write', 'off', true);

    insert into audit_log (clinic_id, actor_id, action, entity, entity_id, after)
    values (v_clinic.id, v_existing.id, 'pre_registered_profile_linked', 'profiles', v_existing.id,
            jsonb_build_object('via', 'public_link'));

    return query select v_clinic.id;
    return;
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

create or replace function accept_therapist_invite(p_token uuid, p_full_name text, p_phone text, p_email text)
returns table(clinic_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_clerk_sub text := auth.jwt() ->> 'sub';
  v_uid uuid := gen_random_uuid();
  v_invite clinic_invites%rowtype;
  v_existing profiles%rowtype;
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

  select * into v_existing from profiles where lower(email) = lower(p_email) for update;
  if found then
    if v_existing.clerk_user_id is not null or v_existing.clinic_id <> v_invite.clinic_id then
      raise exception 'EMAIL_ALREADY_REGISTERED';
    end if;
    -- הזמנה ידנית יכולה לשדרג פרופיל מיובא לאדמין/ית (זה בדיוק המסלול
    -- היחיד להענקת אדמין — ר' /admin/therapists).
    perform set_config('cleana.trusted_write', 'on', true);
    update profiles
    set clerk_user_id = v_clerk_sub, full_name = p_full_name, phone = p_phone,
        role = v_invite.role, terms_accepted_at = now()
    where id = v_existing.id;
    perform set_config('cleana.trusted_write', 'off', true);

    update clinic_invites set used_at = now(), used_by = v_existing.id where token = p_token;

    insert into audit_log (clinic_id, actor_id, action, entity, entity_id, after)
    values (v_invite.clinic_id, v_existing.id, 'pre_registered_profile_linked', 'profiles', v_existing.id,
            jsonb_build_object('via', 'invite', 'role', v_invite.role));

    return query select v_invite.clinic_id;
    return;
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
