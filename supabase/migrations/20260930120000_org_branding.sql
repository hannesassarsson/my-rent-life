-- EGET VARUMÄRKE
-- En förening, hyresvärd eller förvaltare kan visa appen under sitt eget
-- varumärke: med sin logga eller sitt namn som text, och i sin egen färg.
--
--   brand_mode   'platform'  Boendeplattformens logga och färger (standard)
--                'logo'      egen logga (brand_logo_path i bucketen branding)
--                'text'      eget namn som ordmärke (brand_name)
--   brand_color  huvudfärg som #rrggbb; appen justerar nyansen så att texten
--                på knappar och länkar alltid blir lätt att läsa.
--
-- Loggorna ligger i den publika bucketen "branding" under <org_id>/. De är
-- inte hemliga (de visas även på inbjudningssidan), men bara föreningens
-- administratör kan ladda upp, byta eller ta bort dem.

alter table public.organizations
  add column if not exists brand_mode text not null default 'platform',
  add column if not exists brand_name text,
  add column if not exists brand_logo_path text,
  add column if not exists brand_color text;

alter table public.organizations drop constraint if exists organizations_brand_check;
alter table public.organizations add constraint organizations_brand_check check (
  brand_mode in ('platform', 'logo', 'text')
  and char_length(coalesce(brand_name, '')) <= 60
  and (brand_color is null or brand_color ~ '^#[0-9a-f]{6}$')
  and (brand_logo_path is null or brand_logo_path like id::text || '/%')
  and (brand_mode <> 'logo' or brand_logo_path is not null)
  and (brand_mode <> 'text' or char_length(trim(coalesce(brand_name, ''))) > 0)
);

-- Historiken visar när varumärket ändrades.
create or replace function public.audit_organization() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (new.name, new.org_type, new.contact_email, new.contact_phone, new.emergency_phone, new.address, new.about)
     is distinct from
     (old.name, old.org_type, old.contact_email, old.contact_phone, old.emergency_phone, old.address, old.about) then
    perform write_audit(new.id, 'organization.updated', 'Föreningens uppgifter ändrades.');
  end if;
  if new.welcome_message is distinct from old.welcome_message then
    perform write_audit(new.id, 'organization.welcome', 'Välkomstmeddelandet ändrades.');
  end if;
  if (new.brand_mode, new.brand_name, new.brand_logo_path, new.brand_color)
     is distinct from (old.brand_mode, old.brand_name, old.brand_logo_path, old.brand_color) then
    perform write_audit(new.id, 'organization.brand', 'Föreningens logga eller färger ändrades.');
  end if;
  return new;
end; $$;
revoke all on function public.audit_organization() from public, anon, authenticated;

-- Inbjudningssidan visas i föreningens varumärke.
create or replace function public.invitation_preview(_token text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  inv invitations;
  org organizations;
  u units;
begin
  if _token is null or char_length(_token) not between 20 and 200 then
    return jsonb_build_object('status', 'not_found');
  end if;
  select * into inv from invitations
  where token_hash = encode(sha256(convert_to(_token, 'UTF8')), 'hex');
  if not found then
    return jsonb_build_object('status', 'not_found');
  end if;
  select * into org from organizations where id = inv.organization_id;
  select * into u from units where id = inv.unit_id;
  return jsonb_build_object(
    'status', public.invitation_status(inv),
    'organization_name', org.name,
    'organization_type', org.org_type,
    'address', u.address,
    'unit_number', u.unit_number,
    'invitee_name', coalesce(inv.invitee_name,
      (select resident_name from residencies where id = inv.residency_id)),
    'invitee_email', coalesce(inv.invitee_email,
      (select email from residencies where id = inv.residency_id)),
    'expires_at', inv.expires_at,
    'is_demo', exists (select 1 from subscriptions where organization_id = org.id and is_demo),
    'brand', jsonb_build_object(
      'mode', org.brand_mode,
      'name', org.brand_name,
      'logo_path', org.brand_logo_path,
      'color', org.brand_color
    )
  );
end; $$;
revoke all on function public.invitation_preview(text) from public;
grant execute on function public.invitation_preview(text) to anon, authenticated;

-- LAGRING ---------------------------------------------------------------------
do $$
begin
  if to_regclass('storage.objects') is null then
    return;
  end if;

  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('branding', 'branding', true, 1048576, array['image/png', 'image/jpeg', 'image/webp'])
  on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

  execute 'drop policy if exists "branding admin read" on storage.objects';
  execute $p$
    create policy "branding admin read" on storage.objects for select to authenticated
    using (
      bucket_id = 'branding'
      and public.has_org_role(auth.uid(), ((storage.foldername(name))[1])::uuid,
        array['org_admin']::public.app_role[])
    )
  $p$;

  execute 'drop policy if exists "branding admin upload" on storage.objects';
  execute $p$
    create policy "branding admin upload" on storage.objects for insert to authenticated
    with check (
      bucket_id = 'branding'
      and public.has_org_role(auth.uid(), ((storage.foldername(name))[1])::uuid,
        array['org_admin']::public.app_role[])
    )
  $p$;

  execute 'drop policy if exists "branding admin delete" on storage.objects';
  execute $p$
    create policy "branding admin delete" on storage.objects for delete to authenticated
    using (
      bucket_id = 'branding'
      and public.has_org_role(auth.uid(), ((storage.foldername(name))[1])::uuid,
        array['org_admin']::public.app_role[])
    )
  $p$;
end $$;

-- DEMO ------------------------------------------------------------------------
-- Demoföreningen visas som en förening under Riksbyggen, i Riksbyggens röda
-- färg och med namnet som text (ingen logga). Besökares ändringar återställs
-- varje natt.
create or replace function public.reset_demo_branding() returns void
language plpgsql security definer set search_path = public as $$
begin
  update organizations set
    brand_mode = 'text',
    brand_name = 'Riksbyggen',
    brand_logo_path = null,
    brand_color = '#d51c29'
  where id = '11111111-1111-1111-1111-111111111111';
end; $$;
revoke all on function public.reset_demo_branding() from public, anon, authenticated;

select public.reset_demo_branding();

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'reset-demo-branding';
    perform cron.schedule('reset-demo-branding', '6 3 * * *', 'select public.reset_demo_branding()');
  end if;
end $$;
