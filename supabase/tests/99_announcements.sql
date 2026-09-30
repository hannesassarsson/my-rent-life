-- Tester för nyheter: målgrupp, historik och behörighet. Boende bbbb… bor i
-- 3B (4444…01); förvaltaren cccc… administrerar demoföreningen (1111…).

begin;

-- Riktade testnyheter: till boendes hus, till ett annat hus och till en
-- annan fastighet i samma förening.
create temp table t as
select u.building_id as my_building, b.property_id as my_property,
  (select id from public.buildings where property_id = b.property_id and id <> u.building_id limit 1) as other_building,
  (select id from public.properties where organization_id = '11111111-1111-1111-1111-111111111111'
     and id <> b.property_id limit 1) as other_property
from public.units u join public.buildings b on b.id = u.building_id
where u.id = '44444444-0000-0000-0000-000000000001';
grant select on t to authenticated;

insert into public.announcements (organization_id, title, body, audience_scope, property_id, building_id, is_published, published_at)
select '11111111-1111-1111-1111-111111111111'::uuid, 'Mitt hus', 'x', 'building', my_property, my_building, true, now() from t
union all
select '11111111-1111-1111-1111-111111111111'::uuid, 'Min fastighet', 'x', 'property', my_property, null, true, now() from t
union all
select '11111111-1111-1111-1111-111111111111'::uuid, 'Annan fastighet', 'x', 'property', other_property, null, true, now() from t
union all
select '11111111-1111-1111-1111-111111111111'::uuid, 'Annat hus', 'x', 'building', my_property, other_building, true, now()
from t where other_building is not null;
insert into public.announcements (organization_id, title, body, is_published, published_at)
values ('99999999-0000-0000-0000-000000000000', 'Annan förening', 'x', true, now());

-- En riktad nyhet måste ha fastighet eller hus.
select tests.expect_error($q$insert into public.announcements (organization_id, title, body, audience_scope)
  values ('11111111-1111-1111-1111-111111111111', 'x', 'x', 'property')$q$, '%announcements_audience_check%');
select tests.expect_error($q$insert into public.announcements (organization_id, title, body, audience_scope, property_id)
  select '11111111-1111-1111-1111-111111111111', 'x', 'x', 'building', my_property from t$q$, '%announcements_audience_check%');

-- Boende ser nyheter till alla, sin fastighet och sitt hus – inte andras.
set local role authenticated;
set local request.jwt.claim.sub = 'bbbbbbbb-0000-0000-0000-000000000001';
select tests.assert(exists (select 1 from public.announcements where title = 'Mitt hus'), 'boende ser nyhet till sitt hus');
select tests.assert(exists (select 1 from public.announcements where title = 'Min fastighet'), 'boende ser nyhet till sin fastighet');
select tests.assert(not exists (select 1 from public.announcements where title = 'Annan fastighet'), 'boende ser inte nyhet till annan fastighet');
select tests.assert(not exists (select 1 from public.announcements where title = 'Annat hus'), 'boende ser inte nyhet till annat hus');
select tests.assert(not exists (select 1 from public.announcements where title = 'Annan förening'), 'boende ser inte annan förenings nyhet');
select tests.assert(not exists (select 1 from public.announcements where not is_published), 'boende ser inga utkast');
select tests.assert(exists (select 1 from public.announcements where audience_scope = 'organization'), 'boende ser nyheter till alla');
-- Boende kan inte ändra eller ta bort nyheter.
select tests.expect_rows($q$update public.announcements set title = 'x'$q$, 0);
select tests.expect_rows($q$delete from public.announcements$q$, 0);

-- Förvaltaren ser alla föreningens nyheter, även riktade och utkast.
set local request.jwt.claim.sub = 'cccccccc-0000-0000-0000-000000000001';
select tests.assert(exists (select 1 from public.announcements where title = 'Annan fastighet'), 'förvaltaren ser riktade nyheter');
select tests.assert(exists (select 1 from public.announcements where not is_published), 'förvaltaren ser utkast');
select tests.assert(not exists (select 1 from public.announcements where title = 'Annan förening'), 'förvaltaren ser inte annan förenings nyhet');

-- Ändringar, publicering och borttagning syns i historiken.
select tests.expect_rows($q$update public.announcements set body = 'Ny text' where title = 'Min fastighet'$q$, 1);
select tests.expect_rows($q$update public.announcements set is_published = false where title = 'Mitt hus'$q$, 1);
select tests.expect_rows($q$delete from public.announcements where title = 'Annan fastighet'$q$, 1);
-- Men inte en annan förenings nyhet.
select tests.expect_rows($q$delete from public.announcements where title = 'Annan förening'$q$, 0);
reset role;
select tests.assert(
  (select count(*) = 3 from public.audit_events
   where organization_id = '11111111-1111-1111-1111-111111111111'
     and action in ('announcement.updated', 'announcement.unpublished', 'announcement.deleted')
     and summary in ('Nyheten "Min fastighet" ändrades.', 'Nyheten "Mitt hus" avpublicerades.',
                     'Nyheten "Annan fastighet" togs bort.')),
  'historiken visar ändrad, avpublicerad och borttagen nyhet');
select tests.assert(exists (select 1 from public.announcements where title = 'Annan förening'), 'annan förenings nyhet finns kvar');

rollback;

select 'Nyhetstesterna gick igenom' as result;
