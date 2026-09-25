-- FILES
-- Filer lagras i den privata bucketen "files" i Supabase Storage:
--   <org_id>/documents/<uuid>-<filnamn>             dokument (public.documents.storage_path)
--   <org_id>/requests/<request_id>/<uuid>-<filnamn> bilder i felanmälningar (request_attachments)
-- Läsrätt följer raden som pekar på filen: den som får se dokumentet eller
-- ärendet får se filen. Personal laddar upp dokument; den som ser ett ärende
-- kan ladda upp bilder till det.

create table if not exists public.request_attachments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  request_id uuid not null references public.maintenance_requests(id) on delete cascade,
  storage_path text not null unique,
  file_name text not null check (char_length(file_name) <= 200),
  content_type text,
  size_bytes int check (size_bytes between 0 and 10485760),
  uploaded_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.request_attachments enable row level security;
grant select, insert, delete on public.request_attachments to authenticated;
grant all on public.request_attachments to service_role;

drop policy if exists "read attachments" on public.request_attachments;
create policy "read attachments" on public.request_attachments for select to authenticated
using (public.can_see_request(auth.uid(), request_id));
drop policy if exists "add attachments" on public.request_attachments;
create policy "add attachments" on public.request_attachments for insert to authenticated
with check (
  public.can_see_request(auth.uid(), request_id)
  and uploaded_by = auth.uid()
  and storage_path like organization_id::text || '/requests/' || request_id::text || '/%'
);
drop policy if exists "staff delete attachments" on public.request_attachments;
create policy "staff delete attachments" on public.request_attachments for delete to authenticated
using (public.is_org_staff(auth.uid(), organization_id) or uploaded_by = auth.uid());

-- Dokumentens sökväg måste ligga under organisationens mapp.
alter table public.documents drop constraint if exists documents_storage_path_in_org;
alter table public.documents add constraint documents_storage_path_in_org
  check (storage_path is null or storage_path like organization_id::text || '/documents/%');

do $$
begin
  if to_regclass('storage.objects') is null then
    return;
  end if;

  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('files', 'files', false, 10485760, array[
    'application/pdf', 'image/png', 'image/jpeg', 'image/webp', 'image/heic',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ])
  on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

  execute 'drop policy if exists "files read" on storage.objects';
  execute $p$
    create policy "files read" on storage.objects for select to authenticated
    using (
      bucket_id = 'files' and (
        exists (select 1 from public.documents d where d.storage_path = name)
        or exists (select 1 from public.request_attachments a where a.storage_path = name)
        or public.is_org_staff(auth.uid(), ((storage.foldername(name))[1])::uuid)
      )
    )
  $p$;

  execute 'drop policy if exists "files upload" on storage.objects';
  execute $p$
    create policy "files upload" on storage.objects for insert to authenticated
    with check (
      bucket_id = 'files' and (
        ((storage.foldername(name))[2] = 'documents'
          and public.is_org_staff(auth.uid(), ((storage.foldername(name))[1])::uuid))
        or ((storage.foldername(name))[2] = 'requests'
          and public.can_see_request(auth.uid(), ((storage.foldername(name))[3])::uuid))
      )
    )
  $p$;

  execute 'drop policy if exists "files delete" on storage.objects';
  execute $p$
    create policy "files delete" on storage.objects for delete to authenticated
    using (
      bucket_id = 'files'
      and public.is_org_staff(auth.uid(), ((storage.foldername(name))[1])::uuid)
    )
  $p$;
end $$;
