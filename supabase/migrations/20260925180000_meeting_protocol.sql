-- MEETING PROTOCOL
-- Protokoll och beslut skrivs direkt i mötet och visas för de boende.

alter table public.meetings add column if not exists protocol text
  check (char_length(protocol) <= 20000);

create or replace function public.reset_demo_all() returns void
language plpgsql security definer set search_path = public as $$
declare
  links jsonb;
begin
  select coalesce(jsonb_object_agg(id, user_id), '{}') into links
  from contractors
  where organization_id = '11111111-1111-1111-1111-111111111111' and user_id is not null;

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
  where organization_id = '11111111-1111-1111-1111-111111111111'
    and meeting_type = 'annual' and starts_at < now();

  perform reset_demo_profiles();
end; $$;
revoke all on function public.reset_demo_all() from public, anon, authenticated;
