-- ADDONS
-- Priset byggs av en plan plus valda tillägg (t.ex. Ekonomi, Digitala
-- nycklar). Tilläggen sparas på abonnemanget och styr vilka funktioner som
-- finns, precis som planen.

alter table public.subscriptions add column if not exists addons text[] not null default '{}';

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
    addons = case when _data ? 'addons'
      then array(select jsonb_array_elements_text(_data->'addons'))
      else s.addons end,
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
grant execute on function public.apply_billing(text, uuid, text, jsonb) to anon, authenticated;
