-- Tester för demobetalning och notiser.

-- En obetald avi för 3B (den boendes lägenhet) och en för 4C (någon annans).
insert into public.payments (id, organization_id, unit_id, kind, period, amount, due_date, status) values
  ('a0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111',
   '44444444-0000-0000-0000-000000000001', 'fee', date '2030-01-01', 5420, date '2030-01-31', 'unpaid'),
  ('a0000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111',
   '44444444-0000-0000-0000-000000000002', 'rent', date '2030-01-01', 8420, date '2030-01-31', 'unpaid');

begin;
set local role authenticated;
set local request.jwt.claim.sub = 'bbbbbbbb-0000-0000-0000-000000000001';
select public.pay_my_payment('a0000000-0000-0000-0000-000000000001', 'swish');
select tests.assert(
  (select status = 'paid' and paid_via = 'swish' and paid_at is not null from public.payments
   where id = 'a0000000-0000-0000-0000-000000000001'),
  'den boende betalar sin egen avi');
select tests.expect_error($q$select public.pay_my_payment('a0000000-0000-0000-0000-000000000001', 'swish')$q$, 'Betalningen är redan betald');
select tests.expect_error($q$select public.pay_my_payment('a0000000-0000-0000-0000-000000000002', 'card')$q$, 'Betalningen hittades inte');
select tests.expect_error($q$select public.pay_my_payment('a0000000-0000-0000-0000-000000000002', 'bitcoin')$q$, 'Okänt betalsätt');
-- Boende kan inte skapa notiser åt andra.
select tests.expect_error($q$insert into public.notifications (organization_id, user_id, title) values ('11111111-1111-1111-1111-111111111111', 'cccccccc-0000-0000-0000-000000000001', 'x')$q$, '%row-level security%');
rollback;

begin;
set local role authenticated;
set local request.jwt.claim.sub = 'cccccccc-0000-0000-0000-000000000001';
-- Förvaltaren notifierar en boende i föreningen men inte någon utanför.
select tests.expect_rows($q$insert into public.notifications (organization_id, user_id, title) values ('11111111-1111-1111-1111-111111111111', 'bbbbbbbb-0000-0000-0000-000000000001', 'Påminnelse')$q$, 1);
select tests.expect_error($q$insert into public.notifications (organization_id, user_id, title) values ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-0000-0000-0000-000000000001', 'x')$q$, '%row-level security%');
-- Förvaltaren kan inte läsa den boendes notiser.
select tests.expect_rows('select * from public.notifications', 0);
rollback;

delete from public.payments where id in ('a0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000002');


select public.reset_demo_all();
select tests.assert(
  (select status = 'unpaid' from public.payments
   where unit_id = '44444444-0000-0000-0000-000000000002'
     and period = date_trunc('month', current_date)::date),
  'demo: 4C har en obetald avi för innevarande månad');

select 'Ekonomitesterna gick igenom' as result;
