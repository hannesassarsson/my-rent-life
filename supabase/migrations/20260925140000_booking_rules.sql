-- BOOKING RULES
-- Resursens regler (öppettider, passlängd, hur långt fram man får boka,
-- max aktiva bokningar och avbokningsgräns) kontrolleras i databasen så att
-- de gäller oavsett om bokningen görs via appen eller direkt mot API:t.
-- Personal (is_org_staff) och service role (auth.uid() is null) undantas.
-- Tider tolkas i svensk tid. open_to 23:59 betyder "till midnatt".

create or replace function public.enforce_booking_rules() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  res public.resources%rowtype;
  local_start timestamp;
  local_end timestamp;
  day_close timestamp;
  active_count int;
begin
  if auth.uid() is null or public.is_org_staff(auth.uid(), new.organization_id) then
    return new;
  end if;

  select * into res from public.resources where id = new.resource_id;
  if not found or res.organization_id <> new.organization_id then
    raise exception 'Resursen finns inte' using errcode = 'P0001';
  end if;
  if not res.is_active then
    raise exception '% går inte att boka just nu', res.name using errcode = 'P0001';
  end if;

  if new.starts_at < now() then
    raise exception 'Tiden har redan passerat' using errcode = 'P0001';
  end if;
  if new.starts_at > now() + make_interval(days => res.days_ahead) then
    raise exception '% kan bokas högst % dagar i förväg', res.name, res.days_ahead
      using errcode = 'P0001';
  end if;
  if new.ends_at - new.starts_at <> make_interval(mins => res.slot_minutes) then
    raise exception 'Ett pass för % är % minuter', res.name, res.slot_minutes
      using errcode = 'P0001';
  end if;

  local_start := new.starts_at at time zone 'Europe/Stockholm';
  local_end := new.ends_at at time zone 'Europe/Stockholm';
  day_close := case when res.open_to >= time '23:59'
    then local_start::date + interval '1 day'
    else local_start::date + res.open_to end;
  if local_start::time < res.open_from or local_end > day_close then
    raise exception '% är öppen %–%', res.name,
      to_char(res.open_from, 'HH24:MI'), to_char(res.open_to, 'HH24:MI')
      using errcode = 'P0001';
  end if;

  -- Lås per användare och resurs så att två samtidiga bokningar inte kan
  -- passera maxgränsen.
  perform pg_advisory_xact_lock(hashtext(coalesce(new.user_id::text, '') || new.resource_id::text));
  select count(*) into active_count from public.bookings
    where user_id = new.user_id and resource_id = new.resource_id and ends_at > now();
  if active_count >= res.max_active_bookings then
    raise exception 'Du har redan % aktiva bokningar för %', res.max_active_bookings, res.name
      using errcode = 'P0001';
  end if;

  return new;
end; $$;

create or replace function public.enforce_booking_cancel() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  res public.resources%rowtype;
begin
  if auth.uid() is null or public.is_org_staff(auth.uid(), old.organization_id) then
    return old;
  end if;
  select * into res from public.resources where id = old.resource_id;
  if found and old.starts_at - now() < make_interval(hours => res.cancel_hours) then
    raise exception '% kan avbokas senast % timmar innan', res.name, res.cancel_hours
      using errcode = 'P0001';
  end if;
  return old;
end; $$;

revoke all on function public.enforce_booking_rules() from public, anon, authenticated;
revoke all on function public.enforce_booking_cancel() from public, anon, authenticated;

drop trigger if exists enforce_booking_rules on public.bookings;
create trigger enforce_booking_rules before insert on public.bookings
for each row execute function public.enforce_booking_rules();

drop trigger if exists enforce_booking_cancel on public.bookings;
create trigger enforce_booking_cancel before delete on public.bookings
for each row execute function public.enforce_booking_cancel();

-- Uppdateringar av bokningar (t.ex. flytt av tid) görs bara av personal.
drop policy if exists "update own bookings" on public.bookings;
create policy "update own bookings" on public.bookings for update to authenticated
using (public.is_org_staff(auth.uid(), organization_id))
with check (public.is_org_staff(auth.uid(), organization_id));
