-- Utskick: notiser köas som e-post/sms enligt mottagarens val, och bara
-- servern (med hemligheten) kan hämta och avsluta utskick.
insert into private.billing_secret (hash)
  values (encode(sha256(convert_to('test-hemlighet', 'UTF8')), 'hex'))
  on conflict do nothing;

insert into public.organizations (id, name, slug, org_type)
  values ('99999999-0000-0000-0000-0000000000a1', 'BRF Utskick', 'brf-utskick', 'brf');
insert into auth.users (id, email)
  values ('cccccccc-0000-0000-0000-0000000000a1', 'boende@utskick.test');
update public.profiles
  set organization_id = '99999999-0000-0000-0000-0000000000a1', phone = '070-123 45 67'
  where id = 'cccccccc-0000-0000-0000-0000000000a1';

create temp table n_ids (label text, id uuid);
grant select on n_ids to authenticated;

with n as (
  insert into public.notifications (organization_id, user_id, title, body, link)
  values ('99999999-0000-0000-0000-0000000000a1', 'cccccccc-0000-0000-0000-0000000000a1',
    'Ny avi', 'Avin för oktober', '/app/ekonomi') returning id)
insert into n_ids select 'avi1', id from n;

select tests.assert(
  (select count(*) = 1 and bool_and(channel = 'email' and status = 'pending'
     and recipient = 'boende@utskick.test' and category = 'economy')
   from public.notification_deliveries d join n_ids on n_ids.id = d.notification_id
   where n_ids.label = 'avi1'),
  'notis blir ett e-postutskick; sms är avstängt som standard');

update public.organizations set sms_enabled = true where id = '99999999-0000-0000-0000-0000000000a1';
insert into public.notification_prefs (user_id, sms_enabled)
  values ('cccccccc-0000-0000-0000-0000000000a1', true);

with n as (
  insert into public.notifications (organization_id, user_id, title, body, link)
  values
    ('99999999-0000-0000-0000-0000000000a1', 'cccccccc-0000-0000-0000-0000000000a1',
      'Påminnelse', 'Obetald avi', '/app/ekonomi'),
    ('99999999-0000-0000-0000-0000000000a1', 'cccccccc-0000-0000-0000-0000000000a1',
      'Nyhet', 'Städdag på lördag', '/app/information')
  returning id, title)
insert into n_ids select case when title = 'Nyhet' then 'nyhet' else 'avi2' end, id from n;

select tests.assert(
  (select array_agg(channel order by channel) = array['email', 'sms']
   from public.notification_deliveries d join n_ids on n_ids.id = d.notification_id
   where n_ids.label = 'avi2'),
  'med sms påslaget går avin både som e-post och sms');
select tests.assert(
  (select array_agg(channel) = array['email']
   from public.notification_deliveries d join n_ids on n_ids.id = d.notification_id
   where n_ids.label = 'nyhet'),
  'nyheter skickas aldrig som sms');

update public.notification_prefs set email_enabled = false, sms_enabled = false
  where user_id = 'cccccccc-0000-0000-0000-0000000000a1';
with n as (
  insert into public.notifications (organization_id, user_id, title, body, link)
  values ('99999999-0000-0000-0000-0000000000a1', 'cccccccc-0000-0000-0000-0000000000a1',
    'Tyst', 'Ingen kanal', '/app/ekonomi') returning id)
insert into n_ids select 'tyst', id from n;
select tests.assert(
  not exists (select 1 from public.notification_deliveries d join n_ids on n_ids.id = d.notification_id
    where n_ids.label = 'tyst'),
  'den som stängt av alla kanaler får inga utskick');

with n as (
  insert into public.notifications (organization_id, user_id, title, body, link)
  values ('11111111-1111-1111-1111-111111111111', 'bbbbbbbb-0000-0000-0000-000000000001',
    'Demo', 'Demonotis', '/app/ekonomi') returning id)
insert into n_ids select 'demo', id from n;
select tests.assert(
  (select bool_and(status = 'skipped') from public.notification_deliveries d
   join n_ids on n_ids.id = d.notification_id where n_ids.label = 'demo'),
  'demoföreningen skickar inga riktiga utskick');

begin;
set local role authenticated;
set local request.jwt.claim.sub = 'cccccccc-0000-0000-0000-0000000000a1';
select tests.assert(
  (select count(*) = 4 from public.notification_deliveries),
  'boende ser sina egna utskick');
select tests.expect_error(
  $q$update public.notification_deliveries set status = 'sent'$q$, '%permission denied%');
select tests.expect_error(
  $q$insert into public.notification_deliveries (notification_id, organization_id, user_id, channel, category, recipient)
     select id, '99999999-0000-0000-0000-0000000000a1', auth.uid(), 'sms', 'other', '+46700000000' from n_ids limit 1$q$,
  '%permission denied%');
select tests.expect_error(
  $q$select * from public.claim_notification_deliveries('fel', array['email'])$q$, 'Behörighet saknas');
select tests.expect_error(
  $q$select public.finish_notification_delivery('fel', gen_random_uuid(), true)$q$, 'Behörighet saknas');
rollback;

begin;
set local role authenticated;
set local request.jwt.claim.sub = 'bbbbbbbb-0000-0000-0000-000000000001';
select tests.assert(
  not exists (select 1 from public.notification_deliveries
    where organization_id = '99999999-0000-0000-0000-0000000000a1'),
  'andra ser inte organisationens utskick');
rollback;

-- Servern hämtar bara de kanaler den kan skicka med.
create temp table claimed as
  select * from public.claim_notification_deliveries('test-hemlighet', array['email'], 50)
  where recipient = 'boende@utskick.test';
select tests.assert(
  (select count(*) = 3 and bool_and(channel = 'email') and bool_and(attempts = 1) from claimed),
  'servern hämtar köade e-postutskick');
select tests.assert(
  (select count(*) = 0 from public.claim_notification_deliveries('test-hemlighet', array['email'], 50)
   where recipient = 'boende@utskick.test'),
  'ett hämtat utskick hämtas inte igen');
select tests.assert(
  (select title = 'Ny avi' and organization_name = 'BRF Utskick' from claimed
   join public.notification_deliveries d using (id)
   join n_ids on n_ids.id = d.notification_id where n_ids.label = 'avi1'),
  'utskicket har notisens innehåll');

select public.finish_notification_delivery('test-hemlighet', c.id, true, 'resend-1')
from claimed c join public.notification_deliveries d using (id)
join n_ids on n_ids.id = d.notification_id where n_ids.label = 'avi1';
select tests.assert(
  (select status = 'sent' and sent_at is not null and provider_id = 'resend-1'
   from public.notification_deliveries d join n_ids on n_ids.id = d.notification_id
   where n_ids.label = 'avi1' and channel = 'email'),
  'lyckat utskick markeras som skickat');

select public.finish_notification_delivery('test-hemlighet', c.id, false, null, 'Tillfälligt fel')
from claimed c join public.notification_deliveries d using (id)
join n_ids on n_ids.id = d.notification_id where n_ids.label = 'avi2';
select tests.assert(
  (select status = 'pending' and error = 'Tillfälligt fel' and next_attempt_at > now()
   from public.notification_deliveries d join n_ids on n_ids.id = d.notification_id
   where n_ids.label = 'avi2' and channel = 'email'),
  'misslyckat utskick görs om senare');

select public.finish_notification_delivery('test-hemlighet', c.id, false, null, 'Ogiltig adress', false)
from claimed c join public.notification_deliveries d using (id)
join n_ids on n_ids.id = d.notification_id where n_ids.label = 'nyhet';
select tests.assert(
  (select status = 'failed' from public.notification_deliveries d join n_ids on n_ids.id = d.notification_id
   where n_ids.label = 'nyhet'),
  'permanent fel görs inte om');

update public.notification_deliveries set created_at = now() - interval '2 days'
  where channel = 'sms' and recipient = '070-123 45 67';
select from public.claim_notification_deliveries('test-hemlighet', array['sms'], 50);
select tests.assert(
  (select status = 'skipped' from public.notification_deliveries
   where channel = 'sms' and recipient = '070-123 45 67'),
  'gamla köade utskick skickas inte i efterhand');
select 'Utskickstesterna gick igenom' as result;
