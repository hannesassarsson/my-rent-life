-- ROLE POLICIES
-- Skrivrätten i databasen följer samma rollmodell som src/lib/permissions.ts,
-- så att styrelse och fastighetsskötare inte kan göra mer via API:t än i
-- appen. Läsrätten för personal (is_org_staff) är oförändrad.
--
--   ekonomi, entreprenörer, lägenheter, boende .... org_admin, property_manager
--   resurser (bokningsregler), ärenden, besiktn. .. + staff
--   information, dokument, möten, underhållsplan .. + board_member
--   organisationen ................................ org_admin

create or replace function public.has_org_role(_user_id uuid, _org uuid, _roles public.app_role[])
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.user_roles r
    where r.user_id = _user_id
      and (r.role = 'super_admin' or (r.organization_id = _org and r.role = any (_roles)))
  );
$$;
revoke all on function public.has_org_role(uuid, uuid, public.app_role[]) from public, anon;
grant execute on function public.has_org_role(uuid, uuid, public.app_role[]) to authenticated;

-- Förvaltning: administratör och förvaltare.
create or replace function public.is_org_manager(_user_id uuid, _org uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.has_org_role(_user_id, _org, array['org_admin', 'property_manager']::public.app_role[]);
$$;
-- Drift: förvaltning och fastighetsskötare.
create or replace function public.is_org_operations(_user_id uuid, _org uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.has_org_role(_user_id, _org, array['org_admin', 'property_manager', 'staff']::public.app_role[]);
$$;
-- Föreningsarbete: förvaltning och styrelse.
create or replace function public.is_org_board(_user_id uuid, _org uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.has_org_role(_user_id, _org, array['org_admin', 'property_manager', 'board_member']::public.app_role[]);
$$;
revoke all on function public.is_org_manager(uuid, uuid) from public, anon;
revoke all on function public.is_org_operations(uuid, uuid) from public, anon;
revoke all on function public.is_org_board(uuid, uuid) from public, anon;
grant execute on function public.is_org_manager(uuid, uuid) to authenticated;
grant execute on function public.is_org_operations(uuid, uuid) to authenticated;
grant execute on function public.is_org_board(uuid, uuid) to authenticated;

-- ORGANISATIONEN
drop policy if exists "org admins update org" on public.organizations;
create policy "org admins update org" on public.organizations for update to authenticated
using (public.has_org_role(auth.uid(), id, array['org_admin']::public.app_role[]))
with check (public.has_org_role(auth.uid(), id, array['org_admin']::public.app_role[]));

-- FASTIGHETER, HUS, LÄGENHETER, BOENDE (förvaltning)
drop policy if exists "staff write properties" on public.properties;
create policy "staff write properties" on public.properties for all to authenticated
using (public.is_org_manager(auth.uid(), organization_id))
with check (public.is_org_manager(auth.uid(), organization_id));
drop policy if exists "staff write buildings" on public.buildings;
create policy "staff write buildings" on public.buildings for all to authenticated
using (public.is_org_manager(auth.uid(), organization_id))
with check (public.is_org_manager(auth.uid(), organization_id));
drop policy if exists "staff write units" on public.units;
create policy "staff write units" on public.units for all to authenticated
using (public.is_org_manager(auth.uid(), organization_id))
with check (public.is_org_manager(auth.uid(), organization_id));
drop policy if exists "staff write residencies" on public.residencies;
create policy "staff write residencies" on public.residencies for all to authenticated
using (public.is_org_manager(auth.uid(), organization_id))
with check (public.is_org_manager(auth.uid(), organization_id));

-- EKONOMI (förvaltning)
drop policy if exists "staff write payments" on public.payments;
create policy "staff write payments" on public.payments for all to authenticated
using (public.is_org_manager(auth.uid(), organization_id))
with check (public.is_org_manager(auth.uid(), organization_id));

-- ENTREPRENÖRER: all personal och entreprenören själv läser, förvaltningen skriver.
drop policy if exists "staff manage contractors" on public.contractors;
drop policy if exists "read contractors" on public.contractors;
create policy "read contractors" on public.contractors for select to authenticated
using (public.is_org_staff(auth.uid(), organization_id) or user_id = auth.uid());
drop policy if exists "manager write contractors" on public.contractors;
create policy "manager write contractors" on public.contractors for all to authenticated
using (public.is_org_manager(auth.uid(), organization_id))
with check (public.is_org_manager(auth.uid(), organization_id));

-- BOKNINGSREGLER (drift)
drop policy if exists "staff write resources" on public.resources;
create policy "staff write resources" on public.resources for all to authenticated
using (public.is_org_operations(auth.uid(), organization_id))
with check (public.is_org_operations(auth.uid(), organization_id));

-- INFORMATION, DOKUMENT, MÖTEN, UNDERHÅLLSPLAN (förening)
drop policy if exists "staff write announcements" on public.announcements;
create policy "staff write announcements" on public.announcements for all to authenticated
using (public.is_org_board(auth.uid(), organization_id))
with check (public.is_org_board(auth.uid(), organization_id));
drop policy if exists "staff write documents" on public.documents;
create policy "staff write documents" on public.documents for all to authenticated
using (public.is_org_board(auth.uid(), organization_id))
with check (public.is_org_board(auth.uid(), organization_id));
drop policy if exists "staff write meetings" on public.meetings;
create policy "staff write meetings" on public.meetings for all to authenticated
using (public.is_org_board(auth.uid(), organization_id))
with check (public.is_org_board(auth.uid(), organization_id));
drop policy if exists "staff write projects" on public.maintenance_projects;
create policy "staff write projects" on public.maintenance_projects for all to authenticated
using (public.is_org_board(auth.uid(), organization_id))
with check (public.is_org_board(auth.uid(), organization_id));

-- ÄRENDEN: drift handlägger, styrelsen läser.
drop policy if exists "update requests" on public.maintenance_requests;
create policy "update requests" on public.maintenance_requests for update to authenticated
using (
  public.is_org_operations(auth.uid(), organization_id)
  or reported_by = auth.uid()
  or contractor_id in (select id from public.contractors where user_id = auth.uid())
)
with check (
  public.is_org_operations(auth.uid(), organization_id)
  or (
    reported_by = auth.uid()
    and public.is_org_member(auth.uid(), organization_id)
    and (unit_id is null or unit_id in (select public.my_unit_ids(auth.uid())))
  )
  or contractor_id in (
    select c.id from public.contractors c
    where c.user_id = auth.uid() and c.organization_id = maintenance_requests.organization_id
  )
);
drop policy if exists "staff delete requests" on public.maintenance_requests;
create policy "staff delete requests" on public.maintenance_requests for delete to authenticated
using (public.is_org_operations(auth.uid(), organization_id));

-- BESIKTNINGAR: drift skriver, all personal läser.
do $$
begin
  if to_regclass('public.inspections') is null then
    return;
  end if;
  execute 'drop policy if exists "Staff manage inspections" on public.inspections';
  execute 'drop policy if exists "staff read inspections" on public.inspections';
  execute 'drop policy if exists "operations write inspections" on public.inspections';
  execute $p$create policy "staff read inspections" on public.inspections for select to authenticated
    using (public.is_org_staff(auth.uid(), organization_id))$p$;
  execute $p$create policy "operations write inspections" on public.inspections for all to authenticated
    using (public.is_org_operations(auth.uid(), organization_id))
    with check (public.is_org_operations(auth.uid(), organization_id))$p$;
end $$;

-- FILER: dokument laddas upp och tas bort av dem som får hantera dokument.
do $$
begin
  if to_regclass('storage.objects') is null then
    return;
  end if;
  execute 'drop policy if exists "files upload" on storage.objects';
  execute $p$
    create policy "files upload" on storage.objects for insert to authenticated
    with check (
      bucket_id = 'files' and (
        ((storage.foldername(name))[2] = 'documents'
          and public.is_org_board(auth.uid(), ((storage.foldername(name))[1])::uuid))
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
      and public.is_org_board(auth.uid(), ((storage.foldername(name))[1])::uuid)
      and name not like '%/documents/demo-%'
    )
  $p$;
end $$;
