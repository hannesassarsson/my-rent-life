-- DIGITAL KEYS
-- Passersystem med digitala nycklar: dörrar med NFC-läsare, nycklar som ger
-- tillgång till dörrar under en viss tid, och en logg över alla passager.
--
-- Boende har automatiskt tillgång till fastighetens gemensamma dörrar
-- (residents_access). Personal (drift) kommer in överallt. Övriga, som
-- entreprenörer och gäster, behöver en nyckel. Upplåsning prövas i
-- unlock_door, som också loggar passagen. I en riktig installation anropar
-- servern därefter låsleverantörens API för att öppna dörren.

create table if not exists public.access_doors (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  property_id uuid references public.properties(id) on delete cascade,
  name text not null,
  location text,
  kind text not null default 'entrance'
    check (kind in ('entrance', 'laundry', 'garbage', 'garage', 'bike', 'storage', 'common', 'other')),
  residents_access boolean not null default true,
  -- Läsarens id hos låsleverantören.
  reader_id text,
  is_online boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists access_doors_org_idx on public.access_doors (organization_id);

create table if not exists public.access_keys (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  holder_name text not null,
  holder_kind text not null default 'guest'
    check (holder_kind in ('resident', 'staff', 'contractor', 'guest')),
  door_ids uuid[] not null default '{}',
  valid_from timestamptz not null default now(),
  valid_until timestamptz,
  revoked_at timestamptz,
  note text,
  created_by uuid,
  created_at timestamptz not null default now()
);
create index if not exists access_keys_org_idx on public.access_keys (organization_id);
create index if not exists access_keys_user_idx on public.access_keys (user_id);

create table if not exists public.access_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  door_id uuid not null references public.access_doors(id) on delete cascade,
  key_id uuid references public.access_keys(id) on delete set null,
  user_id uuid,
  holder_name text,
  result text not null check (result in ('granted', 'denied')),
  reason text,
  method text not null default 'nfc' check (method in ('nfc', 'app', 'remote')),
  created_at timestamptz not null default now()
);
create index if not exists access_events_org_idx on public.access_events (organization_id, created_at desc);
create index if not exists access_events_user_idx on public.access_events (user_id, created_at desc);

alter table public.access_doors enable row level security;
alter table public.access_keys enable row level security;
alter table public.access_events enable row level security;

revoke all on public.access_doors, public.access_keys, public.access_events from anon;
grant select, insert, update, delete on public.access_doors, public.access_keys to authenticated;
-- Passager skrivs bara av unlock_door.
revoke insert, update, delete on public.access_events from authenticated;
grant select on public.access_events to authenticated;
grant all on public.access_doors, public.access_keys, public.access_events to service_role;

drop policy if exists "members read doors" on public.access_doors;
create policy "members read doors" on public.access_doors for select to authenticated
using (public.is_org_member(auth.uid(), organization_id));
drop policy if exists "operations write doors" on public.access_doors;
create policy "operations write doors" on public.access_doors for all to authenticated
using (public.is_org_operations(auth.uid(), organization_id))
with check (public.is_org_operations(auth.uid(), organization_id));

drop policy if exists "read keys" on public.access_keys;
create policy "read keys" on public.access_keys for select to authenticated
using (public.is_org_staff(auth.uid(), organization_id) or user_id = auth.uid());
drop policy if exists "operations write keys" on public.access_keys;
create policy "operations write keys" on public.access_keys for all to authenticated
using (public.is_org_operations(auth.uid(), organization_id))
with check (public.is_org_operations(auth.uid(), organization_id));

drop policy if exists "read events" on public.access_events;
create policy "read events" on public.access_events for select to authenticated
using (public.is_org_staff(auth.uid(), organization_id) or user_id = auth.uid());

-- Prövar om den inloggade får öppna dörren, loggar passagen och returnerar
-- resultatet. Här skulle servern sedan be låsleverantören öppna.
create or replace function public.unlock_door(_door_id uuid, _method text default 'nfc')
returns json
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  d public.access_doors%rowtype;
  k public.access_keys%rowtype;
  who text;
  granted boolean := false;
  why text;
  key_used uuid;
begin
  select * into d from access_doors where id = _door_id;
  if not found or uid is null or not public.is_org_member(uid, d.organization_id) then
    raise exception 'Dörren hittades inte' using errcode = 'P0001';
  end if;
  if _method not in ('nfc', 'app', 'remote') then
    raise exception 'Ogiltigt sätt att öppna' using errcode = 'P0001';
  end if;
  select coalesce(full_name, email, 'Okänd') into who from profiles where id = uid;

  if public.is_org_operations(uid, d.organization_id) then
    granted := true; why := 'Personal';
  else
    select * into k from access_keys
    where user_id = uid and organization_id = d.organization_id
      and revoked_at is null and valid_from <= now()
      and (valid_until is null or valid_until > now())
      and _door_id = any(door_ids)
    order by valid_until nulls first limit 1;
    if found then
      granted := true; why := 'Digital nyckel'; key_used := k.id;
    elsif d.residents_access and d.property_id in (select public.my_property_ids(uid)) then
      granted := true; why := 'Boende i fastigheten';
    else
      why := 'Saknar behörighet till dörren';
    end if;
  end if;

  if granted and not d.is_online then
    granted := false; why := 'Läsaren är inte ansluten';
  end if;

  insert into access_events (organization_id, door_id, key_id, user_id, holder_name, result, reason, method)
  values (d.organization_id, d.id, key_used, uid, who,
          case when granted then 'granted' else 'denied' end, why, _method);

  return json_build_object(
    'result', case when granted then 'granted' else 'denied' end,
    'reason', why,
    'door', d.name,
    'at', now()
  );
end; $$;
revoke all on function public.unlock_door(uuid, text) from public, anon;
grant execute on function public.unlock_door(uuid, text) to authenticated;

-- DEMO: dörrar, nycklar och en veckas passager i BRF Solrosen.
create or replace function public.reset_demo_keys() returns void
language plpgsql security definer set search_path = public as $$
declare
  org constant uuid := '11111111-1111-1111-1111-111111111111';
  p10 uuid; p12 uuid; p14 uuid; p16 uuid;
  resident_4c uuid;
  contractor_user uuid;
begin
  if not exists (select 1 from organizations where id = org) then
    return;
  end if;
  delete from access_events where organization_id = org;
  delete from access_keys where organization_id = org;
  delete from access_doors where organization_id = org;

  select id into p10 from properties where organization_id = org and address ilike '%10%' order by address limit 1;
  select id into p12 from properties where organization_id = org and address ilike '%12%' order by address limit 1;
  select id into p14 from properties where organization_id = org and address ilike '%14%' order by address limit 1;
  select id into p16 from properties where organization_id = org and address ilike '%16%' order by address limit 1;
  if p12 is null then
    select id into p12 from properties where organization_id = org order by address limit 1;
  end if;
  p10 := coalesce(p10, p12); p14 := coalesce(p14, p12); p16 := coalesce(p16, p12);

  insert into access_doors (id, organization_id, property_id, name, location, kind, residents_access, reader_id, is_online) values
  ('88888888-0000-0000-0000-000000000001', org, p10, 'Port Storgatan 10', 'Entré mot gatan', 'entrance', true, 'NFC-1010', true),
  ('88888888-0000-0000-0000-000000000002', org, p12, 'Port Storgatan 12', 'Entré mot gatan', 'entrance', true, 'NFC-1012', true),
  ('88888888-0000-0000-0000-000000000003', org, p14, 'Port Storgatan 14', 'Entré mot gatan', 'entrance', true, 'NFC-1014', true),
  ('88888888-0000-0000-0000-000000000004', org, p16, 'Port Storgatan 16', 'Entré mot gatan', 'entrance', true, 'NFC-1016', true),
  ('88888888-0000-0000-0000-000000000005', org, p12, 'Tvättstuga 1', 'Storgatan 12, källare', 'laundry', true, 'NFC-2001', true),
  ('88888888-0000-0000-0000-000000000006', org, p14, 'Tvättstuga 2', 'Storgatan 14, källare', 'laundry', true, 'NFC-2002', true),
  ('88888888-0000-0000-0000-000000000007', org, p10, 'Soprum', 'Gården, vid Storgatan 10', 'garbage', true, 'NFC-3001', true),
  ('88888888-0000-0000-0000-000000000008', org, p16, 'Cykelrum', 'Storgatan 16, bottenvåning', 'bike', true, 'NFC-3002', true),
  ('88888888-0000-0000-0000-000000000009', org, p10, 'Garage', 'Infart från Bakgatan', 'garage', false, 'NFC-4001', true),
  ('88888888-0000-0000-0000-000000000010', org, p12, 'Förråd och undercentral', 'Storgatan 12, källare', 'storage', false, 'NFC-4002', false);

  -- Den boende i 4C har en garageplats.
  select user_id into resident_4c from residencies
  where unit_id = '44444444-0000-0000-0000-000000000002' and status = 'active' limit 1;
  select user_id into contractor_user from contractors where id = '66666666-0000-0000-0000-000000000001';

  insert into access_keys (organization_id, user_id, holder_name, holder_kind, door_ids, valid_from, valid_until, revoked_at, note) values
  (org, resident_4c, coalesce((select full_name from profiles where id = resident_4c), 'Boende 4C'), 'resident',
   array['88888888-0000-0000-0000-000000000009']::uuid[], now() - interval '200 days', null, null, 'Garageplats 24'),
  (org, contractor_user, 'ABC VVS – Johan Ek', 'contractor',
   array['88888888-0000-0000-0000-000000000002', '88888888-0000-0000-0000-000000000010']::uuid[],
   now() - interval '1 day', now() + interval '6 days', null, 'Stambyte i trapphus 12'),
  (org, null, 'Hemtjänsten Norrmalm', 'guest',
   array['88888888-0000-0000-0000-000000000002']::uuid[], now() - interval '20 days', now() + interval '70 days', null,
   'Besök hos boende i 3B'),
  (org, null, 'Flyttfirman Lyft AB', 'guest',
   array['88888888-0000-0000-0000-000000000003']::uuid[], now() - interval '5 days', now() - interval '3 days', now() - interval '3 days',
   'Flytt i 5A');

  -- En veckas passager: boende i sina portar, tvättstugor och soprum.
  insert into access_events (organization_id, door_id, user_id, holder_name, result, reason, method, created_at)
  select org, d.id, r.user_id, coalesce(r.resident_name, 'Boende'),
         'granted', 'Boende i fastigheten', 'nfc',
         now() - make_interval(mins => (('x' || substr(md5(g::text || 'ev'), 1, 6))::bit(24)::int % (7 * 24 * 60)))
  from generate_series(1, 160) g
  cross join lateral (
    select * from residencies r
    where r.organization_id = org and r.status = 'active'
    order by md5(r.id::text || g) limit 1
  ) r
  join units u on u.id = r.unit_id
  join buildings b on b.id = u.building_id
  cross join lateral (
    select * from access_doors d
    where d.organization_id = org and d.residents_access and d.property_id = b.property_id
    order by md5(d.id::text || g) limit 1
  ) d;

  -- Nekade försök och entreprenörens besök.
  insert into access_events (organization_id, door_id, user_id, holder_name, result, reason, method, created_at) values
  (org, '88888888-0000-0000-0000-000000000009', null, 'Okänd telefon', 'denied', 'Saknar behörighet till dörren', 'nfc', now() - interval '2 days 3 hours'),
  (org, '88888888-0000-0000-0000-000000000003', null, 'Flyttfirman Lyft AB', 'denied', 'Nyckeln är återkallad', 'nfc', now() - interval '2 days 1 hour'),
  (org, '88888888-0000-0000-0000-000000000002', contractor_user, 'ABC VVS – Johan Ek', 'granted', 'Digital nyckel', 'nfc', now() - interval '20 hours'),
  (org, '88888888-0000-0000-0000-000000000010', contractor_user, 'ABC VVS – Johan Ek', 'denied', 'Läsaren är inte ansluten', 'nfc', now() - interval '19 hours');

  -- Den boende i 4C: egna passager.
  if resident_4c is not null then
    insert into access_events (organization_id, door_id, user_id, holder_name, result, reason, method, created_at)
    select org, x.door, resident_4c, coalesce((select full_name from profiles where id = resident_4c), 'Boende 4C'),
           'granted', x.why, 'nfc', now() - x.ago
    from (values
      ('88888888-0000-0000-0000-000000000002'::uuid, 'Boende i fastigheten', interval '3 hours'),
      ('88888888-0000-0000-0000-000000000009'::uuid, 'Digital nyckel', interval '1 day 2 hours'),
      ('88888888-0000-0000-0000-000000000005'::uuid, 'Boende i fastigheten', interval '2 days 5 hours'),
      ('88888888-0000-0000-0000-000000000002'::uuid, 'Boende i fastigheten', interval '3 days 1 hour')
    ) as x(door, why, ago);
  end if;
end; $$;
revoke all on function public.reset_demo_keys() from public, anon, authenticated;

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

  perform public.reset_demo_keys();
end; $$;
revoke all on function public.reset_demo_extras() from public, anon, authenticated;

select public.reset_demo_keys();
