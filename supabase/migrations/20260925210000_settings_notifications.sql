-- SETTINGS & NOTIFICATIONS
-- 1. set_member_role(): en administratör byter roll på en medlem i sin
--    organisation. Man kan inte ändra sin egen roll (så att man inte låser ute
--    sig själv), och bara administratörer kan göra någon till administratör.
-- 2. notify_request_reporter(): personal och entreprenörer som kan se ett
--    ärende notifierar den som anmälde det.
-- 3. Demokontonas roller sparas i demo.user_roles och återställs varje natt.

create or replace function public.set_member_role(_user_id uuid, _role public.app_role) returns void
language plpgsql security definer set search_path = public as $$
declare
  org uuid := public.current_org(auth.uid());
begin
  if org is null or not exists (
    select 1 from user_roles where user_id = auth.uid() and organization_id = org
      and role in ('org_admin', 'super_admin')
  ) then
    raise exception 'Behörighet saknas' using errcode = 'P0001';
  end if;
  if _user_id = auth.uid() then
    raise exception 'Du kan inte ändra din egen roll' using errcode = 'P0001';
  end if;
  if _role = 'super_admin' then
    raise exception 'Rollen kan inte tilldelas här' using errcode = 'P0001';
  end if;
  if not exists (select 1 from profiles where id = _user_id and organization_id = org) then
    raise exception 'Användaren finns inte i organisationen' using errcode = 'P0001';
  end if;
  delete from user_roles where user_id = _user_id and organization_id = org;
  insert into user_roles (user_id, organization_id, role) values (_user_id, org, _role);
end; $$;
revoke all on function public.set_member_role(uuid, public.app_role) from public, anon;
grant execute on function public.set_member_role(uuid, public.app_role) to authenticated;

create or replace function public.notify_request_reporter(_request_id uuid, _title text, _body text)
returns void
language plpgsql security definer set search_path = public as $$
declare
  req record;
begin
  if not public.can_see_request(auth.uid(), _request_id) then
    raise exception 'Ärendet hittades inte' using errcode = 'P0001';
  end if;
  select id, organization_id, reported_by, ticket_number into req
  from maintenance_requests where id = _request_id;
  if req.reported_by is null or req.reported_by = auth.uid() then
    return;
  end if;
  insert into notifications (organization_id, user_id, title, body, link)
  values (req.organization_id, req.reported_by, left(_title, 200), left(_body, 1000),
          '/app/felanmalan/' || req.id);
end; $$;
revoke all on function public.notify_request_reporter(uuid, text, text) from public, anon;
grant execute on function public.notify_request_reporter(uuid, text, text) to authenticated;

drop table if exists demo.user_roles;
create table demo.user_roles as
  select r.* from public.user_roles r
  join auth.users u on u.id = r.user_id
  where r.organization_id = '11111111-1111-1111-1111-111111111111';

create or replace function public.reset_demo_extras() returns void
language plpgsql security definer set search_path = public as $$
declare
  org constant uuid := '11111111-1111-1111-1111-111111111111';
begin
  update meetings set protocol = '§1 Stämman öppnades av styrelsens ordförande.
§2 Till ordförande valdes Karin Ström och till sekreterare Oskar Dahl.
§4 Årsredovisningen lades till handlingarna.
§6 Stämman beslutade att balansera resultatet i ny räkning.
§7 Styrelsen beviljades ansvarsfrihet.
§8 Motion om laddplatser bifölls. Styrelsen får i uppdrag att ta in offerter.
§9 Styrelsen omvaldes i sin helhet.'
  where organization_id = org and meeting_type = 'annual' and starts_at < now();

  update payments set status = 'unpaid', paid_at = null, paid_via = null
  where unit_id = '44444444-0000-0000-0000-000000000002'
    and period = date_trunc('month', current_date)::date;

  -- Roller för konton som fanns när ögonblicksbilden togs.
  delete from user_roles
  where organization_id = org and user_id in (select user_id from demo.user_roles);
  insert into user_roles (id, user_id, organization_id, role)
  select id, user_id, organization_id, role from demo.user_roles
  on conflict do nothing;
end; $$;
revoke all on function public.reset_demo_extras() from public, anon, authenticated;
