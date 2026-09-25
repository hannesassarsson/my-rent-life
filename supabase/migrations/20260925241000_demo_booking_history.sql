-- DEMO BOOKING HISTORY
-- Demoföreningen får fyra veckors bokningshistorik vid varje återställning,
-- så att beläggningsgraden i översikten räknas på riktiga pass.

create or replace function public.reset_demo_extras() returns void
language plpgsql security definer set search_path = public as $$
declare
  org constant uuid := '11111111-1111-1111-1111-111111111111';
  prefix constant text := '11111111-1111-1111-1111-111111111111/documents/demo-';
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

  delete from user_roles
  where organization_id = org and user_id in (select user_id from demo.user_roles);
  insert into user_roles (id, user_id, organization_id, role)
  select id, user_id, organization_id, role from demo.user_roles
  on conflict do nothing;

  update documents d set storage_path = prefix || f.file
  from (values
    ('statutes', null::uuid, 'stadgar.pdf'),
    ('rules', null, 'ordningsregler.pdf'),
    ('energy', null, 'energideklaration.pdf'),
    ('financial', null, 'arsredovisning.pdf'),
    ('maintenance', null, 'underhallsplan.pdf'),
    ('contract', '44444444-0000-0000-0000-000000000001', 'upplatelseavtal-3b.pdf'),
    ('floorplan', '44444444-0000-0000-0000-000000000001', 'planritning-3b.png'),
    ('inspection', '44444444-0000-0000-0000-000000000001', 'besiktning-3b.pdf'),
    ('contract', '44444444-0000-0000-0000-000000000002', 'hyresavtal-4c.pdf')
  ) as f(doc_type, unit_id, file)
  where d.organization_id = org and d.doc_type = f.doc_type
    and d.unit_id is not distinct from f.unit_id;

  -- BOKNINGSHISTORIK: de senaste fyra veckorna, så att beläggningen i
  -- översikten blir realistisk. Andelen bokade pass varierar per resurs.
  insert into bookings (organization_id, resource_id, unit_id, booked_by_name, starts_at, ends_at)
  select org, s.resource_id, s.unit_id, s.name, s.starts_at, s.starts_at + make_interval(mins => s.slot_minutes)
  from (
    select r.id as resource_id, r.slot_minutes,
           ((d.day + r.open_from + make_interval(mins => r.slot_minutes * n.n)) at time zone 'Europe/Stockholm') as starts_at,
           (('x' || substr(md5(r.id::text || d.day || n.n), 1, 4))::bit(16)::int % 100) as roll,
           case r.kind when 'laundry' then 58 when 'ev_charger' then 45 when 'guest_room' then 35
                       when 'sauna' then 28 when 'party_room' then 18 else 20 end as share,
           (select u.id from units u
             where u.organization_id = org and u.status = 'active'
             order by md5(u.id::text || r.id::text || d.day || n.n) limit 1) as unit_id,
           (array['Sara Nilsson','Erik Lundgren','Maria Holm','Johan Berg','Elin Sandberg','Nora Lind',
                  'Ali Hassan','Karin Ström','Oskar Dahl','Emma Wik','Leo Åberg','Fatima Omar'])
             [1 + (('x' || substr(md5(d.day::text || r.id::text || n.n), 5, 4))::bit(16)::int % 12)] as name
    from resources r
    cross join (select (current_date - k) as day from generate_series(1, 29) k) d
    cross join lateral generate_series(
      0,
      greatest(0, (extract(epoch from (r.open_to - r.open_from)) / 60)::int / r.slot_minutes - 1)
    ) n(n)
    where r.organization_id = org and r.is_active
  ) s
  where s.roll < s.share
    and not exists (
      select 1 from bookings b
      where b.resource_id = s.resource_id
        and b.starts_at < s.starts_at + make_interval(mins => s.slot_minutes)
        and b.ends_at > s.starts_at
    );
end; $$;
revoke all on function public.reset_demo_extras() from public, anon, authenticated;
