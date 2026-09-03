-- Minimal shim replicating the parts of Supabase's auth/storage schemas that
-- our migrations reference, so we can replay them against plain local Postgres.
create schema if not exists auth;
create schema if not exists storage;

create table if not exists auth.users (
  id uuid primary key default gen_random_uuid(),
  email text
);

create or replace function auth.uid() returns uuid as $$
  select nullif(current_setting('cleana.test_uid', true), '')::uuid;
$$ language sql stable;

create or replace function auth.role() returns text as $$
  select coalesce(nullif(current_setting('cleana.test_role', true), ''), 'authenticated');
$$ language sql stable;

create table if not exists storage.buckets (
  id text primary key,
  name text not null,
  public boolean default false
);

create table if not exists storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text references storage.buckets(id),
  name text,
  owner uuid
);

create or replace function storage.foldername(name text) returns text[] as $$
  select string_to_array(name, '/');
$$ language sql immutable;

alter table storage.objects enable row level security;

create publication supabase_realtime;

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin bypassrls;
  end if;
end $$;

-- Mimics Supabase's default grants: broad DML to anon/authenticated at the
-- table level, trusting RLS (not GRANT) to actually restrict rows. Run again
-- after each migration that adds tables (ALTER DEFAULT PRIVILEGES covers new
-- ones automatically for objects created by this same role going forward).
grant usage on schema public to anon, authenticated, service_role;
grant all on all tables in schema public to anon, authenticated, service_role;
grant all on all sequences in schema public to anon, authenticated, service_role;
grant execute on all functions in schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;
