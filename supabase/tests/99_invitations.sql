-- Tester för inbjudningar, hushåll, historik och att föreningar hålls isär.
-- Demoföreningen (1111…) har admin cccc… och boende bbbb… i 3B. Förening
-- 9999… ("Annan") får här en lägenhet och en egen administratör.

begin;

insert into public.properties (id, organization_id, name, address)
  values ('99999999-0000-0000-0000-0000000000a1', '99999999-0000-0000-0000-000000000000', 'Annan fastighet', 'Annangatan 1');
insert into public.buildings (id, organization_id, property_id, name)
  values ('99999999-0000-0000-0000-0000000000b1', '99999999-0000-0000-0000-000000000000',
          '99999999-0000-0000-0000-0000000000a1', 'Hus A');
insert into public.units (id, organization_id, building_id, unit_number, address, status)
  values ('99999999-0000-0000-0000-0000000000c1', '99999999-0000-0000-0000-000000000000',
          '99999999-0000-0000-0000-0000000000b1', '1001', 'Annangatan 1', 'vacant');
insert into auth.users (id, email, raw_user_meta_data) values
  ('eeeeeeee-0000-0000-0000-0000000000e9', 'annan-admin@example.com', '{"full_name":"Annan Admin"}'),
  ('ffffffff-0000-0000-0000-00000000000f', 'ny@example.com', '{"full_name":"Ny Boende"}');
update public.profiles set organization_id = '99999999-0000-0000-0000-000000000000'
  where id = 'eeeeeeee-0000-0000-0000-0000000000e9';
insert into public.user_roles (user_id, organization_id, role)
  values ('eeeeeeee-0000-0000-0000-0000000000e9', '99999999-0000-0000-0000-000000000000', 'org_admin');

-- Administratören i Annan skapar en inbjudan till sin lägenhet.
set local role authenticated;
set local request.jwt.claim.sub = 'eeeeeeee-0000-0000-0000-0000000000e9';
select tests.expect_rows($q$insert into public.invitations (organization_id, unit_id, invitee_name, token_hash, created_by)
  values ('99999999-0000-0000-0000-000000000000', '99999999-0000-0000-0000-0000000000c1', 'Ny Boende',
          encode(sha256(convert_to('token-annan-0123456789abcdef', 'UTF8')), 'hex'),
          'eeeeeeee-0000-0000-0000-0000000000e9')$q$, 1);
-- Inte till en lägenhet i en annan förening, och inte i en annan förenings namn.
select tests.expect_error($q$insert into public.invitations (organization_id, unit_id, token_hash, created_by)
  values ('99999999-0000-0000-0000-000000000000', '44444444-0000-0000-0000-000000000002',
          repeat('a', 64), 'eeeeeeee-0000-0000-0000-0000000000e9')$q$, 'Lägenheten hör inte till föreningen');
select tests.expect_error($q$insert into public.invitations (organization_id, unit_id, token_hash, created_by)
  values ('11111111-1111-1111-1111-111111111111', '44444444-0000-0000-0000-000000000002',
          repeat('b', 64), 'eeeeeeee-0000-0000-0000-0000000000e9')$q$, '%row-level security%');
-- Tokenen går inte att byta i efterhand.
select tests.expect_error($q$update public.invitations set token_hash = repeat('c', 64)
  where unit_id = '99999999-0000-0000-0000-0000000000c1'$q$, 'Inbjudan kan inte ändras');
-- Admin kan inte heller koppla ett boende till en annan förenings lägenhet.
select tests.expect_error($q$insert into public.residencies (organization_id, unit_id, resident_name)
  values ('99999999-0000-0000-0000-000000000000', '44444444-0000-0000-0000-000000000002', 'X')$q$,
  'Lägenheten hör inte till föreningen');

-- Demoföreningens admin och boende ser inte Annans inbjudningar.
set local request.jwt.claim.sub = 'cccccccc-0000-0000-0000-000000000001';
select tests.expect_rows('select * from public.invitations', 0);
select tests.expect_error($q$insert into public.residencies (organization_id, unit_id, resident_name)
  values ('11111111-1111-1111-1111-111111111111', '99999999-0000-0000-0000-0000000000c1', 'X')$q$,
  'Lägenheten hör inte till föreningen');
set local request.jwt.claim.sub = 'bbbbbbbb-0000-0000-0000-000000000001';
select tests.expect_rows('select * from public.invitations', 0);
select tests.expect_error($q$insert into public.invitations (organization_id, unit_id, token_hash, created_by)
  values ('11111111-1111-1111-1111-111111111111', '44444444-0000-0000-0000-000000000001',
          repeat('d', 64), 'bbbbbbbb-0000-0000-0000-000000000001')$q$, '%row-level security%');

-- Vem som helst med länken ser vad den gäller; utan rätt token inget.
set local role anon;
select tests.assert(
  (select public.invitation_preview('token-annan-0123456789abcdef')->>'status' = 'valid'
      and public.invitation_preview('token-annan-0123456789abcdef')->>'unit_number' = '1001'),
  'förhandsvisningen visar lägenheten');
select tests.assert(
  public.invitation_preview('token-fel-0123456789abcdefgh') = '{"status": "not_found"}'::jsonb,
  'fel token ger inget');
select tests.expect_error($q$select public.accept_invitation('token-annan-0123456789abcdef')$q$, '%permission denied%');

-- Ett konto i en annan förening kan inte ta emot inbjudan.
set local role authenticated;
set local request.jwt.claim.sub = 'bbbbbbbb-0000-0000-0000-000000000001';
select tests.expect_error($q$select public.accept_invitation('token-annan-0123456789abcdef')$q$, '%annan förening%');

-- Det nya kontot tar emot inbjudan.
set local request.jwt.claim.sub = 'ffffffff-0000-0000-0000-00000000000f';
select tests.assert(
  (select public.accept_invitation('token-annan-0123456789abcdef', 'Nya Boendet')->>'unit_number' = '1001'),
  'inbjudan tas emot');
select tests.assert(
  (select organization_id = '99999999-0000-0000-0000-000000000000' and full_name = 'Nya Boendet'
   from public.profiles where id = auth.uid()),
  'kontot kopplas till föreningen');
select tests.assert(
  exists (select 1 from public.user_roles where user_id = auth.uid() and role = 'resident'
          and organization_id = '99999999-0000-0000-0000-000000000000'),
  'kontot får rollen boende');
select tests.assert(
  (select is_primary and status = 'active' from public.residencies where user_id = auth.uid()),
  'första boendet blir primär boende');
select tests.assert(
  (select count(*) = 1 and bool_and(is_me) from public.my_household()),
  'hushållet visas för den boende');
select tests.expect_error($q$select public.accept_invitation('token-annan-0123456789abcdef')$q$, 'Inbjudan har redan använts.');
select tests.expect_rows('select * from public.audit_events', 0);

-- Administratören ser historiken och kan återkalla en ny inbjudan.
set local request.jwt.claim.sub = 'eeeeeeee-0000-0000-0000-0000000000e9';
select tests.assert(
  (select status = 'active' from public.units where id = '99999999-0000-0000-0000-0000000000c1'),
  'lägenheten blir aktiv');
select tests.assert(
  (select count(*) >= 3 from public.audit_events
   where action in ('invitation.created', 'resident.added', 'invitation.accepted')),
  'historiken skrivs');
select tests.expect_error($q$insert into public.audit_events (organization_id, action, summary)
  values ('99999999-0000-0000-0000-000000000000', 'x', 'falsk rad')$q$, '%row-level security%');
insert into public.invitations (organization_id, unit_id, token_hash, created_by)
  values ('99999999-0000-0000-0000-000000000000', '99999999-0000-0000-0000-0000000000c1',
          encode(sha256(convert_to('token-annan-andra-0123456789', 'UTF8')), 'hex'),
          'eeeeeeee-0000-0000-0000-0000000000e9');
update public.invitations set revoked_at = now()
  where token_hash = encode(sha256(convert_to('token-annan-andra-0123456789', 'UTF8')), 'hex');
select tests.assert(
  public.invitation_preview('token-annan-andra-0123456789')->>'status' = 'revoked',
  'återkallad inbjudan');
select tests.expect_error($q$update public.invitations set revoked_at = null
  where token_hash = encode(sha256(convert_to('token-annan-andra-0123456789', 'UTF8')), 'hex')$q$,
  'Inbjudan kan inte ändras');

-- Demoföreningens inbjudningar kan visas men inte användas.
reset role;
insert into public.invitations (organization_id, unit_id, token_hash, created_by)
  values ('11111111-1111-1111-1111-111111111111', '44444444-0000-0000-0000-000000000002',
          encode(sha256(convert_to('token-demo-0123456789abcdefgh', 'UTF8')), 'hex'),
          'cccccccc-0000-0000-0000-000000000001');
set local role authenticated;
set local request.jwt.claim.sub = 'aaaaaaaa-0000-0000-0000-000000000001';
select tests.expect_error($q$select public.accept_invitation('token-demo-0123456789abcdefgh')$q$, '%demoförening%');

rollback;

select 'Inbjudningstesterna gick igenom' as result;
