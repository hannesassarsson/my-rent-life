-- BANKID
-- Ett konto kan kopplas till ett personnummer. Personnumret sparas aldrig i
-- klartext: servern skickar en HMAC av det (nyckeln finns bara på servern)
-- och en maskerad variant som visas för användaren (••••••••-1234).
-- Tabellen ligger i schemat private som API:t inte når; allt går via
-- funktioner. Inloggning och koppling kräver serverns hemlighet, eftersom
-- bara servern har kontrollerat BankID-legitimationen.

create table if not exists private.bankid_identities (
  pnr_hash text primary key,
  user_id uuid not null unique references auth.users(id) on delete cascade,
  hint text not null,
  linked_at timestamptz not null default now(),
  last_login_at timestamptz
);

-- Kopplar ett personnummer till ett konto. Med _organization_id (när en
-- administratör anger personnumret) måste kontot vara en boendes i
-- organisationen.
-- Svarar 'linked', 'taken' (personnumret hör till ett annat konto) eller
-- 'demo' (demokonton delas av alla och kan inte kopplas).
create or replace function public.link_bankid(
  _secret text, _user_id uuid, _pnr_hash text, _hint text, _organization_id uuid default null
) returns text
language plpgsql security definer set search_path = public as $$
declare
  owner uuid;
  org uuid;
begin
  if not private.server_secret_ok(_secret) then
    raise exception 'Behörighet saknas' using errcode = '42501';
  end if;
  if _pnr_hash !~ '^[0-9a-f]{64}$' or char_length(coalesce(_hint, '')) not between 4 and 20 then
    raise exception 'Ogiltiga uppgifter' using errcode = 'P0001';
  end if;
  select organization_id into org from profiles where id = _user_id;
  if not found or (_organization_id is not null and org is distinct from _organization_id) then
    raise exception 'Kontot hittades inte' using errcode = 'P0001';
  end if;
  if exists (select 1 from subscriptions where organization_id = org and is_demo) then
    return 'demo';
  end if;
  -- Förvaltningen kopplar bara boendes konton. Personal kopplar själva, så
  -- att ingen kan ge sig själv inloggning till en kollegas konto.
  if _organization_id is not null and exists (
    select 1 from user_roles where user_id = _user_id and role <> 'resident'
  ) then
    raise exception 'Personal kopplar BankID själva under Min profil' using errcode = 'P0001';
  end if;
  select user_id into owner from private.bankid_identities where pnr_hash = _pnr_hash;
  if owner is not null and owner <> _user_id then
    return 'taken';
  end if;
  delete from private.bankid_identities where user_id = _user_id and pnr_hash <> _pnr_hash;
  insert into private.bankid_identities (pnr_hash, user_id, hint)
  values (_pnr_hash, _user_id, _hint)
  on conflict (pnr_hash) do update set hint = excluded.hint;
  return 'linked';
end; $$;
revoke all on function public.link_bankid(text, uuid, text, text, uuid) from public;
grant execute on function public.link_bankid(text, uuid, text, text, uuid) to anon, authenticated;

-- Kontot som hör till ett personnummer, vid inloggning med BankID.
create or replace function public.bankid_login(_secret text, _pnr_hash text)
returns table (user_id uuid, email text)
language plpgsql security definer set search_path = public as $$
begin
  if not private.server_secret_ok(_secret) then
    raise exception 'Behörighet saknas' using errcode = '42501';
  end if;
  return query
  with hit as (
    update private.bankid_identities b set last_login_at = now()
    from auth.users u
    where b.pnr_hash = _pnr_hash and u.id = b.user_id
    returning b.user_id as uid, u.email::text as mail
  )
  select hit.uid, hit.mail from hit;
end; $$;
revoke all on function public.bankid_login(text, text) from public;
grant execute on function public.bankid_login(text, text) to anon, authenticated;

-- Den inloggades koppling.
create or replace function public.my_bankid() returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select jsonb_build_object('linked', true, 'hint', hint, 'linked_at', linked_at,
       'last_login_at', last_login_at)
     from private.bankid_identities where user_id = auth.uid()),
    jsonb_build_object('linked', false))
$$;
revoke all on function public.my_bankid() from public, anon;
grant execute on function public.my_bankid() to authenticated;

create or replace function public.unlink_my_bankid() returns void
language sql security definer set search_path = public as $$
  delete from private.bankid_identities where user_id = auth.uid();
$$;
revoke all on function public.unlink_my_bankid() from public, anon;
grant execute on function public.unlink_my_bankid() to authenticated;

-- Vilka konton i organisationen som har BankID, för förvaltningen.
create or replace function public.org_bankid_links(_user_ids uuid[])
returns table (user_id uuid, hint text, linked_at timestamptz, last_login_at timestamptz)
language sql stable security definer set search_path = public as $$
  select b.user_id, b.hint, b.linked_at, b.last_login_at
  from private.bankid_identities b
  join profiles p on p.id = b.user_id
  where b.user_id = any(_user_ids)
    and public.is_org_operations(auth.uid(), p.organization_id)
$$;
revoke all on function public.org_bankid_links(uuid[]) from public, anon;
grant execute on function public.org_bankid_links(uuid[]) to authenticated;

-- Förvaltningen tar bort en koppling (t.ex. vid utflytt).
create or replace function public.unlink_member_bankid(_user_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not exists (
    select 1 from profiles p where p.id = _user_id
      and public.is_org_manager(auth.uid(), p.organization_id)
  ) then
    raise exception 'Behörighet saknas' using errcode = 'P0001';
  end if;
  delete from private.bankid_identities where user_id = _user_id;
end; $$;
revoke all on function public.unlink_member_bankid(uuid) from public, anon;
grant execute on function public.unlink_member_bankid(uuid) to authenticated;
