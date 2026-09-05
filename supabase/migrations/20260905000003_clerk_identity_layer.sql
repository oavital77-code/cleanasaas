-- ═══════════════════════════════════════════════════════════════════════
-- שלב 1 מתוך המעבר ל-Clerk: שכבת זהות דו-מצבית ב-DB
-- ═══════════════════════════════════════════════════════════════════════
--
-- 🔴 העובדה שקובעת את כל המיגרציה הזו:
--
--   auth.uid() מוגדרת ב-Supabase כ:
--       select coalesce(..., claims ->> 'sub')::uuid
--
--   ה-`::uuid` בסוף הוא הבעיה. ה-sub של Clerk הוא מחרוזת מהצורה
--   `user_2abc...` — לא UUID. כלומר ברגע שמגיע טוקן של Clerk, כל קריאה
--   ל-auth.uid() **זורקת שגיאה** (invalid input syntax for type uuid),
--   היא לא מחזירה NULL. זה אומר שאי אפשר "פשוט להדליק" את Clerk בדשבורד
--   ולתקן את ה-DB אחר כך: ברגע שהטוקן משתנה, כל מדיניות RLS וכל RPC
--   שנוגעים ב-auth.uid() קורסים בו-זמנית.
--
--   לכן ה-DB חייב לעבור *לפני* שמחליפים את ספק הזהות, ובאופן שממשיך
--   לעבוד גם עם הסשנים הקיימים של Supabase Auth — כלומר דו-מצבי.
--
-- מה יש כאן:
--   1. profiles.clerk_user_id — המיפוי בין משתמש Clerk לפרופיל.
--   2. app_user_id() — פתרון הזהות היחיד של המערכת, תומך בשני הספקים.
--   3. שלוש פונקציות הזהות (current_clinic_id/is_admin/is_superadmin)
--      עוברות להשתמש בה — וכל ~20 מדיניות ה-RLS שעוברות דרכן הופכות
--      תואמות-Clerk בבת אחת, בלי לגעת בהן.
--   4. 8 המדיניות שמשתמשות ב-auth.uid() *ישירות*.
--   5. טריגר ההגנה על profiles (מונע הסלמת הרשאות) — גם הוא קרא auth.uid().
--
-- ה-RPCs (יתר המופעים של auth.uid()) הם שלב 2 — הם ממשיכים לעבוד כרגיל
-- תחת Supabase Auth עד שיומרו.

-- ── 1. מיפוי משתמש Clerk → פרופיל ─────────────────────────────────────
alter table profiles add column if not exists clerk_user_id text unique;
comment on column profiles.clerk_user_id is
  'מזהה המשתמש ב-Clerk (user_...). NULL = פרופיל שנוצר בתקופת Supabase Auth.';

-- ── 2. פתרון הזהות המרכזי ─────────────────────────────────────────────
-- מחזירה את profiles.id של המשתמש/ת בבקשה הנוכחית, משני ספקי הזהות.
--
-- ⚠️ הפונקציה הזו לא קוראת ל-auth.uid() בכוונה — ר' ההסבר למעלה. היא
-- קוראת את ה-sub הגולמי, ומבצעת cast ל-uuid רק אחרי שווידאה בביטוי רגולרי
-- שהוא באמת בצורת uuid. בלי השמירה הזו טוקן של Clerk היה מפיל את השאילתה.
create or replace function app_user_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  with claim as (select auth.jwt() ->> 'sub' as sub)
  select coalesce(
    -- Supabase Auth: ה-sub הוא ה-uuid של auth.users, שזהה ל-profiles.id
    (select p.id from profiles p, claim c
      where c.sub ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
        and p.id = c.sub::uuid),
    -- Clerk: ה-sub הוא מחרוזת, ומתמפה דרך העמודה החדשה
    (select p.id from profiles p, claim c where p.clerk_user_id = c.sub)
  );
$$;

comment on function app_user_id() is
  'זהות המשתמש/ת בבקשה הנוכחית (profiles.id), תומכת ב-Supabase Auth וב-Clerk. אין להחליף בקריאה ישירה ל-auth.uid() — היא זורקת על sub של Clerk.';

-- ── 3. שלוש פונקציות הזהות שכל ה-RLS תלוי בהן ────────────────────────
create or replace function current_clinic_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select clinic_id from profiles where id = app_user_id();
$$;

create or replace function is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from profiles where id = app_user_id() and role in ('owner', 'admin')
  );
$$;

create or replace function is_superadmin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from platform_admins where user_id = app_user_id());
$$;

-- ── 4. המדיניות שמשתמשות בזהות ישירות ────────────────────────────────
-- (השאר עוברות דרך שלוש הפונקציות למעלה ולכן כבר תואמות)

drop policy if exists own_profile on profiles;
create policy own_profile on profiles for select
  using (id = app_user_id() or (is_admin() and clinic_id = current_clinic_id()) or is_superadmin());

drop policy if exists edit_profile on profiles;
create policy edit_profile on profiles for update
  using (id = app_user_id() or (is_admin() and clinic_id = current_clinic_id()));

drop policy if exists own_bookings on bookings;
create policy own_bookings on bookings for select
  using (user_id = app_user_id() or (is_admin() and clinic_id = current_clinic_id()));

drop policy if exists own_cards on punch_cards;
create policy own_cards on punch_cards for select
  using (user_id = app_user_id() or (is_admin() and clinic_id = current_clinic_id()));

drop policy if exists own_pays on payments;
create policy own_pays on payments for select
  using (user_id = app_user_id() or (is_admin() and clinic_id = current_clinic_id()));

drop policy if exists own_over on overrun_charges;
create policy own_over on overrun_charges for select
  using (user_id = app_user_id() or (is_admin() and clinic_id = current_clinic_id()));

drop policy if exists own_subs on session_subscriptions;
create policy own_subs on session_subscriptions for select
  using (user_id = app_user_id() or (is_admin() and clinic_id = current_clinic_id()));

drop policy if exists own_slots on session_slots;
create policy own_slots on session_slots for select
  using (exists (
    select 1 from session_subscriptions s
    where s.id = session_slots.subscription_id
      and (s.user_id = app_user_id() or (is_admin() and s.clinic_id = current_clinic_id()))
  ));

-- ── 5. טריגר ההגנה מפני הסלמת הרשאות ─────────────────────────────────
-- זהה לחלוטין לקודם פרט ל-app_user_id() במקום auth.uid(). הוא זה שמונע
-- ממטפל/ת לשנות לעצמו/ה role/status או לעבור קליניקה דרך PostgREST —
-- ר' סקירת האבטחה ב-PROGRESS.md סעיף 16.
create or replace function enforce_profile_privilege_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if current_setting('cleana.trusted_write', true) = 'on' then
    return new;
  end if;

  if tg_op = 'UPDATE' then
    new.clinic_id := old.clinic_id;
    new.phone := old.phone;
    new.email := old.email;
    -- clerk_user_id הוא מזהה זהות — לעולם לא ניתן לשינוי מהלקוח, אחרת
    -- אפשר היה "לחטוף" פרופיל של מישהו אחר ע"י מיפויו למשתמש Clerk שלי.
    new.clerk_user_id := old.clerk_user_id;
    if new.id = app_user_id() or not is_admin() then
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
$$;
