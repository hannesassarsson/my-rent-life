-- Abonnemang: medlemmar läser, ingen kan ändra utan serverns hemlighet.
insert into private.billing_secret (hash)
  values (encode(sha256(convert_to('test-hemlighet', 'UTF8')), 'hex'));

select tests.assert(
  (select plan = 'forvaltning' and is_demo from public.subscriptions
   where organization_id = '11111111-1111-1111-1111-111111111111'),
  'demoföreningen har en demoplan');

-- Ny organisation får provperiod.
insert into public.organizations (id, name, slug, org_type)
  values ('99999999-0000-0000-0000-000000000001', 'BRF Test', 'brf-test', 'brf');
select tests.assert(
  (select status = 'trialing' and trial_ends_at > now() + interval '29 days'
   from public.subscriptions where organization_id = '99999999-0000-0000-0000-000000000001'),
  'ny organisation får 30 dagars provperiod');

begin;
set local role authenticated;
set local request.jwt.claim.sub = 'bbbbbbbb-0000-0000-0000-000000000001';
select tests.assert(
  (select count(*) = 1 from public.subscriptions), 'boende ser bara sin organisations abonnemang');
select tests.expect_error(
  $q$update public.subscriptions set plan = 'forvaltning'$q$, '%permission denied%');
select tests.expect_error(
  $q$select public.apply_billing('fel', '99999999-0000-0000-0000-000000000001', null, '{"status":"active"}')$q$,
  'Behörighet saknas');
select tests.expect_error($q$select * from private.billing_secret$q$, '%permission denied%');
rollback;

begin;
set local role anon;
select public.apply_billing('test-hemlighet', '99999999-0000-0000-0000-000000000001', null,
  '{"status":"past_due","plan":"bas","stripe_customer_id":"cus_test","stripe_mode":"test"}');
rollback;
select public.apply_billing('test-hemlighet', '99999999-0000-0000-0000-000000000001', null,
  '{"status":"past_due","plan":"bas","stripe_customer_id":"cus_test","stripe_mode":"test"}');
select tests.assert(
  (select plan = 'bas' and status = 'past_due' and past_due_since is not null
   from public.subscriptions where organization_id = '99999999-0000-0000-0000-000000000001'),
  'servern uppdaterar abonnemanget och fristen börjar');
-- Uppslag på Stripe-kund (webhook).
select tests.assert(
  public.apply_billing('test-hemlighet', null, 'cus_test', '{"status":"active"}')
    = '99999999-0000-0000-0000-000000000001',
  'webhooken hittar organisationen via kunden');
select tests.assert(
  (select status = 'active' and past_due_since is null
   from public.subscriptions where organization_id = '99999999-0000-0000-0000-000000000001'),
  'betald faktura nollställer fristen');
-- Demoföreningen ändras aldrig.
select public.apply_billing('test-hemlighet', '11111111-1111-1111-1111-111111111111', null, '{"status":"canceled"}');
select tests.assert(
  (select status = 'active' from public.subscriptions
   where organization_id = '11111111-1111-1111-1111-111111111111'),
  'demoföreningens abonnemang påverkas inte');

delete from public.organizations where id = '99999999-0000-0000-0000-000000000001';
delete from private.billing_secret;
select 'Abonnemangstesterna gick igenom' as result;
