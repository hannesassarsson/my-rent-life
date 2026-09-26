-- DEMO ACCESS
-- 1. demo_requests: förfrågningar från formuläret "Boka demo". Vem som helst
--    får skicka in, ingen i appen får läsa (läses i Supabase-dashboarden).
-- 2. Demokonton (raw_app_meta_data.demo_account = true) används av knappen
--    "Se demomiljön". Besökare kan inte byta lösenord, e-post eller telefon på
--    dem, och namnet återställs varje natt av reset_demo().

create table if not exists public.demo_requests (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 200),
  email text not null check (char_length(email) between 3 and 200 and email like '%_@_%'),
  organization text not null check (char_length(organization) between 1 and 200),
  org_type text not null default 'brf' check (org_type in ('brf', 'landlord', 'manager', 'other')),
  unit_count int check (unit_count between 1 and 100000),
  message text check (char_length(message) <= 4000),
  created_at timestamptz not null default now()
);
alter table public.demo_requests enable row level security;
grant insert on public.demo_requests to anon, authenticated;
grant all on public.demo_requests to service_role;
drop policy if exists "anyone can request a demo" on public.demo_requests;
create policy "anyone can request a demo" on public.demo_requests for insert to anon, authenticated
with check (true);

-- Security invoker: current_user är rollen som gör ändringen (supabase_auth_admin
-- för Auth-API:t). Bara postgres (SQL/migrationer) får ändra demokontona.
create or replace function public.protect_demo_accounts() returns trigger
language plpgsql set search_path = public as $$
begin
  if coalesce(old.raw_app_meta_data->>'demo_account', '') = 'true' and current_user <> 'postgres' then
    new.encrypted_password := old.encrypted_password;
    new.email := old.email;
    new.phone := old.phone;
    new.email_change := '';
    new.email_change_token_new := '';
    new.email_change_token_current := '';
    new.phone_change := '';
    new.phone_change_token := '';
    new.raw_app_meta_data := old.raw_app_meta_data;
  end if;
  return new;
end; $$;
revoke all on function public.protect_demo_accounts() from public, anon, authenticated;

drop trigger if exists protect_demo_accounts on auth.users;
create trigger protect_demo_accounts before update on auth.users
for each row execute function public.protect_demo_accounts();

-- Återställ namnen på demokontonas profiler varje natt.
create or replace function public.reset_demo_profiles() returns void
language sql security definer set search_path = public as $$
  update public.profiles p
  set full_name = u.raw_user_meta_data->>'full_name', phone = null
  from auth.users u
  where u.id = p.id and coalesce(u.raw_app_meta_data->>'demo_account', '') = 'true';
$$;
revoke all on function public.reset_demo_profiles() from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'reset-demo';
    perform cron.schedule('reset-demo', '0 3 * * *',
      'select public.reset_demo(); select public.reset_demo_profiles();');
  end if;
end $$;
