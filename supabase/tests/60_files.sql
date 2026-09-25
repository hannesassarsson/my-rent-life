-- Tester för bilagor i ärenden och dokumentens sökvägar. Storage-reglerna
-- finns bara i Supabase och testas inte här.

begin;
set local role authenticated;
set local request.jwt.claim.sub = 'bbbbbbbb-0000-0000-0000-000000000001';
select tests.expect_rows($q$
  insert into public.request_attachments (organization_id, request_id, storage_path, file_name, uploaded_by)
  select organization_id, id, organization_id || '/requests/' || id || '/bild.jpg', 'bild.jpg', auth.uid()
  from public.maintenance_requests where ticket_number = 1827$q$, 1);
select tests.expect_rows('select * from public.request_attachments', 1);
-- Fel mapp eller någon annans ärende nekas.
select tests.expect_error($q$
  insert into public.request_attachments (organization_id, request_id, storage_path, file_name, uploaded_by)
  select organization_id, id, 'annan/mapp/bild.jpg', 'bild.jpg', auth.uid()
  from public.maintenance_requests where ticket_number = 1827$q$, '%row-level security%');
select tests.expect_error($q$
  insert into public.request_attachments (organization_id, request_id, storage_path, file_name, uploaded_by)
  values ('11111111-1111-1111-1111-111111111111', '88888888-0000-0000-0000-000000001832',
          '11111111-1111-1111-1111-111111111111/requests/88888888-0000-0000-0000-000000001832/x.jpg',
          'x.jpg', auth.uid())$q$, '%row-level security%');
rollback;

-- Entreprenören ser bilagor i sina ärenden, en boende utan ärendet ser dem inte.
insert into public.request_attachments (organization_id, request_id, storage_path, file_name)
select organization_id, id, organization_id || '/requests/' || id || '/foto.jpg', 'foto.jpg'
from public.maintenance_requests where ticket_number = 1827;
begin;
set local role authenticated;
set local request.jwt.claim.sub = 'eeeeeeee-0000-0000-0000-000000000001';
select tests.expect_rows('select * from public.request_attachments', 1);
set local request.jwt.claim.sub = 'aaaaaaaa-0000-0000-0000-000000000001';
select tests.expect_rows('select * from public.request_attachments', 0);
rollback;

select tests.expect_error($q$
  insert into public.documents (organization_id, title, storage_path)
  values ('11111111-1111-1111-1111-111111111111', 'Fel mapp', '99999999-0000-0000-0000-000000000000/documents/x.pdf')$q$,
  '%documents_storage_path_in_org%');

select public.reset_demo_all();
select tests.assert(
  (select count(*) = 9 from public.documents where storage_path like '%/documents/demo-%'),
  'demodokumenten får sina filer vid återställningen');

select 'Filtesterna gick igenom' as result;
