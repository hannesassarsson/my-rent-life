-- Tester för behörigheter, bokningsregler och demomiljön. Körs efter alla
-- migrationer av scripts/test-db.sh. Ett misslyckat test avbryter med
-- "TEST FAILED".

create schema tests;
grant usage on schema tests to anon, authenticated, supabase_auth_admin;

-- Kör sql och kräv att det ger ett fel som matchar pattern.
create function tests.expect_error(sql text, pattern text) returns void
language plpgsql as $$
begin
  execute sql;
  raise exception 'TEST FAILED: förväntade fel "%" för: %', pattern, sql;
exception when others then
  if sqlerrm like 'TEST FAILED%' then raise; end if;
  if sqlerrm not like pattern then
    raise exception 'TEST FAILED: fick "%" men förväntade "%" för: %', sqlerrm, pattern, sql;
  end if;
end $$;

-- Kör sql och kräv att exakt n rader påverkas.
create function tests.expect_rows(sql text, n int) returns void
language plpgsql as $$
declare affected int;
begin
  execute sql;
  get diagnostics affected = row_count;
  if affected <> n then
    raise exception 'TEST FAILED: % rader påverkades, förväntade % för: %', affected, n, sql;
  end if;
end $$;

create function tests.assert(ok boolean, what text) returns void
language plpgsql as $$
begin
  if not coalesce(ok, false) then raise exception 'TEST FAILED: %', what; end if;
end $$;

grant execute on all functions in schema tests to anon, authenticated, supabase_auth_admin;

-- Testdata: en boende i 3B, en förvaltare, en användare som försöker bli admin
-- och ett demokonto.
insert into auth.users (id, email, raw_user_meta_data) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'evil@example.com', '{"demo_role":"admin"}'),
  ('bbbbbbbb-0000-0000-0000-000000000001', 'boende@example.com', '{"full_name":"Boende"}'),
  ('cccccccc-0000-0000-0000-000000000001', 'admin@example.com', '{"full_name":"Admin"}');
insert into auth.users (id, email, encrypted_password, raw_app_meta_data, raw_user_meta_data) values
  ('dddddddd-0000-0000-0000-000000000001', 'visning@example.com', 'hash', '{"demo_account":"true"}', '{"full_name":"Visning"}');

select tests.assert(
  (select organization_id is null from public.profiles where id = 'aaaaaaaa-0000-0000-0000-000000000001')
  and not exists (select 1 from public.user_roles where user_id = 'aaaaaaaa-0000-0000-0000-000000000001')
  and not exists (select 1 from public.residencies where user_id = 'aaaaaaaa-0000-0000-0000-000000000001'),
  'nytt konto får ingen organisation, roll eller lägenhet (demo_role ignoreras)');

update public.profiles set organization_id = '11111111-1111-1111-1111-111111111111'
  where id in ('bbbbbbbb-0000-0000-0000-000000000001', 'cccccccc-0000-0000-0000-000000000001');
insert into public.user_roles (user_id, organization_id, role) values
  ('bbbbbbbb-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'resident'),
  ('cccccccc-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'org_admin');
update public.residencies set user_id = 'bbbbbbbb-0000-0000-0000-000000000001'
  where unit_id = '44444444-0000-0000-0000-000000000001';
select public.reset_demo();
insert into public.organizations (id, name, slug) values ('99999999-0000-0000-0000-000000000000', 'Annan', 'annan');

-- ANONYM
begin;
set local role anon;
select tests.expect_rows('select * from public.units', 0);
select tests.expect_rows('select * from public.payments', 0);
select tests.expect_rows($q$insert into public.demo_requests (name, email, organization) values ('A', 'a@example.com', 'BRF A')$q$, 1);
select tests.expect_rows('select * from public.demo_requests', 0);
select tests.expect_error($q$insert into public.demo_requests (name, email, organization) values ('A', 'inte-epost', 'BRF A')$q$, '%check constraint%');
rollback;

-- BOENDE
begin;
set local role authenticated;
set local request.jwt.claim.sub = 'bbbbbbbb-0000-0000-0000-000000000001';

select tests.expect_rows('select * from public.units', 1);
select tests.expect_rows('select * from public.payments', 4);
select tests.expect_rows('select * from public.residencies', 1);
select tests.expect_rows($q$update public.profiles set full_name = 'Nytt namn' where id = auth.uid()$q$, 1);
select tests.expect_error($q$update public.profiles set organization_id = '99999999-0000-0000-0000-000000000000' where id = auth.uid()$q$, '%row-level security%');
select tests.expect_error($q$update public.profiles set organization_id = null where id = auth.uid()$q$, '%row-level security%');

select tests.expect_rows($q$update public.maintenance_requests set status = 'resolved' where ticket_number = 1827$q$, 1);
select tests.expect_error($q$update public.maintenance_requests set organization_id = '99999999-0000-0000-0000-000000000000' where ticket_number = 1827$q$, '%row-level security%');
select tests.expect_error($q$update public.maintenance_requests set unit_id = '44444444-0000-0000-0000-000000000002' where ticket_number = 1827$q$, '%row-level security%');
select tests.expect_rows($q$update public.maintenance_requests set status = 'closed' where ticket_number = 1832$q$, 0);
select tests.expect_rows('update public.payments set status = $$paid$$', 0);

-- Bokningar: Tvättstuga 1 (06–22, 120 min, 14 dagar, max 2, avboka 2 h innan)
select tests.expect_rows($q$insert into public.bookings (organization_id, resource_id, user_id, starts_at, ends_at) values ('11111111-1111-1111-1111-111111111111', '77777777-0000-0000-0000-000000000001', auth.uid(), (current_date + 2 + time '08:00') at time zone 'Europe/Stockholm', (current_date + 2 + time '10:00') at time zone 'Europe/Stockholm')$q$, 1);
select tests.expect_error($q$insert into public.bookings (organization_id, resource_id, user_id, starts_at, ends_at) values ('11111111-1111-1111-1111-111111111111', '77777777-0000-0000-0000-000000000001', auth.uid(), (current_date + 2 + time '10:00') at time zone 'Europe/Stockholm', (current_date + 2 + time '11:00') at time zone 'Europe/Stockholm')$q$, 'Ett pass för%');
select tests.expect_error($q$insert into public.bookings (organization_id, resource_id, user_id, starts_at, ends_at) values ('11111111-1111-1111-1111-111111111111', '77777777-0000-0000-0000-000000000001', auth.uid(), (current_date + 2 + time '04:00') at time zone 'Europe/Stockholm', (current_date + 2 + time '06:00') at time zone 'Europe/Stockholm')$q$, '%är öppen%');
select tests.expect_error($q$insert into public.bookings (organization_id, resource_id, user_id, starts_at, ends_at) values ('11111111-1111-1111-1111-111111111111', '77777777-0000-0000-0000-000000000001', auth.uid(), (current_date + 2 + time '21:00') at time zone 'Europe/Stockholm', (current_date + 2 + time '23:00') at time zone 'Europe/Stockholm')$q$, '%är öppen%');
select tests.expect_error($q$insert into public.bookings (organization_id, resource_id, user_id, starts_at, ends_at) values ('11111111-1111-1111-1111-111111111111', '77777777-0000-0000-0000-000000000001', auth.uid(), (current_date - 1 + time '08:00') at time zone 'Europe/Stockholm', (current_date - 1 + time '10:00') at time zone 'Europe/Stockholm')$q$, 'Tiden har redan passerat');
select tests.expect_error($q$insert into public.bookings (organization_id, resource_id, user_id, starts_at, ends_at) values ('11111111-1111-1111-1111-111111111111', '77777777-0000-0000-0000-000000000001', auth.uid(), (current_date + 20 + time '08:00') at time zone 'Europe/Stockholm', (current_date + 20 + time '10:00') at time zone 'Europe/Stockholm')$q$, '%dagar i förväg');
-- Demodatan ger den boende en bokning ikväll; med ovanstående är det två aktiva.
select tests.expect_error($q$insert into public.bookings (organization_id, resource_id, user_id, starts_at, ends_at) values ('11111111-1111-1111-1111-111111111111', '77777777-0000-0000-0000-000000000001', auth.uid(), (current_date + 3 + time '08:00') at time zone 'Europe/Stockholm', (current_date + 3 + time '10:00') at time zone 'Europe/Stockholm')$q$, 'Du har redan%');
-- Gästrummet är öppet 00:00–23:59 och bokas per dygn.
select tests.expect_rows($q$insert into public.bookings (organization_id, resource_id, user_id, starts_at, ends_at) values ('11111111-1111-1111-1111-111111111111', '77777777-0000-0000-0000-000000000004', auth.uid(), (current_date + 5 + time '00:00') at time zone 'Europe/Stockholm', (current_date + 6 + time '00:00') at time zone 'Europe/Stockholm')$q$, 1);
select tests.expect_error($q$insert into public.bookings (organization_id, resource_id, user_id, starts_at, ends_at) values ('11111111-1111-1111-1111-111111111111', '77777777-0000-0000-0000-000000000001', 'cccccccc-0000-0000-0000-000000000001', (current_date + 4 + time '08:00') at time zone 'Europe/Stockholm', (current_date + 4 + time '10:00') at time zone 'Europe/Stockholm')$q$, '%row-level security%');
select tests.expect_rows($q$update public.bookings set starts_at = starts_at + interval '1 day' where user_id = auth.uid()$q$, 0);
select tests.expect_rows($q$delete from public.bookings where user_id = auth.uid() and starts_at = (current_date + 2 + time '08:00') at time zone 'Europe/Stockholm'$q$, 1);
rollback;

-- Avbokningsgräns: bastun kan avbokas senast 4 timmar innan.
insert into public.bookings (organization_id, resource_id, user_id, starts_at, ends_at)
values ('11111111-1111-1111-1111-111111111111', '77777777-0000-0000-0000-000000000003',
  'bbbbbbbb-0000-0000-0000-000000000001', now() + interval '1 hour', now() + interval '2 hours');
begin;
set local role authenticated;
set local request.jwt.claim.sub = 'bbbbbbbb-0000-0000-0000-000000000001';
select tests.expect_error($q$delete from public.bookings where resource_id = '77777777-0000-0000-0000-000000000003' and user_id = auth.uid()$q$, '%kan avbokas senast%');
rollback;

-- FÖRVALTARE
begin;
set local role authenticated;
set local request.jwt.claim.sub = 'cccccccc-0000-0000-0000-000000000001';
select tests.expect_rows('select * from public.units', 184);
select tests.expect_rows($q$delete from public.bookings where resource_id = '77777777-0000-0000-0000-000000000003' and user_id = 'bbbbbbbb-0000-0000-0000-000000000001'$q$, 1);
select tests.expect_rows($q$update public.maintenance_requests set status = 'closed' where ticket_number = 1832$q$, 1);
select tests.expect_rows('select * from public.demo_requests', 0);
rollback;

-- UTAN ORGANISATION
begin;
set local role authenticated;
set local request.jwt.claim.sub = 'aaaaaaaa-0000-0000-0000-000000000001';
select tests.expect_rows('select * from public.units', 0);
select tests.expect_rows('select * from public.maintenance_requests', 0);
select tests.expect_rows('select * from public.announcements', 0);
rollback;

-- DEMOKONTON kan inte ändras via Auth-API:t
begin;
set local role supabase_auth_admin;
update auth.users set encrypted_password = 'ny', email = 'annan@example.com', raw_app_meta_data = '{}'
  where id = 'dddddddd-0000-0000-0000-000000000001';
reset role;
select tests.assert(
  (select encrypted_password = 'hash' and email = 'visning@example.com' and raw_app_meta_data->>'demo_account' = 'true'
   from auth.users where id = 'dddddddd-0000-0000-0000-000000000001'),
  'demokontots lösenord, e-post och metadata skyddas');
rollback;

-- ÅTERSTÄLLNING
select public.reset_demo();
select public.reset_demo();
select tests.assert((select count(*) = 14 from public.maintenance_requests), 'reset_demo ger 14 ärenden');
select tests.assert((select count(distinct ticket_number) = 14 from public.maintenance_requests), 'unika ärendenummer');
select tests.assert((select max(period) = date_trunc('month', current_date)::date from public.payments), 'senaste perioden är innevarande månad');
select tests.assert((select count(*) = 8 from public.bookings), 'reset_demo ger 8 bokningar');
select tests.assert(
  (select count(*) = 1 from public.bookings where user_id = 'bbbbbbbb-0000-0000-0000-000000000001'),
  'den boendes bokning kopplas till kontot');

select 'Alla databastester gick igenom' as result;
