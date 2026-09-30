-- Tester för roller i inställningarna och notiser i ärenden.

begin;
set local role authenticated;
set local request.jwt.claim.sub = 'cccccccc-0000-0000-0000-000000000001';
select public.set_member_role('bbbbbbbb-0000-0000-0000-000000000001', 'board_member');
select tests.assert(
  (select array_agg(role::text) = array['board_member'] from public.user_roles
   where user_id = 'bbbbbbbb-0000-0000-0000-000000000001'),
  'administratören byter roll på en medlem');
select tests.expect_error($q$select public.set_member_role('cccccccc-0000-0000-0000-000000000001', 'resident')$q$, 'Du kan inte ändra din egen roll');
select tests.expect_error($q$select public.set_member_role('aaaaaaaa-0000-0000-0000-000000000001', 'staff')$q$, 'Användaren finns inte i organisationen');
select tests.expect_error($q$select public.set_member_role('bbbbbbbb-0000-0000-0000-000000000001', 'super_admin')$q$, 'Rollen kan inte tilldelas här');
rollback;

begin;
set local role authenticated;
set local request.jwt.claim.sub = 'bbbbbbbb-0000-0000-0000-000000000001';
select tests.expect_error($q$select public.set_member_role('cccccccc-0000-0000-0000-000000000001', 'resident')$q$, 'Behörighet saknas');
rollback;

-- Entreprenören (eeee…) notifierar anmälaren av ärende 1827 (den boende bbbb…).
begin;
set local role authenticated;
set local request.jwt.claim.sub = 'eeeeeeee-0000-0000-0000-000000000001';
select public.notify_request_reporter(
  (select id from public.maintenance_requests where ticket_number = 1827), 'Tid bokad', 'Vi kommer tisdag');
-- Men inte för ett ärende som entreprenören inte har.
select tests.expect_error($q$select public.notify_request_reporter((select id from public.maintenance_requests where contractor_id is null limit 1), 'x', 'y')$q$, 'Ärendet hittades inte');
reset role;
select tests.assert(
  (select count(*) = 1 from public.notifications
   where user_id = 'bbbbbbbb-0000-0000-0000-000000000001' and title = 'Tid bokad'
     and link like '/app/felanmalan/%'),
  'notisen hamnar hos den boende med länk till ärendet');
rollback;

select 'Inställningstesterna gick igenom' as result;
