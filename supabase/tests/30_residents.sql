-- Tester för kontaktuppgifter och återställning av lägenheter och boenden.

-- Boende (bbbb… i 3B från 10_security.sql) uppdaterar sina kontaktuppgifter.
begin;
set local role authenticated;
set local request.jwt.claim.sub = 'bbbbbbbb-0000-0000-0000-000000000001';
select public.update_my_contact('Nytt Namn', '070-111 22 33');
select tests.assert(
  (select full_name = 'Nytt Namn' and phone = '070-111 22 33' from public.profiles where id = auth.uid()),
  'profilen uppdateras');
select tests.assert(
  (select phone = '070-111 22 33' from public.residencies where user_id = auth.uid() and status = 'active'),
  'telefon i boendet uppdateras');
select tests.expect_error($q$select public.update_my_contact('', '')$q$, 'Ogiltiga uppgifter');
rollback;

begin;
set local role anon;
select tests.expect_error($q$select public.update_my_contact('A', '1')$q$, '%permission denied%');
rollback;

-- Förvaltaren flyttar ut 3B, ändrar lägenheten och flyttar in någon i en
-- annan lägenhet; återställningen tar bort ändringarna men behåller kontot.
update public.residencies set status = 'moved_out', move_out_date = current_date
  where unit_id = '44444444-0000-0000-0000-000000000001';
update public.units set status = 'vacant', monthly_amount = 1
  where id = '44444444-0000-0000-0000-000000000001';
insert into public.residencies (id, organization_id, unit_id, resident_name)
  values ('ffffffff-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111',
          '44444444-0000-0000-0000-000000000002', 'Ny Hyresgäst');

select public.reset_demo_all();

select tests.assert(
  (select status = 'active' and move_out_date is null and user_id = 'bbbbbbbb-0000-0000-0000-000000000001'
   from public.residencies where unit_id = '44444444-0000-0000-0000-000000000001'),
  'utflytten återställs och kontokopplingen behålls');
select tests.assert(
  (select status = 'active' and monthly_amount = 5420 from public.units
   where id = '44444444-0000-0000-0000-000000000001'),
  'lägenheten återställs');
select tests.assert(
  not exists (select 1 from public.residencies where id = 'ffffffff-0000-0000-0000-000000000001'),
  'inflyttningen tas bort');

select 'Boendetesterna gick igenom' as result;
