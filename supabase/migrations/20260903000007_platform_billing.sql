-- Cleana SaaS — תשלום הקליניקות לפלטפורמה + הגבלות תוכנית (SAASMIGRATIONSPEC §7)
-- נפרד לגמרי מ-clinic_payment_settings (איך הקליניקה גובה מהמטופלים שלה).

create table platform_plan_limits (
  plan            text primary key,
  max_branches    int,
  max_rooms       int,
  max_therapists  int
);

insert into platform_plan_limits (plan, max_branches, max_rooms, max_therapists) values
  ('trial', 1, 3, 5),
  ('basic', 2, 10, 50),
  ('pro',   null, null, null) -- ללא הגבלה
on conflict (plan) do nothing;

create table platform_subscriptions (
  clinic_id            uuid primary key references clinics(id) on delete cascade,
  plan                 text not null default 'trial' references platform_plan_limits(plan),
  status               text not null default 'trialing'
                          check (status in ('trialing', 'active', 'past_due', 'suspended', 'canceled')),
  current_period_end   timestamptz,
  external_payment_id  text,
  created_at           timestamptz default now(),
  updated_at           timestamptz default now()
);

alter table platform_plan_limits  enable row level security;
alter table platform_subscriptions enable row level security;

create policy read_plan_limits on platform_plan_limits for select using (true);
create policy read_own_subscription on platform_subscriptions for select
  using (clinic_id = current_clinic_id() or is_superadmin());
-- כתיבה (שינוי תוכנית/סטטוס) — superadmin/service בלבד, ר' RPCs למטה.

-- ═══ אכיפת מכסות — נקרא מ-create_branch/create_room/accept_therapist_invite ═══
create or replace function assert_within_plan_quota(p_clinic_id uuid, p_resource text)
returns void as $$
declare
  v_plan text;
  v_limits platform_plan_limits%rowtype;
  v_count int;
begin
  select plan into v_plan from platform_subscriptions where clinic_id = p_clinic_id;
  v_plan := coalesce(v_plan, 'trial');
  select * into v_limits from platform_plan_limits where plan = v_plan;
  if not found then
    return;
  end if;

  if p_resource = 'branch' then
    select count(*) into v_count from branches where clinic_id = p_clinic_id;
    if v_limits.max_branches is not null and v_count >= v_limits.max_branches then
      raise exception 'PLAN_LIMIT_BRANCHES';
    end if;
  elsif p_resource = 'room' then
    select count(*) into v_count from rooms where clinic_id = p_clinic_id;
    if v_limits.max_rooms is not null and v_count >= v_limits.max_rooms then
      raise exception 'PLAN_LIMIT_ROOMS';
    end if;
  elsif p_resource = 'therapist' then
    select count(*) into v_count from profiles where clinic_id = p_clinic_id and role = 'therapist';
    if v_limits.max_therapists is not null and v_count >= v_limits.max_therapists then
      raise exception 'PLAN_LIMIT_THERAPISTS';
    end if;
  end if;
end;
$$ language plpgsql security definer stable set search_path = public;

-- ═══ יצירת סניף/חדר — RPC (לא insert ישיר) כדי שאכיפת המכסה תהיה אטומית ═══
create or replace function create_branch(p_name text, p_address text, p_waze_url text default null, p_phone text default null)
returns table (branch_id uuid) as $$
declare
  v_clinic_id uuid;
  v_id uuid;
begin
  select clinic_id into v_clinic_id from profiles where id = auth.uid();
  if not is_admin() then
    raise exception 'FORBIDDEN';
  end if;

  perform assert_within_plan_quota(v_clinic_id, 'branch');

  insert into branches (clinic_id, name, address, waze_url, phone)
  values (v_clinic_id, p_name, p_address, p_waze_url, p_phone)
  returning id into v_id;

  insert into audit_log (clinic_id, actor_id, action, entity, entity_id, after)
  values (v_clinic_id, auth.uid(), 'branch_created', 'branches', v_id, jsonb_build_object('name', p_name));

  return query select v_id;
end;
$$ language plpgsql security definer set search_path = public;

create or replace function create_room(
  p_branch_id uuid,
  p_name text,
  p_room_type room_type[],
  p_capacity int default 2,
  p_description text default null,
  p_equipment jsonb default '[]'::jsonb
)
returns table (room_id uuid) as $$
declare
  v_clinic_id uuid;
  v_branch_clinic uuid;
  v_id uuid;
begin
  select clinic_id into v_clinic_id from profiles where id = auth.uid();
  if not is_admin() then
    raise exception 'FORBIDDEN';
  end if;

  select clinic_id into v_branch_clinic from branches where id = p_branch_id;
  if v_branch_clinic is null or v_branch_clinic <> v_clinic_id then
    raise exception 'FORBIDDEN';
  end if;

  perform assert_within_plan_quota(v_clinic_id, 'room');

  insert into rooms (clinic_id, branch_id, name, room_type, capacity, description, equipment)
  values (v_clinic_id, p_branch_id, p_name, p_room_type, p_capacity, p_description, p_equipment)
  returning id into v_id;

  insert into audit_log (clinic_id, actor_id, action, entity, entity_id, after)
  values (v_clinic_id, auth.uid(), 'room_created', 'rooms', v_id, jsonb_build_object('name', p_name, 'branch_id', p_branch_id));

  return query select v_id;
end;
$$ language plpgsql security definer set search_path = public;

-- ═══ superadmin: שינוי תוכנית/סטטוס מנוי הפלטפורמה + השעיה/הפעלה של קליניקה ═══
create or replace function superadmin_set_clinic_status(p_clinic_id uuid, p_status clinic_status, p_reason text default null)
returns void as $$
declare
  v_before clinic_status;
begin
  if not is_superadmin() then
    raise exception 'FORBIDDEN';
  end if;

  select status into v_before from clinics where id = p_clinic_id;
  if v_before is null then
    raise exception 'FORBIDDEN';
  end if;

  update clinics set status = p_status where id = p_clinic_id;

  insert into platform_audit_log (actor_id, action, clinic_id, before, after)
  values (auth.uid(), 'clinic_status_changed', p_clinic_id,
          jsonb_build_object('status', v_before), jsonb_build_object('status', p_status, 'reason', p_reason));
end;
$$ language plpgsql security definer set search_path = public;

create or replace function superadmin_set_plan(p_clinic_id uuid, p_plan text, p_status text default 'active', p_current_period_end timestamptz default null)
returns void as $$
begin
  if not is_superadmin() then
    raise exception 'FORBIDDEN';
  end if;

  update platform_subscriptions
  set plan = p_plan, status = p_status, current_period_end = p_current_period_end, updated_at = now()
  where clinic_id = p_clinic_id;
  if not found then
    raise exception 'FORBIDDEN';
  end if;

  insert into platform_audit_log (actor_id, action, clinic_id, after)
  values (auth.uid(), 'plan_changed', p_clinic_id, jsonb_build_object('plan', p_plan, 'status', p_status));
end;
$$ language plpgsql security definer set search_path = public;

-- ═══ cron: trial שפג ולא שודרג → suspended (לוגין עדיין עובד, בלי הזמנות חדשות) ═══
create or replace function expire_trial_subscriptions()
returns void as $$
begin
  perform assert_service_or_admin();

  update clinics c
  set status = 'suspended'
  from platform_subscriptions ps
  where ps.clinic_id = c.id
    and c.status <> 'suspended'
    and ps.status = 'trialing'
    and ps.current_period_end is not null
    and ps.current_period_end < now();

  update platform_subscriptions
  set status = 'past_due'
  where status = 'trialing' and current_period_end is not null and current_period_end < now();
end;
$$ language plpgsql security definer set search_path = public;
