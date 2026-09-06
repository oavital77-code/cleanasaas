-- הצפנת סודות ה-Woo (consumer secret + webhook secret) של כל קליניקה.
-- עד עכשיו נשמרו כטקסט רגיל, מוגנים רק ב-RLS (ר' PROGRESS.md, "מגבלות
-- ידועות"). הטבלה ריקה לגמרי כרגע (אין עדיין קליניקה עם חיבור Woo אמיתי)
-- אז אין נתונים קיימים למגר — מוחלף ל-bytea ישירות בלי שלב "using".
--
-- מפתח ההצפנה עצמו מאוחסן ב-Supabase Vault (מותקן כבר בפרויקט) ולא בקוד
-- האפליקציה/env — pgcrypto's pgp_sym_encrypt/decrypt קורא אותו מ-
-- vault.decrypted_secrets, נגיש רק מתוך SECURITY DEFINER functions, לעולם
-- לא ישירות מ-anon/authenticated.
do $$
begin
  if not exists (select 1 from vault.secrets where name = 'woo_secrets_key') then
    perform vault.create_secret(
      encode(extensions.gen_random_bytes(32), 'base64'),
      'woo_secrets_key',
      'מפתח סימטרי ל-pgp_sym_encrypt/decrypt על clinic_payment_settings.woo_consumer_secret/woo_webhook_secret.'
    );
  end if;
end $$;

alter table clinic_payment_settings drop column woo_consumer_secret;
alter table clinic_payment_settings drop column woo_webhook_secret;
alter table clinic_payment_settings add column woo_consumer_secret bytea;
alter table clinic_payment_settings add column woo_webhook_secret bytea;

-- כתיבה: רק אדמין הקליניקה שלו/ה, מצפין לפני האחסון. שדה = null בקריאה
-- אומר "לא לגעת בערך הקיים" (בדיוק כמו הלוגיקה הקיימת ב-
-- updatePaymentSettingsAction — כאן רק מוסיפים הצפנה, לא משנים את הסמנטיקה).
create or replace function admin_set_clinic_woo_secrets(
  p_woo_store_url text default null,
  p_woo_consumer_key text default null,
  p_woo_consumer_secret text default null,
  p_woo_webhook_secret text default null,
  p_woo_session_product_id integer default null
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

  select decrypted_secret into v_key from vault.decrypted_secrets where name = 'woo_secrets_key';
  if v_key is null then
    raise exception 'ENCRYPTION_KEY_MISSING';
  end if;

  insert into clinic_payment_settings (clinic_id, woo_store_url, woo_consumer_key, woo_consumer_secret, woo_webhook_secret, updated_by)
  values (
    v_clinic_id,
    p_woo_store_url,
    p_woo_consumer_key,
    case when p_woo_consumer_secret is not null then pgp_sym_encrypt(p_woo_consumer_secret, v_key) else null end,
    case when p_woo_webhook_secret is not null then pgp_sym_encrypt(p_woo_webhook_secret, v_key) else null end,
    app_user_id()
  )
  on conflict (clinic_id) do update set
    woo_store_url = coalesce(excluded.woo_store_url, clinic_payment_settings.woo_store_url),
    woo_consumer_key = coalesce(excluded.woo_consumer_key, clinic_payment_settings.woo_consumer_key),
    woo_consumer_secret = coalesce(excluded.woo_consumer_secret, clinic_payment_settings.woo_consumer_secret),
    woo_webhook_secret = coalesce(excluded.woo_webhook_secret, clinic_payment_settings.woo_webhook_secret),
    updated_by = excluded.updated_by,
    updated_at = now();

  if p_woo_session_product_id is not null then
    insert into app_settings (clinic_id, key, value)
    values (v_clinic_id, 'woo_session_product_id', to_jsonb(p_woo_session_product_id))
    on conflict (clinic_id, key) do update set value = excluded.value;
  end if;
end;
$$;

revoke all on function admin_set_clinic_woo_secrets(text, text, text, text, integer) from public;
grant execute on function admin_set_clinic_woo_secrets(text, text, text, text, integer) to authenticated;

-- קריאה (מפוענח): service_role בלבד — לעולם לא authenticated/anon. זה בדיוק
-- הקוד השרתי הקיים (lib/woo/rest-client.ts, webhook route) שכבר משתמש
-- ב-createAdminClient(); לא נחשף ל-UI/לאדמין בממשק בשום מסך.
create or replace function get_clinic_woo_credentials(p_clinic_id uuid)
returns table(woo_store_url text, woo_consumer_key text, woo_consumer_secret text, woo_webhook_secret text)
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

  select decrypted_secret into v_key from vault.decrypted_secrets where name = 'woo_secrets_key';

  return query
  select
    cps.woo_store_url,
    cps.woo_consumer_key,
    case when cps.woo_consumer_secret is not null then pgp_sym_decrypt(cps.woo_consumer_secret, v_key) else null end,
    case when cps.woo_webhook_secret is not null then pgp_sym_decrypt(cps.woo_webhook_secret, v_key) else null end
  from clinic_payment_settings cps
  where cps.clinic_id = p_clinic_id;
end;
$$;

revoke all on function get_clinic_woo_credentials(uuid) from public, anon, authenticated;
grant execute on function get_clinic_woo_credentials(uuid) to service_role;
