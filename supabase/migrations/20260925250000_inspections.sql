-- INSPECTIONS
-- Besiktningar: planeras och protokollförs av drift (förvaltning och
-- fastighetsskötare). Den boende ser besiktningar av sin lägenhet och av
-- fastigheten där hen bor.

alter table public.inspections
  add column if not exists property_id uuid references public.properties(id) on delete cascade,
  add column if not exists result text,
  add column if not exists protocol text;

alter table public.inspections drop constraint if exists inspections_kind_check;
alter table public.inspections add constraint inspections_kind_check
  check (kind in ('periodic', 'move_in', 'move_out', 'ovk', 'elevator', 'fire', 'other'));
alter table public.inspections drop constraint if exists inspections_status_check;
alter table public.inspections add constraint inspections_status_check
  check (status in ('planned', 'completed', 'cancelled'));
alter table public.inspections drop constraint if exists inspections_result_check;
alter table public.inspections add constraint inspections_result_check
  check (result is null or result in ('approved', 'remarks', 'failed'));

-- Fastigheterna där användaren bor.
create or replace function public.my_property_ids(_user_id uuid)
returns setof uuid language sql stable security definer set search_path = public as $$
  select distinct b.property_id
  from public.residencies r
  join public.units u on u.id = r.unit_id
  join public.buildings b on b.id = u.building_id
  where r.user_id = _user_id and r.status = 'active';
$$;
revoke all on function public.my_property_ids(uuid) from public, anon;
grant execute on function public.my_property_ids(uuid) to authenticated;

drop policy if exists "Residents see own inspections" on public.inspections;
create policy "Residents see own inspections" on public.inspections for select to authenticated
using (
  status <> 'cancelled' and (
    unit_id in (select public.my_unit_ids(auth.uid()))
    or (unit_id is null and property_id in (select public.my_property_ids(auth.uid())))
  )
);

create or replace function public.reset_demo_extras() returns void
language plpgsql security definer set search_path = public as $$
declare
  org constant uuid := '11111111-1111-1111-1111-111111111111';
  prefix constant text := '11111111-1111-1111-1111-111111111111/documents/demo-';
  prop_3b uuid;
  prop_4c uuid;
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

  -- BESIKTNINGAR: planerade och genomförda, för lägenheter och hela fastigheter.
  select b.property_id into prop_3b from units u join buildings b on b.id = u.building_id
  where u.id = '44444444-0000-0000-0000-000000000001';
  select b.property_id into prop_4c from units u join buildings b on b.id = u.building_id
  where u.id = '44444444-0000-0000-0000-000000000002';

  delete from inspections where organization_id = org;
  insert into inspections (organization_id, unit_id, property_id, kind, status, scheduled_at, completed_at, inspector_name, result, note, protocol) values
  (org, '44444444-0000-0000-0000-000000000001', prop_3b, 'periodic', 'planned',
   (current_date + 12 + time '10:00') at time zone 'Europe/Stockholm', null, 'Besiktningsbyrån Norr AB', null,
   'Besiktningen tar cirka 30 minuter. Vi behöver komma åt kök, badrum och balkong. Är du inte hemma används huvudnyckel.', null),
  (org, '44444444-0000-0000-0000-000000000001', prop_3b, 'move_in', 'completed',
   (current_date - 700 + time '09:00') at time zone 'Europe/Stockholm', (current_date - 700 + time '09:40') at time zone 'Europe/Stockholm',
   'Besiktningsbyrån Norr AB', 'approved', null,
   'Lägenheten godkänd vid inflyttning. Noterat: mindre repa i parketten i hallen, ingen åtgärd.'),
  (org, null, prop_3b, 'elevator', 'planned',
   (current_date + 20 + time '08:00') at time zone 'Europe/Stockholm', null, 'Hisskontroll Sverige AB', null,
   'Hissen är avstängd 08.00–10.00 under besiktningen.', null),
  (org, null, prop_3b, 'ovk', 'completed',
   (current_date - 150 + time '08:00') at time zone 'Europe/Stockholm', (current_date - 149 + time '15:00') at time zone 'Europe/Stockholm',
   'VentService AB', 'remarks', null,
   'Frånluftsflödet är för lågt i tre lägenheter. Fläktarna justeras och efterkontroll görs inom sex månader.'),
  (org, null, prop_4c, 'fire', 'completed',
   (current_date - 60 + time '13:00') at time zone 'Europe/Stockholm', (current_date - 60 + time '15:30') at time zone 'Europe/Stockholm',
   'Brandsäkert Stockholm', 'approved', null,
   'Systematiskt brandskyddsarbete kontrollerat. Brandsläckare och utrymningsskyltar i ordning.'),
  (org, '44444444-0000-0000-0000-000000000002', prop_4c, 'periodic', 'completed',
   (current_date - 380 + time '11:00') at time zone 'Europe/Stockholm', (current_date - 380 + time '11:30') at time zone 'Europe/Stockholm',
   'Besiktningsbyrån Norr AB', 'remarks', null,
   'Silikonfog i duschen behöver bytas. Åtgärdat av fastighetsskötaren.'),
  (org, '44444444-0000-0000-0000-000000000002', prop_4c, 'periodic', 'planned',
   (current_date + 9 + time '13:30') at time zone 'Europe/Stockholm', null, 'Besiktningsbyrån Norr AB', null,
   'Årlig kontroll av våtrum och vitvaror. Du behöver inte vara hemma; vi använder huvudnyckel om ingen öppnar.', null);

  -- Några fler planerade lägenhetsbesiktningar i samma hus som 3B.
  insert into inspections (organization_id, unit_id, property_id, kind, status, scheduled_at, inspector_name)
  select org, u.id, prop_3b, 'periodic', 'planned',
         (current_date + 12 + time '10:00' + make_interval(mins => 45 * (row_number() over (order by u.unit_number))::int)) at time zone 'Europe/Stockholm',
         'Besiktningsbyrån Norr AB'
  from units u join buildings b on b.id = u.building_id
  where b.property_id = prop_3b and u.status = 'active' and u.id not in ('44444444-0000-0000-0000-000000000001', '44444444-0000-0000-0000-000000000002')
  order by u.unit_number
  limit 5;
end; $$;
revoke all on function public.reset_demo_extras() from public, anon, authenticated;
