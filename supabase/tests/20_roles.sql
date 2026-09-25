-- Tester för entreprenörsrollen och nattens återställning med kopplade konton.
-- Använder hjälpfunktionerna i schemat tests från 10_security.sql.

insert into auth.users (id, email, raw_user_meta_data) values
  ('eeeeeeee-0000-0000-0000-000000000001', 'vvs@example.com', '{"full_name":"Johan Ek"}');
update public.profiles set organization_id = '11111111-1111-1111-1111-111111111111'
  where id = 'eeeeeeee-0000-0000-0000-000000000001';
insert into public.user_roles (user_id, organization_id, role) values
  ('eeeeeeee-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'contractor');
update public.contractors set user_id = 'eeeeeeee-0000-0000-0000-000000000001'
  where id = '66666666-0000-0000-0000-000000000001';

select public.reset_demo_all();
select tests.assert(
  (select user_id = 'eeeeeeee-0000-0000-0000-000000000001' from public.contractors
   where id = '66666666-0000-0000-0000-000000000001'),
  'reset_demo_all behåller kopplingen mellan entreprenör och konto');

begin;
set local role authenticated;
set local request.jwt.claim.sub = 'eeeeeeee-0000-0000-0000-000000000001';

-- ABC VVS har 1827, 1832, stopp i avlopp och läckage under diskbänk.
select tests.expect_rows('select * from public.maintenance_requests', 4);
select tests.expect_rows('select * from public.units', 4);
select tests.expect_rows('select * from public.payments', 0);
select tests.expect_rows('select * from public.residencies', 0);
select tests.expect_rows($q$update public.maintenance_requests set status = 'booked' where ticket_number = 1827$q$, 1);
select tests.expect_rows($q$insert into public.maintenance_events (organization_id, request_id, label) select organization_id, id, 'Tid bokad' from public.maintenance_requests where ticket_number = 1827$q$, 1);
select tests.expect_error($q$update public.maintenance_requests set contractor_id = '66666666-0000-0000-0000-000000000002' where ticket_number = 1827$q$, '%row-level security%');
select tests.expect_rows($q$update public.maintenance_requests set status = 'resolved' where contractor_id = '66666666-0000-0000-0000-000000000002'$q$, 0);
rollback;

select 'Rolltesterna gick igenom' as result;
