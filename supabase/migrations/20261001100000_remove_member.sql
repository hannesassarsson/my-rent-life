-- TA BORT ETT KONTO FRÅN FÖRENINGEN
-- Administratören kan ta bort åtkomsten för t.ex. en avgången styrelseledamot,
-- en fastighetsskötare som slutat eller en entreprenör. Kontot finns kvar
-- (personen kan bjudas in igen), men kopplingen till föreningen, rollerna och
-- digitala nycklar tas bort. Historiken finns kvar.
--
-- Boende tas inte bort här; de flyttas ut från lägenhetens sida, så att
-- boenderegistret och hushållet blir rätt.

create or replace function public.remove_member(_user_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  org uuid := public.current_org(auth.uid());
  who text;
begin
  if org is null or not exists (
    select 1 from user_roles where user_id = auth.uid() and organization_id = org
      and role in ('org_admin', 'super_admin')
  ) then
    raise exception 'Behörighet saknas' using errcode = 'P0001';
  end if;
  if _user_id = auth.uid() then
    raise exception 'Du kan inte ta bort ditt eget konto' using errcode = 'P0001';
  end if;
  if exists (select 1 from subscriptions where organization_id = org and is_demo) then
    raise exception 'I demomiljön kan konton inte tas bort.' using errcode = 'P0001';
  end if;
  select coalesce(full_name, email) into who from profiles where id = _user_id and organization_id = org;
  if not found then
    raise exception 'Användaren finns inte i organisationen' using errcode = 'P0001';
  end if;
  if exists (
    select 1 from residencies where user_id = _user_id and organization_id = org and status = 'active'
  ) then
    raise exception 'Personen bor i föreningen. Flytta ut hen från lägenhetens sida i stället.'
      using errcode = 'P0001';
  end if;

  delete from user_roles where user_id = _user_id and organization_id = org;
  update profiles set organization_id = null where id = _user_id;
  update contractors set user_id = null where user_id = _user_id and organization_id = org;
  update access_keys set revoked_at = now()
    where user_id = _user_id and organization_id = org and revoked_at is null;
  perform write_audit(org, 'member.removed', coalesce(who, 'Ett konto') || ' togs bort från föreningen.');
end; $$;
revoke all on function public.remove_member(uuid) from public, anon;
grant execute on function public.remove_member(uuid) to authenticated;
