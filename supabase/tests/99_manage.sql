-- Tester för att ta bort ett konto från föreningen (remove_member). Förening
-- 9999… ("Annan") är inte en demo; där finns en administratör, en
-- styrelseledamot och en boende.

begin;

insert into auth.users (id, email, raw_user_meta_data) values
  ('e0000000-0000-0000-0000-000000000001', 'admin@annan.se', '{"full_name":"Annan Admin"}'),
  ('e0000000-0000-0000-0000-000000000002', 'styrelse@annan.se', '{"full_name":"Sara Styrelse"}'),
  ('e0000000-0000-0000-0000-000000000003', 'boende@annan.se', '{"full_name":"Bo Ende"}');
update public.profiles set organization_id = '99999999-0000-0000-0000-000000000000'
  where id::text like 'e0000000-%';
insert into public.user_roles (user_id, organization_id, role) values
  ('e0000000-0000-0000-0000-000000000001', '99999999-0000-0000-0000-000000000000', 'org_admin'),
  ('e0000000-0000-0000-0000-000000000002', '99999999-0000-0000-0000-000000000000', 'board_member'),
  ('e0000000-0000-0000-0000-000000000003', '99999999-0000-0000-0000-000000000000', 'resident');
insert into public.properties (id, organization_id, name, address)
  values ('e1000000-0000-0000-0000-000000000001', '99999999-0000-0000-0000-000000000000', 'Annan 1', 'Annangatan 1');
insert into public.buildings (id, organization_id, property_id, name)
  values ('e2000000-0000-0000-0000-000000000001', '99999999-0000-0000-0000-000000000000',
          'e1000000-0000-0000-0000-000000000001', 'Annangatan 1');
insert into public.units (id, organization_id, building_id, unit_number, address)
  values ('e3000000-0000-0000-0000-000000000001', '99999999-0000-0000-0000-000000000000',
          'e2000000-0000-0000-0000-000000000001', '1001', 'Annangatan 1');
insert into public.residencies (organization_id, unit_id, user_id, resident_name, status)
  values ('99999999-0000-0000-0000-000000000000', 'e3000000-0000-0000-0000-000000000001',
          'e0000000-0000-0000-0000-000000000003', 'Bo Ende', 'active');
insert into public.access_keys (organization_id, user_id, holder_name, holder_kind)
  values ('99999999-0000-0000-0000-000000000000', 'e0000000-0000-0000-0000-000000000002', 'Sara Styrelse', 'staff');

set local role authenticated;

-- Styrelseledamoten får inte ta bort konton.
set local request.jwt.claim.sub = 'e0000000-0000-0000-0000-000000000002';
select tests.expect_error($q$select public.remove_member('e0000000-0000-0000-0000-000000000003')$q$, 'Behörighet saknas');

-- Administratören kan inte ta bort sig själv eller en boende.
set local request.jwt.claim.sub = 'e0000000-0000-0000-0000-000000000001';
select tests.expect_error($q$select public.remove_member('e0000000-0000-0000-0000-000000000001')$q$, '%eget konto%');
select tests.expect_error($q$select public.remove_member('e0000000-0000-0000-0000-000000000003')$q$, '%bor i föreningen%');
-- Inte heller någon i en annan förening.
select tests.expect_error($q$select public.remove_member('cccccccc-0000-0000-0000-000000000001')$q$, '%finns inte i organisationen%');

-- Men styrelseledamoten.
select public.remove_member('e0000000-0000-0000-0000-000000000002');
reset role;
select tests.assert(
  (select organization_id is null from public.profiles where id = 'e0000000-0000-0000-0000-000000000002'),
  'kontot är inte längre kopplat till föreningen');
select tests.assert(
  not exists (select 1 from public.user_roles where user_id = 'e0000000-0000-0000-0000-000000000002'),
  'rollerna är borttagna');
select tests.assert(
  (select revoked_at is not null from public.access_keys where user_id = 'e0000000-0000-0000-0000-000000000002'),
  'nyckeln är återkallad');
select tests.assert(
  exists (select 1 from public.audit_events where action = 'member.removed'
          and summary = 'Sara Styrelse togs bort från föreningen.'),
  'historiken visar borttaget konto');

-- I demomiljön kan konton inte tas bort.
set local role authenticated;
set local request.jwt.claim.sub = 'cccccccc-0000-0000-0000-000000000001';
select tests.expect_error($q$select public.remove_member('bbbbbbbb-0000-0000-0000-000000000001')$q$, '%demomiljön%');

rollback;

select 'Kontotesterna gick igenom' as result;

-- Borttagningar följer rollerna (fastighetsskötare 57aff…, styrelse b0a4d…
-- och förvaltare cccc… från 70_role_policies.sql och 10_security.sql).
begin;
set local role authenticated;

-- Fastighetsskötaren tar bort en bokningsbar resurs med kommande bokningar
-- (bokningarna följer med) och en dörr, men inte fastigheter eller entreprenörer.
set local request.jwt.claim.sub = '57aff000-0000-0000-0000-000000000001';
select tests.expect_rows($q$delete from public.resources where id = '77777777-0000-0000-0000-000000000003'$q$, 1);
select tests.expect_rows($q$delete from public.access_doors where id = (select id from public.access_doors limit 1)$q$, 1);
select tests.expect_rows($q$delete from public.contractors$q$, 0);
select tests.expect_rows($q$delete from public.buildings$q$, 0);
select tests.expect_rows($q$delete from public.maintenance_projects$q$, 0);

-- Styrelsen tar bort underhållsprojekt men inte resurser eller dörrar.
set local request.jwt.claim.sub = 'b0a4d000-0000-0000-0000-000000000001';
select tests.expect_rows($q$delete from public.maintenance_projects where id = (select id from public.maintenance_projects limit 1)$q$, 1);
select tests.expect_rows($q$delete from public.resources$q$, 0);
select tests.expect_rows($q$delete from public.access_doors$q$, 0);

-- Förvaltaren tar bort en entreprenör; ärendena står kvar utan entreprenör.
set local request.jwt.claim.sub = 'cccccccc-0000-0000-0000-000000000001';
create temp table c as select id from public.contractors
  where id in (select contractor_id from public.maintenance_requests) limit 1;
select tests.expect_rows($q$delete from public.contractors where id in (select id from c)$q$, 1);
select tests.assert(
  (select count(*) = 0 from public.maintenance_requests where contractor_id in (select id from c))
  and (select count(*) > 0 from public.maintenance_requests),
  'ärendena finns kvar utan den borttagna entreprenören');
-- Och en tom lägenhet och ett tomt hus.
insert into public.buildings (id, organization_id, property_id, name)
select 'e4000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', id, 'Nytt hus'
from public.properties where organization_id = '11111111-1111-1111-1111-111111111111' limit 1;
insert into public.units (id, organization_id, building_id, unit_number, address)
values ('e5000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111',
        'e4000000-0000-0000-0000-000000000001', '9999', 'Nytt hus');
select tests.expect_rows($q$delete from public.units where id = 'e5000000-0000-0000-0000-000000000001'$q$, 1);
select tests.expect_rows($q$delete from public.buildings where id = 'e4000000-0000-0000-0000-000000000001'$q$, 1);
-- Men inte i en annan förening.
select tests.expect_rows($q$delete from public.units where organization_id <> '11111111-1111-1111-1111-111111111111'$q$, 0);

rollback;

select 'Borttagningstesterna gick igenom' as result;
