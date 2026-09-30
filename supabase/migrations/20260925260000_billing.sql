-- BILLING
-- Abonnemang per organisation. Raden skrivs bara av servern efter att den
-- har frågat Stripe (via apply_billing med en hemlighet som bara servern
-- känner till); användare kan läsa men aldrig ändra plan eller status.

create table if not exists public.subscriptions (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  plan text not null default 'standard' check (plan in ('bas', 'standard', 'forvaltning')),
  status text not null default 'trialing'
    check (status in ('trialing', 'active', 'past_due', 'canceled', 'unpaid', 'incomplete', 'incomplete_expired', 'paused')),
  billing_interval text check (billing_interval in ('month', 'year')),
  trial_ends_at timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  past_due_since timestamptz,
  units_billed int,
  stripe_mode text check (stripe_mode in ('test', 'live')),
  stripe_customer_id text,
  stripe_subscription_id text,
  -- Kunder som betalar mot faktura utanför Stripe.
  invoice_billing boolean not null default false,
  is_demo boolean not null default false,
  synced_at timestamptz,
  updated_at timestamptz not null default now()
);
create index if not exists subscriptions_customer_idx on public.subscriptions (stripe_customer_id);

alter table public.subscriptions enable row level security;
revoke all on public.subscriptions from anon, authenticated;
grant select on public.subscriptions to authenticated;
grant all on public.subscriptions to service_role;
drop policy if exists "members read subscription" on public.subscriptions;
create policy "members read subscription" on public.subscriptions for select to authenticated
using (public.is_org_member(auth.uid(), organization_id));

-- Nya organisationer får 30 dagars provperiod på Standard.
create or replace function public.create_trial_subscription() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into subscriptions (organization_id, plan, status, trial_ends_at)
  values (new.id, 'standard', 'trialing', now() + interval '30 days')
  on conflict (organization_id) do nothing;
  return new;
end; $$;
drop trigger if exists create_trial_subscription on public.organizations;
create trigger create_trial_subscription after insert on public.organizations
for each row execute function public.create_trial_subscription();

insert into public.subscriptions (organization_id, plan, status, trial_ends_at)
select id, 'standard', 'trialing', now() + interval '30 days' from public.organizations
on conflict (organization_id) do nothing;

-- Demoföreningen visar allt och spärras aldrig.
insert into public.subscriptions (organization_id, plan, status, is_demo)
select id, 'forvaltning', 'active', true from public.organizations
where id = '11111111-1111-1111-1111-111111111111'
on conflict (organization_id) do update
  set plan = 'forvaltning', status = 'active', is_demo = true, trial_ends_at = null;

-- Hemligheten som servern visar upp. Bara dess SHA-256 lagras, i ett schema
-- som API:t inte når.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
create table if not exists private.billing_secret (hash text primary key);

create or replace function public.apply_billing(
  _secret text,
  _organization_id uuid,
  _stripe_customer_id text,
  _data jsonb
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  org uuid := _organization_id;
begin
  if not exists (
    select 1 from private.billing_secret
    where hash = encode(sha256(convert_to(coalesce(_secret, ''), 'UTF8')), 'hex')
  ) then
    raise exception 'Behörighet saknas' using errcode = '42501';
  end if;

  if org is null and _stripe_customer_id is not null then
    select organization_id into org from subscriptions where stripe_customer_id = _stripe_customer_id;
  end if;
  if org is null or not exists (select 1 from organizations where id = org) then
    return null;
  end if;

  insert into subscriptions (organization_id) values (org) on conflict (organization_id) do nothing;
  update subscriptions s set
    plan = coalesce(_data->>'plan', s.plan),
    status = coalesce(_data->>'status', s.status),
    billing_interval = coalesce(_data->>'billing_interval', s.billing_interval),
    trial_ends_at = case when _data ? 'trial_ends_at' then (_data->>'trial_ends_at')::timestamptz else s.trial_ends_at end,
    current_period_end = case when _data ? 'current_period_end' then (_data->>'current_period_end')::timestamptz else s.current_period_end end,
    cancel_at_period_end = coalesce((_data->>'cancel_at_period_end')::boolean, s.cancel_at_period_end),
    units_billed = coalesce((_data->>'units_billed')::int, s.units_billed),
    stripe_mode = coalesce(_data->>'stripe_mode', s.stripe_mode),
    stripe_customer_id = coalesce(_data->>'stripe_customer_id', _stripe_customer_id, s.stripe_customer_id),
    stripe_subscription_id = case when _data ? 'stripe_subscription_id' then _data->>'stripe_subscription_id' else s.stripe_subscription_id end,
    -- Fristen räknas från första misslyckade betalningen.
    past_due_since = case
      when coalesce(_data->>'status', s.status) = 'past_due' then coalesce(s.past_due_since, now())
      else null end,
    synced_at = now(),
    updated_at = now()
  where s.organization_id = org and not s.is_demo;
  return org;
end; $$;
revoke all on function public.apply_billing(text, uuid, text, jsonb) from public;
-- Anropas av servern med den publika nyckeln (även från Stripes webhook,
-- där ingen användare är inloggad); hemligheten är skyddet.
grant execute on function public.apply_billing(text, uuid, text, jsonb) to anon, authenticated;
