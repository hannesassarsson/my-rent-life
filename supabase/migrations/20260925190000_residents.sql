-- RESIDENTS
-- 1. Utflyttningsdatum på boenden.
-- 2. update_my_contact(): boende uppdaterar namn och telefon i sin profil och
--    telefon i sitt aktiva boende (som de annars inte får skriva i).
-- 3. Ögonblicksbild av demoföreningens lägenheter och boenden i schemat demo
--    (inte åtkomligt via API:t). reset_demo_all() återställer dem, så att in-
--    och utflyttningar som besökare gör försvinner varje natt. Kopplingar
--    till konton (residencies.user_id) behålls.

alter table public.residencies add column if not exists move_out_date date;

create or replace function public.update_my_contact(_full_name text, _phone text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then
    raise exception 'Inte inloggad';
  end if;
  if char_length(coalesce(_full_name, '')) not between 1 and 200 or char_length(coalesce(_phone, '')) > 40 then
    raise exception 'Ogiltiga uppgifter' using errcode = 'P0001';
  end if;
  update profiles set full_name = _full_name, phone = nullif(_phone, '') where id = auth.uid();
  update residencies set phone = nullif(_phone, '') where user_id = auth.uid() and status = 'active';
end; $$;
revoke all on function public.update_my_contact(text, text) from public, anon;
grant execute on function public.update_my_contact(text, text) to authenticated;

create schema if not exists demo;
revoke all on schema demo from public;

drop table if exists demo.units;
drop table if exists demo.residencies;
create table demo.units as
  select * from public.units where organization_id = '11111111-1111-1111-1111-111111111111';
create table demo.residencies as
  select * from public.residencies where organization_id = '11111111-1111-1111-1111-111111111111';
alter table demo.residencies add primary key (id);
alter table demo.units add primary key (id);

create or replace function public.reset_demo_all() returns void
language plpgsql security definer set search_path = public as $$
declare
  org constant uuid := '11111111-1111-1111-1111-111111111111';
  links jsonb;
begin
  -- Lägenheter och boenden tillbaka till ögonblicksbilden.
  delete from residencies where organization_id = org and id not in (select id from demo.residencies);
  delete from units where organization_id = org and id not in (select id from demo.units);
  update units u set
    building_id = b.building_id, unit_number = b.unit_number, object_number = b.object_number,
    address = b.address, size_sqm = b.size_sqm, rooms = b.rooms, floor = b.floor, tenure = b.tenure,
    monthly_amount = b.monthly_amount, storage = b.storage, parking = b.parking, balcony = b.balcony,
    key_count = b.key_count, status = b.status
  from demo.units b where u.id = b.id;
  update residencies r set
    unit_id = b.unit_id, resident_name = b.resident_name, email = b.email, phone = b.phone,
    move_in_date = b.move_in_date, move_out_date = null, tenure = b.tenure, status = b.status,
    is_primary = b.is_primary
  from demo.residencies b where r.id = b.id;
  -- Konton kopplade till demoboenden ska ha sin e-post kvar.
  update residencies r set email = u.email
  from auth.users u where r.user_id = u.id and r.organization_id = org;

  select coalesce(jsonb_object_agg(id, user_id), '{}') into links
  from contractors where organization_id = org and user_id is not null;

  perform reset_demo();

  update contractors c set user_id = (links->>c.id::text)::uuid
  where links ? c.id::text;

  update meetings set protocol = '§1 Stämman öppnades av styrelsens ordförande.
§2 Till ordförande valdes Karin Ström och till sekreterare Oskar Dahl.
§4 Årsredovisningen lades till handlingarna.
§6 Stämman beslutade att balansera resultatet i ny räkning.
§7 Styrelsen beviljades ansvarsfrihet.
§8 Motion om laddplatser bifölls. Styrelsen får i uppdrag att ta in offerter.
§9 Styrelsen omvaldes i sin helhet.'
  where organization_id = org and meeting_type = 'annual' and starts_at < now();

  perform reset_demo_profiles();
end; $$;
revoke all on function public.reset_demo_all() from public, anon, authenticated;
