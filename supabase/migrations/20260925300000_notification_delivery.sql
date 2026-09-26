-- UTSKICK PÅ E-POST OCH SMS
-- Varje notis i appen läggs i en utkorg per kanal enligt mottagarens val.
-- Servern hämtar köade utskick med sin hemlighet (samma som för
-- abonnemangen), skickar dem via Resend (e-post) och 46elks (sms) och
-- rapporterar resultatet. Ingen inloggad användare kan skapa eller ändra
-- utskick direkt; de uppstår bara ur notiser.
--
-- Sms kostar pengar och är därför avstängt tills organisationen slår på det,
-- och används bara för sådant som rör den boende direkt (avier, ärenden,
-- meddelanden, lägenheten och nycklar). Nyheter och möten går bara som e-post.

alter table public.organizations
  add column if not exists sms_enabled boolean not null default false;

create table if not exists public.notification_prefs (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email_enabled boolean not null default true,
  sms_enabled boolean not null default false,
  updated_at timestamptz not null default now()
);
revoke all on public.notification_prefs from anon, authenticated;
grant select, insert, update on public.notification_prefs to authenticated;
grant all on public.notification_prefs to service_role;
alter table public.notification_prefs enable row level security;
drop policy if exists "own prefs" on public.notification_prefs;
create policy "own prefs" on public.notification_prefs for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create table if not exists public.notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  notification_id uuid not null references public.notifications(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  channel text not null check (channel in ('email', 'sms')),
  category text not null,
  recipient text not null,
  status text not null default 'pending'
    check (status in ('pending', 'sending', 'sent', 'failed', 'skipped')),
  attempts int not null default 0,
  next_attempt_at timestamptz not null default now(),
  claimed_at timestamptz,
  sent_at timestamptz,
  provider_id text,
  error text,
  created_at timestamptz not null default now()
);
create index if not exists notification_deliveries_queue_idx
  on public.notification_deliveries (next_attempt_at) where status in ('pending', 'sending');
create index if not exists notification_deliveries_org_idx
  on public.notification_deliveries (organization_id, created_at desc);
revoke all on public.notification_deliveries from anon, authenticated;
grant select on public.notification_deliveries to authenticated;
grant all on public.notification_deliveries to service_role;
alter table public.notification_deliveries enable row level security;
drop policy if exists "read deliveries" on public.notification_deliveries;
create policy "read deliveries" on public.notification_deliveries for select to authenticated
  using (user_id = auth.uid() or public.is_org_manager(auth.uid(), organization_id));

-- Rena hjälpfunktioner får en fast sökväg (Supabase-lintern).
alter function public.ocr_check_digit(text) set search_path = '';

-- Vad notisen gäller, utifrån vart den länkar.
create or replace function public.notification_category(_link text)
returns text language sql immutable set search_path = '' as $$
  select case
    when _link like '/app/ekonomi%' then 'economy'
    when _link like '/app/felanmalan%' then 'request'
    when _link like '/app/meddelanden%' then 'message'
    when _link like '/app/boende%' then 'home'
    when _link like '/app/nycklar%' then 'keys'
    when _link like '/app/moten%' then 'meeting'
    when _link like '/app/information%' then 'news'
    when _link like '/app/bokningar%' then 'booking'
    else 'other'
  end
$$;

create or replace function public.queue_notification_delivery() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  prefs record;
  addr text;
  phone text;
  cat text := public.notification_category(new.link);
  demo boolean;
  org_sms boolean;
begin
  select coalesce(p.email_enabled, true) as email_enabled, coalesce(p.sms_enabled, false) as sms_enabled
    into prefs
  from (select 1) x left join notification_prefs p on p.user_id = new.user_id;
  select coalesce(nullif(u.email, ''), pr.email), pr.phone into addr, phone
  from auth.users u left join profiles pr on pr.id = u.id
  where u.id = new.user_id;
  select coalesce(s.is_demo, false), o.sms_enabled into demo, org_sms
  from organizations o left join subscriptions s on s.organization_id = o.id
  where o.id = new.organization_id;

  if prefs.email_enabled and addr is not null then
    insert into notification_deliveries
      (notification_id, organization_id, user_id, channel, category, recipient, status, error)
    values (new.id, new.organization_id, new.user_id, 'email', cat, addr,
      case when demo then 'skipped' else 'pending' end,
      case when demo then 'Demoföreningen skickar inga riktiga utskick' end);
  end if;

  if prefs.sms_enabled and coalesce(org_sms, false) and nullif(phone, '') is not null
     and cat in ('economy', 'request', 'message', 'home', 'keys') then
    insert into notification_deliveries
      (notification_id, organization_id, user_id, channel, category, recipient, status, error)
    values (new.id, new.organization_id, new.user_id, 'sms', cat, phone,
      case when demo then 'skipped' else 'pending' end,
      case when demo then 'Demoföreningen skickar inga riktiga utskick' end);
  end if;
  return new;
end; $$;
revoke all on function public.queue_notification_delivery() from public, anon, authenticated;
drop trigger if exists queue_notification_delivery on public.notifications;
create trigger queue_notification_delivery after insert on public.notifications
for each row execute function public.queue_notification_delivery();

-- Serverns hemlighet (samma som för abonnemangen).
create or replace function private.server_secret_ok(_secret text)
returns boolean language sql stable security definer set search_path = private as $$
  select exists (
    select 1 from private.billing_secret
    where hash = encode(sha256(convert_to(coalesce(_secret, ''), 'UTF8')), 'hex')
  )
$$;
revoke all on function private.server_secret_ok(text) from public, anon, authenticated;

-- Hämtar köade utskick för de kanaler servern kan skicka med. Utskick som
-- blivit liggande (t.ex. för att kanalen inte var konfigurerad) skickas inte
-- i efterhand när de hunnit bli inaktuella.
create or replace function public.claim_notification_deliveries(
  _secret text, _channels text[], _limit int default 50
) returns table (
  id uuid, channel text, category text, recipient text, attempts int,
  title text, body text, link text, organization_name text
)
language plpgsql security definer set search_path = public as $$
begin
  if not private.server_secret_ok(_secret) then
    raise exception 'Behörighet saknas' using errcode = '42501';
  end if;

  update notification_deliveries d
  set status = 'skipped', error = 'Inaktuellt, skickades inte i tid'
  where d.status = 'pending' and d.created_at < now() - interval '24 hours';

  return query
  with picked as (
    select d.id from notification_deliveries d
    where d.channel = any(_channels)
      and d.created_at >= now() - interval '24 hours'
      and ((d.status = 'pending' and d.next_attempt_at <= now())
        or (d.status = 'sending' and d.claimed_at < now() - interval '10 minutes'))
    order by d.created_at
    limit greatest(1, least(coalesce(_limit, 50), 200))
    for update skip locked
  ), claimed as (
    update notification_deliveries d
    set status = 'sending', claimed_at = now(), attempts = d.attempts + 1
    from picked where d.id = picked.id
    returning d.*
  )
  select c.id, c.channel, c.category, c.recipient, c.attempts,
    n.title, n.body, n.link, o.name
  from claimed c
  join notifications n on n.id = c.notification_id
  join organizations o on o.id = c.organization_id;
end; $$;
revoke all on function public.claim_notification_deliveries(text, text[], int) from public;
grant execute on function public.claim_notification_deliveries(text, text[], int) to anon, authenticated;

-- Resultatet av ett utskick. Misslyckade försök görs om upp till tre gånger.
create or replace function public.finish_notification_delivery(
  _secret text, _id uuid, _ok boolean, _provider_id text default null, _error text default null,
  _retry boolean default true
) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not private.server_secret_ok(_secret) then
    raise exception 'Behörighet saknas' using errcode = '42501';
  end if;
  update notification_deliveries d set
    status = case
      when _ok then 'sent'
      when _retry and d.attempts < 3 then 'pending'
      else 'failed' end,
    sent_at = case when _ok then now() else d.sent_at end,
    provider_id = coalesce(_provider_id, d.provider_id),
    error = case when _ok then null else left(_error, 500) end,
    next_attempt_at = case when _ok then d.next_attempt_at
      else now() + d.attempts * interval '5 minutes' end
  where d.id = _id and d.status = 'sending';
end; $$;
revoke all on function public.finish_notification_delivery(text, uuid, boolean, text, text, boolean) from public;
grant execute on function public.finish_notification_delivery(text, uuid, boolean, text, text, boolean) to anon, authenticated;
