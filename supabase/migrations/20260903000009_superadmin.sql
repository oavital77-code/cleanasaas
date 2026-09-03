-- Cleana SaaS — Superadmin: ראייה חוצת-קליניקות (SAASMIGRATIONSPEC §8)
-- platform_admins/platform_audit_log/is_superadmin() כבר הוגדרו ב-init_schema+rls.
-- superadmin_set_clinic_status/superadmin_set_plan כבר הוגדרו ב-platform_billing.
-- כאן: RPC לרשימת קליניקות (הבסיס למסך /superadmin).

create or replace function superadmin_list_clinics()
returns table (
  clinic_id uuid,
  name text,
  slug text,
  status clinic_status,
  plan text,
  subscription_status text,
  current_period_end timestamptz,
  branches_count bigint,
  rooms_count bigint,
  therapists_count bigint,
  created_at timestamptz
) as $$
begin
  if not is_superadmin() then
    raise exception 'FORBIDDEN';
  end if;

  return query
  select
    c.id, c.name, c.slug, c.status,
    ps.plan, ps.status, ps.current_period_end,
    (select count(*) from branches b where b.clinic_id = c.id),
    (select count(*) from rooms r where r.clinic_id = c.id),
    (select count(*) from profiles p where p.clinic_id = c.id and p.role = 'therapist'),
    c.created_at
  from clinics c
  left join platform_subscriptions ps on ps.clinic_id = c.id
  order by c.created_at desc;
end;
$$ language plpgsql security definer stable set search_path = public;

-- ═══ Impersonation — כניסה "בשם" קליניקה לצורך תמיכה. לא בנוי ב-MVP הזה
-- (SAASMIGRATIONSPEC §8: "זו בדיוק הנקודה הכי רגישה מבחינת פרטיות"). המקום
-- הנכון להתחיל ממנו כשיידרש בפועל: לא session-swap שקט, אלא RPC ששואב
-- read-only view מוגבל + כתיבה חובה ל-platform_audit_log על כל שאילתה
-- (מי, מתי, לאיזו קליניקה, למה) לפני שמאשרים לו לגעת בנתון עסקי אחד. ═══
