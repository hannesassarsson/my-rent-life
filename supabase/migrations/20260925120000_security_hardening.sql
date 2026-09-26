-- SECURITY HARDENING
-- 1. handle_new_user: ingen demo_role-väg till admin och ingen automatisk
--    tilldelning av lediga lägenheter. Nya konton får endast en profil utan
--    organisation och utan roller; organisation, roll och boende kopplas av
--    en administratör (service role).
-- 2. "update own profile": organization_id får inte ändras av användaren.
-- 3. WITH CHECK på update-policyerna för maintenance_requests och bookings.

-- NEW USER HANDLING
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, organization_id, full_name, email)
  values (new.id, null,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    new.email);
  return new;
end; $$;

revoke all on function public.handle_new_user() from public, anon, authenticated;

-- PROFILES
-- current_org() är STABLE och ser raden som den var före uppdateringen,
-- så WITH CHECK kräver att organization_id är oförändrad.
drop policy if exists "update own profile" on public.profiles;
create policy "update own profile" on public.profiles for update to authenticated
using (id = auth.uid())
with check (
  id = auth.uid()
  and organization_id is not distinct from public.current_org(auth.uid())
);

-- MAINTENANCE REQUESTS
drop policy if exists "update requests" on public.maintenance_requests;
create policy "update requests" on public.maintenance_requests for update to authenticated
using (
  public.is_org_staff(auth.uid(), organization_id)
  or reported_by = auth.uid()
  or contractor_id in (select id from public.contractors where user_id = auth.uid())
)
with check (
  public.is_org_staff(auth.uid(), organization_id)
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

-- BOOKINGS
drop policy if exists "update own bookings" on public.bookings;
create policy "update own bookings" on public.bookings for update to authenticated
using (user_id = auth.uid() or public.is_org_staff(auth.uid(), organization_id))
with check (
  public.is_org_staff(auth.uid(), organization_id)
  or (user_id = auth.uid() and public.is_org_member(auth.uid(), organization_id))
);
