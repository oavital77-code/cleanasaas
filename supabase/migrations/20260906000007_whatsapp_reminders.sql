-- תזכורות WhatsApp למטפל/ת לפני הזמנה, מהמספר העסקי של הקליניקה, דרך
-- שער QR (Green API / Whapi) — ר' PROGRESS.md סעיף 24 להחלטה על הספק
-- (המשתמש בחר במפורש שער QR לא-רשמי על פני Meta Cloud API, בידיעה על
-- הסיכון בתנאי השימוש של WhatsApp).
--
-- אותה תבנית בדיוק כמו clinic_payment_settings + הצפנת סודות Woo
-- (20260906000002): הטוקן מוצפן ב-pgcrypto עם מפתח ב-Supabase Vault,
-- כתיבה רק דרך RPC של אדמין הקליניקה, קריאה מפוענחת רק ל-service_role
-- (ה-cron). ה-UI לעולם לא רואה את הטוקן — רק "מוגדר/לא מוגדר".

do $$
begin
  if not exists (select 1 from vault.secrets where name = 'whatsapp_secrets_key') then
    perform vault.create_secret(
      encode(extensions.gen_random_bytes(32), 'base64'),
      'whatsapp_secrets_key',
      'מפתח סימטרי ל-pgp_sym_encrypt/decrypt על clinic_whatsapp_settings.api_token.'
    );
  end if;
end $$;

create table clinic_whatsapp_settings (
  clinic_id     uuid primary key references clinics(id) on delete cascade,
  enabled       boolean not null default false,
  provider      text not null default 'green_api' check (provider in ('green_api', 'whapi')),
  -- Green API: idInstance (לא סודי). Whapi: לא בשימוש.
  instance_id   text,
  -- Green API: כתובת ה-API הייעודית מהקונסולה (למשל https://7103.api.greenapi.com).
  -- ריק → ברירת המחדל של הספק בקוד (lib/whatsapp).
  api_url       text,
  -- מוצפן. null = לא הוגדר עדיין.
  api_token     bytea,
  -- המספר העסקי שקושר ב-QR — לתצוגה בלבד; השער שולח ממה שקושר אצלו בפועל.
  sender_phone  text,
  hours_before  integer not null default 24 check (hours_before between 1 and 72),
  -- משתנים: {name} {date} {time} {room} {branch} {clinic}
  template      text not null default 'שלום {name}, תזכורת להזמנה שלך ב-{clinic}: {date} בשעה {time}, {room} ({branch}).',
  updated_by    uuid references profiles(id),
  updated_at    timestamptz default now()
);

alter table clinic_whatsapp_settings enable row level security;

-- אדמין הקליניקה בלבד — הגנת-עומק; הכתיבה בפועל דרך ה-RPC למטה (הצפנה),
-- והקריאה מה-UI היא רק לשדות הלא-סודיים + "האם api_token קיים".
create policy admin_all_whatsapp_settings on clinic_whatsapp_settings for all
  using (is_admin() and clinic_id = current_clinic_id());

-- מקביל ל-bookings.reminder_sent_at (מייל) — ערוץ נפרד, סימון נפרד, כדי
-- שכיבוי/הפעלה של WhatsApp לא ישפיע על תזכורות המייל ולהפך.
alter table bookings add column whatsapp_reminder_sent_at timestamptz;

-- כתיבה: אדמין הקליניקה שלו/ה. שדה = null → "לא לגעת בערך הקיים" (אותה
-- סמנטיקה כמו admin_set_clinic_woo_secrets). p_enabled מועבר תמיד
-- מהטופס (checkbox → true/false מפורש), לא null.
create or replace function admin_set_clinic_whatsapp_settings(
  p_enabled boolean default null,
  p_provider text default null,
  p_instance_id text default null,
  p_api_url text default null,
  p_api_token text default null,
  p_sender_phone text default null,
  p_hours_before integer default null,
  p_template text default null
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
    (clinic_id, enabled, provider, instance_id, api_url, api_token, sender_phone, hours_before, template, updated_by)
  values (
    v_clinic_id,
    coalesce(p_enabled, false),
    coalesce(p_provider, 'green_api'),
    p_instance_id,
    p_api_url,
    case when p_api_token is not null then pgp_sym_encrypt(p_api_token, v_key) else null end,
    p_sender_phone,
    coalesce(p_hours_before, 24),
    coalesce(p_template, 'שלום {name}, תזכורת להזמנה שלך ב-{clinic}: {date} בשעה {time}, {room} ({branch}).'),
    app_user_id()
  )
  on conflict (clinic_id) do update set
    enabled      = coalesce(excluded.enabled, clinic_whatsapp_settings.enabled),
    provider     = coalesce(p_provider, clinic_whatsapp_settings.provider),
    instance_id  = coalesce(excluded.instance_id, clinic_whatsapp_settings.instance_id),
    api_url      = coalesce(excluded.api_url, clinic_whatsapp_settings.api_url),
    api_token    = coalesce(excluded.api_token, clinic_whatsapp_settings.api_token),
    sender_phone = coalesce(excluded.sender_phone, clinic_whatsapp_settings.sender_phone),
    hours_before = coalesce(p_hours_before, clinic_whatsapp_settings.hours_before),
    template     = coalesce(p_template, clinic_whatsapp_settings.template),
    updated_by   = excluded.updated_by,
    updated_at   = now();

  -- ביקורת — בלי הטוקן ובלי הטלפון (CLAUDE.md: אין PII/סודות בלוגים).
  insert into audit_log (clinic_id, actor_id, action, entity, entity_id, after)
  values (
    v_clinic_id,
    app_user_id(),
    'whatsapp_settings_updated',
    'clinic_whatsapp_settings',
    v_clinic_id,
    jsonb_build_object(
      'enabled', coalesce(p_enabled, false),
      'provider', coalesce(p_provider, 'green_api'),
      'hours_before', coalesce(p_hours_before, 24),
      'token_changed', p_api_token is not null
    )
  );
end;
$$;

revoke all on function admin_set_clinic_whatsapp_settings(boolean, text, text, text, text, text, integer, text) from public;
grant execute on function admin_set_clinic_whatsapp_settings(boolean, text, text, text, text, text, integer, text) to authenticated;

-- קריאה (מפוענח): service_role בלבד — ה-cron (send-reminders) ו-server
-- action של "שליחת בדיקה" שרץ עם createAdminClient אחרי requireClinicAdmin.
create or replace function get_clinic_whatsapp_credentials(p_clinic_id uuid)
returns table(
  enabled boolean,
  provider text,
  instance_id text,
  api_url text,
  api_token text,
  sender_phone text,
  hours_before integer,
  template text
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
    s.provider,
    s.instance_id,
    s.api_url,
    case when s.api_token is not null then pgp_sym_decrypt(s.api_token, v_key) else null end,
    s.sender_phone,
    s.hours_before,
    s.template
  from clinic_whatsapp_settings s
  where s.clinic_id = p_clinic_id;
end;
$$;

revoke all on function get_clinic_whatsapp_credentials(uuid) from public, anon, authenticated;
grant execute on function get_clinic_whatsapp_credentials(uuid) to service_role;

-- ה-cron רץ עם service_role ומצטרך את כל הקליניקות עם WhatsApp פעיל —
-- service_role עוקף RLS ממילא, אין צורך ב-policy נוספת.
