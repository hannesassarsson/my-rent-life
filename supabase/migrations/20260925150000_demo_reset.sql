-- DEMO RESET
-- public.reset_demo() återställer demoföreningen BRF Solrosen till ett känt
-- läge med datum räknade från dagens datum, så att demon aldrig ser
-- inaktuell ut och så att ändringar gjorda av besökare försvinner.
-- Fastigheter, hus, lägenheter och boende (inkl. kopplade konton) lämnas
-- orörda. Körs varje natt via pg_cron när tillägget finns.

create or replace function public.sv_date(d date) returns text
language sql immutable set search_path = public as $$
  select extract(day from d)::int || ' ' || (array['januari','februari','mars','april','maj','juni',
    'juli','augusti','september','oktober','november','december'])[extract(month from d)::int];
$$;

create or replace function public.sv_weekday(d date) returns text
language sql immutable set search_path = public as $$
  select (array['måndag','tisdag','onsdag','torsdag','fredag','lördag','söndag'])[extract(isodow from d)::int];
$$;

create or replace function public.reset_demo() returns void
language plpgsql security definer set search_path = public as $$
declare
  org constant uuid := '11111111-1111-1111-1111-111111111111';
  unit_3b constant uuid := '44444444-0000-0000-0000-000000000001';
  unit_4c constant uuid := '44444444-0000-0000-0000-000000000002';
  user_3b uuid;
  user_4c uuid;
  this_month date := date_trunc('month', current_date)::date;
  water_day date := current_date + ((3 - extract(isodow from current_date)::int + 7) % 7 + 1);
  yard_day date := current_date + ((5 - extract(isodow from current_date)::int + 7) % 7 + 8);
  facade_week date := current_date + 21;
  agm timestamptz := (current_date + 18 + time '18:00') at time zone 'Europe/Stockholm';
  booked_day date := current_date - 13;
begin
  if not exists (select 1 from organizations where id = org) then
    return;
  end if;

  select user_id into user_3b from residencies where unit_id = unit_3b and status = 'active' limit 1;
  select user_id into user_4c from residencies where unit_id = unit_4c and status = 'active' limit 1;

  -- Rensa allt som ändras i appen. Händelser, kommentarer, meddelanden per
  -- ärende och mötesanmälningar följer med via on delete cascade.
  delete from bookings where organization_id = org;
  delete from payments where organization_id = org;
  delete from maintenance_requests where organization_id = org;
  delete from messages where organization_id = org;
  delete from announcements where organization_id = org;
  delete from documents where organization_id = org;
  delete from meetings where organization_id = org;
  delete from maintenance_projects where organization_id = org;
  -- inspections skapas av en drizzle-migration och finns inte i alla miljöer.
  if to_regclass('public.inspections') is not null then
    execute 'delete from public.inspections where organization_id = $1' using org;
  end if;
  delete from notifications where organization_id = org;
  delete from contractors where organization_id = org;

  update organizations set name = 'BRF Solrosen', org_type = 'brf' where id = org;

  -- RESURSER
  delete from resources where organization_id = org and id::text not like '77777777-%';
  insert into resources (id, organization_id, property_id, name, kind, icon, location, slot_minutes, open_from, open_to, max_active_bookings, days_ahead, cancel_hours, is_active) values
  ('77777777-0000-0000-0000-000000000001',org,'22222222-0000-0000-0000-000000000012','Tvättstuga 1','laundry','🧺','Storgatan 12, källare',120,'06:00','22:00',2,14,2,true),
  ('77777777-0000-0000-0000-000000000002',org,'22222222-0000-0000-0000-000000000014','Tvättstuga 2','laundry','🧺','Storgatan 14, källare',120,'06:00','22:00',2,14,2,true),
  ('77777777-0000-0000-0000-000000000003',org,'22222222-0000-0000-0000-000000000010','Bastu','sauna','🧖','Storgatan 10, källare',60,'07:00','22:00',1,10,4,true),
  ('77777777-0000-0000-0000-000000000004',org,'22222222-0000-0000-0000-000000000016','Gästrum','guest_room','🛏️','Storgatan 16, bottenvåning',1440,'00:00','23:59',1,90,48,true),
  ('77777777-0000-0000-0000-000000000005',org,'22222222-0000-0000-0000-000000000012','Festlokal','party_room','🎉','Storgatan 12, gårdshus',240,'10:00','23:00',1,120,72,true),
  ('77777777-0000-0000-0000-000000000006',org,'22222222-0000-0000-0000-000000000014','Hobbyrum','hobby','🔧','Storgatan 14, källare',120,'08:00','21:00',2,21,4,true),
  ('77777777-0000-0000-0000-000000000007',org,'22222222-0000-0000-0000-000000000010','Laddplats 1','ev_charger','⚡','Garage, plats 24',240,'00:00','23:59',1,7,2,true)
  on conflict (id) do update set property_id = excluded.property_id, name = excluded.name, kind = excluded.kind,
    icon = excluded.icon, location = excluded.location, slot_minutes = excluded.slot_minutes,
    open_from = excluded.open_from, open_to = excluded.open_to, max_active_bookings = excluded.max_active_bookings,
    days_ahead = excluded.days_ahead, cancel_hours = excluded.cancel_hours, is_active = excluded.is_active;

  -- ENTREPRENÖRER
  insert into contractors (id, organization_id, company, contact_name, phone, email, category, agreement_note) values
  ('66666666-0000-0000-0000-000000000001',org,'ABC VVS','Johan Ek','08-123 45 60','service@abcvvs.se','Vatten & värme','Ramavtal t.o.m. ' || (extract(year from current_date)::int + 1) || '-12-31'),
  ('66666666-0000-0000-0000-000000000002',org,'Elfirma Nordström','Petra Nordström','08-556 21 10','jour@nordstromel.se','El','Jouravtal dygnet runt'),
  ('66666666-0000-0000-0000-000000000003',org,'Låsteam Stockholm','Mikael Sand','08-441 09 22','order@lasteam.se','Dörr & lås',null),
  ('66666666-0000-0000-0000-000000000004',org,'VentService AB','Anna Sjögren','08-777 12 34','info@ventservice.se','Ventilation','Serviceavtal, OVK ' || (extract(year from current_date)::int + 1));

  -- AVGIFTER OCH HYROR: tre betalda månader och innevarande månad där några
  -- få är obetalda.
  insert into payments (organization_id, unit_id, kind, period, amount, due_date, status, paid_at)
  select org, u.id,
         case when u.tenure = 'rented' then 'rent' else 'fee' end,
         m.period,
         coalesce(u.monthly_amount, 4500),
         (m.period + interval '1 month - 1 day')::date,
         case when m.period = this_month and (('x' || substr(md5(u.id::text),1,4))::bit(16)::int % 46) = 0 then 'unpaid' else 'paid' end,
         case when m.period = this_month and (('x' || substr(md5(u.id::text),1,4))::bit(16)::int % 46) = 0 then null
              else least(m.period + interval '20 days', now() - interval '1 hour') end
  from units u
  cross join (select (this_month - make_interval(months => n))::date as period from generate_series(0,3) n) m
  where u.organization_id = org and u.status = 'active';

  update payments set status = 'paid', paid_at = least(this_month + interval '1 day 9 hours 12 minutes', now() - interval '1 hour')
  where unit_id = unit_3b and period = this_month;

  -- BOKNINGAR
  insert into bookings (organization_id, resource_id, unit_id, user_id, booked_by_name, starts_at, ends_at) values
  (org,'77777777-0000-0000-0000-000000000001',unit_3b,user_3b,'Hannes Assarsson', (current_date + time '18:00') at time zone 'Europe/Stockholm', (current_date + time '20:00') at time zone 'Europe/Stockholm'),
  (org,'77777777-0000-0000-0000-000000000001',null,null,'Sara Nilsson', (current_date + time '08:00') at time zone 'Europe/Stockholm', (current_date + time '10:00') at time zone 'Europe/Stockholm'),
  (org,'77777777-0000-0000-0000-000000000001',null,null,'Erik Lundgren', (current_date + time '14:00') at time zone 'Europe/Stockholm', (current_date + time '16:00') at time zone 'Europe/Stockholm'),
  (org,'77777777-0000-0000-0000-000000000002',null,null,'Maria Holm', (current_date + time '10:00') at time zone 'Europe/Stockholm', (current_date + time '12:00') at time zone 'Europe/Stockholm'),
  (org,'77777777-0000-0000-0000-000000000003',null,null,'Johan Berg', (current_date + time '19:00') at time zone 'Europe/Stockholm', (current_date + time '20:00') at time zone 'Europe/Stockholm'),
  (org,'77777777-0000-0000-0000-000000000005',null,null,'Elin Sandberg', (current_date + 9 + time '16:00') at time zone 'Europe/Stockholm', (current_date + 9 + time '20:00') at time zone 'Europe/Stockholm'),
  (org,'77777777-0000-0000-0000-000000000001',null,null,'Nora Lind', (current_date + 1 + time '12:00') at time zone 'Europe/Stockholm', (current_date + 1 + time '14:00') at time zone 'Europe/Stockholm'),
  (org,'77777777-0000-0000-0000-000000000002',unit_4c,user_4c,'Linnea Ek', (current_date + 2 + time '16:00') at time zone 'Europe/Stockholm', (current_date + 2 + time '18:00') at time zone 'Europe/Stockholm');

  -- INFORMATION
  insert into announcements (organization_id, title, body, category, audience_scope, property_id, is_published, is_pinned, published_at) values
  (org,'Vattenavstängning ' || sv_weekday(water_day),'Vattnet stängs av i hela Storgatan 12 ' || sv_weekday(water_day) || ' ' || sv_date(water_day) || ' kl. 08:00–14:00 på grund av stambyte i källaren. Tappa upp vatten kvällen innan. Vid frågor, kontakta förvaltningen.','operations','property','22222222-0000-0000-0000-000000000012',true,true, now() - interval '1 day'),
  (org,'Fasadrenovering börjar vecka ' || to_char(facade_week,'IW'),'Renoveringen av fasaden på Storgatan 14 och 16 startar vecka ' || to_char(facade_week,'IW') || ' och beräknas pågå i fem månader. Byggställningar monteras veckan innan. Håll fönster stängda under arbetstid.','maintenance','organization',null,true,false, now() - interval '4 days'),
  (org,'Gårdsdag ' || sv_date(yard_day),'Vi träffas på gården kl. 10:00 för städning, plantering och korvgrillning. Föreningen bjuder på fika. Anmälan behövs inte.','news','organization',null,true,false, now() - interval '8 days'),
  (org,'Nya tvättider i Tvättstuga 1','Bokningsbara tider är nu utökade till kl. 22:00 alla dagar. Max två aktiva bokningar per lägenhet gäller fortsatt.','news','organization',null,true,false, now() - interval '14 days'),
  (org,'Utkast: Information om portkoder','Nya portkoder införs efter årsskiftet. Texten behöver kompletteras med datum innan publicering.','news','organization',null,false,false, null),
  (org,'Utkast: Sopsortering i nya miljörummet','Beskrivning av det nya miljörummet på Storgatan 10. Väntar på bilder.','operations','organization',null,false,false, null);

  -- DOKUMENT
  insert into documents (organization_id, title, doc_type, file_kind, file_size, unit_id, property_id) values
  (org,'Stadgar BRF Solrosen','statutes','pdf','1,2 MB',null,null),
  (org,'Ordningsregler','rules','pdf','340 kB',null,null),
  (org,'Energideklaration Storgatan 12','energy','pdf','780 kB',null,'22222222-0000-0000-0000-000000000012'),
  (org,'Årsredovisning ' || (extract(year from current_date)::int - 1),'financial','pdf','2,4 MB',null,null),
  (org,'Underhållsplan ' || extract(year from current_date)::int || '–' || (extract(year from current_date)::int + 10),'maintenance','pdf','3,1 MB',null,null),
  (org,'Upplåtelseavtal Storgatan 12, 3B','contract','pdf','620 kB',unit_3b,null),
  (org,'Planritning 3B','floorplan','png','1,8 MB',unit_3b,null),
  (org,'Besiktningsprotokoll 3B','inspection','pdf','410 kB',unit_3b,null),
  (org,'Hyresavtal Storgatan 12, 4C','contract','pdf','580 kB',unit_4c,null);

  -- MÖTEN
  insert into meetings (organization_id, title, meeting_type, starts_at, location, agenda, motions, protocol_url) values
  (org,'Föreningsstämma ' || extract(year from agm)::int,'annual', agm,'Festlokalen, Storgatan 12','1. Mötets öppnande
2. Val av ordförande och sekreterare
3. Godkännande av dagordning
4. Styrelsens årsredovisning
5. Revisorns berättelse
6. Beslut om resultatdisposition
7. Ansvarsfrihet för styrelsen
8. Motioner
9. Val av styrelse
10. Mötets avslutande','Motion 1: Laddplatser i garaget
Motion 2: Cykelrum i källaren på Storgatan 14', null),
  (org,'Informationsmöte om fasadrenovering','info', (current_date + 7 + time '18:30') at time zone 'Europe/Stockholm','Gårdshuset, Storgatan 12','Entreprenören presenterar tidsplan, ställningar och påverkan på balkonger.',null,null),
  (org,'Föreningsstämma ' || (extract(year from agm)::int - 1),'annual', agm - interval '1 year','Festlokalen, Storgatan 12','Ordinarie stämma ' || (extract(year from agm)::int - 1) || '.',null,'protokoll-stamma-' || (extract(year from agm)::int - 1) || '.pdf');

  -- UNDERHÅLLSPLAN
  insert into maintenance_projects (organization_id, property_id, title, year, status, budget, note) values
  (org,'22222222-0000-0000-0000-000000000010','Takomläggning',extract(year from current_date)::int,'done',4200000,'Slutbesiktigat utan anmärkning.'),
  (org,'22222222-0000-0000-0000-000000000014','Fasadrenovering',extract(year from current_date)::int,'in_progress',9800000,'Byggställningar monteras vecka ' || (to_char(facade_week,'IW')::int - 1) || ', arbetet startar vecka ' || to_char(facade_week,'IW') || '.'),
  (org,'22222222-0000-0000-0000-000000000012','Ventilationsöversyn och OVK',extract(year from current_date)::int,'planned',650000,'Upphandling pågår.'),
  (org,'22222222-0000-0000-0000-000000000016','Fönsterbyte',extract(year from current_date)::int + 1,'planned',5600000,null),
  (org,'22222222-0000-0000-0000-000000000012','Balkongrenovering',extract(year from current_date)::int + 1,'planned',7400000,null),
  (org,'22222222-0000-0000-0000-000000000010','Stamspolning',extract(year from current_date)::int + 2,'planned',420000,null);

  -- FELANMÄLNINGAR
  insert into maintenance_requests (id, organization_id, unit_id, ticket_number, reported_by, reporter_name, category, title, description, room, is_urgent, priority, status, assignee_name, contractor_id, created_at, updated_at) values
  ('88888888-0000-0000-0000-000000001827',org,unit_3b,1827,user_3b,'Hannes Assarsson','Värme','Element i sovrum','Elementet i sovrummet blir inte varmt trots att termostaten är uppvriden. Det hörs ett svagt klickande ljud.','Sovrum',false,'normal','in_progress','Johan Ek','66666666-0000-0000-0000-000000000001', now() - interval '15 days', now() - interval '3 hours'),
  ('88888888-0000-0000-0000-000000001832',org,unit_4c,1832,user_4c,'Linnea Ek','Värme','Ingen värme i hela lägenheten','Kallt i samtliga rum sedan igår kväll.','Hela lägenheten',true,'urgent','in_progress','Johan Ek','66666666-0000-0000-0000-000000000001', now() - interval '1 day', now() - interval '5 hours');

  insert into maintenance_requests (organization_id, unit_id, ticket_number, reporter_name, category, title, description, room, is_urgent, priority, status, assignee_name, contractor_id, created_at, updated_at, resolved_at)
  select org, r.unit_id, 1833 + 12 - d.n, r.resident_name, d.category, d.title, d.description, d.room, d.urgent, d.priority::request_priority, d.status::request_status, d.assignee, d.contractor,
         now() - make_interval(days => d.days), now() - make_interval(days => greatest(d.days - 2, 0)),
         case when d.status in ('resolved','closed') then now() - make_interval(days => d.days - 2) else null end
  from (values
    (1,'Vatten','Droppande kran i kök','Kranen droppar jämnt, blir värre på kvällen.','Kök',false,'normal','new','Ej tilldelad',null::uuid,1),
    (2,'Dörr/lås','Porten går inte i lås','Porten på Storgatan 14 stängs inte helt.','Entré',false,'high','assigned','Mikael Sand','66666666-0000-0000-0000-000000000003'::uuid,2),
    (3,'Tvättstuga','Torktumlare torkar dåligt','Tumlaren i Tvättstuga 2 blir inte varm.','Tvättstuga',false,'normal','received','Ej tilldelad',null::uuid,3),
    (4,'El','Trasig lampa i trapphus','Lampan mellan våning 2 och 3 blinkar.','Trapphus',false,'low','booked','Petra Nordström','66666666-0000-0000-0000-000000000002'::uuid,4),
    (5,'Ventilation','Dålig ventilation i badrum','Fukten står kvar länge efter dusch.','Badrum',false,'normal','in_progress','Anna Sjögren','66666666-0000-0000-0000-000000000004'::uuid,6),
    (6,'Vitvaror','Kylskåp låter högt','Kompressorn låter mycket på nätterna.','Kök',false,'normal','resolved','Johan Ek',null::uuid,9),
    (7,'Vatten','Stopp i avlopp','Vattnet rinner undan mycket långsamt i badrumsgolvbrunnen.','Badrum',false,'high','resolved','Johan Ek','66666666-0000-0000-0000-000000000001'::uuid,12),
    (8,'Värme','Kallt i vardagsrum','Elementet under fönstret är bara ljummet.','Vardagsrum',false,'normal','closed','Johan Ek',null::uuid,16),
    (9,'Annat','Klotter i cykelrum','Klotter på innerdörren till cykelrummet.','Cykelrum',false,'low','closed','Fastighetsskötaren',null::uuid,21),
    (10,'Dörr/lås','Nyckeltagg fungerar inte','Taggen fungerar inte till miljörummet.','Miljörum',false,'normal','resolved','Mikael Sand','66666666-0000-0000-0000-000000000003'::uuid,25),
    (11,'El','Ingen ström i ett uttag','Uttaget i hallen är strömlöst.','Hall',false,'normal','closed','Petra Nordström','66666666-0000-0000-0000-000000000002'::uuid,30),
    (12,'Vatten','Läckage under diskbänk','Vattenpöl i skåpet under diskbänken.','Kök',true,'urgent','resolved','Johan Ek','66666666-0000-0000-0000-000000000001'::uuid,34)
  ) as d(n,category,title,description,room,urgent,priority,status,assignee,contractor,days)
  join lateral (
    select re.unit_id, re.resident_name from residencies re
    where re.organization_id = org and re.status = 'active' and re.unit_id not in (unit_3b, unit_4c)
    order by md5(re.unit_id::text || d.title) limit 1
  ) r on true;

  perform setval('request_number_seq', greatest(1845, (select max(ticket_number) from maintenance_requests)) + 1, false);

  insert into maintenance_events (organization_id, request_id, label, created_at) values
  (org,'88888888-0000-0000-0000-000000001827','Felanmälan skickad', now() - interval '15 days'),
  (org,'88888888-0000-0000-0000-000000001827','Ärendet mottaget', now() - interval '15 days' + interval '48 minutes'),
  (org,'88888888-0000-0000-0000-000000001827','Fastighetsskötare tilldelad', now() - interval '14 days'),
  (org,'88888888-0000-0000-0000-000000001827','Tid bokad: ' || sv_date(booked_day) || ' kl. 10:00', now() - interval '13 days 2 hours'),
  (org,'88888888-0000-0000-0000-000000001832','Felanmälan skickad', now() - interval '1 day'),
  (org,'88888888-0000-0000-0000-000000001832','Ärendet mottaget som akut', now() - interval '22 hours'),
  (org,'88888888-0000-0000-0000-000000001832','ABC VVS tilldelat', now() - interval '20 hours');

  insert into maintenance_events (organization_id, request_id, label, created_at)
  select organization_id, id, 'Felanmälan skickad', created_at from maintenance_requests
  where organization_id = org and id not in ('88888888-0000-0000-0000-000000001827','88888888-0000-0000-0000-000000001832');

  insert into maintenance_comments (organization_id, request_id, author_name, author_role, body, created_at) values
  (org,'88888888-0000-0000-0000-000000001827','Johan Ek','contractor','Jag kommer förbi den ' || sv_date(booked_day) || ' kl. 10 och luftar elementet.', now() - interval '13 days 2 hours'),
  (org,'88888888-0000-0000-0000-000000001827','Hannes Assarsson','resident','Det fungerar bra, jag är hemma då.', now() - interval '13 days 1 hour');

  -- MEDDELANDEN
  insert into messages (organization_id, thread_key, subject, request_id, resident_user_id, sender_name, sender_role, body, created_at) values
  (org,'request-1827','Ärende #1827 · Element i sovrum','88888888-0000-0000-0000-000000001827',user_3b,'Johan Ek','contractor','Jag kommer förbi den ' || sv_date(booked_day) || ' kl. 10.', now() - interval '13 days 2 hours'),
  (org,'request-1827','Ärende #1827 · Element i sovrum','88888888-0000-0000-0000-000000001827',user_3b,'Hannes Assarsson','resident','Det fungerar bra.', now() - interval '13 days 1 hour'),
  (org,'board','Fråga om andrahandsuthyrning',null,null,'Styrelsen','board_member','Hej! Ansökan om andrahandsuthyrning behandlas på nästa styrelsemöte den ' || sv_date(current_date + 6) || '.', now() - interval '2 days');
end; $$;

revoke all on function public.reset_demo() from public, anon, authenticated;

-- Schemalägg varje natt 03:00 UTC om pg_cron finns (inte i lokala testmiljöer).
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    perform cron.unschedule(jobid) from cron.job where jobname = 'reset-demo';
    perform cron.schedule('reset-demo', '0 3 * * *', 'select public.reset_demo()');
  end if;
end $$;

select public.reset_demo();
