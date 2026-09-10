alter table public.residencies add column created_at timestamptz not null default now();

insert into public.organizations (id, name, slug, org_type, created_at) values
('11111111-1111-1111-1111-111111111111','BRF Solrosen','brf-solrosen','brf', now() - interval '400 days');

insert into public.properties (id, organization_id, name, address, postal_code, city, build_year) values
('22222222-0000-0000-0000-000000000010','11111111-1111-1111-1111-111111111111','Storgatan 10','Storgatan 10','114 51','Stockholm',1968),
('22222222-0000-0000-0000-000000000012','11111111-1111-1111-1111-111111111111','Storgatan 12','Storgatan 12','114 51','Stockholm',1968),
('22222222-0000-0000-0000-000000000014','11111111-1111-1111-1111-111111111111','Storgatan 14','Storgatan 14','114 51','Stockholm',1972),
('22222222-0000-0000-0000-000000000016','11111111-1111-1111-1111-111111111111','Storgatan 16','Storgatan 16','114 51','Stockholm',1972);

insert into public.buildings (id, organization_id, property_id, name, floors) values
('33333333-0000-0000-0000-000000000010','11111111-1111-1111-1111-111111111111','22222222-0000-0000-0000-000000000010','Byggnad A',5),
('33333333-0000-0000-0000-000000000012','11111111-1111-1111-1111-111111111111','22222222-0000-0000-0000-000000000012','Byggnad B',5),
('33333333-0000-0000-0000-000000000014','11111111-1111-1111-1111-111111111111','22222222-0000-0000-0000-000000000014','Byggnad C',5),
('33333333-0000-0000-0000-000000000016','11111111-1111-1111-1111-111111111111','22222222-0000-0000-0000-000000000016','Byggnad D',5);

insert into public.units (id, organization_id, building_id, unit_number, object_number, address, size_sqm, rooms, floor, tenure, monthly_amount, storage, parking, balcony, key_count) values
('44444444-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','33333333-0000-0000-0000-000000000012','3B','1201-3B','Storgatan 12',74,3,3,'owned',5420,'Förråd F12 (källare)','P-plats 24 (garage)',true,4),
('44444444-0000-0000-0000-000000000002','11111111-1111-1111-1111-111111111111','33333333-0000-0000-0000-000000000012','4C','1201-4C','Storgatan 12',82,3,4,'rented',8420,'Förråd F19 (källare)','Laddplats L3',true,3);

insert into public.units (organization_id, building_id, unit_number, object_number, address, size_sqm, rooms, floor, tenure, monthly_amount, storage, parking, balcony, key_count, status)
select '11111111-1111-1111-1111-111111111111',
       b.id,
       f.floor::text || chr(64 + f.letter),
       replace(p.address, 'Storgatan ', '12') || '-' || f.floor::text || chr(64 + f.letter),
       p.address,
       42 + ((f.floor * 7 + f.letter * 5) % 60),
       1 + ((f.floor + f.letter) % 4),
       f.floor,
       case when (f.floor + f.letter) % 5 = 0 then 'rented' else 'owned' end::public.tenure_type,
       3200 + ((f.floor * 311 + f.letter * 187) % 4200),
       'Förråd ' || f.floor::text || chr(64 + f.letter),
       case when (f.floor + f.letter) % 3 = 0 then 'P-plats ' || (f.floor * 10 + f.letter)::text else null end,
       (f.floor + f.letter) % 2 = 0,
       2 + ((f.floor + f.letter) % 3),
       case when (f.floor * f.letter) % 37 = 0 then 'vacant' else 'active' end
from public.properties p
join public.buildings b on b.property_id = p.id
cross join (select floor, letter from generate_series(1,5) floor, generate_series(1,10) letter) f
where not (p.address = 'Storgatan 12' and f.floor = 3 and f.letter = 2)
  and not (p.address = 'Storgatan 12' and f.floor = 4 and f.letter = 3)
  and (f.floor - 1) * 10 + f.letter <= 46;

insert into public.residencies (id, organization_id, unit_id, resident_name, email, phone, move_in_date, tenure, created_at) values
('55555555-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','44444444-0000-0000-0000-000000000001','Hannes Assarsson','hannes@example.se','070-123 45 67','2021-04-01','owned', now() - interval '300 days'),
('55555555-0000-0000-0000-000000000002','11111111-1111-1111-1111-111111111111','44444444-0000-0000-0000-000000000002','Linnea Ek','linnea@example.se','070-222 11 09','2023-09-01','rented', now() - interval '299 days');

insert into public.residencies (organization_id, unit_id, resident_name, email, phone, move_in_date, tenure, created_at)
select '11111111-1111-1111-1111-111111111111', u.id,
       (array['Erik Lundgren','Sara Nilsson','Ahmed Karim','Maria Holm','Johan Berg','Elin Sandberg','Petra Vinter','Oskar Dahl','Nora Lind','Ali Hassan','Karin Ström','Viktor Falk'])[1 + (row_number() over (order by u.address, u.unit_number))::int % 12]
       || ' ' || u.unit_number,
       'boende.' || lower(replace(u.address,' ','')) || '.' || lower(u.unit_number) || '@example.se',
       '070-' || (1000000 + (random()*8999999)::int)::text,
       date '2015-01-01' + ((random()*3800)::int),
       u.tenure,
       now() - interval '200 days'
from public.units u
where u.status = 'active' and u.id not in ('44444444-0000-0000-0000-000000000001','44444444-0000-0000-0000-000000000002');

insert into public.payments (organization_id, unit_id, kind, period, amount, due_date, status, paid_at)
select '11111111-1111-1111-1111-111111111111', u.id,
       case when u.tenure = 'rented' then 'rent' else 'fee' end,
       m.period,
       coalesce(u.monthly_amount, 4500),
       (m.period + interval '1 month - 1 day')::date,
       case when m.period = date '2026-09-01' and (('x' || substr(md5(u.id::text),1,4))::bit(16)::int % 46) = 0 then 'unpaid' else 'paid' end,
       case when m.period = date '2026-09-01' and (('x' || substr(md5(u.id::text),1,4))::bit(16)::int % 46) = 0 then null else (m.period + interval '20 days') end
from public.units u
cross join (values (date '2026-06-01'),(date '2026-07-01'),(date '2026-08-01'),(date '2026-09-01')) as m(period)
where u.status = 'active';

update public.payments set status = 'paid', paid_at = timestamptz '2026-09-02 09:12'
where unit_id = '44444444-0000-0000-0000-000000000001' and period = date '2026-09-01';

insert into public.contractors (id, organization_id, company, contact_name, phone, email, category, agreement_note) values
('66666666-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','ABC VVS','Johan Ek','08-123 45 60','service@abcvvs.se','Vatten & värme','Ramavtal t.o.m. 2027-12-31'),
('66666666-0000-0000-0000-000000000002','11111111-1111-1111-1111-111111111111','Elfirma Nordström','Petra Nordström','08-556 21 10','jour@nordstromel.se','El','Jouravtal dygnet runt'),
('66666666-0000-0000-0000-000000000003','11111111-1111-1111-1111-111111111111','Låsteam Stockholm','Mikael Sand','08-441 09 22','order@lasteam.se','Dörr & lås',null),
('66666666-0000-0000-0000-000000000004','11111111-1111-1111-1111-111111111111','VentService AB','Anna Sjögren','08-777 12 34','info@ventservice.se','Ventilation','Serviceavtal, OVK 2027');

insert into public.resources (id, organization_id, property_id, name, kind, icon, location, slot_minutes, open_from, open_to, max_active_bookings, days_ahead, cancel_hours) values
('77777777-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','22222222-0000-0000-0000-000000000012','Tvättstuga 1','laundry','🧺','Storgatan 12, källare',120,'06:00','22:00',2,14,2),
('77777777-0000-0000-0000-000000000002','11111111-1111-1111-1111-111111111111','22222222-0000-0000-0000-000000000014','Tvättstuga 2','laundry','🧺','Storgatan 14, källare',120,'06:00','22:00',2,14,2),
('77777777-0000-0000-0000-000000000003','11111111-1111-1111-1111-111111111111','22222222-0000-0000-0000-000000000010','Bastu','sauna','🧖','Storgatan 10, källare',60,'07:00','22:00',1,10,4),
('77777777-0000-0000-0000-000000000004','11111111-1111-1111-1111-111111111111','22222222-0000-0000-0000-000000000016','Gästrum','guest_room','🛏️','Storgatan 16, bottenvåning',1440,'00:00','23:59',1,90,48),
('77777777-0000-0000-0000-000000000005','11111111-1111-1111-1111-111111111111','22222222-0000-0000-0000-000000000012','Festlokal','party_room','🎉','Storgatan 12, gårdshus',240,'10:00','23:00',1,120,72),
('77777777-0000-0000-0000-000000000006','11111111-1111-1111-1111-111111111111','22222222-0000-0000-0000-000000000014','Hobbyrum','hobby','🔧','Storgatan 14, källare',120,'08:00','21:00',2,21,4),
('77777777-0000-0000-0000-000000000007','11111111-1111-1111-1111-111111111111','22222222-0000-0000-0000-000000000010','Laddplats 1','ev_charger','⚡','Garage, plats 24',240,'00:00','23:59',1,7,2);

insert into public.bookings (organization_id, resource_id, unit_id, booked_by_name, starts_at, ends_at) values
('11111111-1111-1111-1111-111111111111','77777777-0000-0000-0000-000000000001','44444444-0000-0000-0000-000000000001','Hannes Assarsson', (current_date + time '18:00'), (current_date + time '20:00')),
('11111111-1111-1111-1111-111111111111','77777777-0000-0000-0000-000000000001',null,'Sara Nilsson', (current_date + time '08:00'), (current_date + time '10:00')),
('11111111-1111-1111-1111-111111111111','77777777-0000-0000-0000-000000000001',null,'Erik Lundgren', (current_date + time '14:00'), (current_date + time '16:00')),
('11111111-1111-1111-1111-111111111111','77777777-0000-0000-0000-000000000002',null,'Maria Holm', (current_date + time '10:00'), (current_date + time '12:00')),
('11111111-1111-1111-1111-111111111111','77777777-0000-0000-0000-000000000003',null,'Johan Berg', (current_date + time '19:00'), (current_date + time '20:00')),
('11111111-1111-1111-1111-111111111111','77777777-0000-0000-0000-000000000005',null,'Elin Sandberg', (current_date + interval '9 days' + time '16:00'), (current_date + interval '9 days' + time '20:00')),
('11111111-1111-1111-1111-111111111111','77777777-0000-0000-0000-000000000001',null,'Nora Lind', (current_date + interval '1 day' + time '12:00'), (current_date + interval '1 day' + time '14:00'));

insert into public.announcements (organization_id, title, body, category, audience_scope, property_id, is_published, is_pinned, published_at) values
('11111111-1111-1111-1111-111111111111','Vattenavstängning torsdag','Vattnet stängs av i hela Storgatan 12 torsdag 17 september kl. 08:00–14:00 på grund av stambyte i källaren. Tappa upp vatten kvällen innan. Vid frågor, kontakta förvaltningen.','operations','property','22222222-0000-0000-0000-000000000012',true,true, now() - interval '1 day'),
('11111111-1111-1111-1111-111111111111','Fasadrenovering börjar vecka 42','Renoveringen av fasaden på Storgatan 14 och 16 startar vecka 42 och beräknas pågå till mars. Byggställningar monteras vecka 41. Håll fönster stängda under arbetstid.','maintenance','organization',null,true,false, now() - interval '4 days'),
('11111111-1111-1111-1111-111111111111','Höstens gårdsdag 4 oktober','Vi träffas på gården kl. 10:00 för höststädning, lökplantering och korvgrillning. Föreningen bjuder på fika. Anmälan behövs inte.','news','organization',null,true,false, now() - interval '8 days'),
('11111111-1111-1111-1111-111111111111','Nya tvättider i Tvättstuga 1','Från 1 oktober utökas bokningsbara tider till kl. 22:00 alla dagar. Max två aktiva bokningar per lägenhet gäller fortsatt.','news','organization',null,true,false, now() - interval '14 days'),
('11111111-1111-1111-1111-111111111111','Utkast: Information om portkoder','Nya portkoder införs efter årsskiftet. Texten behöver kompletteras med datum innan publicering.','news','organization',null,false,false, null),
('11111111-1111-1111-1111-111111111111','Utkast: Sopsortering i nya miljörummet','Beskrivning av det nya miljörummet på Storgatan 10. Väntar på bilder.','operations','organization',null,false,false, null);

insert into public.documents (organization_id, title, doc_type, file_kind, file_size, unit_id, property_id) values
('11111111-1111-1111-1111-111111111111','Stadgar BRF Solrosen','statutes','pdf','1,2 MB',null,null),
('11111111-1111-1111-1111-111111111111','Ordningsregler','rules','pdf','340 kB',null,null),
('11111111-1111-1111-1111-111111111111','Energideklaration Storgatan 12','energy','pdf','780 kB',null,'22222222-0000-0000-0000-000000000012'),
('11111111-1111-1111-1111-111111111111','Årsredovisning 2025','financial','pdf','2,4 MB',null,null),
('11111111-1111-1111-1111-111111111111','Underhållsplan 2026–2036','maintenance','pdf','3,1 MB',null,null),
('11111111-1111-1111-1111-111111111111','Upplåtelseavtal Storgatan 12, 3B','contract','pdf','620 kB','44444444-0000-0000-0000-000000000001',null),
('11111111-1111-1111-1111-111111111111','Planritning 3B','floorplan','png','1,8 MB','44444444-0000-0000-0000-000000000001',null),
('11111111-1111-1111-1111-111111111111','Besiktningsprotokoll 3B','inspection','pdf','410 kB','44444444-0000-0000-0000-000000000001',null),
('11111111-1111-1111-1111-111111111111','Hyresavtal Storgatan 12, 4C','contract','pdf','580 kB','44444444-0000-0000-0000-000000000002',null);

insert into public.meetings (organization_id, title, meeting_type, starts_at, location, agenda, motions) values
('11111111-1111-1111-1111-111111111111','Föreningsstämma 2026','annual', timestamptz '2026-09-24 18:00+02','Festlokalen, Storgatan 12','1. Mötets öppnande
2. Val av ordförande och sekreterare
3. Godkännande av dagordning
4. Styrelsens årsredovisning
5. Revisorns berättelse
6. Beslut om resultatdisposition
7. Ansvarsfrihet för styrelsen
8. Motioner
9. Val av styrelse
10. Mötets avslutande','Motion 1: Laddplatser i garaget
Motion 2: Cykelrum i källaren på Storgatan 14'),
('11111111-1111-1111-1111-111111111111','Informationsmöte om fasadrenovering','info', timestamptz '2026-10-08 18:30+02','Gårdshuset, Storgatan 12','Entreprenören presenterar tidsplan, ställningar och påverkan på balkonger.',null),
('11111111-1111-1111-1111-111111111111','Föreningsstämma 2025','annual', timestamptz '2025-09-25 18:00+02','Festlokalen, Storgatan 12','Ordinarie stämma 2025.',null);

update public.meetings set protocol_url = 'protokoll-stamma-2025.pdf' where title = 'Föreningsstämma 2025';

insert into public.maintenance_projects (organization_id, property_id, title, year, status, budget, note) values
('11111111-1111-1111-1111-111111111111','22222222-0000-0000-0000-000000000010','Takomläggning',2026,'done',4200000,'Slutbesiktigat i maj utan anmärkning.'),
('11111111-1111-1111-1111-111111111111','22222222-0000-0000-0000-000000000014','Fasadrenovering',2026,'in_progress',9800000,'Byggställningar vecka 41, arbetet startar vecka 42.'),
('11111111-1111-1111-1111-111111111111','22222222-0000-0000-0000-000000000012','Ventilationsöversyn och OVK',2026,'planned',650000,'Upphandling pågår.'),
('11111111-1111-1111-1111-111111111111','22222222-0000-0000-0000-000000000016','Fönsterbyte',2027,'planned',5600000,null),
('11111111-1111-1111-1111-111111111111','22222222-0000-0000-0000-000000000012','Balkongrenovering',2027,'planned',7400000,null),
('11111111-1111-1111-1111-111111111111','22222222-0000-0000-0000-000000000010','Stamspolning',2028,'planned',420000,null);

insert into public.maintenance_requests (id, organization_id, unit_id, ticket_number, reporter_name, category, title, description, room, is_urgent, priority, status, assignee_name, contractor_id, created_at, updated_at) values
('88888888-0000-0000-0000-000000001827','11111111-1111-1111-1111-111111111111','44444444-0000-0000-0000-000000000001',1827,'Hannes Assarsson','Värme','Element i sovrum','Elementet i sovrummet blir inte varmt trots att termostaten är uppvriden. Det hörs ett svagt klickande ljud.','Sovrum',false,'normal','in_progress','Johan Ek','66666666-0000-0000-0000-000000000001', timestamptz '2026-09-10 09:14+02', now() - interval '3 hours'),
('88888888-0000-0000-0000-000000001832','11111111-1111-1111-1111-111111111111','44444444-0000-0000-0000-000000000002',1832,'Linnea Ek','Värme','Ingen värme i hela lägenheten','Kallt i samtliga rum sedan igår kväll.','Hela lägenheten',true,'urgent','in_progress','Johan Ek','66666666-0000-0000-0000-000000000001', now() - interval '1 day', now() - interval '5 hours');

insert into public.maintenance_requests (organization_id, unit_id, reporter_name, category, title, description, room, is_urgent, priority, status, assignee_name, contractor_id, created_at, resolved_at)
select '11111111-1111-1111-1111-111111111111', u.id, r.resident_name, d.category, d.title, d.description, d.room, d.urgent, d.priority::public.request_priority, d.status::public.request_status, d.assignee, d.contractor, now() - (d.days || ' days')::interval,
       case when d.status in ('resolved','closed') then now() - ((d.days - 2) || ' days')::interval else null end
from (values
  ('Vatten','Droppande kran i kök','Kranen droppar jämnt, blir värre på kvällen.','Kök',false,'normal','new','Ej tilldelad',null::uuid,1),
  ('Dörr/lås','Porten går inte i lås','Porten på Storgatan 14 stängs inte helt.','Entré',false,'high','assigned','Mikael Sand','66666666-0000-0000-0000-000000000003'::uuid,2),
  ('Tvättstuga','Torktumlare torkar dåligt','Tumlaren i Tvättstuga 2 blir inte varm.','Tvättstuga',false,'normal','received','Ej tilldelad',null::uuid,3),
  ('El','Trasig lampa i trapphus','Lampan mellan våning 2 och 3 blinkar.','Trapphus',false,'low','booked','Petra Nordström','66666666-0000-0000-0000-000000000002'::uuid,4),
  ('Ventilation','Dålig ventilation i badrum','Fukten står kvar länge efter dusch.','Badrum',false,'normal','in_progress','Anna Sjögren','66666666-0000-0000-0000-000000000004'::uuid,6),
  ('Vitvaror','Kylskåp låter högt','Kompressorn låter mycket på nätterna.','Kök',false,'normal','resolved','Johan Ek',null::uuid,9),
  ('Vatten','Stopp i avlopp','Vattnet rinner undan mycket långsamt i badrumsgolvbrunnen.','Badrum',false,'high','resolved','Johan Ek','66666666-0000-0000-0000-000000000001'::uuid,12),
  ('Värme','Kallt i vardagsrum','Elementet under fönstret är bara ljummet.','Vardagsrum',false,'normal','closed','Johan Ek',null::uuid,16),
  ('Annat','Klotter i cykelrum','Klotter på innerdörren till cykelrummet.','Cykelrum',false,'low','closed','Fastighetsskötaren',null::uuid,21),
  ('Dörr/lås','Nyckeltagg fungerar inte','Taggen fungerar inte till miljörummet.','Miljörum',false,'normal','resolved','Mikael Sand','66666666-0000-0000-0000-000000000003'::uuid,25),
  ('El','Ingen ström i ett uttag','Uttaget i hallen är strömlöst.','Hall',false,'normal','closed','Petra Nordström','66666666-0000-0000-0000-000000000002'::uuid,30),
  ('Vatten','Läckage under diskbänk','Vattenpöl i skåpet under diskbänken.','Kök',true,'urgent','resolved','Johan Ek','66666666-0000-0000-0000-000000000001'::uuid,34)
) as d(category,title,description,room,urgent,priority,status,assignee,contractor,days)
join lateral (
  select re.unit_id, re.resident_name from public.residencies re
  where re.organization_id = '11111111-1111-1111-1111-111111111111'
    and re.unit_id not in ('44444444-0000-0000-0000-000000000001','44444444-0000-0000-0000-000000000002')
  order by md5(re.id::text || d.title) limit 1
) r on true
join public.units u on u.id = r.unit_id;

insert into public.maintenance_events (organization_id, request_id, label, created_at) values
('11111111-1111-1111-1111-111111111111','88888888-0000-0000-0000-000000001827','Felanmälan skickad', timestamptz '2026-09-10 09:14+02'),
('11111111-1111-1111-1111-111111111111','88888888-0000-0000-0000-000000001827','Ärendet mottaget', timestamptz '2026-09-10 10:02+02'),
('11111111-1111-1111-1111-111111111111','88888888-0000-0000-0000-000000001827','Fastighetsskötare tilldelad', timestamptz '2026-09-11 08:20+02'),
('11111111-1111-1111-1111-111111111111','88888888-0000-0000-0000-000000001827','Tid bokad: 12 september kl. 10:00', timestamptz '2026-09-12 07:45+02'),
('11111111-1111-1111-1111-111111111111','88888888-0000-0000-0000-000000001832','Felanmälan skickad', now() - interval '1 day'),
('11111111-1111-1111-1111-111111111111','88888888-0000-0000-0000-000000001832','Ärendet mottaget som akut', now() - interval '22 hours'),
('11111111-1111-1111-1111-111111111111','88888888-0000-0000-0000-000000001832','ABC VVS tilldelat', now() - interval '20 hours');

insert into public.maintenance_events (organization_id, request_id, label, created_at)
select organization_id, id, 'Felanmälan skickad', created_at from public.maintenance_requests
where id not in ('88888888-0000-0000-0000-000000001827','88888888-0000-0000-0000-000000001832');

insert into public.maintenance_comments (organization_id, request_id, author_name, author_role, body, created_at) values
('11111111-1111-1111-1111-111111111111','88888888-0000-0000-0000-000000001827','Johan Ek','contractor','Jag kommer förbi imorgon kl. 10 och luftar elementet.', timestamptz '2026-09-12 07:46+02'),
('11111111-1111-1111-1111-111111111111','88888888-0000-0000-0000-000000001827','Hannes Assarsson','resident','Det fungerar bra, jag är hemma då.', timestamptz '2026-09-12 08:15+02');

insert into public.messages (organization_id, thread_key, subject, request_id, sender_name, sender_role, body, created_at) values
('11111111-1111-1111-1111-111111111111','request-1827','Ärende #1827 · Element i sovrum','88888888-0000-0000-0000-000000001827','Johan Ek','contractor','Jag kommer förbi imorgon kl. 10.', timestamptz '2026-09-12 07:46+02'),
('11111111-1111-1111-1111-111111111111','request-1827','Ärende #1827 · Element i sovrum','88888888-0000-0000-0000-000000001827','Hannes Assarsson','resident','Det fungerar bra.', timestamptz '2026-09-12 08:15+02'),
('11111111-1111-1111-1111-111111111111','board','Fråga om andrahandsuthyrning',null,'Styrelsen','board_member','Hej! Ansökan om andrahandsuthyrning behandlas på nästa styrelsemöte den 18 september.', now() - interval '2 days');