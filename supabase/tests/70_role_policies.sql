-- Skrivrätten i databasen följer rollmodellen: styrelse och fastighetsskötare
-- kan inte göra mer via API:t än i appen.

insert into auth.users (id, email) values
  ('b0a4d000-0000-0000-0000-000000000001', 'styrelse@example.com'),
  ('57aff000-0000-0000-0000-000000000001', 'skotare@example.com');
update public.profiles set organization_id = '11111111-1111-1111-1111-111111111111'
  where id in ('b0a4d000-0000-0000-0000-000000000001', '57aff000-0000-0000-0000-000000000001');
insert into public.user_roles (user_id, organization_id, role) values
  ('b0a4d000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'board_member'),
  ('57aff000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'staff');

-- STYRELSEN
begin;
set local role authenticated;
set local request.jwt.claim.sub = 'b0a4d000-0000-0000-0000-000000000001';
select tests.expect_rows('select * from public.payments limit 5', 5);
select tests.expect_rows($q$update public.payments set status = 'paid' where status <> 'paid'$q$, 0);
select tests.expect_rows($q$update public.contractors set company = 'x'$q$, 0);
select tests.expect_rows($q$update public.units set monthly_amount = 1$q$, 0);
select tests.expect_rows($q$update public.maintenance_requests set status = 'closed' where ticket_number = 1832$q$, 0);
select tests.expect_rows($q$update public.resources set is_active = false$q$, 0);
select tests.expect_rows($q$update public.organizations set name = 'x'$q$, 0);
select tests.expect_rows('select * from public.contractors', 4);
select tests.expect_rows($q$update public.announcements set is_pinned = true$q$, 6);
select tests.expect_rows($q$update public.meetings set location = 'Nytt rum'$q$, 3);
select tests.expect_rows($q$update public.maintenance_projects set note = 'x'$q$, 6);
select tests.expect_error($q$insert into public.inspections (organization_id, kind) values ('11111111-1111-1111-1111-111111111111', 'periodic')$q$, '%row-level security%');
rollback;

-- FASTIGHETSSKÖTAREN
begin;
set local role authenticated;
set local request.jwt.claim.sub = '57aff000-0000-0000-0000-000000000001';
select tests.expect_rows($q$update public.maintenance_requests set status = 'closed' where ticket_number = 1832$q$, 1);
select tests.expect_rows($q$update public.resources set cancel_hours = 3$q$, 7);
select tests.expect_rows($q$update public.announcements set is_pinned = true$q$, 0);
select tests.expect_rows($q$update public.payments set status = 'paid' where status <> 'paid'$q$, 0);
select tests.expect_error($q$insert into public.documents (organization_id, title) values ('11111111-1111-1111-1111-111111111111', 'x')$q$, '%row-level security%');
select tests.expect_rows($q$insert into public.inspections (organization_id, kind) values ('11111111-1111-1111-1111-111111111111', 'periodic')$q$, 1);
rollback;

-- Förvaltaren (cccc…) kan fortfarande allt.
begin;
set local role authenticated;
set local request.jwt.claim.sub = 'cccccccc-0000-0000-0000-000000000001';
select tests.expect_rows($q$update public.contractors set agreement_note = 'x'$q$, 4);
select tests.expect_rows($q$update public.organizations set name = 'BRF Test'$q$, 1);
rollback;

select 'Rollpolicytesterna gick igenom' as result;
