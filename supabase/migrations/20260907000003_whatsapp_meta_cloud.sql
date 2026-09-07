-- החלפת שער ה-WhatsApp: שערי QR לא-רשמיים (Green API / Whapi, מיגרציה
-- 20260906000007) → Meta WhatsApp Cloud API הרשמי. החלטת המשתמש אחרי
-- שהובהר סיכון החסימה (ר' PROGRESS.md סעיף 27). המספר שנרשם ל-Meta הוא
-- מספר ייעודי של הקליניקה, לא הוואטסאפ האישי של המנהל/ת.
--
-- ב-Cloud API הודעה יזומה (business-initiated) חייבת להיות *תבנית מאושרת*
-- — לא טקסט חופשי. לכן: template_name + template_lang (כפי שאושרו ב-Meta
-- Business Manager), והפרמטרים נשלחים בסדר קבוע {{1}}…{{6}} =
-- name, clinic, date, time, room, branch (מתועד ב-lib/whatsapp ובמסך
-- ההגדרות). שדה `template` (טקסט חופשי עם {name}…) נשאר — משמש את
-- המסלול החצי-ידני (/admin/reminders, קישורי wa.me).

alter table clinic_whatsapp_settings drop constraint if exists clinic_whatsapp_settings_provider_check;
update clinic_whatsapp_settings set provider = 'meta_cloud';
alter table clinic_whatsapp_settings alter column provider set default 'meta_cloud';
alter table clinic_whatsapp_settings add constraint clinic_whatsapp_settings_provider_check check (provider in ('meta_cloud'));

-- Green API: idInstance → Meta: Phone Number ID (לא סודי, מהדשבורד של Meta).
alter table clinic_whatsapp_settings rename column instance_id to phone_number_id;
-- כתובת API ייעודית — רלוונטי רק ל-Green API. ל-Meta כתובת קבועה (graph.facebook.com).
alter table clinic_whatsapp_settings drop column api_url;
alter table clinic_whatsapp_settings add column template_name text;
alter table clinic_whatsapp_settings add column template_lang text not null default 'he';

-- opt-in/out למטפל/ת (דרישה של Meta, ומוריד דיווחי ספאם). לא שדה privilege
-- — enforce_profile_privilege_columns לא נוגע בו, עדכון עצמי ישיר מ-/profile.
alter table profiles add column whatsapp_reminders boolean not null default true;

-- החתימות משתנות (פרמטרים + עמודות return) → drop לפני create, אחרת
-- overload חופף / שגיאת "cannot change return type".
drop function if exists admin_set_clinic_whatsapp_settings(boolean, text, text, text, text, text, integer, text);
drop function if exists get_clinic_whatsapp_credentials(uuid);

create function admin_set_clinic_whatsapp_settings(
  p_enabled boolean default null,
  p_phone_number_id text default null,
  p_access_token text default null,
  p_sender_phone text default null,
  p_hours_before integer default null,
  p_template text default null,
  p_template_name text default null,
  p_template_lang text default null
)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_clinic_id uuid;
  v_key text;
begin
  if not is_admin() then
    raise exception 'FORBIDDEN';
  end if;
  v_clinic_id := current_clinic_id();

  select decrypted_secret into v_key from vault.decrypted_secrets where name = 'whatsapp_secrets_key';
  if v_key is null then
    raise exception 'ENCRYPTION_KEY_MISSING';
  end if;

  insert into clinic_whatsapp_settings
    (clinic_id, enabled, provider, phone_number_id, api_token, sender_phone, hours_before, template, template_name, template_lang, updated_by)
  values (
    v_clinic_id,
    coalesce(p_enabled, false),
    'meta_cloud',
    p_phone_number_id,
    case when p_access_token is not null then pgp_sym_encrypt(p_access_token, v_key) else null end,
    p_sender_phone,
    coalesce(p_hours_before, 24),
    coalesce(p_template, 'שלום {name}, תזכורת להזמנה שלך ב-{clinic}: {date} בשעה {time}, {room} ({branch}).'),
    p_template_name,
    coalesce(p_template_lang, 'he'),
    app_user_id()
  )
  on conflict (clinic_id) do update set
    enabled         = coalesce(excluded.enabled, clinic_whatsapp_settings.enabled),
    provider        = 'meta_cloud',
    phone_number_id = coalesce(excluded.phone_number_id, clinic_whatsapp_settings.phone_number_id),
    api_token       = coalesce(excluded.api_token, clinic_whatsapp_settings.api_token),
    sender_phone    = coalesce(excluded.sender_phone, clinic_whatsapp_settings.sender_phone),
    hours_before    = coalesce(p_hours_before, clinic_whatsapp_settings.hours_before),
    template        = coalesce(p_template, clinic_whatsapp_settings.template),
    template_name   = coalesce(excluded.template_name, clinic_whatsapp_settings.template_name),
    template_lang   = coalesce(p_template_lang, clinic_whatsapp_settings.template_lang),
    updated_by      = excluded.updated_by,
    updated_at      = now();

  insert into audit_log (clinic_id, actor_id, action, entity, entity_id, after)
  values (
    v_clinic_id, app_user_id(), 'whatsapp_settings_updated', 'clinic_whatsapp_settings', v_clinic_id,
    jsonb_build_object(
      'enabled', coalesce(p_enabled, false),
      'provider', 'meta_cloud',
      'hours_before', coalesce(p_hours_before, 24),
      'template_name', p_template_name,
      'token_changed', p_access_token is not null
    )
  );
end;
$$;

create function get_clinic_whatsapp_credentials(p_clinic_id uuid)
returns table(
  enabled boolean,
  phone_number_id text,
  access_token text,
  sender_phone text,
  hours_before integer,
  template text,
  template_name text,
  template_lang text
)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_key text;
begin
  if auth.role() <> 'service_role' then
    raise exception 'FORBIDDEN';
  end if;

  select decrypted_secret into v_key from vault.decrypted_secrets where name = 'whatsapp_secrets_key';

  return query
  select
    s.enabled,
    s.phone_number_id,
    case when s.api_token is not null then pgp_sym_decrypt(s.api_token, v_key) else null end,
    s.sender_phone,
    s.hours_before,
    s.template,
    s.template_name,
    s.template_lang
  from clinic_whatsapp_settings s
  where s.clinic_id = p_clinic_id;
end;
$$;

-- המסלול החצי-ידני: האדמין שלח/ה בעצמו/ה דרך wa.me ומסמן/ת "נשלח" — כדי
-- שה-cron האוטומטי לא ישלח שוב, ולמעקב. bookings היא RPC-only (CLAUDE.md #1).
create function admin_mark_whatsapp_reminder_sent(p_booking_id uuid)
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

  select * into v_booking from bookings where id = p_booking_id and clinic_id = v_clinic_id for update;
  if not found then
    raise exception 'FORBIDDEN';
  end if;
  if v_booking.whatsapp_reminder_sent_at is not null then
    return; -- אידמפוטנטי
  end if;

  update bookings set whatsapp_reminder_sent_at = now() where id = p_booking_id;

  insert into audit_log (clinic_id, actor_id, action, entity, entity_id, after)
  values (v_clinic_id, app_user_id(), 'whatsapp_reminder_sent', 'bookings', p_booking_id,
          jsonb_build_object('provider', 'manual'));
end;
$$;

-- 🔴 anon מפורש (לקח מ-20260907000001).
revoke all on function admin_set_clinic_whatsapp_settings(boolean, text, text, text, integer, text, text, text) from public, anon;
grant execute on function admin_set_clinic_whatsapp_settings(boolean, text, text, text, integer, text, text, text) to authenticated;
revoke all on function get_clinic_whatsapp_credentials(uuid) from public, anon, authenticated;
grant execute on function get_clinic_whatsapp_credentials(uuid) to service_role;
revoke all on function admin_mark_whatsapp_reminder_sent(uuid) from public, anon;
grant execute on function admin_mark_whatsapp_reminder_sent(uuid) to authenticated;
