-- DEMO DOCUMENTS
-- Demodokumenten får riktiga filer (uppladdade som <org>/documents/demo-*).
-- Filerna kan inte tas bort via API:t, så att en besökare som raderar ett
-- dokument inte tar bort filen för alla; raden återskapas varje natt.

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
end; $$;
revoke all on function public.reset_demo_extras() from public, anon, authenticated;

do $$
begin
  if to_regclass('storage.objects') is null then
    return;
  end if;
  execute 'drop policy if exists "files delete" on storage.objects';
  execute $p$
    create policy "files delete" on storage.objects for delete to authenticated
    using (
      bucket_id = 'files'
      and public.is_org_staff(auth.uid(), ((storage.foldername(name))[1])::uuid)
      and name not like '%/documents/demo-%'
    )
  $p$;
end $$;
