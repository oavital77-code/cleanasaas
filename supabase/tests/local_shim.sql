-- Minimal shim replicating the parts of Supabase's auth/storage schemas that
-- our migrations reference, so we can replay them against plain local Postgres.
create schema if not exists auth;
create schema if not exists storage;
create schema if not exists extensions;

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

-- Identity is Clerk (migration 20260905000003): app_user_id() reads the JWT
-- `sub` out of auth.jwt(), so every RPC in the suite needs this one. Same
-- definition Supabase ships: the claims GUC PostgREST sets per request.
create or replace function auth.jwt() returns jsonb as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim', true), ''),
    nullif(current_setting('request.jwt.claims', true), '')
  )::jsonb;
$$ language sql stable;

create table if not exists storage.buckets (
  id text primary key,
  name text not null,
  public boolean default false,
  file_size_limit bigint,
  allowed_mime_types text[]
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

-- Idempotent: the grants block at the end is meant to be re-run after the
-- migrations, to cover tables they added.
do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
end $$;

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

-- pgcrypto lives in the `extensions` schema on Supabase, and the Woo secret
-- encryption (20260906000002) calls extensions.gen_random_bytes / pgp_sym_*.
create extension if not exists pgcrypto with schema extensions;

-- Supabase Vault, enough of it for the Woo encryption key: create_secret on
-- the way in, decrypted_secrets on the way out. Not real encryption at rest —
-- this is a schema harness, and the migrations only care about the interface.
create schema if not exists vault;

create table if not exists vault.secrets (
  id uuid primary key default gen_random_uuid(),
  name text unique,
  secret text,
  description text
);

create or replace view vault.decrypted_secrets as
  select id, name, secret as decrypted_secret, description from vault.secrets;

create or replace function vault.create_secret(p_secret text, p_name text, p_description text default '')
returns uuid language sql as $$
  insert into vault.secrets (name, secret, description) values (p_name, p_secret, p_description)
  on conflict (name) do update set secret = excluded.secret
  returning id;
$$;

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
