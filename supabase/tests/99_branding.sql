-- Tester för eget varumärke. Demoföreningen (1111…) har admin cccc… och
-- boende bbbb…; förening 9999… ("Annan") har ingen koppling till dem.

begin;

-- Demoföreningen visas som Riksbyggen efter migrationen och nattens återställning.
select tests.assert(
  (select brand_mode = 'text' and brand_name = 'Riksbyggen' and brand_color = '#d51c29'
   from public.organizations where id = '11111111-1111-1111-1111-111111111111'),
  'demoföreningen har Riksbyggens varumärke');

-- Nya organisationer får Boendeplattformens varumärke.
select tests.assert(
  (select brand_mode = 'platform' from public.organizations where id = '99999999-0000-0000-0000-000000000000'),
  'standard är plattformens varumärke');

-- Ogiltiga värden stoppas av databasen.
select tests.expect_error($q$update public.organizations set brand_color = 'red'
  where id = '99999999-0000-0000-0000-000000000000'$q$, '%organizations_brand_check%');
select tests.expect_error($q$update public.organizations set brand_mode = 'logo', brand_logo_path = null
  where id = '99999999-0000-0000-0000-000000000000'$q$, '%organizations_brand_check%');
select tests.expect_error($q$update public.organizations set brand_mode = 'text', brand_name = '  '
  where id = '99999999-0000-0000-0000-000000000000'$q$, '%organizations_brand_check%');
-- En logga måste ligga i organisationens egen mapp.
select tests.expect_error($q$update public.organizations set brand_mode = 'logo',
  brand_logo_path = '11111111-1111-1111-1111-111111111111/logo.png'
  where id = '99999999-0000-0000-0000-000000000000'$q$, '%organizations_brand_check%');

-- Administratören ändrar varumärket och det syns i historiken.
set local role authenticated;
set local request.jwt.claim.sub = 'cccccccc-0000-0000-0000-000000000001';
select tests.expect_rows($q$update public.organizations set brand_mode = 'logo',
  brand_logo_path = '11111111-1111-1111-1111-111111111111/logo-abc.png', brand_color = '#0e3e59'
  where id = '11111111-1111-1111-1111-111111111111'$q$, 1);
select tests.assert(
  exists (select 1 from public.audit_events where action = 'organization.brand'
          and organization_id = '11111111-1111-1111-1111-111111111111'),
  'historiken visar ändrat varumärke');
-- Men inte en annan förenings.
select tests.expect_rows($q$update public.organizations set brand_color = '#000000'
  where id = '99999999-0000-0000-0000-000000000000'$q$, 0);

-- Boende kan inte ändra varumärket.
set local request.jwt.claim.sub = 'bbbbbbbb-0000-0000-0000-000000000001';
select tests.expect_rows($q$update public.organizations set brand_color = '#000000'
  where id = '11111111-1111-1111-1111-111111111111'$q$, 0);

-- Nattens återställning tar tillbaka demons varumärke.
reset role;
select public.reset_demo_branding();
select tests.assert(
  (select brand_mode = 'text' and brand_logo_path is null and brand_color = '#d51c29'
   from public.organizations where id = '11111111-1111-1111-1111-111111111111'),
  'återställningen tar tillbaka demons varumärke');

rollback;

select 'Varumärkestesterna gick igenom' as result;
