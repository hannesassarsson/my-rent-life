-- Digitala nycklar: boende öppnar fastighetens gemensamma dörrar, inte
-- andras; personal öppnar allt; passager loggas och kan inte förfalskas.
select public.reset_demo_all();

create temp table door_ids as
select
  (select d.id from public.access_doors d
   join public.buildings b on b.property_id = d.property_id
   join public.units u on u.building_id = b.id
   where u.id = '44444444-0000-0000-0000-000000000001' and d.residents_access and d.is_online
   limit 1) as own_door,
  '88888888-0000-0000-0000-000000000009'::uuid as garage,
  '88888888-0000-0000-0000-000000000010'::uuid as offline;
grant select on door_ids to authenticated;

begin;
set local role authenticated;
set local request.jwt.claim.sub = 'bbbbbbbb-0000-0000-0000-000000000001';
select tests.assert(
  (select public.unlock_door(own_door)->>'result' = 'granted' from door_ids),
  'boende öppnar porten i sin fastighet');
select tests.assert(
  (select public.unlock_door(garage)->>'result' = 'denied' from door_ids),
  'boende utan garagenyckel nekas');
select tests.assert(
  -- Demons slumpade passager kan också gälla den här boende; räkna bara
  -- de som gjordes i testet (samma transaktion, alltså samma now()).
  (select count(*) = 2 from public.access_events where user_id = auth.uid() and created_at = now()),
  'boende ser sina egna passager');
select tests.assert(
  (select count(*) = 0 from public.access_events where user_id is distinct from auth.uid()),
  'boende ser inte andras passager');
select tests.expect_error(
  $q$insert into public.access_events (organization_id, door_id, result) values ('11111111-1111-1111-1111-111111111111', '88888888-0000-0000-0000-000000000009', 'granted')$q$,
  '%permission denied%');
select tests.expect_rows($q$update public.access_doors set residents_access = true$q$, 0);
rollback;

begin;
set local role authenticated;
set local request.jwt.claim.sub = '57aff000-0000-0000-0000-000000000001';
select tests.assert(
  (select public.unlock_door(garage)->>'result' = 'granted' from door_ids),
  'fastighetsskötaren öppnar garaget');
select tests.assert(
  (select public.unlock_door(offline)->>'reason' = 'Läsaren är inte ansluten' from door_ids),
  'en frånkopplad läsare öppnar inte');
rollback;

select public.reset_demo_all();
select 'Nyckeltesterna gick igenom' as result;
