-- Minimal ersättning för Supabase-miljön så att migrationerna kan köras mot
-- en vanlig Postgres (lokalt och i CI). Körs före migrationerna.

do $$
declare r text;
begin
  foreach r in array array['anon', 'authenticated', 'service_role', 'supabase_auth_admin'] loop
    if not exists (select 1 from pg_roles where rolname = r) then
      execute format('create role %I nologin', r);
    end if;
  end loop;
end $$;

create schema auth;
create schema extensions;
create extension if not exists pgcrypto with schema extensions;

create table auth.users (
  instance_id uuid,
  id uuid primary key default gen_random_uuid(),
  aud text,
  role text,
  email text,
  phone text,
  encrypted_password text,
  email_confirmed_at timestamptz,
  raw_app_meta_data jsonb not null default '{}',
  raw_user_meta_data jsonb not null default '{}',
  email_change text default '',
  email_change_token_new text default '',
  email_change_token_current text default '',
  phone_change text default '',
  phone_change_token text default '',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;

grant usage on schema auth to anon, authenticated, supabase_auth_admin;
grant execute on function auth.uid() to anon, authenticated;
grant all on auth.users to supabase_auth_admin;
grant usage on schema public to anon, authenticated, service_role;

-- Som i Supabase: API-rollerna får behörighet till allt i public och det är
-- radreglerna (RLS) som begränsar vad de ser.
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
