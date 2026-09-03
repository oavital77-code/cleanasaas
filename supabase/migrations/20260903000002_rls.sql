-- Cleana SaaS — Row Level Security, רב-דיירי
-- ר' SAASMIGRATIONSPEC.md §2: כל policy מוסיפה תנאי שלישי — clinic_id תואם
-- לקליניקה של המשתמש המחובר, שנגזרת תמיד מ-auth.uid() → profiles.clinic_id,
-- אף פעם לא מקלט של הלקוח.

-- ═══ פונקציות עזר — כולן SECURITY DEFINER + search_path קבוע מהיום הראשון
-- (לקח אבטחה מהמערכת המקורית: בלי search_path קבוע, CREATE TEMP TABLE
-- profiles יכול לעקוף את כל הבדיקות דרך pg_temp). ═══

-- קליניקה של המשתמש המחובר. שאר כל ה-RLS/RPCs נשענים על הפונקציה הזו —
-- לעולם לא על clinic_id שמגיע כפרמטר מהלקוח.
create or replace function current_clinic_id() returns uuid as $$
  select clinic_id from profiles where id = auth.uid();
$$ language sql security definer stable set search_path = public;

create or replace function is_admin() returns boolean as $$
  select exists (
    select 1 from profiles where id = auth.uid() and role in ('owner', 'admin')
  );
$$ language sql security definer stable set search_path = public;

-- superadmin הוא תפקיד פלטפורמה, לא חבר באף קליניקה (spec §8) — טבלה נפרדת,
-- לא role בתוך profiles.
create or replace function is_superadmin() returns boolean as $$
  select exists (select 1 from platform_admins where user_id = auth.uid());
$$ language sql security definer stable set search_path = public;

-- לשימוש ב-RPCs שנקראים רק מ-webhook/cron (service role) או אדמין ידני —
-- 🔴 בודק auth.role() בפועל, לא "auth.uid() is null" (זה גם המצב של anon
-- key בלי משתמש מחובר בכלל — לקח אבטחה מהמערכת המקורית, ר' תיעוד היסטורי
-- 20260828000008).
create or replace function assert_service_or_admin() returns void as $$
begin
  if auth.role() = 'service_role' then
    return;
  end if;
  if not is_admin() then
    raise exception 'FORBIDDEN';
  end if;
end;
$$ language plpgsql security definer stable set search_path = public;

-- ═══ View לזמינות ציבורית — ר' init_schema להסבר המלא על current_clinic_id() ═══
create view public_availability as
select b.room_id, b.starts_at, b.ends_at, 'booked'::text as kind
from bookings b
join rooms r on r.id = b.room_id
where b.status = 'confirmed'
  and b.starts_at > now() - interval '1 day'
  and r.clinic_id = current_clinic_id()
union all
select rb.room_id, rb.starts_at, rb.ends_at, 'blocked'
from room_blocks rb
join rooms r on r.id = rb.room_id
where rb.ends_at > now() - interval '1 day'
  and r.clinic_id = current_clinic_id();

grant select on public_availability to authenticated;

-- ═══ Realtime לזמינות — טבלת שידור מצומצמת, כמו במקור, אבל עם clinic_id
-- כדי שמדיניות ה-select תוכל לסנן חוצה-דיירים (ר' spec §1 — הערה קריטית:
-- בלי clinic_id כאן, "using (true)" היה משדר לכל לקוח מחובר את כל
-- הקליניקות). ═══
create table availability_events (
  id          bigserial primary key,
  clinic_id   uuid not null references clinics(id) on delete cascade,
  room_id     uuid not null references rooms(id) on delete cascade,
  starts_at   timestamptz not null,
  ends_at     timestamptz not null,
  kind        text not null check (kind in ('booked', 'blocked')),
  action      text not null check (action in ('insert', 'delete')),
  created_at  timestamptz default now()
);
create index on availability_events (clinic_id, created_at desc);

alter table availability_events enable row level security;
create policy read_availability_events on availability_events for select
  using (clinic_id = current_clinic_id());

create or replace function emit_booking_availability_event() returns trigger as $$
declare
  v_clinic_id uuid;
begin
  if tg_op = 'INSERT' then
    if new.status = 'confirmed' then
      select clinic_id into v_clinic_id from rooms where id = new.room_id;
      insert into availability_events (clinic_id, room_id, starts_at, ends_at, kind, action)
      values (v_clinic_id, new.room_id, new.starts_at, new.ends_at, 'booked', 'insert');
    end if;
  elsif tg_op = 'UPDATE' then
    if old.status = 'confirmed' and new.status <> 'confirmed' then
      select clinic_id into v_clinic_id from rooms where id = old.room_id;
      insert into availability_events (clinic_id, room_id, starts_at, ends_at, kind, action)
      values (v_clinic_id, old.room_id, old.starts_at, old.ends_at, 'booked', 'delete');
    elsif old.status <> 'confirmed' and new.status = 'confirmed' then
      select clinic_id into v_clinic_id from rooms where id = new.room_id;
      insert into availability_events (clinic_id, room_id, starts_at, ends_at, kind, action)
      values (v_clinic_id, new.room_id, new.starts_at, new.ends_at, 'booked', 'insert');
    end if;
  elsif tg_op = 'DELETE' then
    if old.status = 'confirmed' then
      select clinic_id into v_clinic_id from rooms where id = old.room_id;
      insert into availability_events (clinic_id, room_id, starts_at, ends_at, kind, action)
      values (v_clinic_id, old.room_id, old.starts_at, old.ends_at, 'booked', 'delete');
    end if;
  end if;
  return null;
end;
$$ language plpgsql security definer set search_path = public;

create trigger bookings_availability_event
  after insert or update or delete on bookings
  for each row execute function emit_booking_availability_event();

create or replace function emit_room_block_availability_event() returns trigger as $$
declare
  v_clinic_id uuid;
begin
  if tg_op = 'INSERT' then
    select clinic_id into v_clinic_id from rooms where id = new.room_id;
    insert into availability_events (clinic_id, room_id, starts_at, ends_at, kind, action)
    values (v_clinic_id, new.room_id, new.starts_at, new.ends_at, 'blocked', 'insert');
  elsif tg_op = 'UPDATE' then
    select clinic_id into v_clinic_id from rooms where id = old.room_id;
    insert into availability_events (clinic_id, room_id, starts_at, ends_at, kind, action)
    values (v_clinic_id, old.room_id, old.starts_at, old.ends_at, 'blocked', 'delete');
    insert into availability_events (clinic_id, room_id, starts_at, ends_at, kind, action)
    values (v_clinic_id, new.room_id, new.starts_at, new.ends_at, 'blocked', 'insert');
  elsif tg_op = 'DELETE' then
    select clinic_id into v_clinic_id from rooms where id = old.room_id;
    insert into availability_events (clinic_id, room_id, starts_at, ends_at, kind, action)
    values (v_clinic_id, old.room_id, old.starts_at, old.ends_at, 'blocked', 'delete');
  end if;
  return null;
end;
$$ language plpgsql security definer set search_path = public;

create trigger room_blocks_availability_event
  after insert or update or delete on room_blocks
  for each row execute function emit_room_block_availability_event();

alter publication supabase_realtime add table availability_events;

-- ═══ Enable RLS ═══
alter table clinics                    enable row level security;
alter table profiles                   enable row level security;
alter table therapist_admin_notes      enable row level security;
alter table bookings                   enable row level security;
alter table punch_cards                enable row level security;
alter table punch_card_tiers           enable row level security;
alter table session_subscriptions      enable row level security;
alter table session_slots              enable row level security;
alter table payments                   enable row level security;
alter table overrun_charges            enable row level security;
alter table room_blocks                enable row level security;
alter table branches                   enable row level security;
alter table rooms                      enable row level security;
alter table app_settings               enable row level security;
alter table audit_log                  enable row level security;
alter table woo_product_tiers          enable row level security;
alter table woo_pending_purchases      enable row level security;
alter table clinic_payment_settings    enable row level security;
alter table platform_admins            enable row level security;
alter table platform_audit_log         enable row level security;

-- ═══ clinics: כל חבר קליניקה רואה את השורה של הקליניקה שלו; superadmin רואה הכל ═══
create policy read_own_clinic on clinics for select
  using (id = current_clinic_id() or is_superadmin());
-- עדכון (השעיה/הפעלה) — superadmin בלבד, דרך RPC ייעודי (ר' migration platform).
-- אין UPDATE policy כללית ל-owner/admin: שינוי status/plan הוא סמכות פלטפורמה.

-- ═══ profiles: רואה רק את עצמו + אדמין רואה את כל הקליניקה שלו + superadmin הכל ═══
create policy own_profile on profiles for select
  using (id = auth.uid() or (is_admin() and clinic_id = current_clinic_id()) or is_superadmin());
create policy edit_profile on profiles for update
  using (id = auth.uid() or (is_admin() and clinic_id = current_clinic_id()));
-- 🔴 אין insert policy עצמי (id=auth.uid()): הרשמת owner/therapist עוברת אך
-- ורק דרך RPCs מהימנים (signup_clinic / accept_therapist_invite) שגוזרים את
-- clinic_id בעצמם בצד השרת — לעולם לא לפי מה שהלקוח היה בוחר. admin יכול
-- להוסיף פרופיל (מסך קליטה ידנית) רק בתוך הקליניקה שלו.
create policy admin_insert_profile on profiles for insert
  with check (is_admin() and clinic_id = current_clinic_id());

-- מניעת העלאת הרשאות/החלפת קליניקה עצמית (לקח אבטחה מהמערכת המקורית,
-- ר' תיעוד היסטורי 20260825000001 + 20260828000008) — clinic_id ננעל *תמיד*,
-- גם לאדמין: מעבר בין קליניקות הוא לא זרימה נתמכת, ואם תידרש אי-פעם, זו
-- פעולת superadmin מפורשת ומתועדת, לא עדכון RLS רגיל.
--
-- 🔴 קריטי: הבדיקה היא new.id = auth.uid() (עריכה עצמית), לא is_admin().
-- owner/admin הם עצמם is_admin()=true על השורה של עצמם — "אם לא אדמין, נעל"
-- (כמו במקור החד-דיירי, ששם היה אדמין אחד מהימן משותף) היה מאפשר לכל
-- owner בהרשמה עצמאית להעניק לעצמו הרשאות/לשנות door_code על השורה שלו
-- עצמו. כאן: עריכה עצמית תמיד נעולה (גם ל-owner/admin) — רק אדמין שמעדכן
-- שורה של *מישהו אחר* באותה קליניקה יכול לשנות role/status/door_code.
create or replace function enforce_profile_privilege_columns() returns trigger as $$
begin
  if current_setting('cleana.trusted_write', true) = 'on' then
    return new;
  end if;

  if tg_op = 'UPDATE' then
    new.clinic_id := old.clinic_id;
    new.phone := old.phone;
    new.email := old.email;
    if new.id = auth.uid() or not is_admin() then
      new.role := old.role;
      new.status := old.status;
      new.door_code := old.door_code;
      new.payplus_token_uid := old.payplus_token_uid;
      new.card_last4 := old.card_last4;
      new.card_expiry := old.card_expiry;
    end if;
  else
    new.role := coalesce(new.role, 'therapist');
    new.status := 'active';
    new.door_code := null;
    new.payplus_token_uid := null;
    new.card_last4 := null;
    new.card_expiry := null;
  end if;

  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists profiles_privilege_guard on profiles;
create trigger profiles_privilege_guard
  before insert or update on profiles
  for each row execute function enforce_profile_privilege_columns();

create policy admin_only_notes on therapist_admin_notes for all
  using (is_admin() and clinic_id = current_clinic_id());

-- ═══ הזמנות: רואה רק את שלו + אדמין רואה את כל הקליניקה שלו. אחרים —
--     דרך public_availability בלבד. יצירה/עדכון רק דרך RPC. ═══
create policy own_bookings on bookings for select
  using (user_id = auth.uid() or (is_admin() and clinic_id = current_clinic_id()));
create policy no_direct_insert on bookings for insert
  with check (is_admin() and clinic_id = current_clinic_id());
create policy no_direct_update on bookings for update
  using (is_admin() and clinic_id = current_clinic_id());

create policy own_cards on punch_cards for select
  using (user_id = auth.uid() or (is_admin() and clinic_id = current_clinic_id()));
create policy own_subs on session_subscriptions for select
  using (user_id = auth.uid() or (is_admin() and clinic_id = current_clinic_id()));
create policy own_slots on session_slots for select
  using (
    exists (
      select 1 from session_subscriptions s
      where s.id = subscription_id and (s.user_id = auth.uid() or (is_admin() and s.clinic_id = current_clinic_id()))
    )
  );
create policy own_pays on payments for select
  using (user_id = auth.uid() or (is_admin() and clinic_id = current_clinic_id()));
create policy own_over on overrun_charges for select
  using (user_id = auth.uid() or (is_admin() and clinic_id = current_clinic_id()));

-- חסימות תחזוקה: פרטים מלאים לאדמין הקליניקה בלבד. זמינות למטפל/ת — דרך
-- public_availability.
create policy admin_room_blocks on room_blocks for all
  using (is_admin() and clinic_id = current_clinic_id());

-- טבלאות לקריאה בתוך הקליניקה
create policy read_branches on branches for select
  using (clinic_id = current_clinic_id() and (active or is_admin()));
create policy read_rooms on rooms for select
  using (clinic_id = current_clinic_id() and (active or is_admin()));
create policy read_tiers on punch_card_tiers for select
  using (clinic_id = current_clinic_id() and (active or is_admin()));
create policy read_settings on app_settings for select
  using (clinic_id = current_clinic_id());
create policy read_woo_product_tiers on woo_product_tiers for select
  using (clinic_id = current_clinic_id());

-- ניהול (CRUD) — אדמין הקליניקה בלבד, ותמיד בתוך הקליניקה שלו
create policy admin_write_branches on branches for insert
  with check (is_admin() and clinic_id = current_clinic_id());
create policy admin_update_branches on branches for update
  using (is_admin() and clinic_id = current_clinic_id());
create policy admin_write_rooms on rooms for insert
  with check (is_admin() and clinic_id = current_clinic_id());
create policy admin_update_rooms on rooms for update
  using (is_admin() and clinic_id = current_clinic_id());
create policy admin_write_tiers on punch_card_tiers for insert
  with check (is_admin() and clinic_id = current_clinic_id());
create policy admin_update_tiers on punch_card_tiers for update
  using (is_admin() and clinic_id = current_clinic_id());
create policy admin_write_settings on app_settings for insert
  with check (is_admin() and clinic_id = current_clinic_id());
create policy admin_update_settings on app_settings for update
  using (is_admin() and clinic_id = current_clinic_id());
create policy admin_all_woo_tiers on woo_product_tiers for all
  using (is_admin() and clinic_id = current_clinic_id());
create policy admin_all_woo_pending on woo_pending_purchases for all
  using (is_admin() and clinic_id = current_clinic_id());

-- פרטי סליקה: אדמין הקליניקה בלבד, ואף פעם לא נשלף ישירות ל-client בקוד —
-- ר' lib/woo (Server Actions עם admin client). ה-RLS כאן הגנת-עומק.
create policy admin_all_payment_settings on clinic_payment_settings for all
  using (is_admin() and clinic_id = current_clinic_id());

-- יומן ביקורת: קריאה לאדמין הקליניקה בלבד. כתיבה רק מפונקציות SECURITY DEFINER.
create policy admin_read_audit on audit_log for select
  using (is_admin() and clinic_id = current_clinic_id());

-- superadmin: קריאה/כתיבה על טבלאות הפלטפורמה עצמן. לא נחשף למשתמשי קליניקה בכלל.
create policy superadmin_only_admins on platform_admins for all using (is_superadmin());
create policy superadmin_only_audit on platform_audit_log for select using (is_superadmin());
