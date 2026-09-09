-- End-to-end isolation smoke test: two clinics, two owners, verify a
-- therapist bug/attempt to touch another clinic's room is blocked at the
-- RPC layer, RLS blocks cross-tenant profile reads, and public_availability
-- never leaks across clinics.
\set ON_ERROR_STOP on

begin;

-- Identity is Clerk (20260905000003+): app_user_id() maps the JWT `sub`
-- (request.jwt.claims) to profiles.clerk_user_id, so the test sets the claim
-- instead of inserting auth.users rows.

-- From here on, run as the actual restricted 'authenticated' role (not
-- postgres/superuser) so RLS policies are genuinely enforced, not bypassed
-- by table ownership. SECURITY DEFINER RPCs still run as their owner
-- (postgres) internally, exactly like in production.
set role authenticated;

select set_config('cleana.test_role', 'authenticated', true);

select set_config('request.jwt.claims', '{"sub":"user_owner_a"}', true);
select * from signup_clinic('Clinic A', 'clinic-a', 'Owner A', '0500000001', 'ownerA@test.com');
select id as clinic_a_id into temp t_clinic_a from clinics where slug = 'clinic-a';
select id as owner_a_id into temp t_owner_a from profiles where clinic_id = (select clinic_a_id from t_clinic_a) and role = 'owner';

select set_config('request.jwt.claims', '{"sub":"user_owner_b"}', true);
select * from signup_clinic('Clinic B', 'clinic-b', 'Owner B', '0500000002', 'ownerB@test.com');
select id as clinic_b_id into temp t_clinic_b from clinics where slug = 'clinic-b';
select id as owner_b_id into temp t_owner_b from profiles where clinic_id = (select clinic_b_id from t_clinic_b) and role = 'owner';

-- grant_bonus_hours is blocked during trial (20260906000003) — move both clinics to a paid plan first,
-- as the platform (postgres), exactly like a payment would.
reset role;
update platform_subscriptions set plan = 'basic' where clinic_id in ((select clinic_a_id from t_clinic_a), (select clinic_b_id from t_clinic_b));
set role authenticated;

-- Owner A creates branch + room
select set_config('request.jwt.claims', '{"sub":"user_owner_a"}', true);
select * from create_branch('Branch A1', 'Address A1');
select id as branch_a_id into temp t_branch_a from branches where clinic_id = (select clinic_a_id from t_clinic_a);
select * from create_room((select branch_a_id from t_branch_a), 'Room A1', array['talk']::room_type[]);
select id as room_a_id into temp t_room_a from rooms where clinic_id = (select clinic_a_id from t_clinic_a);

-- Owner B creates branch + room
select set_config('request.jwt.claims', '{"sub":"user_owner_b"}', true);
select * from create_branch('Branch B1', 'Address B1');
select id as branch_b_id into temp t_branch_b from branches where clinic_id = (select clinic_b_id from t_clinic_b);
select * from create_room((select branch_b_id from t_branch_b), 'Room B1', array['talk']::room_type[]);
select id as room_b_id into temp t_room_b from rooms where clinic_id = (select clinic_b_id from t_clinic_b);

-- give each owner a punch card so they can book (grant_bonus_hours: is_admin() -- owner qualifies)
select set_config('request.jwt.claims', '{"sub":"user_owner_a"}', true);
select * from grant_bonus_hours((select owner_a_id from t_owner_a), 10, 'test grant');

-- Owner A books their own room A1 -- should succeed
select * from create_booking((select room_a_id from t_room_a), date_trunc('day', now()) + interval '1 day 9 hours', date_trunc('day', now()) + interval '1 day 10 hours');

-- 🔴 CRITICAL: Owner A (still authenticated as clinic A) tries to book Clinic B's room
do $$
declare
  v_failed boolean := false;
begin
  begin
    perform create_booking((select room_b_id from t_room_b), date_trunc('day', now()) + interval '2 days 9 hours', date_trunc('day', now()) + interval '2 days 10 hours');
  exception when others then
    v_failed := true;
    raise notice 'cross-tenant booking correctly rejected: %', sqlerrm;
  end;
  if not v_failed then
    raise exception 'SECURITY BUG: cross-tenant booking succeeded!';
  end if;
end $$;

-- 🔴 CRITICAL: public_availability for owner A must NOT show clinic B's room/booking
select set_config('request.jwt.claims', '{"sub":"user_owner_b"}', true);
select * from grant_bonus_hours((select owner_b_id from t_owner_b), 10, 'test grant');
select * from create_booking((select room_b_id from t_room_b), date_trunc('day', now()) + interval '3 days 9 hours', date_trunc('day', now()) + interval '3 days 10 hours');

select set_config('request.jwt.claims', '{"sub":"user_owner_a"}', true);
do $$
declare
  v_leak_count int;
begin
  select count(*) into v_leak_count from public_availability where room_id = (select room_b_id from t_room_b);
  if v_leak_count > 0 then
    raise exception 'SECURITY BUG: public_availability leaked clinic B booking to clinic A user!';
  end if;
  raise notice 'public_availability isolation OK (0 rows leaked)';
end $$;

-- 🔴 profiles RLS: owner A (real 'authenticated' role, RLS enforced) cannot see owner B's profile row
do $$
declare
  v_count int;
begin
  select count(*) into v_count from profiles where id = (select owner_b_id from t_owner_b);
  if v_count > 0 then
    raise exception 'SECURITY BUG: profiles RLS leaked cross-tenant!';
  end if;
  raise notice 'profiles RLS isolation OK';
end $$;

-- 🔴 branches/rooms RLS: owner A cannot see clinic B's branch/room rows directly
do $$
declare
  v_count int;
begin
  select count(*) into v_count from rooms where id = (select room_b_id from t_room_b);
  if v_count > 0 then
    raise exception 'SECURITY BUG: rooms RLS leaked cross-tenant!';
  end if;
  raise notice 'rooms RLS isolation OK';
end $$;

-- Same phone number across two different clinics must be ALLOWED (spec §9 bugfix)
select set_config('request.jwt.claims', '{"sub":"user_owner_a"}', true);
do $$
begin
  update profiles set phone = '0501234567' where id = (select owner_a_id from t_owner_a);
end $$;
select set_config('request.jwt.claims', '{"sub":"user_owner_b"}', true);
do $$
begin
  update profiles set phone = '0501234567' where id = (select owner_b_id from t_owner_b);
  raise notice 'same phone across two different clinics: allowed as expected (unique(clinic_id, phone))';
end $$;

-- 🔴 self-escalation: a plain client-side UPDATE must never let a user grant themselves admin/owner
select set_config('request.jwt.claims', '{"sub":"user_owner_a"}', true);
update profiles set role = 'admin' where id = (select owner_a_id from t_owner_a);
do $$
declare
  v_role user_role;
begin
  select role into v_role from profiles where id = (select owner_a_id from t_owner_a);
  if v_role <> 'owner' then
    raise exception 'SECURITY BUG: self-escalation via direct UPDATE succeeded! role=%', v_role;
  end if;
  raise notice 'self-escalation guard OK (role still owner)';
end $$;

-- 🔴 clinic_id hijack: a plain client-side UPDATE must never move a profile to another clinic
update profiles set clinic_id = (select clinic_b_id from t_clinic_b) where id = (select owner_a_id from t_owner_a);
do $$
declare
  v_clinic uuid;
begin
  select clinic_id into v_clinic from profiles where id = (select owner_a_id from t_owner_a);
  if v_clinic <> (select clinic_a_id from t_clinic_a) then
    raise exception 'SECURITY BUG: clinic_id hijack via direct UPDATE succeeded!';
  end if;
  raise notice 'clinic_id hijack guard OK (still clinic A)';
end $$;

reset role;
rollback;
