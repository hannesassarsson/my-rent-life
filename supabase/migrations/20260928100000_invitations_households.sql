-- INBJUDNINGAR, HUSHÅLL OCH HISTORIK
-- 1. Föreningens kontaktuppgifter och välkomstmeddelande på organizations.
-- 2. Konsistens: ett boende måste höra till en lägenhet i samma förening
--    (radregeln kontrollerar bara radens organization_id).
-- 3. invitations: inbjudningslänkar per lägenhet. Bara en hash av länkens
--    token sparas; länken visas en gång när den skapas. En länk gäller en
--    gång, har ett utgångsdatum och kan återkallas.
-- 4. invitation_preview() och accept_invitation(): allt som rör en inbjudan
--    avgörs i databasen utifrån tokenen, aldrig utifrån ett lägenhets-id.
-- 5. audit_events: historik över boenden, inbjudningar och roller. Raderna
--    skrivs bara av triggrar, så de kan inte skrivas eller ändras via API:t.
--    Ändringar utan inloggad användare (nattlig återställning av demon)
--    loggas inte.
-- 6. my_household(): boende ser vilka som bor i den egna lägenheten.

-- 1. FÖRENINGEN -------------------------------------------------------------
alter table public.organizations
  add column if not exists contact_email text,
  add column if not exists contact_phone text,
  add column if not exists emergency_phone text,
  add column if not exists address text,
  add column if not exists about text,
  add column if not exists welcome_message text;

alter table public.organizations drop constraint if exists organizations_contact_lengths;
alter table public.organizations add constraint organizations_contact_lengths check (
  char_length(coalesce(contact_email, '')) <= 200
  and char_length(coalesce(contact_phone, '')) <= 40
  and char_length(coalesce(emergency_phone, '')) <= 40
  and char_length(coalesce(address, '')) <= 200
  and char_length(coalesce(about, '')) <= 4000
  and char_length(coalesce(welcome_message, '')) <= 4000
);

-- 2. KONSISTENS -------------------------------------------------------------
create or replace function public.check_residency_org() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not exists (
    select 1 from units where id = new.unit_id and organization_id = new.organization_id
  ) then
    raise exception 'Lägenheten hör inte till föreningen' using errcode = 'P0001';
  end if;
  return new;
end; $$;
revoke all on function public.check_residency_org() from public, anon, authenticated;

drop trigger if exists residency_org_check on public.residencies;
create trigger residency_org_check before insert or update of unit_id, organization_id
on public.residencies for each row execute function public.check_residency_org();

-- 3. INBJUDNINGAR -----------------------------------------------------------
create table if not exists public.invitations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  unit_id uuid not null references public.units(id) on delete cascade,
  residency_id uuid references public.residencies(id) on delete cascade,
  invitee_name text,
  invitee_email text,
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '14 days',
  sent_at timestamptz,
  accepted_at timestamptz,
  accepted_by uuid references auth.users(id) on delete set null,
  revoked_at timestamptz,
  check (char_length(coalesce(invitee_name, '')) <= 200),
  check (char_length(coalesce(invitee_email, '')) <= 200),
  check (expires_at <= created_at + interval '90 days')
);
create index if not exists invitations_unit_idx on public.invitations (unit_id);
create index if not exists invitations_org_idx on public.invitations (organization_id, created_at desc);

grant select, insert, update on public.invitations to authenticated;
grant all on public.invitations to service_role;
alter table public.invitations enable row level security;

drop policy if exists "managers read invitations" on public.invitations;
create policy "managers read invitations" on public.invitations for select to authenticated
using (public.is_org_manager(auth.uid(), organization_id));
drop policy if exists "managers create invitations" on public.invitations;
create policy "managers create invitations" on public.invitations for insert to authenticated
with check (
  public.is_org_manager(auth.uid(), organization_id)
  and created_by = auth.uid()
  and accepted_at is null and accepted_by is null and revoked_at is null
);
-- Förvaltningen får bara återkalla eller markera som skickad; att ta emot en
-- inbjudan sker i accept_invitation().
drop policy if exists "managers update invitations" on public.invitations;
create policy "managers update invitations" on public.invitations for update to authenticated
using (public.is_org_manager(auth.uid(), organization_id))
with check (public.is_org_manager(auth.uid(), organization_id));

create or replace function public.check_invitation() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    if not exists (
      select 1 from units where id = new.unit_id and organization_id = new.organization_id
    ) then
      raise exception 'Lägenheten hör inte till föreningen' using errcode = 'P0001';
    end if;
    if new.residency_id is not null and not exists (
      select 1 from residencies
      where id = new.residency_id and unit_id = new.unit_id and status = 'active' and user_id is null
    ) then
      raise exception 'Personen bor inte i lägenheten eller har redan ett konto' using errcode = 'P0001';
    end if;
    return new;
  end if;
  -- Uppdatering: bara återkallelse och utskickstid får ändras av förvaltningen.
  if current_setting('app.accepting_invitation', true) = 'on' then
    return new;
  end if;
  if new.organization_id <> old.organization_id or new.unit_id <> old.unit_id
     or new.residency_id is distinct from old.residency_id
     or new.token_hash <> old.token_hash or new.expires_at <> old.expires_at
     or new.accepted_at is distinct from old.accepted_at
     or new.accepted_by is distinct from old.accepted_by
     or new.created_by is distinct from old.created_by
     or new.invitee_name is distinct from old.invitee_name
     or new.invitee_email is distinct from old.invitee_email
     or (old.revoked_at is not null and new.revoked_at is distinct from old.revoked_at) then
    raise exception 'Inbjudan kan inte ändras' using errcode = 'P0001';
  end if;
  return new;
end; $$;
revoke all on function public.check_invitation() from public, anon, authenticated;

drop trigger if exists invitation_check on public.invitations;
create trigger invitation_check before insert or update on public.invitations
for each row execute function public.check_invitation();

-- 4. FUNKTIONER FÖR INBJUDNA -----------------------------------------------
create or replace function public.invitation_status(inv public.invitations) returns text
language sql stable as $$
  select case
    when inv.accepted_at is not null then 'used'
    when inv.revoked_at is not null then 'revoked'
    when inv.expires_at < now() then 'expired'
    else 'valid'
  end;
$$;

-- Vad länken gäller. Kan anropas utan inloggning; utan rätt token får man
-- bara veta att länken inte finns.
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
    'is_demo', exists (select 1 from subscriptions where organization_id = org.id and is_demo)
  );
end; $$;
revoke all on function public.invitation_preview(text) from public;
grant execute on function public.invitation_preview(text) to anon, authenticated;

-- Den inloggade användaren tar emot inbjudan: kontot kopplas till föreningen
-- och lägenheten och får rollen boende om det inte redan har en roll där.
create or replace function public.accept_invitation(_token text, _full_name text default null)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  inv invitations;
  org organizations;
  u units;
  prof profiles;
  existing residencies;
  name text;
  res_id uuid;
begin
  if uid is null then
    raise exception 'Du behöver vara inloggad' using errcode = '42501';
  end if;
  if char_length(coalesce(_full_name, '')) > 200 then
    raise exception 'Ogiltiga uppgifter' using errcode = 'P0001';
  end if;
  select * into inv from invitations
  where token_hash = encode(sha256(convert_to(coalesce(_token, ''), 'UTF8')), 'hex')
  for update;
  if not found then
    raise exception 'Inbjudan finns inte. Kontrollera länken.' using errcode = 'P0001';
  end if;
  case public.invitation_status(inv)
    when 'used' then raise exception 'Inbjudan har redan använts.' using errcode = 'P0001';
    when 'revoked' then raise exception 'Inbjudan har återkallats. Be styrelsen om en ny länk.' using errcode = 'P0001';
    when 'expired' then raise exception 'Inbjudan har gått ut. Be styrelsen om en ny länk.' using errcode = 'P0001';
    else null;
  end case;
  if exists (select 1 from subscriptions where organization_id = inv.organization_id and is_demo) then
    raise exception 'Det här är en demoförening. Inbjudan kan visas men inte användas.' using errcode = 'P0001';
  end if;

  select * into prof from profiles where id = uid;
  if prof.organization_id is not null and prof.organization_id <> inv.organization_id then
    raise exception 'Ditt konto hör redan till en annan förening. Använd en annan e-postadress.' using errcode = 'P0001';
  end if;
  select * into existing from residencies where user_id = uid and status = 'active' limit 1;
  if found and existing.unit_id <> inv.unit_id then
    raise exception 'Ditt konto är redan kopplat till en annan lägenhet. Kontakta styrelsen.' using errcode = 'P0001';
  end if;

  select * into org from organizations where id = inv.organization_id;
  select * into u from units where id = inv.unit_id;
  name := coalesce(nullif(trim(_full_name), ''), prof.full_name, inv.invitee_name, split_part(prof.email, '@', 1));

  -- Loggen ska visa den inbjudnas namn som utförare.
  update profiles set organization_id = inv.organization_id, full_name = name where id = uid;

  if not exists (select 1 from user_roles where user_id = uid and organization_id = inv.organization_id) then
    insert into user_roles (user_id, organization_id, role) values (uid, inv.organization_id, 'resident');
  end if;

  if existing.id is not null then
    res_id := existing.id;
  elsif inv.residency_id is not null then
    update residencies set user_id = uid, email = coalesce(email, prof.email)
    where id = inv.residency_id and user_id is null and status = 'active'
    returning id into res_id;
    if res_id is null then
      raise exception 'Inbjudan gäller inte längre. Be styrelsen om en ny länk.' using errcode = 'P0001';
    end if;
  else
    insert into residencies (organization_id, unit_id, user_id, resident_name, email, tenure,
                             move_in_date, status, is_primary)
    values (inv.organization_id, inv.unit_id, uid, name, prof.email, u.tenure, current_date, 'active',
            not exists (select 1 from residencies where unit_id = inv.unit_id and status = 'active'))
    returning id into res_id;
    update units set status = 'active' where id = inv.unit_id and status = 'vacant';
  end if;

  perform set_config('app.accepting_invitation', 'on', true);
  update invitations set accepted_at = now(), accepted_by = uid where id = inv.id;
  perform set_config('app.accepting_invitation', 'off', true);

  return jsonb_build_object(
    'organization_name', org.name,
    'address', u.address,
    'unit_number', u.unit_number,
    'resident_name', name,
    'welcome_message', org.welcome_message
  );
end; $$;
revoke all on function public.accept_invitation(text, text) from public, anon;
grant execute on function public.accept_invitation(text, text) to authenticated;

-- 5. HISTORIK ---------------------------------------------------------------
create table if not exists public.audit_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  actor_name text,
  action text not null,
  summary text not null,
  unit_id uuid references public.units(id) on delete set null,
  residency_id uuid references public.residencies(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists audit_events_org_idx on public.audit_events (organization_id, created_at desc);
create index if not exists audit_events_unit_idx on public.audit_events (unit_id, created_at desc);

grant select on public.audit_events to authenticated;
grant all on public.audit_events to service_role;
alter table public.audit_events enable row level security;
drop policy if exists "board reads audit" on public.audit_events;
create policy "board reads audit" on public.audit_events for select to authenticated
using (public.is_org_board(auth.uid(), organization_id));

create or replace function public.write_audit(
  _org uuid, _action text, _summary text, _unit uuid default null, _residency uuid default null
) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then
    return;
  end if;
  insert into audit_events (organization_id, actor_id, actor_name, action, summary, unit_id, residency_id)
  values (_org, auth.uid(),
          (select coalesce(full_name, email) from profiles where id = auth.uid()),
          _action, left(_summary, 500), _unit,
          case when exists (select 1 from residencies where id = _residency) then _residency end);
end; $$;
revoke all on function public.write_audit(uuid, text, text, uuid, uuid) from public, anon, authenticated;

create or replace function public.unit_label(_unit uuid) returns text
language sql stable security definer set search_path = public as $$
  select coalesce('lägenhet ' || unit_number || ', ' || address, 'okänd lägenhet') from units where id = _unit;
$$;
revoke all on function public.unit_label(uuid) from public, anon, authenticated;

create or replace function public.audit_residency() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    perform write_audit(new.organization_id, 'resident.added',
      new.resident_name || case when new.is_primary then ' flyttade in i ' else ' lades till som hushållsmedlem i ' end
        || unit_label(new.unit_id) || '.',
      new.unit_id, new.id);
  elsif tg_op = 'DELETE' then
    perform write_audit(old.organization_id, 'resident.deleted',
      old.resident_name || ' togs bort från ' || unit_label(old.unit_id) || '.', old.unit_id, null);
    return old;
  else
    if new.unit_id <> old.unit_id then
      perform write_audit(new.organization_id, 'resident.moved',
        new.resident_name || ' flyttades från ' || unit_label(old.unit_id) || ' till ' || unit_label(new.unit_id) || '.',
        new.unit_id, new.id);
    end if;
    if new.status <> old.status and new.status = 'moved_out' then
      perform write_audit(new.organization_id, 'resident.moved_out',
        new.resident_name || ' flyttade ut från ' || unit_label(new.unit_id) || '.', new.unit_id, new.id);
    end if;
    if new.is_primary and not old.is_primary and new.status = 'active' then
      perform write_audit(new.organization_id, 'resident.primary',
        new.resident_name || ' är nu primär boende i ' || unit_label(new.unit_id) || '.', new.unit_id, new.id);
    end if;
    if new.user_id is not null and old.user_id is null then
      perform write_audit(new.organization_id, 'resident.account',
        new.resident_name || ' kopplades till ett konto.', new.unit_id, new.id);
    end if;
    if new.resident_name <> old.resident_name
       or new.email is distinct from old.email or new.phone is distinct from old.phone then
      perform write_audit(new.organization_id, 'resident.updated',
        'Kontaktuppgifterna för ' || new.resident_name || ' ändrades.', new.unit_id, new.id);
    end if;
  end if;
  return new;
end; $$;
revoke all on function public.audit_residency() from public, anon, authenticated;
drop trigger if exists residency_audit on public.residencies;
create trigger residency_audit after insert or update or delete on public.residencies
for each row execute function public.audit_residency();

create or replace function public.audit_invitation() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  who text;
begin
  who := coalesce(new.invitee_name, (select resident_name from residencies where id = new.residency_id),
                  new.invitee_email, 'ny boende');
  if tg_op = 'INSERT' then
    perform write_audit(new.organization_id, 'invitation.created',
      'Inbjudan skapades för ' || who || ' till ' || unit_label(new.unit_id) || '.', new.unit_id, new.residency_id);
  elsif new.revoked_at is not null and old.revoked_at is null then
    perform write_audit(new.organization_id, 'invitation.revoked',
      'Inbjudan till ' || who || ' (' || unit_label(new.unit_id) || ') återkallades.', new.unit_id, new.residency_id);
  elsif new.accepted_at is not null and old.accepted_at is null then
    perform write_audit(new.organization_id, 'invitation.accepted',
      (select coalesce(full_name, email) from profiles where id = new.accepted_by)
        || ' tog emot inbjudan till ' || unit_label(new.unit_id) || '.', new.unit_id, new.residency_id);
  elsif new.sent_at is distinct from old.sent_at and new.sent_at is not null then
    perform write_audit(new.organization_id, 'invitation.sent',
      'Inbjudan till ' || who || ' skickades med e-post.', new.unit_id, new.residency_id);
  end if;
  return new;
end; $$;
revoke all on function public.audit_invitation() from public, anon, authenticated;
drop trigger if exists invitation_audit on public.invitations;
create trigger invitation_audit after insert or update on public.invitations
for each row execute function public.audit_invitation();

create or replace function public.audit_role() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  labels constant jsonb := '{"super_admin":"superadmin","org_admin":"administratör","property_manager":"förvaltare","board_member":"styrelseledamot","staff":"fastighetsskötare","contractor":"entreprenör","resident":"boende"}';
begin
  if new.organization_id is null or new.user_id = auth.uid() then
    return new;
  end if;
  perform write_audit(new.organization_id, 'role.changed',
    (select coalesce(full_name, email) from profiles where id = new.user_id)
      || ' fick rollen ' || (labels->>new.role::text) || '.');
  return new;
end; $$;
revoke all on function public.audit_role() from public, anon, authenticated;
drop trigger if exists role_audit on public.user_roles;
create trigger role_audit after insert on public.user_roles
for each row execute function public.audit_role();

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
  return new;
end; $$;
revoke all on function public.audit_organization() from public, anon, authenticated;
drop trigger if exists organization_audit on public.organizations;
create trigger organization_audit after update on public.organizations
for each row execute function public.audit_organization();

-- 6. HUSHÅLLET --------------------------------------------------------------
create or replace function public.my_household()
returns table (resident_name text, is_primary boolean, is_me boolean)
language sql stable security definer set search_path = public as $$
  select r.resident_name, r.is_primary, r.user_id is not distinct from auth.uid()
  from residencies r
  where r.status = 'active'
    and r.unit_id in (select public.my_unit_ids(auth.uid()))
  order by r.is_primary desc, r.resident_name;
$$;
revoke all on function public.my_household() from public, anon;
grant execute on function public.my_household() to authenticated;

-- DEMO ----------------------------------------------------------------------
-- Inbjudningar och historik som besökare skapar i demoföreningen rensas varje natt.
create or replace function public.reset_demo_invitations() returns void
language plpgsql security definer set search_path = public as $$
declare
  org constant uuid := '11111111-1111-1111-1111-111111111111';
begin
  delete from invitations where organization_id = org;
  delete from audit_events where organization_id = org;
end; $$;
revoke all on function public.reset_demo_invitations() from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'reset-demo-invitations';
    perform cron.schedule('reset-demo-invitations', '5 3 * * *', 'select public.reset_demo_invitations()');
  end if;
end $$;

-- Demoföreningens kontaktuppgifter och välkomstmeddelande (påhittade).
update public.organizations set
  contact_email = coalesce(contact_email, 'styrelsen@brfsolrosen.example'),
  contact_phone = coalesce(contact_phone, '08-123 456 70'),
  emergency_phone = coalesce(emergency_phone, '020-12 34 56'),
  about = coalesce(about, 'Styrelsen har mottagning första tisdagen varje månad kl. 18–19 i föreningslokalen.'),
  welcome_message = coalesce(welcome_message, 'Vi hoppas att du ska trivas i {föreningsnamn}! Har du frågor är du välkommen att skriva till styrelsen här i appen.')
where id = '11111111-1111-1111-1111-111111111111';
