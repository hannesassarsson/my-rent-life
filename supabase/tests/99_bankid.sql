-- BankID: personnummer kopplas bara via servern (hemligheten), lagras
-- hashat och kan inte läsas eller kopplas om av användare.
insert into private.billing_secret (hash)
  values (encode(sha256(convert_to('test-hemlighet', 'UTF8')), 'hex'))
  on conflict do nothing;

insert into public.organizations (id, name, slug, org_type)
  values ('99999999-0000-0000-0000-0000000000b1', 'BRF BankID', 'brf-bankid', 'brf');
insert into auth.users (id, email) values
  ('cccccccc-0000-0000-0000-0000000000b1', 'anna@bankid.test'),
  ('cccccccc-0000-0000-0000-0000000000b2', 'bo@bankid.test');
update public.profiles set organization_id = '99999999-0000-0000-0000-0000000000b1'
  where id in ('cccccccc-0000-0000-0000-0000000000b1', 'cccccccc-0000-0000-0000-0000000000b2');
insert into public.user_roles (user_id, organization_id, role)
  values ('cccccccc-0000-0000-0000-0000000000b2', '99999999-0000-0000-0000-0000000000b1', 'org_admin');

select tests.assert(
  public.link_bankid('test-hemlighet', 'cccccccc-0000-0000-0000-0000000000b1',
    repeat('a', 64), '••••••••-1234') = 'linked',
  'servern kopplar ett personnummer till ett konto');
select tests.assert(
  public.link_bankid('test-hemlighet', 'cccccccc-0000-0000-0000-0000000000b2',
    repeat('a', 64), '••••••••-1234') = 'taken',
  'samma personnummer kan inte kopplas till ett annat konto');
select tests.expect_error(
  $q$select public.link_bankid('test-hemlighet', 'cccccccc-0000-0000-0000-0000000000b1', repeat('b', 64), '••••••••-9999', '11111111-1111-1111-1111-111111111111')$q$,
  'Kontot hittades inte');
select tests.expect_error(
  $q$select public.link_bankid('test-hemlighet', 'cccccccc-0000-0000-0000-0000000000b2', repeat('b', 64), '••••••••-9999', '99999999-0000-0000-0000-0000000000b1')$q$,
  'Personal kopplar BankID själva%');
select tests.assert(
  public.link_bankid('test-hemlighet', 'cccccccc-0000-0000-0000-0000000000b1',
    repeat('9', 64), '••••••••-9999', '99999999-0000-0000-0000-0000000000b1') = 'linked',
  'förvaltningen kopplar en boendes konto');
select tests.assert(
  public.link_bankid('test-hemlighet', 'bbbbbbbb-0000-0000-0000-000000000001',
    repeat('c', 64), '••••••••-5555') = 'demo',
  'demokonton kan inte kopplas');
select tests.assert(
  (select user_id = 'cccccccc-0000-0000-0000-0000000000b1' and email = 'anna@bankid.test'
   from public.bankid_login('test-hemlighet', repeat('9', 64))),
  'inloggning hittar kontot');
select tests.assert(
  not exists (select 1 from public.bankid_login('test-hemlighet', repeat('d', 64))),
  'okänt personnummer ger inget konto');

-- Nytt personnummer på samma konto ersätter det gamla.
select public.link_bankid('test-hemlighet', 'cccccccc-0000-0000-0000-0000000000b1',
  repeat('e', 64), '••••••••-4321');
select tests.assert(
  not exists (select 1 from public.bankid_login('test-hemlighet', repeat('9', 64))),
  'ett konto har bara ett personnummer');

begin;
set local role authenticated;
set local request.jwt.claim.sub = 'cccccccc-0000-0000-0000-0000000000b1';
select tests.assert(
  (select (public.my_bankid()->>'linked')::boolean and public.my_bankid()->>'hint' = '••••••••-4321'),
  'användaren ser sin maskerade koppling');
select tests.expect_error($q$select * from private.bankid_identities$q$, '%permission denied%');
select tests.expect_error(
  $q$select public.link_bankid('fel', auth.uid(), repeat('f', 64), '••••••••-0000')$q$,
  'Behörighet saknas');
select tests.expect_error(
  $q$select * from public.bankid_login('fel', repeat('e', 64))$q$, 'Behörighet saknas');
select tests.assert(
  not exists (select 1 from public.org_bankid_links(array['cccccccc-0000-0000-0000-0000000000b1'::uuid])),
  'boende ser inte andras kopplingar');
select tests.expect_error(
  $q$select public.unlink_member_bankid('cccccccc-0000-0000-0000-0000000000b2')$q$,
  'Behörighet saknas');
select public.unlink_my_bankid();
select tests.assert(
  not (public.my_bankid()->>'linked')::boolean, 'användaren kan ta bort sin koppling');
rollback;

begin;
set local role authenticated;
set local request.jwt.claim.sub = 'cccccccc-0000-0000-0000-0000000000b2';
select tests.assert(
  (select hint = '••••••••-4321' from public.org_bankid_links(array['cccccccc-0000-0000-0000-0000000000b1'::uuid])),
  'förvaltningen ser vilka som har BankID');
select public.unlink_member_bankid('cccccccc-0000-0000-0000-0000000000b1');
select tests.assert(
  not exists (select 1 from public.org_bankid_links(array['cccccccc-0000-0000-0000-0000000000b1'::uuid])),
  'förvaltningen kan ta bort en koppling');
rollback;

select 'BankID-testerna gick igenom' as result;
