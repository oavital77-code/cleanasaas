-- קישור הצטרפות פומבי לקליניקה — SAASMIGRATIONSPEC/משוב משתמש: העברה
-- מ"אדמין יוצר קישור חד-פעמי לכל מטפל/ת" ל"אדמין מפרסם קישור אחד קבוע,
-- כל מטפל/ת נרשם/ת בעצמו/ה דרכו". חל **רק** על role='therapist' — לעולם
-- לא על 'admin', כדי שלינק פתוח לא יאפשר הסלמת הרשאות עצמית לניהול
-- הקליניקה. הזמנת אדמין/ית ממשיכה לעבור אך ורק דרך clinic_invites
-- (create_therapist_invite/accept_therapist_invite) הקיים.
alter table clinics add column if not exists published boolean not null default false;

-- מקביל ל-accept_therapist_invite, אבל לפי clinic slug (קבוע, לא חד-פעמי)
-- במקום טוקן הזמנה. אין "מי הזמין" — כל מי שמגיע לקישור עם הרשמה תקינה
-- מצטרף/ת כ-therapist בקליניקה הזו, בכפוף למכסת התוכנית ולכך שהקליניקה
-- בסטטוס "מפורסם" ולא מושעית.
create or replace function join_clinic_as_therapist(
  p_slug text,
  p_full_name text,
  p_phone text
)
returns table (clinic_id uuid) as $$
declare
  v_uid uuid := auth.uid();
  v_clinic clinics%rowtype;
  v_email text;
begin
  if v_uid is null then
    raise exception 'FORBIDDEN';
  end if;
  if exists (select 1 from profiles where id = v_uid) then
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

  select email into v_email from auth.users where id = v_uid;

  perform set_config('cleana.trusted_write', 'on', true);
  insert into profiles (id, clinic_id, role, status, full_name, phone, email, terms_accepted_at)
  values (v_uid, v_clinic.id, 'therapist', 'active', p_full_name, p_phone, v_email, now());
  perform set_config('cleana.trusted_write', 'off', true);

  insert into audit_log (clinic_id, actor_id, action, entity, entity_id, after)
  values (v_clinic.id, v_uid, 'joined_via_public_link', 'profiles', v_uid, '{}'::jsonb);

  return query select v_clinic.id;
end;
$$ language plpgsql security definer set search_path = public;

-- הקשחת הרשאות כמו בכל שאר ה-RPCs (ר' 20260904000002): revoke מ-PUBLIC
-- ואז grant מפורש בלבד ל-role שבאמת צריך.
-- revoke מפורש גם מ-anon בנוסף ל-public: בהרצה בפועל מול הפרויקט האמיתי,
-- revoke-from-public לבד לא הספיק לפונקציה הזו (has_function_privilege
-- על anon עדיין החזיר true עד שנוסף revoke ישיר) — למרות שבדיוק אותו
-- דפוס עבד לכל שאר ה-RPCs ב-20260904000002. לא ברור המקור המדויק
-- לחוסר-העקביות; זה כאן כדי שההרצה החוזרת (למשל בפרויקט Supabase חדש)
-- תיתן את התוצאה הנכונה תמיד, בלי תלות בסדר/timing.
revoke execute on function join_clinic_as_therapist(text, text, text) from public;
revoke execute on function join_clinic_as_therapist(text, text, text) from anon;
grant execute on function join_clinic_as_therapist(text, text, text) to authenticated;
