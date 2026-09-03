-- Cleana SaaS — owner/admin עורכים את הגדרות הקליניקה שלהם (שם, אזור זמן,
-- הפעלת מודל ססיה) דרך wizard/settings — אבל status ו-slug נשארים בשליטת
-- הפלטפורמה (superadmin RPC / הקצאה חד-פעמית בהרשמה) בלבד.

create policy admin_update_own_clinic on clinics for update
  using (is_admin() and id = current_clinic_id());

create or replace function enforce_clinic_privilege_columns() returns trigger as $$
begin
  if current_setting('cleana.trusted_write', true) = 'on' then
    return new;
  end if;
  if is_superadmin() then
    return new;
  end if;

  new.status := old.status;
  new.slug := old.slug;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists clinics_privilege_guard on clinics;
create trigger clinics_privilege_guard
  before update on clinics
  for each row execute function enforce_clinic_privilege_columns();
