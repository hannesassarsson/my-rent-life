-- NYHETER: REDIGERA, TA BORT, FÄSTA OCH MÅLGRUPP
-- 1. Boende ser bara nyheter som riktar sig till dem: till alla, till deras
--    fastighet eller till deras hus. Tidigare såg alla boende i föreningen
--    även nyheter riktade till andra fastigheter och hus.
-- 2. updated_at visar när en publicerad nyhet senast ändrades.
-- 3. En riktad nyhet måste ha fastighet (och hus) angiven.
-- 4. Historiken visar när nyheter publiceras, ändras och tas bort.

create or replace function public.my_building_ids(_user_id uuid)
returns setof uuid language sql stable security definer set search_path = public as $$
  select distinct u.building_id
  from public.residencies r
  join public.units u on u.id = r.unit_id
  where r.user_id = _user_id and r.status = 'active';
$$;
revoke all on function public.my_building_ids(uuid) from public, anon;
grant execute on function public.my_building_ids(uuid) to authenticated;

drop policy if exists "read announcements" on public.announcements;
create policy "read announcements" on public.announcements for select to authenticated
using (
  public.is_org_staff(auth.uid(), organization_id)
  or public.is_org_board(auth.uid(), organization_id)
  or (
    is_published
    and public.is_org_member(auth.uid(), organization_id)
    and (
      audience_scope = 'organization'
      or (audience_scope = 'property' and property_id in (select public.my_property_ids(auth.uid())))
      or (audience_scope = 'building' and building_id in (select public.my_building_ids(auth.uid())))
    )
  )
);

alter table public.announcements add column if not exists updated_at timestamptz;

alter table public.announcements drop constraint if exists announcements_audience_check;
alter table public.announcements add constraint announcements_audience_check check (
  audience_scope in ('organization', 'property', 'building')
  and char_length(title) between 1 and 200
  and (audience_scope <> 'property' or property_id is not null)
  and (audience_scope <> 'building' or building_id is not null)
) not valid;

-- HISTORIK -------------------------------------------------------------------
create or replace function public.audit_announcement() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'DELETE' then
    perform write_audit(old.organization_id, 'announcement.deleted',
      'Nyheten "' || old.title || '" togs bort.');
    return old;
  end if;
  if tg_op = 'INSERT' then
    if new.is_published then
      perform write_audit(new.organization_id, 'announcement.published',
        'Nyheten "' || new.title || '" publicerades.');
    end if;
    return new;
  end if;
  if new.is_published and not old.is_published then
    perform write_audit(new.organization_id, 'announcement.published',
      'Nyheten "' || new.title || '" publicerades.');
  elsif old.is_published and not new.is_published then
    perform write_audit(new.organization_id, 'announcement.unpublished',
      'Nyheten "' || new.title || '" avpublicerades.');
  elsif new.is_published and (new.title, new.body, new.audience_scope, new.property_id, new.building_id)
        is distinct from (old.title, old.body, old.audience_scope, old.property_id, old.building_id) then
    perform write_audit(new.organization_id, 'announcement.updated',
      'Nyheten "' || new.title || '" ändrades.');
  end if;
  return new;
end; $$;
revoke all on function public.audit_announcement() from public, anon, authenticated;

drop trigger if exists announcement_audit on public.announcements;
create trigger announcement_audit after insert or update or delete on public.announcements
for each row execute function public.audit_announcement();
