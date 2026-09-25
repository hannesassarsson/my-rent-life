-- PUBLIC STATS
-- Nyckeltalen på startsidan räknas fram ur demoföreningen i stället för att
-- vara påhittade. Funktionen lämnar bara ut sammanräknade tal.
create or replace function public.public_demo_stats()
returns json language sql stable security definer set search_path = public as $$
  with org as (select '11111111-1111-1111-1111-111111111111'::uuid as id),
  latest as (
    select max(period) as period from payments where organization_id = (select id from org)
  )
  select json_build_object(
    'units', (select count(*) from units where organization_id = (select id from org)),
    'avg_resolution_days', (
      select round((avg(extract(epoch from (resolved_at - created_at))) / 86400)::numeric, 1)
      from maintenance_requests
      where organization_id = (select id from org) and resolved_at is not null
    ),
    'paid_share', (
      select round(100.0 * count(*) filter (where status = 'paid') / nullif(count(*), 0), 1)
      from payments
      where organization_id = (select id from org) and period = (select period from latest)
    )
  );
$$;
revoke all on function public.public_demo_stats() from public;
grant execute on function public.public_demo_stats() to anon, authenticated;
