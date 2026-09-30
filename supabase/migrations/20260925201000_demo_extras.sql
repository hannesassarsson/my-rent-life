-- DEMO EXTRAS
-- reset_demo_extras() samlar demodetaljer som läggs ovanpå grunddatan efter
-- nattens återställning, så att de kan ändras utan att skriva om
-- reset_demo_all(). Visningskontot för boende (4C) har alltid en obetald avi
-- för innevarande månad att prova betalningen med.

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
end; $$;
revoke all on function public.reset_demo_extras() from public, anon, authenticated;

create or replace function public.reset_demo_all() returns void
language plpgsql security definer set search_path = public as $$
declare
  org constant uuid := '11111111-1111-1111-1111-111111111111';
  links jsonb;
begin
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
  update residencies r set email = u.email
  from auth.users u where r.user_id = u.id and r.organization_id = org;

  select coalesce(jsonb_object_agg(id, user_id), '{}') into links
  from contractors where organization_id = org and user_id is not null;

  perform reset_demo();

  update contractors c set user_id = (links->>c.id::text)::uuid
  where links ? c.id::text;

  perform reset_demo_extras();
  perform reset_demo_profiles();
end; $$;
revoke all on function public.reset_demo_all() from public, anon, authenticated;
