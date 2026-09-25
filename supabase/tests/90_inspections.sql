-- Besiktningar: den boende ser sin lägenhet och sin fastighet, inte andras.
select public.reset_demo_all();

begin;
set local role authenticated;
set local request.jwt.claim.sub = 'bbbbbbbb-0000-0000-0000-000000000001';
select tests.assert(
  (select count(*) = 2 from public.inspections where unit_id = '44444444-0000-0000-0000-000000000001'),
  'boende i 3B ser besiktningarna av sin lägenhet');
select tests.assert(
  (select count(*) >= 2 from public.inspections where unit_id is null),
  'boende i 3B ser besiktningar av sin fastighet');
select tests.assert(
  (select count(*) = 0 from public.inspections
   where unit_id is not null and unit_id <> '44444444-0000-0000-0000-000000000001'),
  'boende ser inte andra lägenheters besiktningar');
select tests.expect_rows($q$update public.inspections set status = 'completed'$q$, 0);
rollback;

-- Inställda besiktningar visas inte för boende.
update public.inspections set status = 'cancelled'
  where unit_id = '44444444-0000-0000-0000-000000000001' and status = 'planned';
begin;
set local role authenticated;
set local request.jwt.claim.sub = 'bbbbbbbb-0000-0000-0000-000000000001';
select tests.assert(
  (select count(*) = 1 from public.inspections where unit_id = '44444444-0000-0000-0000-000000000001'),
  'inställd besiktning döljs');
rollback;

select tests.expect_error(
  $q$insert into public.inspections (organization_id, kind, status) values ('11111111-1111-1111-1111-111111111111', 'periodic', 'okänd')$q$,
  '%inspections_status_check%');

select public.reset_demo_all();
select 'Besiktningstesterna gick igenom' as result;
